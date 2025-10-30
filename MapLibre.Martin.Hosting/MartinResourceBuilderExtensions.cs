using Aspire.Hosting;
using Aspire.Hosting.ApplicationModel;

namespace MapLibre.Martin.Hosting;

internal static class MartinContainerImageTags
{
    internal const string Registry = "ghcr.io";

    internal const string Image = "maplibre/martin";

    internal const string Tag = "latest"; // TODO pin to version
}

public static class MartinResourceBuilderExtensions
{
    /// <summary>
    /// Adds the <see cref="MartinResource"/> to the given
    /// <paramref name="builder"/> instance.
    /// See https://maplibre.org/martin/using.html for endpoints
    /// </summary>
    /// <param name="builder">The <see cref="IDistributedApplicationBuilder"/>.</param>
    /// <param name="name">The name of the resource.</param>
    /// <param name="pg">Postgres database resource with postgis installed.</param>
    /// <param name="connectionUrl">Connection URL in non-standard format postgresql://user:password@host:port/db.
    /// Aspire v9 does not yet support different formats, so requires a hack to build your own reference expression from PostgresResource
    /// var userNameReference = pg.UserNameParameter is not null
    /// ? ReferenceExpression.Create($"{pg.UserNameParameter}")
    /// : ReferenceExpression.Create($"postgres"); 
    /// return ReferenceExpression.Create(
    /// $"postgresql://{userNameReference}:{pg.PasswordParameter}@{pg.PrimaryEndpoint.Property(EndpointProperty.Host)}:{pg.PrimaryEndpoint.Property(EndpointProperty.Port)}");
    /// </param>
    /// <param name="port">The HTTP port.</param>
    /// <returns>
    /// An <see cref="IResourceBuilder{MartinResource}"/> instance that
    /// represents the added Martin resource.
    /// </returns>
    public static IResourceBuilder<MartinResource> AddMapLibreMartin(
        this IDistributedApplicationBuilder builder,
        string name,
        IResourceBuilder<IResourceWithConnectionString> pg,
        ReferenceExpression connectionUrl,
        int? port = null)
    {
        ArgumentNullException.ThrowIfNull(builder);


        var resource = new MartinResource(name);
        
        (string path, string file) config = ("/etc/martin/", "config.yaml");
        
        var resourceBuilder = builder.AddResource(resource)
            .WithImage(MartinContainerImageTags.Image)
            .WithImageRegistry(MartinContainerImageTags.Registry)
            .WithImageTag(MartinContainerImageTags.Tag)
            
            .WithEnvironment("DATABASE_URL", connectionUrl)
            .WithPgConnection("$DATABASE_URL") // set martin config file to use env variable
            .WithReferenceRelationship(pg)
            
            .WithHttpEndpoint(
                targetPort: 3000,
                port: port,
                name: MartinResource.HttpEndpointName)
            .WithHttpHealthCheck("/health")
            
            .WithLifetime(ContainerLifetime.Persistent)
            
            // config file
            .WithContainerFiles(config.path, (_, _) => 
                Task.FromResult<IEnumerable<ContainerFileSystemItem>>([
                    new ContainerFile
                    {
                        Name = config.file,
                        Contents = resource.Settings.ToYaml(),
                    }
            ]))
            .WithArgs(ctx =>
            {
                ctx.Args.Add("--config");
                ctx.Args.Add(Path.Join(config.path, config.file));
            })
            ;
        // TODO wire up prometheus metrics /_/metrics
            

        return resourceBuilder;
    }


    public static IResourceBuilder<MartinResource> WithKeepAlive(this IResourceBuilder<MartinResource> builder,
        int seconds)
    {
        builder.Resource.Settings.KeepAlive = seconds;
        return builder;
    }

    public static IResourceBuilder<MartinResource> WithListenAddresses(this IResourceBuilder<MartinResource> builder,
        string addr)
    {
        builder.Resource.Settings.ListenAddresses = addr;
        return builder;
    }

    public static IResourceBuilder<MartinResource> WithBasePath(this IResourceBuilder<MartinResource> builder,
        string basePath)
    {
        builder.Resource.Settings.BasePath = basePath;
        return builder;
    }

    public static IResourceBuilder<MartinResource> WithWorkerProcesses(this IResourceBuilder<MartinResource> builder,
        int workers)
    {
        builder.Resource.Settings.WorkerProcesses = workers;
        return builder;
    }

    public static IResourceBuilder<MartinResource> WithCacheSizeMb(this IResourceBuilder<MartinResource> builder,
        int mb)
    {
        builder.Resource.Settings.CacheSizeMb = mb;
        return builder;
    }

    public static IResourceBuilder<MartinResource> WithPreferredEncoding(this IResourceBuilder<MartinResource> builder,
        string encoding)
    {
        builder.Resource.Settings.PreferredEncoding = encoding;
        return builder;
    }

    public static IResourceBuilder<MartinResource> WithWebUi(this IResourceBuilder<MartinResource> builder, string mode)
    {
        builder.Resource.Settings.WebUi = mode;
        return builder;
    }

    // Observability
    public static IResourceBuilder<MartinResource> AddMetricLabel(this IResourceBuilder<MartinResource> builder,
        string key, string value)
    {
        builder.Resource.Settings.Observability.Metrics.AddLabels[key] = value;
        return builder;
    }

    // CORS
    public static IResourceBuilder<MartinResource> WithCorsOrigins(this IResourceBuilder<MartinResource> builder,
        params string[] origins)
    {
        builder.Resource.Settings.Cors ??= new CorsSettings();
        builder.Resource.Settings.Cors.Origin.AddRange(origins);
        return builder;
    }

    public static IResourceBuilder<MartinResource> WithCorsMaxAge(this IResourceBuilder<MartinResource> builder,
        int? seconds)
    {
        builder.Resource.Settings.Cors ??= new CorsSettings();
        builder.Resource.Settings.Cors.MaxAge = seconds;
        return builder;
    }

    // Postgres
    public static IResourceBuilder<MartinResource> WithPgConnection(this IResourceBuilder<MartinResource> builder,
        string connectionString)
    {
        builder.Resource.Settings.Postgres.ConnectionString = connectionString;
        return builder;
    }

    public static IResourceBuilder<MartinResource> WithPgSsl(this IResourceBuilder<MartinResource> builder,
        string? cert = null, string? key = null, string? rootCert = null)
    {
        builder.Resource.Settings.Postgres.SslCert = cert ?? builder.Resource.Settings.Postgres.SslCert;
        builder.Resource.Settings.Postgres.SslKey = key ?? builder.Resource.Settings.Postgres.SslKey;
        builder.Resource.Settings.Postgres.SslRootCert = rootCert ?? builder.Resource.Settings.Postgres.SslRootCert;
        return builder;
    }

    public static IResourceBuilder<MartinResource> WithPgDefaultSrid(this IResourceBuilder<MartinResource> builder,
        int srid)
    {
        builder.Resource.Settings.Postgres.DefaultSrid = srid;
        return builder;
    }

    public static IResourceBuilder<MartinResource> WithPgPoolSize(this IResourceBuilder<MartinResource> builder,
        int size)
    {
        builder.Resource.Settings.Postgres.PoolSize = size;
        return builder;
    }

    public static IResourceBuilder<MartinResource> WithPgMaxFeatureCount(this IResourceBuilder<MartinResource> builder,
        int? max)
    {
        builder.Resource.Settings.Postgres.MaxFeatureCount = max;
        return builder;
    }

    public static IResourceBuilder<MartinResource> WithPgAutoBounds(this IResourceBuilder<MartinResource> builder,
        string mode)
    {
        builder.Resource.Settings.Postgres.AutoBounds = mode;
        return builder;
    }

    // auto publish
    public static IResourceBuilder<MartinResource> WithAutoPublish(this IResourceBuilder<MartinResource> builder)
    {
        builder.Resource.Settings.Postgres.AutoPublish ??= new();
        return builder;
    }

    public static IResourceBuilder<MartinResource> WithAutoPublishSchemas(this IResourceBuilder<MartinResource> builder,
        params string[] schemas)
    {
        builder.Resource.Settings.Postgres.AutoPublish ??= new();
        builder.Resource.Settings.Postgres.AutoPublish.FromSchemas ??= [];
        builder.Resource.Settings.Postgres.AutoPublish.FromSchemas!.AddRange(schemas);
        return builder;
    }

    public static IResourceBuilder<MartinResource> WithAutoPublishTables(this IResourceBuilder<MartinResource> builder,
        string? sourceIdFormat = null,
        IEnumerable<string>? fromSchemas = null,
        IEnumerable<string>? idColumns = null,
        bool? clipGeom = null,
        int? buffer = null,
        int? extent = null)
    {
        builder.Resource.Settings.Postgres.AutoPublish ??= new();
        builder.Resource.Settings.Postgres.AutoPublish.Tables ??= new();
        var t = builder.Resource.Settings.Postgres.AutoPublish.Tables!;
        if (sourceIdFormat != null) t.SourceIdFormat = sourceIdFormat;
        if (fromSchemas != null) t.FromSchemas.AddRange(fromSchemas);
        if (idColumns != null) t.IdColumns.AddRange(idColumns);
        if (clipGeom.HasValue) t.ClipGeom = clipGeom;
        if (buffer.HasValue) t.Buffer = buffer;
        if (extent.HasValue) t.Extent = extent;
        return builder;
    }

    public static IResourceBuilder<MartinResource> WithAutoPublishFunctions(
        this IResourceBuilder<MartinResource> builder,
        IEnumerable<string>? fromSchemas = null,
        string? sourceIdFormat = null)
    {
        builder.Resource.Settings.Postgres.AutoPublish ??= new();
        builder.Resource.Settings.Postgres.AutoPublish.Functions ??=new ();
        var f = builder.Resource.Settings.Postgres.AutoPublish.Functions!;
        if (fromSchemas != null) f.FromSchemas.AddRange(fromSchemas);
        if (sourceIdFormat != null) f.SourceIdFormat = sourceIdFormat;
        return builder;
    }

    public static IResourceBuilder<MartinResource> AddTable(this IResourceBuilder<MartinResource> builder,
        string tableSourceId,
        string table,
        string idColumn,
        string geometryColumn,
        Dictionary<string, string> properties,
        int? srid = null,
        string schema = "public",
        Action<TableSource>? configure = null)
    {
        var src = new TableSource
        {
            Table = table,
            IdColumn = idColumn,
            GeometryColumn = geometryColumn,
            Properties = properties,
            Srid = srid ?? builder.Resource.Settings.Postgres.DefaultSrid ?? 0,
            Schema = schema,
        };
        configure?.Invoke(src);
        builder.Resource.Settings.Postgres.Tables ??= new();
        builder.Resource.Settings.Postgres.Tables[tableSourceId] = src;
        return builder;
    }

    // Add Function
    public static IResourceBuilder<MartinResource> AddFunction(this IResourceBuilder<MartinResource> builder,
        string functionSourceId,
        string schema,
        string function,
        Action<FunctionSource>? configure = null)
    {
        var src = new FunctionSource
        {
            Schema = schema,
            Function = function
        };
        configure?.Invoke(src);
        builder.Resource.Settings.Postgres.Functions ??= new();
        builder.Resource.Settings.Postgres.Functions[functionSourceId] = src;
        return builder;
    }

    // Add Style
    public static IResourceBuilder<MartinResource> AddStyle(this IResourceBuilder<MartinResource> builder,
        string styleName, string filePath)
    {
        builder.Resource.Settings.Styles.Sources[styleName] = filePath;
        return builder;
    }

    public static IResourceBuilder<MartinResource> AddStylesPath(this IResourceBuilder<MartinResource> builder,
        string directoryPath)
    {
        builder.Resource.Settings.Styles.Paths.Add(directoryPath);
        return builder;
    }

    // PMTiles
    public static IResourceBuilder<MartinResource> WithPmtiles(this IResourceBuilder<MartinResource> builder,
        bool? forcePathStyle = null, bool? skipCredentials = null)
    {
        builder.Resource.Settings.Pmtiles ??= new PmtilesSettings();
        if (forcePathStyle.HasValue) builder.Resource.Settings.Pmtiles.ForcePathStyle = forcePathStyle;
        if (skipCredentials.HasValue) builder.Resource.Settings.Pmtiles.SkipCredentials = skipCredentials;
        return builder;
    }

    public static IResourceBuilder<MartinResource> AddPmtilesPath(this IResourceBuilder<MartinResource> builder,
        string path)
    {
        (builder.Resource.Settings.Pmtiles ??= new PmtilesSettings()).Paths.Add(path);
        return builder;
    }

    public static IResourceBuilder<MartinResource> AddPmtilesSource(this IResourceBuilder<MartinResource> builder,
        string name, string path)
    {
        (builder.Resource.Settings.Pmtiles ??= new PmtilesSettings()).Sources[name] = path;
        return builder;
    }

    // MBTiles
    public static IResourceBuilder<MartinResource> AddMbtilesPath(this IResourceBuilder<MartinResource> builder,
        string path)
    {
        (builder.Resource.Settings.Mbtiles ??= new MbtilesSettings()).Paths.Add(path);
        return builder;
    }

    public static IResourceBuilder<MartinResource> AddMbtilesSource(this IResourceBuilder<MartinResource> builder,
        string name, string path)
    {
        (builder.Resource.Settings.Mbtiles ??= new MbtilesSettings()).Sources[name] = path;
        return builder;
    }

    // COG
    public static IResourceBuilder<MartinResource> AddCogPath(this IResourceBuilder<MartinResource> builder,
        string path)
    {
        (builder.Resource.Settings.Cog ??= new CogSettings()).Paths.Add(path);
        return builder;
    }

    public static IResourceBuilder<MartinResource> AddCogSource(this IResourceBuilder<MartinResource> builder,
        string name, string path)
    {
        (builder.Resource.Settings.Cog ??= new CogSettings()).Sources[name] = path;
        return builder;
    }

    // Sprites
    public static IResourceBuilder<MartinResource> AddSpritesPath(this IResourceBuilder<MartinResource> builder,
        string path)
    {
        (builder.Resource.Settings.Sprites ??= new SpritesSettings()).Paths.Add(path);
        return builder;
    }

    public static IResourceBuilder<MartinResource> AddSpritesSource(this IResourceBuilder<MartinResource> builder,
        string name, string path)
    {
        (builder.Resource.Settings.Sprites ??= new SpritesSettings()).Sources[name] = path;
        return builder;
    }

    // Fonts
    public static IResourceBuilder<MartinResource> AddFont(this IResourceBuilder<MartinResource> builder, string path)
    {
        builder.Resource.Settings.Fonts.Add(path);
        return builder;
    }

    public static IResourceBuilder<MartinResource> AddFonts(this IResourceBuilder<MartinResource> builder,
        params string[] paths)
    {
        builder.Resource.Settings.Fonts.AddRange(paths);
        return builder;
    }
}