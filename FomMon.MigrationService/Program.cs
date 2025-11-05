using FomMon.ApiService.Infrastructure;
using FomMon.ApiService.Jobs.Osm;
using FomMon.Common.Configuration.Minio;
using FomMon.Common.Infrastructure;
using FomMon.Data.Contexts;
using FomMon.Data.Models;
using FomMon.MigrationService;
using FomMon.ServiceDefaults;
using Hangfire;
using Hangfire.MemoryStorage;

var builder = Host.CreateApplicationBuilder(args);

builder.AddServiceDefaults();

// DB
builder.AddAppDbContext();

// Redis
builder.AddRedisClient(connectionName: "cache");

// Hangfire
builder.Services.AddHangfire(c =>
{
    c.SetDataCompatibilityLevel(CompatibilityLevel.Version_180)
        .UseSimpleAssemblyNameTypeSerializer()
        .UseRecommendedSerializerSettings()
        
        .UseMemoryStorage(new MemoryStorageOptions()
        {
            FetchNextJobTimeout = TimeSpan.FromHours(6) // kills jobs that run longer; default 30 mins
        } )
        .UseFilter(new AutomaticRetryAttribute { Attempts = 0 });
});
builder.Services.AddSingleton<StopApplicationOnCompletionFilter>();

builder.Services.AddHangfireServer();


// Object storage
builder.AddMinio("minio");

// initialization jobs
builder.Services.AddSingleton<MinioInitializer>();
builder.AddMigrationWorker();
builder.AddOsmSetupJob();
builder.Services.AddProcessRunner();

var host = builder.Build();

// Stop app once all jobs complete
GlobalJobFilters.Filters.Add(host.Services.GetRequiredService<StopApplicationOnCompletionFilter>());

var backgroundJob = host.Services.GetRequiredService<IBackgroundJobClient>();
backgroundJob.Enqueue<MinioInitializer>(x => x.ExecuteAsync(CancellationToken.None));

var migrationJob = backgroundJob.Enqueue<MigrationWorker>(x => x.ExecuteAsync(CancellationToken.None));
backgroundJob.ContinueJobWith<IScriptRunner<OsmSetupStep>>(migrationJob, x => x.AddJobsAsync(CancellationToken.None));

host.Run();