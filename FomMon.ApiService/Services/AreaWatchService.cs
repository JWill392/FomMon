using FluentResults;
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
    Task<Result<AreaWatch>> CreateAsync(CreateAreaWatchRequest dto, Guid userId, CancellationToken c = default);
    
    Task<Result<AreaWatch>> GetByIdAsync(Guid id, Guid userId, CancellationToken c = default);
    Task<Result<AreaWatch>> UpdateAsync(Guid id,  UpdateAreaWatchRequest dto, Guid userId, CancellationToken c);
    Task<Result<ICollection<AreaWatch>>> ListAsync(Guid userId, CancellationToken c = default);
    
    Task<Result> DeleteAsync(Guid id, Guid userId, CancellationToken c = default);
    
    public Task<Result<string>> UploadThumbnailImage(Guid id, Guid userId, Stream image, long length, CancellationToken c = default);
}

public sealed class AreaWatchService(
    AppDbContext db, 
    IClockService clock, 
    IMapper mapper,
    IObjectStorageService objectStorageService,
    IEntityObjectStorageService entityObjectStorageService) : IAreaWatchService
{

    public async Task<Result<AreaWatch>> CreateAsync(CreateAreaWatchRequest dto, Guid userId, CancellationToken c = default)
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
        
        return Result.Ok(areaWatch);
    }

    public async Task<Result<AreaWatch>> GetByIdAsync(Guid id, Guid userId, CancellationToken c = default)
    {
        if (userId == Guid.Empty) throw new ArgumentException("UserId is required");
        var aw = await db.AreaWatches.FindAsync([id], c);
        if (aw?.UserId != userId) return Result.Fail(new NotFoundError());
        return aw;
    }

    public async Task<Result<AreaWatch>> UpdateAsync(Guid id, UpdateAreaWatchRequest dto, Guid userId, CancellationToken c)
    {
        var (aw, errors) = await GetByIdAsync(id, userId, c);
        if (errors is not null) return Result.Fail(errors);

        mapper.From(dto).AdaptTo(aw); // see mapping config in dto

        await db.SaveChangesAsync(c);
        return Result.Ok(aw);
    }

    public async Task<Result<ICollection<AreaWatch>>> ListAsync(Guid userId, CancellationToken c = default)
    {
        var areaWatches = await db.AreaWatches
            .Where(aw => aw.UserId == userId)
            .ToListAsync(c);
        
        return Result.Ok<ICollection<AreaWatch>>(areaWatches);
    }

    public async Task<Result> DeleteAsync(Guid id, Guid userId, CancellationToken c = default)
    {
        var (aw, errors) = await GetByIdAsync(id, userId, c);
        if (errors is not null) return Result.Fail(errors);
        
        await objectStorageService.DeleteImageAsync(aw.ThumbnailImageObjectName, c);
        
        db.AreaWatches.Remove(aw);
        
        await db.SaveChangesAsync(c);
        return Result.Ok();
    }

    public async Task<Result<string>> UploadThumbnailImage(Guid id, Guid userId, Stream image, long length, CancellationToken c = default)
    {
        var (aw, errors) = await GetByIdAsync(id, userId, c);
        if (errors is not null) return Result.Fail(errors);
            
        return await entityObjectStorageService.UploadImageAsync(aw, 
            a => a.ThumbnailImageObjectName, 
            a => $"area-watch-thumb-{a.Id}.png", 
            image, length, c);
    }
}