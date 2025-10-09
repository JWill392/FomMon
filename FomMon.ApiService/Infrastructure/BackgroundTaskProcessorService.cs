using System.Diagnostics;
using FomMon.ServiceDefaults;

namespace FomMon.ApiService.Infrastructure;


/// <summary>
/// Placeholder background task processing until we switch to an established job library.
/// // TODO replace with real job queue library like Hangfire or Quartz
/// </summary>
/// <param name="taskQueue"></param>
/// <param name="logger"></param>
/// <param name="serviceProvider"></param>
/// <param name="clock"></param>
public sealed class BackgroundTaskProcessorService(
    IBackgroundTaskQueue taskQueue,
    ILogger<BackgroundTaskProcessorService> logger,
    IServiceProvider serviceProvider, 
    IClockService clock) : BackgroundService

{
    public const string ActivitySourceName = "BackgroundTaskProcessorService";
    private static readonly ActivitySource ActivitySource = new(ActivitySourceName);


    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {

        while (!stoppingToken.IsCancellationRequested)
        {
            var work = await taskQueue.DequeueWorkAsync(stoppingToken);
            try
            {
                using var activity = ActivitySource.StartActivity(ActivityKind.Client, name: work.Name); // TODO name of task
                activity?.SetTag("work-type", work.Name);
                
                using var scope = serviceProvider.CreateScope();

                logger.LogInformation("Work item {name} starting at: {time}", work.Name, clock.Now);
                await work.execute(scope.ServiceProvider, stoppingToken);
            } 
            catch (Exception ex)
            {
                logger.LogError(ex, "Error processing work item");
            }
        }

    }
}
