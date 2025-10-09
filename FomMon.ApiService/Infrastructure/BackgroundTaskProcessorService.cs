using System.Diagnostics;
using FomMon.ServiceDefaults;

namespace FomMon.ApiService.Infrastructure;


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
                using var activity = ActivitySource.StartActivity($"Processing task", ActivityKind.Client); // TODO name of task
                using var scope = serviceProvider.CreateScope();

                logger.LogInformation("Work item starting at: {time}", clock.Now);
                await work(scope.ServiceProvider, stoppingToken);
            } 
            catch (Exception ex)
            {
                logger.LogError(ex, "Error processing work item");
            }
        }

    }
}
