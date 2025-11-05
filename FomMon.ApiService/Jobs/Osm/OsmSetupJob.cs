using System.Globalization;
using CliWrap;
using FluentResults;
using FomMon.ApiService.Infrastructure;
using FomMon.ApiService.Services;
using FomMon.Common.Infrastructure;
using FomMon.Common.Shared;
using FomMon.Data.Contexts;
using FomMon.Data.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace FomMon.ApiService.Jobs.Osm;

public static class OsmSetupJobExtensions
{
    public static IHostApplicationBuilder AddOsmSetupJob(this IHostApplicationBuilder builder)
    {
        builder.Services.AddScoped<IScriptState<OsmSetupStep>, OsmService>();
        builder.Services.AddScoped<IScript<OsmSetupStep>, OsmSetupJob>();
        builder.Services.AddScoped<IScriptRunner<OsmSetupStep>, BackgroundJobScriptRunner<OsmSetupStep>>();
        
        builder.Services.AddScoped<IOsmTileFunctionGenerator, OsmTileFunctionGenerator>();
        
        builder.Services.Configure<OsmConfig>(builder.Configuration.GetSection("OsmConfig"));
        
        return builder;
    }

}
public class OsmSetupJob(
    IOptions<OsmConfig> options, 
    ILogger<OsmSetupJob> logger, 
    IDatabaseConfiguration dbConfig, 
    IProcessRunner runner,
    AppDbContext db,
    IOsmTileFunctionGenerator tileFunctionGenerator) : IScript<OsmSetupStep>
{
    private readonly OsmConfig _config = options.Value;
    
    
    public List<OsmSetupStep> GetOrder()
    {
        return [
            OsmSetupStep.DownloadedOsm,
            OsmSetupStep.Imported, 
            OsmSetupStep.Initialized,
            OsmSetupStep.DownloadedExternalLayers,
            OsmSetupStep.Generalized,
            OsmSetupStep.TileFunctionsCreated,
        ];
    }

    public Func<CancellationToken, Task<Result>> GetStepAction(OsmSetupStep step)
    {
        return step switch
        {
            OsmSetupStep.DownloadedOsm => DownloadOsm,
            OsmSetupStep.Imported => Osm2PgsqlCreate,
            OsmSetupStep.Initialized => InitializeReplication,
            OsmSetupStep.DownloadedExternalLayers => DownloadExternalLayers,
            OsmSetupStep.Generalized => Osm2PgsqlGeneralize,
            OsmSetupStep.TileFunctionsCreated => CreateTileFunctions,
            OsmSetupStep.NotStarted => throw new ArgumentOutOfRangeException(nameof(step), step, null),
            _ => throw new ArgumentOutOfRangeException(nameof(step), step, null)
        };
    }

    
    public async Task<Result> DownloadOsm(CancellationToken c = default)
    {
        var outputPath = GetPbfFilePath();
        var completionMarkerPath = outputPath + ".complete";

        Directory.CreateDirectory(_config.DataDirectory);

        // If marker file exists, download completed successfully before
        if (File.Exists(completionMarkerPath))
        {
            return Result.Ok();
        }

        // TODO BUG resume doesn't ever work; fails with 'cannot uncompress data' in osm2pgsql create step
        var command = Cli.Wrap("wget")
            .WithArguments(args => args
                .Add("-c") // continue: resume partial downloads
                .Add("-O").Add(outputPath)
                .Add(_config.ExtractUrl));
    
        var result = await runner.RunAsync(command, c);
    
        // Create marker file on successful download
        if (result.IsSuccess)
        {
            await File.WriteAllTextAsync(completionMarkerPath, DateTime.UtcNow.ToString(CultureInfo.InvariantCulture), c);
        }
    
        return result.ToResult();
    }


    public async Task<Result> Osm2PgsqlCreate(CancellationToken c = default)
    {
        var luaPath = _config.StyleLuaPath;
        var pbfPath = GetPbfFilePath();
        
        var osm2Pgsql = _config.Osm2Pgsql;

        var command = Cli.Wrap("osm2pgsql")
            .WithArguments(args =>
            {
                args.Add("--create");

                if (osm2Pgsql.Slim)
                    args.Add("--slim");

                // Database connection
                args.Add("--database").Add(dbConfig.Database);
                args.Add("--username").Add(dbConfig.Username);
                args.Add("--host").Add(dbConfig.Host);
                args.Add("--port").Add(dbConfig.Port);
                args.Add("--schema").Add(_config.Schema);
                if (!string.IsNullOrEmpty(osm2Pgsql.Prefix))
                    args.Add("--prefix").Add(osm2Pgsql.Prefix);
                
                // Style file (using flex output)
                args.Add("--output").Add("flex");
                args.Add("--style").Add(_config.StyleFilePath);

                // Performance options
                if (osm2Pgsql.NumberOfProcesses.HasValue)
                    args.Add("--number-processes").Add(osm2Pgsql.NumberOfProcesses.Value);

                if (osm2Pgsql.CacheSizeMb.HasValue)
                    args.Add("--cache").Add(osm2Pgsql.CacheSizeMb.Value);


                // Additional args from config
                if (osm2Pgsql.AdditionalArgs != null)
                {
                    foreach (var arg in osm2Pgsql.AdditionalArgs)
                        args.Add(arg);
                }

                // Input file 
                args.Add(pbfPath);
            })
            .WithEnvironmentVariables(env => env
                .Set("PGPASSWORD", dbConfig.Password)
                .Set("LUA_PATH", luaPath)
                .Set("OSM_SCHEMA", _config.Schema)
            );
        
        
        return (await runner.RunAsync(command, c)).ToResult();
    }

    public async Task<Result> Osm2PgsqlGeneralize(CancellationToken c = default)
    {
        var command = Cli.Wrap("osm2pgsql-gen")
            .WithArguments(args => args
                .Add("--database").Add(dbConfig.Database)
                .Add("--username").Add(dbConfig.Username)
                .Add("--host").Add(dbConfig.Host)
                .Add("--port").Add(dbConfig.Port)
                .Add("--schema").Add(_config.Schema)
                
                .Add("-S").Add(_config.StyleFilePath)
                .Add("-j").Add(Environment.ProcessorCount.ToString())
            )
            .WithEnvironmentVariables(env => env
                .Set("PGPASSWORD", dbConfig.Password)
                .Set("LUA_PATH", _config.StyleLuaPath)
                .Set("OSM_SCHEMA", _config.Schema)
            );
        
        return (await runner.RunAsync(command, c)).ToResult();
    }


    public async Task<Result> InitializeReplication(CancellationToken c = default)
    {
        var pbfPath = GetPbfFilePath();

        var command = Cli.Wrap("osm2pgsql-replication")
            .WithArguments(args =>
                {
                    args
                        .Add("init")
                        .Add("--database").Add(dbConfig.Database)
                        .Add("--username").Add(dbConfig.Username)
                        .Add("--host").Add(dbConfig.Host)
                        .Add("--port").Add(dbConfig.Port)
                        .Add("--schema").Add(_config.Schema);

                    if (!string.IsNullOrEmpty(_config.Osm2Pgsql.Prefix))
                        args.Add("--prefix").Add(_config.Osm2Pgsql.Prefix);

                    args.Add("--osm-file").Add(pbfPath);
                })
                .WithEnvironmentVariables(env => env
                    .Set("PGPASSWORD", dbConfig.Password));
            
        return (await runner.RunAsync(command, c)).ToResult();
    }
    
    
    

    public async Task<Result> DownloadExternalLayers(CancellationToken c = default)
    {
        Directory.CreateDirectory(_config.DataDirectory);
        
        // Config
        var layerCfg = new[]
        {
            new { Layer = "water-polygons-split-3857", Table = "ocean", InLayer = "water_polygons" },
            new { Layer = "simplified-water-polygons-split-3857", Table = "ocean_low", InLayer = "simplified_water_polygons" },
        };

        logger.LogInformation("Downloading external layers...");

        // Download
        foreach (var layer in layerCfg)
        {
            logger.LogInformation("Downloading {Layer}...", layer.Layer);

            var command = Cli.Wrap("wget")
                .WithArguments(args => args
                    .Add("-N") // Only download if newer TODO accept a few days stale
                    .Add($"https://osmdata.openstreetmap.de/download/{layer.Layer}.zip"))
                .WithWorkingDirectory(_config.DataDirectory);
            
            var result = await runner.RunAsync(command, c);
            if (result.IsFailed) return result.ToResult();
        }

        logger.LogInformation("Importing external layers...");

        // Import
        foreach (var layer in layerCfg)
        {
            await ImportLayerAsync(layer.Layer, layer.Table, layer.InLayer, c);
        }

        logger.LogInformation("External layers download and import complete.");
        
        return Result.Ok();
    }

    private async Task ImportLayerAsync(string layer, string table, string inLayer, CancellationToken cancellationToken)
    {
        var schema = _config.Schema;
        var tempTable = $"{table}_new";
        var fullTable = $"{schema}.{table}";
        var fullTempTable = $"{schema}.{tempTable}";
        
        SqlUtil.ValidateSqlIdentifier(schema);
        SqlUtil.ValidateSqlIdentifier(table);

        logger.LogInformation("Importing {Layer} into {Table}...", layer, fullTable);

        // import
        await Cli.Wrap("ogr2ogr")
            .WithArguments(args => args
                .Add("-f").Add("PostgreSQL")
                .Add($"PG:dbname={dbConfig.Database} host={dbConfig.Host} port={dbConfig.Port} user={dbConfig.Username} password={dbConfig.Password}")
                .Add("-overwrite")
                .Add("-nln").Add(fullTempTable)
                .Add("-lco").Add("GEOMETRY_NAME=geom")
                .Add("-lco").Add("FID=id")
                .Add("-lco").Add("SPATIAL_INDEX=NONE")
                .Add("-sql").Add($"select \"_ogr_geometry_\" from {inLayer}")
                .Add($"/vsizip/{layer}.zip/{layer}"))
            .WithWorkingDirectory(_config.DataDirectory)
            .ExecuteAsync(cancellationToken);

        await AnalyzeTableAsync(schema, tempTable, cancellationToken);

        await CreateSpatialIndexAsync(schema, tempTable, "geom", cancellationToken);

        await SwapTablesAsync(schema, table, tempTable, cancellationToken);
    }

    private async Task AnalyzeTableAsync(string schema, string tableName, CancellationToken cancellationToken)
    {
        var sql = $"ANALYZE {schema}.{tableName}";
        
        await db.Database.ExecuteSqlRawAsync(sql, cancellationToken);
        
        logger.LogInformation("Analyzed table {Schema}.{TableName}", schema, tableName);
    }

    private async Task CreateSpatialIndexAsync(string schema, string tableName, string columnName, CancellationToken cancellationToken)
    {
        var indexName = $"ix_{tableName}_{columnName}";
        var sql = $"CREATE INDEX IF NOT EXISTS {indexName} ON {schema}.{tableName} USING GIST ({columnName})";
        
        await db.Database.ExecuteSqlRawAsync(sql, cancellationToken);
        
        logger.LogInformation(
            "Created spatial index {IndexName} on {Schema}.{TableName}.{ColumnName}",
            indexName, schema, tableName, columnName);
    }

    private async Task SwapTablesAsync(string schema, string tableName, string tempTableName, CancellationToken cancellationToken)
    {
        var sql = $@"
            BEGIN;
            DROP TABLE IF EXISTS {schema}.{tableName};
            ALTER TABLE {schema}.{tempTableName} RENAME TO {tableName};
            COMMIT;";
        
        await db.Database.ExecuteSqlRawAsync(sql, cancellationToken);
        
        logger.LogInformation(
            "Swapped tables: {Schema1}.{TempTableName} -> {Schema2}.{TableName}",
            schema, tempTableName, schema, tableName);
    }
    
    public async Task<Result> CreateTileFunctions(CancellationToken c = default)
    {
        try
        {
            await tileFunctionGenerator.CreateTileFunctionsAsync(c);
            return Result.Ok();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to create tile functions");
            return Result.Fail(ex.Message);
        }
    }

    private string GetPbfFilePath()
    {
        var filename = _config.ExtractUrl.Split('/').Last();
        return Path.Combine(_config.DataDirectory, filename);
    }
}