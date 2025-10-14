// Note: open browser from dashboard link in terminal output (includes login token)
using FomMon.AppHost.Extensions;
using FomMon.Data.Configuration.Layer;
using Microsoft.Extensions.Hosting;

var builder = DistributedApplication.CreateBuilder(args);

// prompted to set on first run.  Select 'save to user secrets', then can share with IDE manually.
// WARNING: password cannot contain special characters eg $; keycloak doesn't handle this in connection string
var pgUser = builder.AddParameter("pgUsername", secret: true);
var pgPwd =  builder.AddParameter("pgPassword", secret: true);
var postgres = builder.AddPostgres("postgres", pgUser, pgPwd)
    .WithImage("postgis/postgis")
    //.WithPgAdmin(pgAdmin => pgAdmin.WithHostPort(5050));
    .WithPgWeb(pgWeb => pgWeb.WithHostPort(5051))
    .WithDataVolume(isReadOnly: false) // persist to subsequent debugging sessions
    .WithLifetime(ContainerLifetime.Persistent); 

if (builder.Environment.IsDevelopment())
    postgres.WithHostPort(56298); // allow local access

var applicationDb = postgres
    .AddDatabase("application");

var keycloakDb = postgres
    .AddDatabase("keycloak-db");

var migrations = builder.AddProject<Projects.FomMon_MigrationService>("migrations")
    .WithReference(applicationDb)
    .WaitFor(applicationDb)
    .WithParentRelationship(applicationDb);

var tileserver = builder.AddMapLibreMartin("tileserver", 
        applicationDb, 
        applicationDb.Resource.GetConnectionUrl(), 
        port:5165)
    
    .WithReference(applicationDb)
    .WaitForCompletion(migrations)
    .WithCacheSizeMb(1024)
    .WithPgDefaultSrid(LayerRegistry.DefaultSrid)
    .WithAutoPublishSchemas(LayerRegistry.Schema)
    .WithLifetime(ContainerLifetime.Persistent); // Note: Requires restart on schema change

if (builder.Environment.IsDevelopment())
{
    tileserver.WithWebUi("enable-for-all");
}


// NOTE: if changing settings in keycloak admin console, export to RealmImport file so it's in source control
var keycloak = builder.AddKeycloak("keycloak", 8080)
    .WithPostgres(keycloakDb)
    .WithDataVolume()
    .WithRealmImport("./realm-export.json")
    .WithLifetime(ContainerLifetime.Persistent);

var cache = builder.AddRedis("cache")
    .WithRedisInsight(c => c.WithHostPort(46235)) // arbitrary stable port
    .WithDataVolume(isReadOnly: false)
    .WithPersistence(
        interval: TimeSpan.FromMinutes(5),
        keysChangedThreshold: 100
        )
    .WithLifetime(ContainerLifetime.Persistent)
    ; 

// hangfire dashboard: http://localhost:5389/hangfire
var apiService = builder.AddProject<Projects.FomMon_ApiService>("apiservice")
    .WithReference(applicationDb)
    .WithReference(migrations)
    .WaitForCompletion(migrations)
    .WithReference(keycloak)
    .WithReference(cache)
    .WaitFor(cache)
    .WithHttpHealthCheck("/health")
    .PublishAsDockerFile();


// email - dev mock server
if (builder.Environment.IsDevelopment())
{
    var email = builder.AddMailPit("mailpit", 
        httpPort:8025, 
        smtpPort:1025)
        .WithDataVolume("mailpit")
        .WithLifetime(ContainerLifetime.Persistent); // reduce startup time
    
    apiService.WithReference(email);
    keycloak.WithReference(email);
}

builder.AddNpmApp("angular", "../FomMon.Angular")
    .WithReference(apiService)
    .WaitFor(apiService)
    .WithReference(tileserver)
    .WithReference(keycloak)
    .WithHttpEndpoint(port: 4201, env: "PORT")
    .WithExternalHttpEndpoints()
    .WithHttpHealthCheck("/")
    .PublishAsDockerFile();


builder.Build().Run();

