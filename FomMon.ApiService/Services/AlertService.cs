using FomMon.Data.Contexts;
using FomMon.Data.Models;
using FomMon.ServiceDefaults;
using Microsoft.EntityFrameworkCore;

namespace FomMon.ApiService.Services;

public interface IAlertService
{
    Task<IReadOnlyList<AreaAlert>?> GetAlertsAsync(Guid areaWatchId, Guid userId, CancellationToken c = default);
    Task<IReadOnlyList<AreaAlert>> GetAlertsAsync(Guid userId, CancellationToken c = default);
}

public sealed class AlertService(
    AppDbContext db, 
    FeatureService featureService,
    IClockService clock,
    ILogger<AlertService> logger) : IAlertService
{
    public async Task<IReadOnlyList<AreaAlert>?> GetAlertsAsync(Guid areaWatchId, Guid userId, CancellationToken c = default)
    {
        var aw = await db.AreaWatches
            .Include(aw => aw.Alerts)
            .ThenInclude(a => a.FeatureReference)
            .SingleOrDefaultAsync(a => a.Id == areaWatchId && a.UserId == userId, c);

        if (aw is null) return null; 

        var alerts = await GetOrCreateAlertsAsync(aw, c);
        
        return alerts;
    }

    public async Task<IReadOnlyList<AreaAlert>> GetAlertsAsync(Guid userId, CancellationToken c = default)
    {
        // TODO support filtering to new alerts
        var watches = await db.AreaWatches
            .Include(aw => aw.Alerts)
            .ThenInclude(a => a.FeatureReference)
            .Where(a => a.UserId == userId)
            .ToListAsync(c);

        List<AreaAlert> alerts = [];
        foreach (var aw in watches)
        {
            alerts.AddRange(await GetOrCreateAlertsAsync(aw, c));
        }
        
        return alerts;
    }

    private async Task<List<AreaAlert>> GetOrCreateAlertsAsync(AreaWatch aw, CancellationToken c = default)
    {
        ArgumentNullException.ThrowIfNull(aw, nameof(aw));
        var existingAlerts = aw.Alerts.ToList();
        var alertedFeatureIds = existingAlerts.Select(a => a.FeatureId).ToHashSet();
        var addedAlerts = new List<AreaAlert>();
        
        foreach (var kind in aw.Layers) 
        {
            var currentFeatures = await featureService.GetIntersectingAsync(kind, aw.Geometry, c);
            
            var unalertedFeatures = currentFeatures.ExceptBy(alertedFeatureIds, cur => cur.Id).ToList();
            
            logger.LogDebug("Intersecting features for {aw}, {kind}: {countFeatures} current, {unalertedCount} not yet alerted", 
                aw, kind, currentFeatures.Count, unalertedFeatures.Count);
            foreach (var f in unalertedFeatures)
            {
                var a = new AreaAlert
                {
                    AreaWatch = aw,
                    FeatureReference = f,
                    LayerKind = f.LayerKind,
                    TriggeredAt = clock.Now,
                };
                addedAlerts.Add(a);
            }
        }

        if (addedAlerts.Count > 0) logger.LogDebug("Added {addedCount} alerts to {aw}", addedAlerts.Count, aw);
        await db.AreaWatchAlerts.AddRangeAsync(addedAlerts, c);
        await db.SaveChangesAsync(c);
        
        return existingAlerts.Union(addedAlerts).ToList();
    }
}