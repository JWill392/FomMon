using System.Diagnostics;
using FluentResults;
using FomMon.Common.Configuration.Layer;
using FomMon.Common.Infrastructure;
using FomMon.Common.Shared;
using FomMon.Data.Contexts;
using FomMon.Data.Models;
using FomMon.ServiceDefaults;
using Hangfire;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using NodaTime;
using Npgsql;
using OpenTelemetry.Trace;

namespace FomMon.ApiService.Jobs;

public interface IWfsDownloadJob
{
    public Task DownloadToDbAsync(
        LayerKind kind,  
        int? limit, 
        Duration? updateAge,
        int zeroFeatureAttempts,
        CancellationToken c);
}

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

        services.ConfigureOpenTelemetryTracerProvider(t => t.AddSource(GdalWfsDownloadJob.ActivitySourceName));

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
                x => x.DownloadToDbAsync(layerKind, null, Duration.FromHours(11), 0, CancellationToken.None), 
                Cron.Daily(7, (i*10) % 60));
            
            // run immediately once
            if (parentJobId is null)
            {
                parentJobId = BackgroundJob.Enqueue<GdalWfsDownloadJob>(x =>
                    x.DownloadToDbAsync(layerKind, null, Duration.FromHours(11), 0, CancellationToken.None));
            }
            else
            {
                parentJobId = BackgroundJob.ContinueJobWith<GdalWfsDownloadJob>(parentJobId,
                    x => x.DownloadToDbAsync(layerKind, null, Duration.FromHours(11), 0, CancellationToken.None));
            }

            i++;
        }
    }

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
    public int AcceptZeroFeaturesAfterAttempts { get; set; } = 3;
}

public class GdalWfsDownloadJob(
    AppDbContext db, 
    IClockService clock, 
    IProcessRunner processRunner,
    IConfiguration configuration,
    ILogger<GdalWfsDownloadJob> logger,
    IDatabaseConfiguration dbConfig,
    IOptions<WfsDownloadJobSettings> options) : IWfsDownloadJob
{
    public const string ActivitySourceName = nameof(GdalWfsDownloadJob);
    
    private static readonly ActivitySource ActivitySource = new(ActivitySourceName);
    private readonly WfsDownloadJobSettings _settings = options.Value;
    

    
    public async Task DownloadToDbAsync(
        LayerKind kind,  
        int? limit, 
        Duration? updateAge,
        int zeroFeatureAttempts,
        CancellationToken c)
    {
        using var activity = ActivitySource.StartActivity();
        activity?.SetTag("layer.kind", kind.ToString());

        await db.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
        {
            await using var transaction = await db.Database.BeginTransactionAsync(c);

            var layerCfg = LayerRegistry.Get(kind);
            ArgumentNullException.ThrowIfNull(layerCfg.WfsUrl);
            ArgumentNullException.ThrowIfNull(layerCfg.WfsLayer);
            
            activity?.SetTag("layer.name", layerCfg.TableName);
            activity?.SetTag("wfs.url", layerCfg.WfsUrl);
            activity?.SetTag("wfs.layer", layerCfg.WfsLayer);

            var layer = await TryGetLayerWithLock(kind, c);
            if (layer is null)
            {
                logger.LogWarning("Skipped downloading because layer {kind} is currently being downloaded.", kind);
                return;
            }


            if (layer.FeatureCount > 0 && updateAge is not null && clock.Now - layer.LastDownloaded < updateAge)
            {
                logger.LogInformation(
                    "Skipped downloading because layer {kind} was updated more recently than {updateAge}", kind,
                    updateAge);
                return;
            }

            
            var downloadedCount = await RunOgr2Ogr(limit, layerCfg, layer, c);
            Activity.Current?.SetTag("feature.count", downloadedCount);
            // TODO failed to complete updating ,but still marked layer as updated. Possible ogr2ogr doesn't wait for transaction to commit? seems unlikely.
            if (layer.FeatureCount > 0 && downloadedCount == 0 && zeroFeatureAttempts <= _settings.AcceptZeroFeaturesAfterAttempts)
            {
                logger.LogWarning("Skipped saving because remote layer {kind} returned no features.  " +
                                  "Retry attempt {zeroFeatureAttempts}. Will accept after {AcceptZeroFeaturesAfterAttempts}", 
                    kind, zeroFeatureAttempts, _settings.AcceptZeroFeaturesAfterAttempts);
                
                var nextAttempt = zeroFeatureAttempts + 1;
                var delayMinutes = nextAttempt * nextAttempt; // 1, 4, 9
                BackgroundJob.Schedule<GdalWfsDownloadJob>(x => 
                        x.DownloadToDbAsync(kind, limit, updateAge, zeroFeatureAttempts, CancellationToken.None), 
                    TimeSpan.FromMinutes(delayMinutes));
                
                return; // rollback trans; job scheduling not transactional
            }
            
            layer.FeatureCount = downloadedCount;
            layer.LastDownloaded = clock.Now;
            
            await db.SaveChangesAsync(c);
            
            logger.LogInformation(
                "Successfully downloaded WFS layer {LayerName} with {FeatureCount} features",
                layerCfg.TableName, layer.FeatureCount);
            Activity.Current?.SetStatus(ActivityStatusCode.Ok);
            
            
            await transaction.CommitAsync(c);
        });
    }

    /// <summary>
    /// Try to get exclusive lock on layer.  Returns null if lock is not available.
    /// </summary>
    private async Task<LayerType?> TryGetLayerWithLock(LayerKind kind, CancellationToken c)
    { 
        try
        {
            await db.Database.ExecuteSqlRawAsync($@"
                SELECT 1
                FROM {LayerRegistry.Schema}.layer_types
                WHERE kind = @kind
                FOR UPDATE NOWAIT
             ",
                new NpgsqlParameter("kind", kind.ToString())
            );
            return await db.LayerTypes.FindAsync([kind], c);
        }
        catch (PostgresException ex)
        {
            // NOTE: error logged by EF Core can be ignored
            logger.LogDebug("Failed to get lock on layer {kind}: {ex}", kind, ex.Message);
            return null;
        }
    }

    private async Task<long> RunOgr2Ogr(int? limit, LayerConfig layerCfg, LayerType layer,
        CancellationToken c)
    {
        // change to environmental variables
        var pgString = $"PG:host={dbConfig.Host} port={dbConfig.Port} dbname={dbConfig.Database} " +
                       $"user={dbConfig.Username} password={dbConfig.Password} " +
                       $"active_schema={LayerRegistry.Schema}";
            
        // Build ogr2ogr arguments
        var args = new List<string>
        {
            "--config", "OGR_WFS_PAGE_SIZE", _settings.OgrWfsPageSize.ToString(),
            "--config", "OGR_WFS_PAGING_ALLOWED", _settings.OgrWfsPagingAllowed ? "ON" : "OFF",
            "-f",
            "PostgreSQL",
            pgString,
            $"WFS:{layerCfg.WfsUrl}",
            layerCfg.WfsLayer!, // layer name
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

            Result<ProcessResult> result = await processRunner.RunAsync(_settings.Ogr2OgrPath, args, timeoutCts.Token);
            if (result.IsFailed)
            {
                Activity.Current?.SetStatus(ActivityStatusCode.Error, result.Errors.First().Message);
                throw new Exception(result.Errors.First().Message);
            }
            
        }
            
            
        // ogr2ogr generates its own PK, so index real source key
        // (tried -preserve_fid, -lco FID=column, even sql select objectid as fid/ogc_fid etc.
        await CreateIndexAsync(LayerRegistry.Schema, layerCfg.TableName, layerCfg.SourceIdColumn, c);
            
        // Update metadata
        return await GetFeatureCountAsync(layerCfg.TableName, c);
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