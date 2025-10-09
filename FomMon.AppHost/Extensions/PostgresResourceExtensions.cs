namespace FomMon.AppHost.Extensions;

public static class PostgresServerResourceExtensions
{
    /// <summary>
    /// Gets the connection string in URI format inside the inner network.  If running as docker containers, other containers can use this to connect.
    /// Note, this won't work from a project, as the external port is different from the container port. 
    /// </summary>
    /// <param name="pg"></param>
    /// <returns></returns>
    public static ReferenceExpression GetConnectionUrl(this PostgresServerResource pg)
    {
        var userNameReference =
            pg.UserNameParameter is not null
                ? ReferenceExpression.Create($"{pg.UserNameParameter}")
                : ReferenceExpression.Create($"postgres");

        return ReferenceExpression.Create(
            $"postgresql://{userNameReference}:{pg.PasswordParameter}@{pg.PrimaryEndpoint.Property(EndpointProperty.Host)}:{pg.PrimaryEndpoint.Property(EndpointProperty.Port)}");
    }

    
    public static ReferenceExpression GetConnectionUrl(this PostgresDatabaseResource pg)
    {
        return ReferenceExpression.Create($"{pg.Parent.GetConnectionUrl()}/{pg.DatabaseName}");
    }
    

    
}
