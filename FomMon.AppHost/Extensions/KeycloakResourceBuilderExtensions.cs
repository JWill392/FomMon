
namespace FomMon.AppHost.Extensions;


internal static class KeycloakResourceBuilderExtensions
{
    public static IResourceBuilder<KeycloakResource> WithPostgres(this IResourceBuilder<KeycloakResource> builder, IResourceBuilder<PostgresDatabaseResource> pgDb)
    {
        var pgServer = pgDb.Resource.Parent;
        
        var userNameReference =
            pgServer.UserNameParameter is not null
                ? ReferenceExpression.Create($"{pgServer.UserNameParameter}")
                : ReferenceExpression.Create($"postgres");

        return builder
            .WithReference(pgDb)
            .WaitFor(pgDb)
            .WithEnvironment("KC_DB", "postgres")
            .WithEnvironment("KC_DB_USERNAME", userNameReference)
            .WithEnvironment("KC_DB_PASSWORD", pgServer.PasswordParameter)
            .WithEnvironment("KC_DB_URL_HOST", pgServer.PrimaryEndpoint.Property(EndpointProperty.Host))
            .WithEnvironment("KC_DB_URL_PORT", pgServer.PrimaryEndpoint.Property(EndpointProperty.Port))
            .WithEnvironment("KC_DB_URL_DATABASE", pgDb.Resource.DatabaseName);
        //.WithArgs("--verbose"); 

    }
    
}
