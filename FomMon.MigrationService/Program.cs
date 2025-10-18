using FomMon.Data.Configuration;
using FomMon.Data.Contexts;
using FomMon.MigrationService;
using FomMon.ServiceDefaults;
using Minio;

var builder = Host.CreateApplicationBuilder(args);

builder.AddServiceDefaults();
builder.Services.AddHostedService<MigrationWorker>();
builder.Services.AddSingleton<MinioInitializer>();

builder.Services.AddOpenTelemetry()
    .WithTracing(tracing => tracing.AddSource(MigrationWorker.ActivitySourceName));

// DB
builder.Services.AddAppDbContext(builder.Configuration, builder.Environment.IsDevelopment());

// Object storage
builder.Services.AddMinio(c =>
{
    var config = ObjectStorageConfiguration.ParseMinioConnectionString(
        builder.Configuration.GetConnectionString("minio") 
        ?? throw new ArgumentException("Missing minio connection string"));
    c.WithEndpoint(config.endpoint);
    c.WithCredentials(config.username, config.password);
    if (builder.Environment.IsDevelopment())
    {
        c.WithSSL(false); 
    }
});

var host = builder.Build();
host.Run();