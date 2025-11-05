using FomMon.ApiService.Infrastructure;
using FomMon.ApiService.Jobs.Osm;
using FomMon.Data.Contexts;
using FomMon.Data.Models;
using FomMon.ServiceDefaults;
using Microsoft.Extensions.Options;
using NodaTime;

namespace FomMon.ApiService.Services;

public interface IOsmService : IScriptState<OsmSetupStep>
{
    Task<Osm> GetAsync(CancellationToken c = default);
}
public class OsmService(AppDbContext db, IClockService clock) : IOsmService
{
    private const int SingletonKey = 1;
    public async Task<Osm> GetAsync(CancellationToken c = default)
    {
        return await db.Osm.FindAsync([SingletonKey], c)
               ?? await CreateInitialAsync(c);
    }
    
    private async Task<Osm> CreateInitialAsync(CancellationToken c = default)
    {
        var osm = new Osm 
        { 
            Key = SingletonKey,
            SetupStep = OsmSetupStep.NotStarted,
            InitializedAt = Instant.MinValue 
        };
        db.Osm.Add(osm);
        await db.SaveChangesAsync(c);
        return osm;
    }
    

    public async Task<OsmSetupStep> GetStepCompletedAsync(CancellationToken c = default)
    {
        return (await GetAsync(c)).SetupStep;
    }
    
    public async Task SetStepCompletedAsync(OsmSetupStep step, CancellationToken c = default)
    {
        var osm = await GetAsync();
        osm.SetupStep = step;
        osm.UpdatedAt = clock.Now;
        if (step == OsmSetupStep.Initialized)
        {
            osm.InitializedAt = clock.Now;
        }
        await db.SaveChangesAsync();
    }
}