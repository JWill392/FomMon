using Hangfire;
using Hangfire.Client;
using Hangfire.States;
using Hangfire.Storage;

namespace FomMon.MigrationService;



public class StopApplicationOnCompletionFilter(IHostApplicationLifetime lifetime, 
    ILogger<StopApplicationOnCompletionFilter> logger) : IClientFilter, IApplyStateFilter
{
    private int _runningJobs = 0;
    
    public void OnCreating(CreatingContext context)
    {
        // pass
    }

    public void OnCreated(CreatedContext context)
    {
        Interlocked.Increment(ref _runningJobs);
        LogJobState(LogLevel.Debug, context.BackgroundJob, "created");
    }
    
    public void OnStateApplied(ApplyStateContext context, IWriteOnlyTransaction transaction)
    {
        switch (context.NewState)
        {
            case SucceededState state:
                var jobCount = Interlocked.Decrement(ref _runningJobs);
                LogJobState(LogLevel.Debug, context.BackgroundJob, "succeeded");
            
                if (jobCount == 0)
                {
                    logger.LogInformation("All jobs succeeded; stopping application.");
                    lifetime.StopApplication();
                }
                break;
            
            case FailedState state:
                LogJobState(LogLevel.Critical, context.BackgroundJob, "failed");
                lifetime.StopApplication();
                break;
            
            case EnqueuedState state when context.OldStateName == DeletedState.StateName:
                Interlocked.Increment(ref _runningJobs);
                LogJobState(LogLevel.Debug, context.BackgroundJob, "requeued");
                
                break;
        }
        
    }

    private void LogJobState(LogLevel level, BackgroundJob job, string stateName)
    {
        logger.Log(level, "Job {JobName} {stateName}, id:{JobId}. Remaining: {jobCount}", 
            job.Job.Method.DeclaringType, stateName, job.Id, _runningJobs);
    }

    public void OnStateUnapplied(ApplyStateContext context, IWriteOnlyTransaction transaction)
    {
        // pass
    }

}