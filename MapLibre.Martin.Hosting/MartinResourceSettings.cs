using YamlDotNet.Serialization;

// ReSharper disable CollectionNeverQueried.Global

namespace MapLibre.Martin.Hosting;


public sealed record MartinResourceSettings
{
    public int? KeepAlive { get; set; }
    public string? ListenAddresses { get; set; }
    public string? BasePath { get; set; }
    public int? WorkerProcesses { get; set; }
    public int? CacheSizeMb { get; set; }
    public string? PreferredEncoding { get; set; } // gzip | brotli, etc.
    public string? WebUi { get; set; } // enable-for-all | disable

    public ObservabilitySettings Observability { get; set; } = new();
    public CorsSettings? Cors { get; set; }

    public PostgresSettings Postgres { get; set; } = new();

    public PmtilesSettings? Pmtiles { get; set; }
    public MbtilesSettings? Mbtiles { get; set; }
    public CogSettings? Cog { get; set; }
    public SpritesSettings? Sprites { get; set; }
    public List<string> Fonts { get; set; } = new();

    public StylesSettings Styles { get; set; } = new();
    
    
}

public sealed record ObservabilitySettings
{
    public MetricsSettings Metrics { get; set; } = new();
    public sealed class MetricsSettings
    {
        public Dictionary<string, string> AddLabels { get; set; } = new();
    }
}

public sealed record CorsSettings
{
    public List<string> Origin { get; set; } = new(); // list of allowed origins
    public int? MaxAge { get; set; } // seconds, null => not set
}

public sealed record PostgresSettings
{
    public string? ConnectionString { get; set; }
    public string? SslCert { get; set; }
    public string? SslKey { get; set; }
    public string? SslRootCert { get; set; }
    public int? DefaultSrid { get; set; }
    public int? PoolSize { get; set; }
    public int? MaxFeatureCount { get; set; } // null => unlimited
    public string? AutoBounds { get; set; } // calc | quick | skip

    public AutoPublishSettings? AutoPublish { get; set; }

    public Dictionary<string, TableSource>? Tables { get; set; }
    public Dictionary<string, FunctionSource>? Functions { get; set; }

    public sealed record AutoPublishSettings
    {
        public List<string>? FromSchemas { get; set; }

        public AutoTablesSettings? Tables { get; set; }
        public AutoFunctionsSettings? Functions { get; set; }

        public sealed record AutoTablesSettings
        {
            public string? SourceIdFormat { get; set; }
            public List<string> FromSchemas { get; set; } = new();
            public List<string> IdColumns { get; set; } = new(); // allow single or list
            public bool? ClipGeom { get; set; }
            public int? Buffer { get; set; }
            public int? Extent { get; set; }
        }

        public sealed record AutoFunctionsSettings
        {
            public List<string> FromSchemas { get; set; } = new();
            public string? SourceIdFormat { get; set; }
        }
    }
}

public sealed record TableSource
{
    public string? LayerId { get; set; }
    public required string Schema { get; set; } = "public";
    public required string Table { get; set; }
    public required int Srid { get; set; }
    public required string GeometryColumn { get; set; }
    public string? IdColumn { get; set; }
    public int? MinZoom { get; set; }
    public int? MaxZoom { get; set; }
    public double[]? Bounds { get; set; } // [left,bottom,right,top]
    public int? Extent { get; set; }
    public int? Buffer { get; set; }
    public bool? ClipGeom { get; set; }
    public string? GeometryType { get; set; } // GEOMETRY, etc.
    /// <summary>
    /// Column name to UDT Type mapping
    /// </summary>
    public Dictionary<string, string> Properties { get; set; } = new();
}

public sealed record FunctionSource
{
    public required string Schema { get; set; } = "public";
    public required string Function { get; set; }
    public int? MinZoom { get; set; }
    public int? MaxZoom { get; set; }
    public double[]? Bounds { get; set; } // [left,bottom,right,top]
}

public sealed record PmtilesSettings
{
    public bool? ForcePathStyle { get; set; }
    public bool? SkipCredentials { get; set; }
    public List<string> Paths { get; set; } = new();
    public Dictionary<string, string> Sources { get; set; } = new();
}

public sealed record MbtilesSettings
{
    public List<string> Paths { get; set; } = new();
    public Dictionary<string, string> Sources { get; set; } = new();
}

public sealed record CogSettings
{
    public List<string> Paths { get; set; } = new();
    public Dictionary<string, string> Sources { get; set; } = new();
}

public sealed record SpritesSettings
{
    public List<string> Paths { get; set; } = new();
    public Dictionary<string, string> Sources { get; set; } = new();
}

public sealed record StylesSettings
{
    public List<string> Paths { get; set; } = new();
    public Dictionary<string, string> Sources { get; set; } = new();
}

// Fluent Builder


public static class MartinSettingsYaml
{
    public static string ToYaml(this MartinResourceSettings settings)
    {
        var serializer = CreateSerializer();
        return serializer.Serialize(settings);
    }
    
    private static ISerializer CreateSerializer() =>
        new SerializerBuilder()
            .WithNamingConvention(SnakeCaseNamingConvention.Instance)
            .ConfigureDefaultValuesHandling(DefaultValuesHandling.OmitNull)
            .Build();

}
