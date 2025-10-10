using FomMon.ApiService.Contracts;
using FomMon.ApiService.Services;
using FomMon.Data.Contexts;
using FomMon.Data.Models;
using FomMon.ServiceDefaults;
using MapsterMapper;
using Microsoft.EntityFrameworkCore;

namespace FomMon.ApiService;

public interface IAreaWatchService
{
    Task<AreaWatch> CreateAsync(CreateAreaWatchRequest dto, Guid userId, CancellationToken c = default);
    
    Task<AreaWatch?> GetByIdAsync(Guid id, Guid userId, CancellationToken c = default);
    Task<AreaWatch?> UpdateAsync(Guid id,  UpdateAreaWatchRequest dto, Guid userId, CancellationToken c);
    Task<IReadOnlyList<AreaWatch>> ListAsync(Guid userId, CancellationToken c = default);
    
    Task<bool> DeleteAsync(Guid id, Guid userId, CancellationToken c = default);
}

public sealed class AreaWatchService(
    AppDbContext db, 
    IClockService clock, 
    IMapper mapper,
    IFeatureService featureService) : IAreaWatchService
{

    public async Task<AreaWatch> CreateAsync(CreateAreaWatchRequest dto, Guid userId, CancellationToken c = default)
    {
        if (userId == Guid.Empty) throw new ArgumentException("UserId is required");
        ArgumentNullException.ThrowIfNull(dto.Geometry);
        if (!dto.Geometry.IsValid) throw new ArgumentException("Geometry is invalid");
        
        // TODO prevent ~duplicate geometries

        var areaWatch = mapper.From(dto).AdaptToType<AreaWatch>();
        areaWatch.UserId = userId;
        areaWatch.AddedDate = clock.Now;
        
        await db.AddAsync(areaWatch, c);
        await db.SaveChangesAsync(c);
        
        return areaWatch;
    }

    public async Task<AreaWatch?> GetByIdAsync(Guid id, Guid userId, CancellationToken c = default)
    {
        if (userId == Guid.Empty) throw new ArgumentException("UserId is required");
        return await db.AreaWatches
            .AsNoTracking()
            .SingleOrDefaultAsync(a => a.Id == id && a.UserId == userId, c);
    }

    public async Task<AreaWatch?> UpdateAsync(Guid id, UpdateAreaWatchRequest dto, Guid userId, CancellationToken c)
    {
        var aw = await db.AreaWatches
            .SingleOrDefaultAsync(a => a.Id == id && a.UserId == userId, c);
        
        if (aw is null) return null; // not found

        mapper.From(dto).AdaptTo(aw); // see mapping config in dto

        await db.SaveChangesAsync(c);
        return aw;
    }

    public async Task<IReadOnlyList<AreaWatch>> ListAsync(Guid userId, CancellationToken c = default)
    {
        var areaWatches = await db.AreaWatches
            .Where(aw => aw.UserId == userId)
            .ToListAsync(c);
        
        return areaWatches;
    }

    public async Task<bool> DeleteAsync(Guid id, Guid userId, CancellationToken c = default)
    {
        var areaWatch = await db.AreaWatches
            .SingleOrDefaultAsync(a => a.Id == id && a.UserId == userId, c);

        if (areaWatch is null)
            return false;
        
        db.AreaWatches.Remove(areaWatch);
        
        await db.SaveChangesAsync(c);
        return true;
    }
}