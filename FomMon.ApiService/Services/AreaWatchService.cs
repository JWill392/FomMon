using FluentResults;
using FomMon.ApiService.Contracts;
using FomMon.Data.Contexts;
using FomMon.Data.Models;
using FomMon.ServiceDefaults;
using MapsterMapper;
using Microsoft.EntityFrameworkCore;

namespace FomMon.ApiService.Services;


public interface IAreaWatchService
{
    Task<Result<AreaWatch>> CreateAsync(CreateAreaWatchRequest dto, Guid userId, CancellationToken c = default);
    
    Task<Result<AreaWatch>> GetByIdAsync(Guid id, Guid userId, CancellationToken c = default);
    Task<Result<AreaWatch>> UpdateAsync(Guid id,  UpdateAreaWatchRequest dto, Guid userId, CancellationToken c);
    Task<Result<ICollection<AreaWatch>>> ListAsync(Guid userId, CancellationToken c = default);
    
    Task<Result> DeleteAsync(Guid id, Guid userId, CancellationToken c = default);
    
    public Task<Result<string>> UploadThumbnailImageAsync(Guid id, Guid userId, ThumbnailTheme theme, Stream image, long length, string paramHash, CancellationToken c = default);
    public Task<Result<string>> GetThumbnailImageNameAsync(Guid id, Guid userId, ThumbnailTheme theme, CancellationToken c = default);
}

public sealed class AreaWatchService(
    AppDbContext db, 
    IClockService clock, 
    IMapper mapper,
    ILogger<AreaWatchService> logger,
    IImageStorageService imageStorageService) : IAreaWatchService
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
        var (original, errors) = await GetByIdAsync(id, userId, c);
        if (errors is not null) return Result.Fail(errors);

        var geometryChanged = dto.Geometry is not null && !dto.Geometry.EqualsTopologically(original.Geometry);
        var layersChanged = dto.Layers is not null && !dto.Layers.SequenceEqual(original.Layers);
        
        mapper.From(dto).AdaptTo(original); // see mapping config in dto

        if (geometryChanged || layersChanged)
        {
            
            // TODO update alerts
            // no op needed on thumbnail; it's stored with hash of geometry so users will know it's outdated if geom changed.
            
        }
            

        await db.SaveChangesAsync(c);
        return Result.Ok(original);
    }

    public async Task<Result<string>> GetThumbnailImageNameAsync(Guid id, Guid userId, ThumbnailTheme theme, CancellationToken c = default)
    {
        var (aw, errors) = await GetByIdAsync(id, userId, c);
        if (errors is not null) return Result.Fail(errors);
        
        return Result.Ok(GetThumbnailObjectName(aw, theme));
    }
    private ThumbnailTheme[] GetThemes() => [ThumbnailTheme.Light, ThumbnailTheme.Dark];
    private string GetThumbnailObjectName(AreaWatch aw, ThumbnailTheme theme)
    {
        return $"area-watch-thumb-{aw.Id}-{theme}.png";
    }
    private string[] GetThumbnailObjectNames(AreaWatch aw) => GetThemes().Select(t => GetThumbnailObjectName(aw, t)).ToArray();

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
        
        foreach (var thumbnail in GetThumbnailObjectNames(aw))
        {
            await imageStorageService.DeleteImageAsync(thumbnail, c);
        }
        
        db.AreaWatches.Remove(aw);
        
        await db.SaveChangesAsync(c);
        return Result.Ok();
    }

    public async Task<Result<string>> UploadThumbnailImageAsync(Guid id, Guid userId, ThumbnailTheme theme, Stream image, long length, string paramHash, CancellationToken c = default)
    {
        var (aw, errors) = await GetByIdAsync(id, userId, c);
        if (errors is not null) return Result.Fail(errors);
        
        var objectName = GetThumbnailObjectName(aw, theme);
        
        var uploadResult = await imageStorageService.UploadImageAsync(objectName, image, length, paramHash, c);
        return uploadResult.ToResult(objectName);
    }
}