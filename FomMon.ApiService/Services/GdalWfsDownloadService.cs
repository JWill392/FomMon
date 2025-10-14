using System.Diagnostics;
using FomMon.ApiService.Infrastructure;
using FomMon.Data.Configuration.Layer;
using FomMon.Data.Contexts;
using FomMon.Data.Shared;
using FomMon.ServiceDefaults;
using Microsoft.Extensions.Options;
using Microsoft.EntityFrameworkCore;
using OpenTelemetry.Trace;

namespace FomMon.ApiService.Services;

public static class GdalWfsDownloaderExtensions
{
    public static IServiceCollection AddWfsDownloader(this IServiceCollection services,
        Action<WfsDownloadServiceSettings>? configure = null)
    {
        services.AddOptions<WfsDownloadServiceSettings>()
            .BindConfiguration("WfsDownloader")
            .PostConfigure(configure ?? (_ => {}))
            .ValidateDataAnnotations()
            .ValidateOnStart();

        services.AddScoped<IWfsDownloadService, GdalWfsDownloadService>();

        services.ConfigureOpenTelemetryTracerProvider(t => { t.AddSource(GdalWfsDownloadService.ActivitySourceName); });

        return services;
    }
}

public interface IWfsDownloadService
{
    public Task DownloadToDbAsync(
        LayerKind kind,  
        int? limit, 
        CancellationToken c);
}

public sealed class WfsDownloadServiceSettings
{
    public long TimeoutSeconds { get; set; }
    /// <summary>
    /// Path to ogr2ogr bin, or just name if installed on PATH.  Note must be installed on host image.
    /// </summary>
    public string Ogr2OgrPath { get; set; } = string.Empty;
    public int OgrWfsPageSize { get; set; }
    public bool OgrWfsPagingAllowed { get; set; }
}

public class GdalWfsDownloadService(
    AppDbContext db, 
    IClockService clock, 
    IProcessRunner processRunner,
    IConfiguration configuration,
    ILogger<GdalWfsDownloadService> logger,
    IOptions<WfsDownloadServiceSettings> options) : IWfsDownloadService
{
    public const string ActivitySourceName = "FomMon.WfsDownloader";
    
    private static readonly ActivitySource ActivitySource = new(ActivitySourceName);
    private readonly WfsDownloadServiceSettings _settings = options.Value;
    
    private readonly string _pgConnectionString = 
        configuration.GetConnectionString("application") ??
        throw new Exception("Connection string not found");

    public async Task DownloadToDbAsync(
        LayerKind kind,  
        int? limit, 
        CancellationToken c)
    {
        using var activity = ActivitySource.StartActivity();
        
        activity?.SetTag("layer.kind", kind.ToString());

        
        var layerCfg = LayerRegistry.Get(kind);
        if (layerCfg.WfsUrl is null) throw new ArgumentException($"Layer type {kind} has no WfsUrl configured");
        if (layerCfg.WfsLayer is null) throw new ArgumentException($"Layer type {kind} has no WfsLayer configured");
        var layer = await db.LayerTypes.FindAsync([kind], c) 
            ?? throw new ArgumentException($"Layer type {kind} not found");
        
        
        activity?.SetTag("layer.name", layerCfg.TableName);
        activity?.SetTag("wfs.url", layerCfg.WfsUrl);


        // Build PostgreSQL connection string for ogr2ogr
        var builder = new Npgsql.NpgsqlConnectionStringBuilder(_pgConnectionString);
        var pgString = $"PG:host={builder.Host} port={builder.Port} dbname={builder.Database} " +
                      $"user={builder.Username} password={builder.Password} " +
                      $"active_schema={LayerRegistry.Schema}";

        
        // Build ogr2ogr arguments
        var args = new List<string>
        {
            "--config", "OGR_WFS_PAGE_SIZE", _settings.OgrWfsPageSize.ToString(), // TODO configure
            "--config", "OGR_WFS_PAGING_ALLOWED", _settings.OgrWfsPagingAllowed ? "ON" : "OFF",
            "-f", "PostgreSQL",
            pgString,
            $"WFS:{layerCfg.WfsUrl}",
            layerCfg.WfsLayer, // layer name
            "-nln", $"{LayerRegistry.Schema}.{layerCfg.TableName}",
            "-overwrite",
            "-t_srs", LayerRegistry.DefaultSridString,
            "-lco", $"GEOMETRY_NAME={LayerRegistry.GeometryColumn}",
            "-lco", $"SCHEMA={LayerRegistry.Schema}",
            "-lco", $"DESCRIPTION={layerCfg.Description}",
            
        };
        if (limit.HasValue)
        {
            args.Add("-limit");
            args.Add(limit.Value.ToString());
        }
        

        // Execute ogr2ogr with timeout
        using (var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(c))
        {
            timeoutCts.CancelAfter(TimeSpan.FromSeconds(_settings.TimeoutSeconds));

            ProcessResult result;
            try
            {
                result = await processRunner.RunAsync(_settings.Ogr2OgrPath, args, timeoutCts.Token);

            }
            catch (OperationCanceledException) when (timeoutCts.IsCancellationRequested && !c.IsCancellationRequested)
            {
                var ex = new TimeoutException(
                    $"ogr2ogr operation timed out after {_settings.TimeoutSeconds} seconds");
                activity?.SetStatus(ActivityStatusCode.Error, "Timeout");
                activity?.AddException(ex);
                throw ex;
            }
            catch (Exception ex)
            {
                activity?.SetStatus(ActivityStatusCode.Error, ex.Message);
                activity?.AddException(ex);
                throw;
            }
        
            if (result.ExitCode != 0)
            {
                activity?.SetStatus(ActivityStatusCode.Error, $"Exit code: {result.ExitCode}");
                throw new Exception(
                    $"ogr2ogr failed with exit code {result.ExitCode}. Error: {result.Error}");
            }
        }
        
        
        // ogr2ogr generates its own PK, so index real source key
        // (tried -preserve_fid, -lco FID=column, even sql select objectid as fid/ogc_fid etc.
        await CreateIndexAsync(LayerRegistry.Schema, layerCfg.TableName, layerCfg.SourceIdColumn, c);
        
        // Update metadata
        layer.FeatureCount = await GetFeatureCountAsync(layerCfg.TableName, c);
        layer.LastDownloaded = clock.Now;
        
        activity?.SetTag("feature.count", layer.FeatureCount);
        
        await db.SaveChangesAsync(c);
        
        logger.LogInformation(
            "Successfully downloaded WFS layer {LayerName} with {FeatureCount} features",
            layerCfg.TableName, layer.FeatureCount);
    }
    
    private async Task<long> GetFeatureCountAsync(string tableName, CancellationToken c)
    {
        var sql = $"SELECT COUNT(*) FROM {LayerRegistry.Schema}.{tableName}";
        var res = await db.Database.SqlQueryRaw<long>(sql).ToListAsync(c);
        return res.FirstOrDefault();
    }
    
    private async Task CreateIndexAsync(string schema, string tableName, string columnName, CancellationToken c)
    {
        SqlUtil.ValidateSqlIdentifier(schema);
        SqlUtil.ValidateSqlIdentifier(tableName);
        SqlUtil.ValidateSqlIdentifier(columnName);
        
        var indexName = $"ix_{tableName}_{columnName}";
        var sql = $@"
            CREATE INDEX IF NOT EXISTS {indexName} 
            ON {schema}.{tableName} ({columnName})";
        
        await db.Database.ExecuteSqlRawAsync(sql, c);
        
        logger.LogInformation(
            "Created index {IndexName} on {TableName}.{ColumnName}",
            indexName, tableName, columnName);
    }
}