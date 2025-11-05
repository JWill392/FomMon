namespace FomMon.ApiService.Jobs.Osm;

public sealed record OsmConfig
{
    /// <summary>
    /// Schema to use for OSM data
    /// </summary>
    public required string Schema { get; init; } = "osm";
    
    /// <summary>
    /// URL to download the OSM extract (e.g., Geofabrik BC extract)
    /// </summary>
    public required string ExtractUrl { get; init; }
    
    /// <summary>
    /// Local directory to store downloaded OSM files
    /// </summary>
    public required string DataDirectory { get; init; }
    
    
    
    
    /// <summary>
    /// LUA_PATH environment variable for osm2pgsql.
    /// </summary>
    public required string StyleLuaPath { get; init; }
    
    /// <summary>
    /// Path to the osm2pgsql style.lua file relative to StyleFileWorkingDir.
    /// </summary>
    public required string StyleFilePath { get; init; }
    
    /// <summary>
    ///  Download and import external OSM data script
    /// </summary>
    public required string ExternalDownloadScript { get; init; }
    
    /// <summary>
    /// osm2pgsql configuration
    /// </summary>
    public required Osm2PgsqlConfig Osm2Pgsql { get; init; }
}


public sealed record Osm2PgsqlConfig
{
    /// <summary>
    /// Number of parallel processes (default: number of CPU cores)
    /// </summary>
    public int? NumberOfProcesses { get; init; }
    
    /// <summary>
    /// Cache size in MB (default: 800)
    /// </summary>
    public int? CacheSizeMb { get; init; }
    
    /// <summary>
    /// Use slim mode (required for updates)
    /// </summary>
    public bool Slim { get; init; } = true;

    
    /// <summary>
    /// Prefix for database tables (default: planet_osm)
    /// </summary>
    public string? Prefix { get; init; }
    
    /// <summary>
    /// Additional command line arguments
    /// </summary>
    public string[]? AdditionalArgs { get; init; }
}