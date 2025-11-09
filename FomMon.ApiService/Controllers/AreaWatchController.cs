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
    IImageStorageService imageStorageService,
    ILogger<AreaWatchController> logger) : ControllerBase
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
    [RequestSizeLimit(5 * 1024 * 1024)] // TODO configure max img size centrally
    public async Task<ActionResult<string>> UploadThumbnailImage(Guid id, [FromQuery] ThumbnailTheme theme, IFormFile file, [FromQuery] string paramHash, CancellationToken c = default)
    {
        await using var stream = file.OpenReadStream();
        var (name, errors) = await service.UploadThumbnailImageAsync(id, currentUser.Id!.Value, theme, stream, file.Length, paramHash, c);

        if (errors is not null)
        {
            logger.LogError("Failed to upload thumbnail image: {guid}, {Errors}", id, errors);
            if (errors.Any(e => e is NotFoundError)) return NotFound(errors.Select(e => e.Message));
            return BadRequest(new {errors = errors.Select(e => e.Message)});
        }
        
        var url = await imageStorageService.TryGetImageUrlAsync(name, 3600, getParamHash:true, c);
        if (url is null) return NotFound("Failed to get image url after upload");
        
        return Ok(new {ThumbnailImageUrl=url});
    }

    [HttpGet("{id:Guid}/thumbnail")]
    public async Task<ActionResult<string>> TryGetThumbnailImageUrl(Guid id, [FromQuery] ThumbnailTheme theme, CancellationToken c = default)
    {
        var result = await service.GetThumbnailImageNameAsync(id, currentUser.Id!.Value, theme, c);
        if (result.IsFailed) return ToActionResult(result);
        var thumbnailName = result.Value;

        if (thumbnailName.IsNullOrEmpty()) return NotFound();
        
        var url = await imageStorageService.TryGetImageUrlAsync(thumbnailName, 3600, getParamHash:true, c);
        if (url is null) return NotFound();
        
        return Ok(new { ThumbnailImageUrl=url });
    }
 
    
    private ActionResult ToActionResult<T>(Result<T> result)
    {
        if (result.IsSuccess) return Ok(result.Value);
        if (result.HasError<NotFoundError>(out var e)) return NotFound(e.First().Message);
        return BadRequest(result.Errors.First().Message);
    }

}