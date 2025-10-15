using System.Diagnostics;
using FomMon.ApiService.Infrastructure;
using FomMon.Data.Configuration.Layer;
using FomMon.Data.Contexts;
using FomMon.Data.Shared;
using FomMon.ServiceDefaults;
using Hangfire;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using NodaTime;
using OpenTelemetry.Trace;

namespace FomMon.ApiService.Jobs;

public static class WfsDownloadJobExtensions
{
    public static IServiceCollection AddWfsDownloadJob(this IServiceCollection services,
        Action<WfsDownloadJobSettings>? configure = null)
    {
        services.AddOptions<WfsDownloadJobSettings>()
            .BindConfiguration("WfsDownloader")
            .PostConfigure(configure ?? (_ => {}))
            .ValidateDataAnnotations()
            .ValidateOnStart();

        services.AddScoped<IWfsDownloadJob, GdalWfsDownloadJob>(); // for direct call in testing/admin

        services.ConfigureOpenTelemetryTracerProvider(t => { t.AddSource(GdalWfsDownloadJob.ActivitySourceName); });

        return services;
    }
    
     
    public static void ConfigureJobs()
    {
        string? parentJobId = null;
        int i = 0;
        foreach (var layerKind in LayerRegistry.All.Where(l => l.WfsUrl is not null).Select(l => l.Kind))
        {
            RecurringJob.AddOrUpdate<GdalWfsDownloadJob>(
                $"{nameof(GdalWfsDownloadJob.DownloadToDbAsync)}.{layerKind}", 
                x => x.DownloadToDbAsync(layerKind, null, Duration.FromHours(11), CancellationToken.None), 
                Cron.Daily(7, (i*10) % 60));
            
            
            // run immediately once
            if (parentJobId is null)
            {
                parentJobId = BackgroundJob.Enqueue<GdalWfsDownloadJob>(x =>
                    x.DownloadToDbAsync(layerKind, null, Duration.FromHours(11), CancellationToken.None));
            }
            else
            {
                parentJobId = BackgroundJob.ContinueJobWith<GdalWfsDownloadJob>(parentJobId,
                    x => x.DownloadToDbAsync(layerKind, null, Duration.FromHours(11), CancellationToken.None));
            }

            i++;
        }
    }

}

public interface IWfsDownloadJob
{
    public Task DownloadToDbAsync(
        LayerKind kind,  
        int? limit, 
        Duration? updateAge,
        CancellationToken c);
}

public sealed class WfsDownloadJobSettings
{
    public long TimeoutSeconds { get; set; }
    /// <summary>
    /// Path to ogr2ogr bin, or just name if installed on PATH.  Note must be installed on host image.
    /// </summary>
    public string Ogr2OgrPath { get; set; } = string.Empty;
    public int OgrWfsPageSize { get; set; }
    public bool OgrWfsPagingAllowed { get; set; }
}

public class GdalWfsDownloadJob(
    AppDbContext db, 
    IClockService clock, 
    IProcessRunner processRunner,
    IConfiguration configuration,
    ILogger<GdalWfsDownloadJob> logger,
    IOptions<WfsDownloadJobSettings> options) : IWfsDownloadJob
{
    public const string ActivitySourceName = "FomMon.WfsDownloader";
    
    private static readonly ActivitySource ActivitySource = new(ActivitySourceName);
    private readonly WfsDownloadJobSettings _settings = options.Value;
    
    private readonly string _pgConnectionString = 
        configuration.GetConnectionString("application") ??
        throw new Exception("Connection string not found");

   
    
    
    
    public async Task DownloadToDbAsync(
        LayerKind kind,  
        int? limit, 
        Duration? updateAge,
        CancellationToken c)
    {
        using var activity = ActivitySource.StartActivity();
        activity?.SetTag("layer.kind", kind.ToString());

        var layerCfg = LayerRegistry.Get(kind);
        if (layerCfg.WfsUrl is null) throw new ArgumentException($"Layer type {kind} has no WfsUrl configured");
        if (layerCfg.WfsLayer is null) throw new ArgumentException($"Layer type {kind} has no WfsLayer configured");
        activity?.SetTag("layer.name", layerCfg.TableName);
        activity?.SetTag("wfs.url", layerCfg.WfsUrl);
        
        var layer = await db.LayerTypes.FindAsync([kind], c) 
            ?? throw new ArgumentException($"Layer type {kind} not found");

        if (layer.FeatureCount > 0 && updateAge is not null && clock.Now - layer.LastDownloaded < updateAge)
        {
            logger.LogInformation("Skipped downloading because layer {kind} was updated more recently than {updateAge}", kind, updateAge);
            return;
        }

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