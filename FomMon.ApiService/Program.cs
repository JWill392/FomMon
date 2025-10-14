using FomMon.ApiService;
using FomMon.ApiService.FomApi;
using FomMon.ApiService.Infrastructure;
using FomMon.ApiService.Jobs;
using FomMon.ApiService.Jobs.FomDownload;
using FomMon.ApiService.Services;
using FomMon.ApiService.Shared;
using FomMon.Data.Contexts;
using FomMon.ServiceDefaults;
using Hangfire;
using Hangfire.Redis.StackExchange;
using Extensions = FomMon.ServiceDefaults.Extensions;

var builder = WebApplication.CreateBuilder(args);

//var isDesignTime = Assembly.GetEntryAssembly()?.GetName().Name == "GetDocument.Insider";

builder.AddServiceDefaults();
builder.Services.AddProblemDetails();
//builder.Services.AddOpenApi(); does not play nicely with NetTopology

// Mapping
builder.Services.AddMappings();

// Auth
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUser, HttpContextCurrentUser>(); // get keycloak user from token

builder.Services.AddAuthentication()
    .AddKeycloakJwtBearer(serviceName: "keycloak",
        realm: "fom-mon",
        o =>
        {
            o.Audience = "api";
            o.TokenValidationParameters.RoleClaimType = "role"; // mapped in realm config
            // TODO add role filter api-user / api-admin

            if (builder.Environment.IsDevelopment())
                o.RequireHttpsMetadata = false; // dev only disable https
        });



// Database
builder.Services.AddAppDbContext(builder.Configuration, builder.Environment.IsDevelopment());

// Redis
builder.AddRedisClient(connectionName: "cache");

// Outgoing API
builder.Services.AddHttpClient<FomApiClient>(c => c.BaseAddress = new Uri("https://fom.nrs.gov.bc.ca/")); // TODO put in config


// Hangfire 
builder.Services.AddHangfire(c => c
        .SetDataCompatibilityLevel(CompatibilityLevel.Version_180)
        .UseSimpleAssemblyNameTypeSerializer()
        .UseRecommendedSerializerSettings()
        .UseRedisStorage(builder.Configuration.GetConnectionString("cache"), 
            new RedisStorageOptions()
            {
                Prefix = "{fommon.apiservice.hangfire}:",
            })
        .WithJobExpirationTimeout(TimeSpan.FromDays(7))
    );
builder.Services.AddHangfireServer();

// Background jobs
builder.Services.AddFomDownloadJob();
builder.Services.AddWfsDownloadJob();
builder.Services.AddProcessRunner();

// Business logic services
builder.Services.AddScoped<IAreaWatchService, AreaWatchService>();
builder.Services.AddScoped<IAlertService, AlertService>(); 
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<IFeatureService, FeatureService>();

// Hosted APIs
builder.Services.AddControllers(o =>
    {
        o.Filters.Add<UserMapperFilter>(); // map keycloak user to app user
        o.Filters.Add<RequireUserIdFilter>(); // double check user id successfully mapped to app user
    })
    .AddJsonOptions(o => Extensions.SetJsonSerializerOptions(o.JsonSerializerOptions)); // for controllers. ConfigureHttpJsonOptions doesn't work
    

var app = builder.Build();

// Hangfire dashboard
app.UseHangfireDashboard(); 

// TODO centralize job config
FomDownloadJobExtensions.ConfigureJobs();
WfsDownloadJobExtensions.ConfigureJobs();

// Configure the HTTP request pipeline.
app.UseExceptionHandler();

// TESTING: Simulate network latency
if (app.Environment.IsDevelopment() && builder.Configuration.GetSection("Testing:IncomingDelay") is {} delayCfg)
{
    Int32.TryParse(delayCfg["FromMs"], out var fromMs);
    Int32.TryParse(delayCfg["ToMs"], out var toMs);
    app.Use(async (_, next) =>
    {
        var delay = Random.Shared.Next(fromMs, toMs);
        await Task.Delay(delay);
        await next();
    });
    
    app.UseDeveloperExceptionPage();
}

app.UseAuthentication();
app.UseAuthorization();


app.MapDefaultEndpoints();
app.MapControllers();
app.MapHangfireDashboard(); // TODO authz policy with keycloak roles, link to management dashboard from SPA


app.Run();
