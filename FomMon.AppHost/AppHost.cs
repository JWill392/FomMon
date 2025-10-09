// Launch config note: open browser at http://localhost:15123/
using FomMon.AppHost.Extensions;
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
    .WithDataVolume(isReadOnly: false); // persist to subsequent debugging sessions
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
    .WithPgDefaultSrid(4326)
    .WithAutoPublishSchemas(["layers"]) // all layers stored in this schema, auto published
                                        // TODO get from Data.LayerRegistry.Schema.. or rather pass down to it?
    .WithLifetime(ContainerLifetime.Persistent); // but requires restart on schema changes

if (builder.Environment.IsDevelopment())
{
    tileserver.WithWebUi("enable-for-all");
}
    
    
// TODO martin implements prometheus metrics at /_/metrics	


// if (builder.Environment.IsDevelopment())
// {
//     // local map editing
//     var mapStyleEditor = builder.AddContainer("maputnik", "ghcr.io/maplibre/maputnik:main")
//         .WithHttpEndpoint(targetPort: 8000, port: 8888)
//         .WithLifetime(ContainerLifetime.Persistent)
//         .WithReference(tileserver)
//         .WaitFor(tileserver)
//         //.WithBindMount("../FomMon.MapStyleEditor/maputnik.json", "/app/style.json"); // TODO decide on location for styles 
//     // TODO access tileserver endpoint
// }
    



// TODO YARP integration once Aspire.Hosting.Yarp is out of pre-release
//var fomService = builder.AddExternalService("fomApi", "https://fom.nrs.gov.bc.ca/")
//    .WithHttpHealthCheck("/api");

// NOTE: if changing realm settings in admin console, export to RealmImport dir so it's in source control
var keycloak = builder.AddKeycloak("keycloak", 8080)

    .WithPostgres(keycloakDb)
    .WithDataVolume()
    .WithRealmImport("./Realms")
    .WithLifetime(ContainerLifetime.Persistent);
     


var apiService = builder.AddProject<Projects.FomMon_ApiService>("apiservice")
    .WithReference(applicationDb)
    .WithReference(migrations)
    .WithReference(keycloak)
    .WaitForCompletion(migrations)
    //.WithReference(fomService)
    .WithHttpHealthCheck("/health")
    .PublishAsDockerFile();

//var cache = builder.AddRedis("cache")
//    .WithRedisInsight()
//    .WithLifetime(ContainerLifetime.Persistent);


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
    // .WithReference(cache)
    // .WaitFor(cache)
    .PublishAsDockerFile();


builder.Build().Run();

