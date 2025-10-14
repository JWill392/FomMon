using System.Text.Json;
using FomMon.Data.Contexts;
using FomMon.Data.Models;
using FomMon.ServiceDefaults;
using FomMon.ApiService.Shared;
using FomMon.Data.Configuration.Layer;
using MapsterMapper;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using Npgsql;

namespace FomMon.ApiService.Services;

public interface IFeatureService
{
    public Task<List<FeatureReference>> GetIntersectingAsync(LayerKind kind, Geometry geometry,
        CancellationToken c = default);

}




public sealed class FeatureService(
    AppDbContext db, 
    IClockService clock, 
    IMapper mapper) : IFeatureService
{
    private record FeatureSourceRecord(
        string SourceFeatureId, 
        Geometry Geometry, 
        JsonDocument? AttributesSnapshot) : IDisposable
    {
        public void Dispose() => AttributesSnapshot?.Dispose();
    }
    
    public async Task<List<FeatureReference>> GetIntersectingAsync(
        LayerKind kind,
        Geometry geometry,
        CancellationToken c = default)
    {
        var layerCfg = LayerRegistry.Get(kind);

        // find intersections
        var features = await db.Database
#pragma warning disable EF1002
            .SqlQueryRaw<FeatureSourceRecord>(
                $"""
                SELECT cast({layerCfg.SourceIdColumn} as text) as source_feature_id
                     , {LayerRegistry.GeometryColumn} as geometry
                     , row_to_json(t) as attributes_snapshot
                FROM {LayerRegistry.Schema}.{layerCfg.TableName} as t
                WHERE ST_Intersects({LayerRegistry.GeometryColumn}, @geom)
                """, 
                new NpgsqlParameter("kind", kind.ToString()),
                new NpgsqlParameter("geom", geometry)
                    {NpgsqlDbType = NpgsqlTypes.NpgsqlDbType.Geometry}
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
                f.SourceFeatureId == featureSource.SourceFeatureId, c);
    
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


        var newRef = new FeatureReference() 
        {
            LayerKind = kind,
            SourceFeatureId = featureSource.SourceFeatureId,
            Geometry = featureSource.Geometry,
            AttributesSnapshot = featureSource.AttributesSnapshot?.WithRemovedProperty(LayerRegistry.GeometryColumn),
            FirstSeenAt = clock.Now,
            LastSeenAt = clock.Now
        };
        
    
        db.FeatureReferences.Add(newRef);
        await db.SaveChangesAsync(c);
        return newRef;
    }
    
    public async Task ReconcileAsync(LayerKind kind, CancellationToken c) // TODO reconcileasync as task
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
                .SqlQuery<int>(
                    $"""
                     SELECT 1 
                     FROM {layerCfg.TableName} 
                     WHERE {layerCfg.SourceIdColumn} = {featureRef.SourceFeatureId}
                     """)
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