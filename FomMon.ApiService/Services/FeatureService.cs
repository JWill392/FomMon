using System.Text.Json;
using FomMon.ApiService.Contracts;
using FomMon.Data.Contexts;
using FomMon.Data.Models;
using FomMon.ServiceDefaults;
using FomMon.ApiService.Shared;
using FomMon.Common.Configuration.Layer;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using Npgsql;

namespace FomMon.ApiService.Services;

public interface IFeatureService
{
    public Task<List<FeatureReference>> GetIntersectingAsync(LayerKind kind, Geometry geometry,
        CancellationToken c = default);

    public Task<FeatureDto?> GetDtoAsync(LayerKind kind, int sourceFeatureId, CancellationToken c = default);
}

public sealed class FeatureService(
    AppDbContext db, 
    IClockService clock) : IFeatureService
{
    private record FeatureSourceRecord(
        int Id, 
        Geometry Geometry, 
        JsonDocument Properties) : IDisposable
    {
        public void Dispose() => Properties?.Dispose();
    }
    
    public async Task<List<FeatureReference>> GetIntersectingAsync(
        LayerKind kind,
        Geometry geometry,
        CancellationToken c = default)
    {

        // find intersections
        var features = await db.Database
#pragma warning disable EF1002
            .SqlQueryRaw<FeatureSourceRecord>(
                GenerateSelectFeature(kind, $"WHERE ST_Intersects({LayerRegistry.GeometryColumn}, @geom)"), 
                new NpgsqlParameter("kind", kind.ToString()),
                new NpgsqlParameter("geom", geometry) {NpgsqlDbType = NpgsqlTypes.NpgsqlDbType.Geometry}
            ) 
#pragma warning restore EF1002
            .ToListAsync(c);
        
        

        // get feature references
        var refs = new List<FeatureReference>();
        foreach (var f in features)
        {
            var fr = await GetOrCreateAsync(kind, f, c);
            refs.Add(fr);
            f.Dispose();
        }

        return refs;
    }

    public async Task<FeatureDto?> GetDtoAsync(LayerKind kind, int sourceFeatureId, CancellationToken c = default)
    {
        var layerCfg = LayerRegistry.Get(kind);

        // find intersections
        var features = await db.Database
#pragma warning disable EF1002
            .SqlQueryRaw<FeatureSourceRecord>(
                GenerateSelectFeature(kind, $"WHERE {layerCfg.SourceIdColumn} = @sourceFeatureId"), 
                new NpgsqlParameter("kind", kind.ToString()),
                new NpgsqlParameter("sourceFeatureId", sourceFeatureId)
            ) 
#pragma warning restore EF1002
            .ToListAsync(c);
        
        var feat = features.FirstOrDefault();
        if (feat is null) return null;

        var dto = new FeatureDto(
            Id: feat.Id, 
            Kind: kind, 
            Geometry: feat.Geometry,
            Properties: feat.Properties.WithRemovedProperties(LayerRegistry.GeometryColumn, layerCfg.SourceIdColumn));
        feat.Dispose();

        return dto;
    }

    private string GenerateSelectFeature(LayerKind kind, string where)
    {
        var layerCfg = LayerRegistry.Get(kind);
        return $"""
                SELECT cast({layerCfg.SourceIdColumn} as integer) as id
                     , {LayerRegistry.GeometryColumn} as geometry
                     , row_to_json(t) as properties
                FROM {LayerRegistry.Schema}.{layerCfg.TableName} as t
                {where}
                """;
    }
    
    /// <summary>
    /// Copy interesting feature from 'warehouse' layers into stable application table; FeatureReference
    /// </summary>
    /// <returns>Found or created feature reference</returns>
    private async Task<FeatureReference> GetOrCreateAsync(
        LayerKind kind,
        FeatureSourceRecord featureSource,
        CancellationToken c)
    {
        var existing = await db.FeatureReferences
            .FirstOrDefaultAsync(f => 
                f.LayerKind == kind && 
                f.SourceFeatureId == featureSource.Id, c);
    
        if (existing != null)
        {
            existing.LastSeenAt = clock.Now;
            if (existing.IsDeleted)
            {
                existing.IsDeleted = false; // Feature came back
                // DeletedAt preserved
            }
            return existing;
        }


        var layerCfg = LayerRegistry.Get(kind);
        var newRef = new FeatureReference() 
        {
            LayerKind = kind,
            SourceFeatureId = featureSource.Id,
            Geometry = featureSource.Geometry,
            Properties = featureSource.Properties?.WithRemovedProperties(LayerRegistry.GeometryColumn, layerCfg.SourceIdColumn),
            FirstSeenAt = clock.Now,
            LastSeenAt = clock.Now
        };
        
    
        db.FeatureReferences.Add(newRef);
        await db.SaveChangesAsync(c);
        return newRef;
    }
    
    public async Task ReconcileAsync(LayerKind kind, CancellationToken c) // TODO reconcileasync as job
    {
        var layerCfg = LayerRegistry.Get(kind);
    
        // Mark features as deleted if they no longer exist in the layer
        var existingRefs = await db.FeatureReferences
            .Where(f => f.LayerKind == kind && !f.IsDeleted)
            .ToListAsync(c);
    
        // TODO performance; change to IN list
        foreach (var featureRef in existingRefs)
        {
            var exists = await db.Database
                .SqlQueryRaw<int>(
                    $"""
                     SELECT 1 
                     FROM {LayerRegistry.Schema}.{layerCfg.TableName} 
                     WHERE {layerCfg.SourceIdColumn} = @sourceFeatureId
                     """,
                    new NpgsqlParameter("sourceFeatureId", featureRef.SourceFeatureId))
                .AnyAsync(c);
        
            if (!exists)
            {
                featureRef.IsDeleted = true;
                featureRef.DeletedAt = clock.Now;
            }
        }
    
        await db.SaveChangesAsync(c);
    }
    
}