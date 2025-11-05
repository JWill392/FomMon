using FluentResults;
using Hangfire;

namespace FomMon.ApiService.Infrastructure;



public interface IScript<TStep>
    where TStep : Enum
{
    List<TStep> GetOrder();
    Func<CancellationToken, Task<Result>> GetStepAction(TStep state);
}

public interface IScriptState<TStep> where TStep : Enum
{
    Task<TStep> GetStepCompletedAsync(CancellationToken c = default);
    Task SetStepCompletedAsync(TStep state, CancellationToken c = default);
}

public interface IScriptRunner<in TStep> where TStep : Enum
{
    Task AddJobsAsync(CancellationToken c = default);
    Task RunStepAsync(TStep step, CancellationToken c = default);
}

public class BackgroundJobScriptRunner<TScriptState>(
    ILogger<BackgroundJobScriptRunner<TScriptState>> logger,
    IScript<TScriptState> script,
    IBackgroundJobClient jobClient,
    IScriptState<TScriptState> scriptState) : IScriptRunner<TScriptState> where TScriptState : Enum

{
    
    public async Task AddJobsAsync(CancellationToken c = default)
    {
        var stepsToRun = await GetStepsToRun(c);

        string? parentJobId = null;
        foreach (var step in stepsToRun)
        {
            parentJobId = parentJobId is null ? 
                jobClient.Enqueue<BackgroundJobScriptRunner<TScriptState>>(x => x.RunStepAsync(step, CancellationToken.None)) 
                : jobClient.ContinueJobWith<BackgroundJobScriptRunner<TScriptState>>(parentJobId, x => x.RunStepAsync(step, CancellationToken.None));
        }
    }

    private async Task<List<TScriptState>> GetStepsToRun(CancellationToken c = default)
    {
        var curStep = await scriptState.GetStepCompletedAsync(c);
        var allSteps = script.GetOrder();

        var skipTo = allSteps.IndexOf(curStep) + 1;
        if (skipTo == allSteps.Count) return [];
        
        return allSteps[skipTo..];
    }

    public async Task RunStepAsync(TScriptState step, CancellationToken c = default)
    {
        logger.LogInformation("Running step {State}", step);
        var stepAction = script.GetStepAction(step);
        
        var result = await stepAction.Invoke(c);
        if (!result.IsSuccess)
        {
            throw new Exception($"Failed to run step {step}, {result.Errors[0].Message}");
        }
        logger.LogInformation("Step {State} completed", step);
        await scriptState.SetStepCompletedAsync(step, c);
        
        // TODO cleanup
    }
}