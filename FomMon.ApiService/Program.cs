using FomMon.ApiService;
using FomMon.ApiService.FomApi;
using FomMon.ApiService.Infrastructure;
using FomMon.ApiService.Services;
using FomMon.Data.Contexts;
using FomMon.ServiceDefaults;
using Mapster;
using NetTopologySuite.Geometries;
using Extensions = FomMon.ServiceDefaults.Extensions;

var builder = WebApplication.CreateBuilder(args);

//var isDesignTime = Assembly.GetEntryAssembly()?.GetName().Name == "GetDocument.Insider";

builder.AddServiceDefaults();
builder.Services.AddProblemDetails();
//builder.Services.AddOpenApi(); does not play nicely with NetTopology

// Mapping
var config = new TypeAdapterConfig();
config.Scan(AppDomain.CurrentDomain.GetAssemblies());

config.NewConfig<Geometry, Geometry>()
    .MapWith(g => g.Copy()); //  MapContext.Current.GetService<GeometryFactory>().CreateGeometry(g)

builder.Services.AddSingleton(config);
builder.Services.AddMapster();
    // TODO move to MappingConfig 


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

// Outgoing API
// TODO get from apphost external service "fom"?

builder.Services.AddHttpClient<FomApiClient>(c => c.BaseAddress = new Uri("https://fom.nrs.gov.bc.ca/")); // TODO put in config

builder.Services.AddFomDownloader();
builder.Services.AddFomPollingService();

builder.Services.AddWfsDownloader();

// Background work
builder.Services.AddProcessRunner();
builder.Services.AddSingleton<IBackgroundTaskQueue, BackgroundTaskQueue>();
builder.Services.AddHostedService<BackgroundTaskProcessorService>();
builder.Services.AddOpenTelemetry()
    .WithTracing(tracing => tracing.AddSource(BackgroundTaskProcessorService.ActivitySourceName));

// Business logic services
builder.Services.AddScoped<IAreaWatchService, AreaWatchService>(); 
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


// Configure the HTTP request pipeline.
app.UseExceptionHandler();

// Hosted APIs
if (app.Environment.IsDevelopment())
{
    //app.UseOpenApi();
    app.Use(async (context, next) =>
    {
        // Generate a random delay between 100ms and 2000ms
        var delay = Random.Shared.Next(100, 1000);
        await Task.Delay(delay);
        await next();
    });
    
    app.UseDeveloperExceptionPage();
}

app.UseAuthentication(); // TODO pipeline order?
app.UseAuthorization();


app.MapDefaultEndpoints();
app.MapControllers();


app.Run();
