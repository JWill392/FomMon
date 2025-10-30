using System.Diagnostics;

namespace FomMon.MigrationService;

public static class OsmInitializerExtensions
{
    public static IHostApplicationBuilder AddOsmInitializer(this IHostApplicationBuilder builder)
    {
        builder.Services.AddSingleton<OsmInitializer>();
        builder.Services.AddOpenTelemetry()
            .WithTracing(tracing => tracing.AddSource(OsmInitializer.ActivitySourceName));
        return builder;
    }
}

public class OsmInitializer(ILogger<OsmInitializer> logger)
{
    public const string ActivitySourceName = "OsmInitializer";
    private static readonly ActivitySource ActivitySource = new(ActivitySourceName);
    
    public async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var activity = ActivitySource.StartActivity();
        logger.LogInformation("Starting OSM initialization");
        // TODO
        // throw new NotImplementedException();
    }
}