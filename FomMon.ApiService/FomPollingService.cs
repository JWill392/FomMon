using Microsoft.Extensions.Options;

namespace FomMon.ApiService;

public class FomPollingServiceSettings
{
    public TimeSpan PollingInterval { get; set; }
}

public static class FomPollingServiceExtensions
{
    public static IServiceCollection AddFomPollingService(this IServiceCollection services,
        Action<FomPollingServiceSettings>? configure = null)
    {
        services.AddOptions<FomPollingServiceSettings>()
            .BindConfiguration("FomPollingService") 
            .PostConfigure(configure ?? (_ => { }))
            .Validate(s => s.PollingInterval > TimeSpan.Zero, "PollingInterval must be > 0")
            .ValidateDataAnnotations();
        
        services.AddHostedService<FomPollingService>();
        return services;
    }
}

public class FomPollingService(
    IOptions<FomPollingServiceSettings> opt,
    IBackgroundTaskQueue taskQueue,
    ILogger<FomPollingService> logger) : BackgroundService
{
    private readonly FomPollingServiceSettings _settings = opt.Value;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await taskQueue.QueueWorkAsync((s, c) =>
                    s.GetRequiredService<IFomDownloader>().GetProjects(c));

                await Task.Delay(_settings.PollingInterval, stoppingToken);
            }
            catch (TaskCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                logger.LogInformation("FOM polling service stopping.");
                break;
            }
            catch (Exception e)
            {
                logger.LogError(e, "Error occurred while queuing FOM project download task.");
            }
        }
    }
}

