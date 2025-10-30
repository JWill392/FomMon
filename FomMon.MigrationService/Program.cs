using FomMon.Common.Configuration;
using FomMon.Common.Configuration.Minio;
using FomMon.Data.Contexts;
using FomMon.MigrationService;
using FomMon.ServiceDefaults;
using Hangfire;

var builder = Host.CreateApplicationBuilder(args);

builder.AddServiceDefaults();

// DB
builder.AddAppDbContext();

// Redis
builder.AddRedisClient(connectionName: "cache");

// Jobs
builder.AddHangfireRedis("cache", "{fommon.hangfire}:", c => c
    .UseFilter(new AutomaticRetryAttribute { Attempts = 1 })
);
builder.Services.AddSingleton<StopApplicationOnCompletionFilter>();

// Object storage
builder.AddMinio("minio");

// initialization jobs
builder.Services.AddSingleton<MinioInitializer>();
builder.AddMigrationWorker();
builder.AddOsmInitializer();

var host = builder.Build();

// Stop app once all jobs complete
GlobalJobFilters.Filters.Add(host.Services.GetRequiredService<StopApplicationOnCompletionFilter>());

var backgroundJob = host.Services.GetRequiredService<IBackgroundJobClient>();
backgroundJob.Enqueue<MinioInitializer>(x => x.ExecuteAsync(CancellationToken.None));
backgroundJob.Enqueue<MigrationWorker>(x => x.ExecuteAsync(CancellationToken.None));
backgroundJob.Enqueue<OsmInitializer>(x => x.ExecuteAsync(CancellationToken.None));


host.Run();