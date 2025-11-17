using System.Net.Security;
using System.Security.Cryptography.X509Certificates;
using FomMon.ApiService.FomApi;
using FomMon.ApiService.Infrastructure;
using FomMon.ApiService.Jobs;
using FomMon.ApiService.Jobs.FomDownload;
using FomMon.ApiService.Services;
using FomMon.ApiService.Shared;
using FomMon.Common.Configuration;
using FomMon.Common.Configuration.Minio;
using FomMon.Common.Infrastructure;
using FomMon.Data.Contexts;
using FomMon.ServiceDefaults;
using Hangfire;
using Extensions = FomMon.ServiceDefaults.Extensions;

var builder = WebApplication.CreateBuilder(args);

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
builder.AddAppDbContext();

// Object storage
builder.AddMinio("minio");
builder.Services.AddMinioObjectStorageService();
builder.Services.AddScoped<IEntityObjectStorageService, VersionedEntityObjectStorageService>();

// Outgoing API

const string fomHost = "fom.nrs.gov.bc.ca"; // TODO configure
builder.Services.AddHttpClient<FomApiClient>(c =>
    {
        c.BaseAddress = new Uri($"https://{fomHost}/");
    })
    // temporary workaround for .NET 10 SSL intermediate chain validation regression.
    // PartialChain exceptions on this host only, while openssl works fine.
    .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler
    {
        ServerCertificateCustomValidationCallback = (message, cert, chain, errors) =>
        {
            // If everything is fine, accept
            if (errors == SslPolicyErrors.None)
                return true;

            // Only special-case this specific host
            if (!string.Equals(message.RequestUri?.Host, fomHost, StringComparison.OrdinalIgnoreCase))
                return false;

            // Only tolerate *chain* errors (no name mismatch, etc.)
            if ((errors & ~SslPolicyErrors.RemoteCertificateChainErrors) != 0)
                return false;

            // Make sure the only chain issue is PartialChain
            if (chain?.ChainStatus is { Length: > 0 } statuses &&
                statuses.All(s => s.Status == X509ChainStatusFlags.PartialChain))
            {
                // Sanity-check subject
                if (!cert.Subject.Contains($"CN={fomHost}", StringComparison.OrdinalIgnoreCase))
                    return false;

                return true;
            }

            return false;
        }
    });


// Hangfire 
builder.AddHangfireRedis("cache", "{fommon.apiservice.hangfire}:");



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
        o.Filters.Add<RequireUserIdFilter>(); // confirm user id successfully mapped to app user
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
if (app.Environment.IsDevelopment() && 
    builder.Configuration.GetSection("Testing:IncomingDelay") is {} delayCfg)
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
