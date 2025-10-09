using FomMon.Data.Contexts;
using FomMon.MigrationService;
using FomMon.ServiceDefaults;

var builder = Host.CreateApplicationBuilder(args);

builder.AddServiceDefaults();
builder.Services.AddHostedService<MigrationWorker>();

builder.Services.AddOpenTelemetry()
    .WithTracing(tracing => tracing.AddSource(MigrationWorker.ActivitySourceName));

builder.Services.AddAppDbContext(builder.Configuration, builder.Environment.IsDevelopment());

var host = builder.Build();
host.Run();
