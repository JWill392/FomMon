using System.Diagnostics;
using Microsoft.EntityFrameworkCore;
using FomMon.Data.Contexts;
using FomMon.MigrationService.Seeding;

namespace FomMon.MigrationService;

public static class MigrationWorkerExtensions
{
    public static IHostApplicationBuilder AddMigrationWorker(this IHostApplicationBuilder builder)
    {
        builder.Services.AddSingleton<MigrationWorker>();
        builder.Services.AddOpenTelemetry()
            .WithTracing(tracing => tracing.AddSource(MigrationWorker.ActivitySourceName));
        
        return builder;
    }
}

public class MigrationWorker(
    IServiceProvider serviceProvider,
    ILogger<MigrationWorker> logger)
{
    public const string ActivitySourceName = nameof(MigrationWorker);
    private static readonly ActivitySource ActivitySource = new(ActivitySourceName);
    
    
    public async Task ExecuteAsync(CancellationToken cancellationToken)
    {
        using var activity = ActivitySource.StartActivity();

        try
        {
            // migrations
            using (var scope = serviceProvider.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

                await RunMigrationAsync(db, cancellationToken);
            }

            // data seeding
            // separate transaction for seeding to allow rollback if failed
            using (var scope = serviceProvider.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

                await EnsureDevSeededAsync(db, cancellationToken);
            }

        }
        catch (Exception ex)
        {
            activity?.AddException(ex);
            logger.LogCritical(ex, "Error occurred while migrating database");
            throw;
        }
        
    }

    private static async Task RunMigrationAsync(AppDbContext db, CancellationToken c)
    {
        var strategy = db.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () =>
        {
            // Run migration in a transaction to avoid partial migration if it fails.
            await db.Database.MigrateAsync(c);
        });
    }
    
    private async Task EnsureDevSeededAsync(AppDbContext db, CancellationToken c)
    {
        var env = serviceProvider.GetRequiredService<IHostEnvironment>();
        if (!env.IsDevelopment()) return;

        var force = Environment.GetEnvironmentVariable("FORCE_DEV_SEED") == "1";

        var strategy = db.Database.CreateExecutionStrategy();
        await strategy.ExecuteAsync(async () => { 
            await new DevDataSeeder(logger).SeedAsync(db, force);
        });
    }
    
}