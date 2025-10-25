using FluentResults;
using FomMon.ApiService.Contracts;
using FomMon.ApiService.Infrastructure;
using FomMon.ApiService.Services;
using FomMon.Data.Models;
using MapsterMapper;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;

namespace FomMon.ApiService.Controllers;

[ApiController]
[Route("[controller]")]
public class AreaWatchController(
    IAreaWatchService service, 
    IMapper mapper, 
    ICurrentUser currentUser,
    IObjectStorageService objectStorageService
    ) : ControllerBase
{

    [HttpPost]
    public async Task<ActionResult<AreaWatchDto>> Create([FromBody] CreateAreaWatchRequest dto, CancellationToken c = default)
    {
        var (created, errors) = await service.CreateAsync(dto, currentUser.Id!.Value, c);
        if (errors is not null) return BadRequest(errors);
        
        AreaWatchDto result = mapper.Map<AreaWatchDto>(created);
        
        return CreatedAtAction(
            nameof(GetById),
            new { id = result.Id}, 
            result);
    }
    [HttpGet("{id:Guid}")]
    public async Task<ActionResult<AreaWatchDto>> GetById(Guid id, CancellationToken c = default)
    {
        var (found, errors) = await service.GetByIdAsync(id, currentUser.Id!.Value, c);
        if (errors is not null)
        {
            if (errors.Any(e => e is NotFoundError)) return NotFound();
            return BadRequest(errors);
        }
        
        AreaWatchDto result = mapper.Map<AreaWatchDto>(found);
        
        return Ok(result);
    }

    [HttpPatch("{id:Guid}")]
    public async Task<ActionResult<AreaWatchDto>> Update(Guid id, [FromBody] UpdateAreaWatchRequest dto,
        CancellationToken c = default)
    {   
        var (updated, errors) = await service.UpdateAsync(id, dto, currentUser.Id!.Value, c);
        if (errors is not null)
        {
            if (errors.Any(e => e is NotFoundError)) return NotFound();
            return BadRequest(errors);
        }

        AreaWatchDto result = mapper.Map<AreaWatchDto>(updated);
        
        return Ok(result);
    }
    
    
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<AreaWatchDto>>> List(CancellationToken c = default)
    {
        var (watches, errors) = await service.ListAsync(currentUser.Id!.Value, c);
        if (errors is not null) return BadRequest(errors);

        var watchDtos = mapper.Map<ICollection<AreaWatchDto>>(watches);

        foreach (var dto in watchDtos)
        {
            if (dto.ThumbnailImageObjectName.IsNullOrEmpty()) continue;
            var url = await objectStorageService.GetImageUrlAsync(dto.ThumbnailImageObjectName, 3600, c);
            dto.ThumbnailImageUrl = url;
        }

        return Ok(watchDtos);
    }

    [HttpDelete("{id:Guid}")]
    public async Task<ActionResult> Delete(Guid id, CancellationToken c = default)
    {
        var result = await service.DeleteAsync(id, currentUser.Id!.Value, c);
        if (result.HasError<NotFoundError>()) return NotFound();
        if (result.IsFailed) return BadRequest(result.Errors);

        return Ok();
    }

    [HttpPost("{id:Guid}/thumbnail")]
    [RequestSizeLimit(5 * 1024 * 1024)] // TODO configure centrally
    public async Task<ActionResult<string>> UploadThumbnailImage(Guid id, IFormFile file, CancellationToken c = default)
    {
        await using var stream = file.OpenReadStream();
        var (name, errors) = await service.UploadThumbnailImage(id, currentUser.Id!.Value, stream, file.Length, c);

        if (errors is not null)
        {
            if (errors.Any(e => e is NotFoundError)) return NotFound();
            return BadRequest(errors);
        }
        
        var url = await objectStorageService.GetImageUrlAsync(name, 3600, c);
        
        return Ok(new {ThumbnailImageObjectName=name, ThumbnailImageUrl=url});
    }

    [HttpGet("{id:Guid}/thumbnail")]
    public async Task<ActionResult<string>> GetThumbnailImageUrl(Guid id, CancellationToken c = default)
    {
        var (areaWatch, errors) = await service.GetByIdAsync(id, currentUser.Id!.Value, c);
        if (errors is not null) return BadRequest(errors);

        if (areaWatch.ThumbnailImageObjectName.IsNullOrEmpty()) return NotFound();
        
        var url = await objectStorageService.GetImageUrlAsync(areaWatch.ThumbnailImageObjectName, 3600, c);
        return Ok(new { url });
    }
    
}