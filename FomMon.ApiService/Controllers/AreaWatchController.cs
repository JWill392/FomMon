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
    /* Expire thumbnail image access URL periodically.  Obviously not actually sensitive data,
     but just learning S3 best practices for e.g., private photos */
    private const int ThumbnailUrlExpirySeconds = 60 * 60; // 1 hour

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
    public async Task<ActionResult<ThumbnailUrlDto>> UploadThumbnailImage(Guid id, [FromQuery] ThumbnailTheme theme, IFormFile file, [FromQuery] string paramHash, CancellationToken c = default)
    {
        await using var stream = file.OpenReadStream();
        var uploadResult = await service.UploadThumbnailImageAsync(id, currentUser.Id!.Value, theme, stream, file.Length, paramHash, c);
        if (uploadResult.IsFailed) return ToActionResult(uploadResult);
        
        var name = uploadResult.Value;
        
        var urlResult = await imageStorageService.GetImageUrlAsync(name, ThumbnailUrlExpirySeconds, c);
        if (urlResult.IsFailed) return ToActionResult(urlResult);

        var thumbnail = new ThumbnailUrlDto()
        {
            Name = name,
            ParamHash = paramHash,
            Theme = theme,
            Url = urlResult.Value,
        };
        return Ok(thumbnail);
    }

    [HttpGet("{id:Guid}/thumbnail")]
    public async Task<ActionResult<string>> TryGetThumbnailImageUrl(Guid id, [FromQuery] ThumbnailTheme theme, CancellationToken c = default)
    {
        var result = await service.GetThumbnailImageNameAsync(id, currentUser.Id!.Value, theme, c);
        if (result.IsFailed) return ToActionResult(result);
        var thumbnailName = result.Value;

        if (thumbnailName.IsNullOrEmpty()) return NotFound();
        
        var urlResult = await imageStorageService.GetImageUrlAsync(thumbnailName, ThumbnailUrlExpirySeconds, c);
        if (urlResult.IsFailed) return ToActionResult(urlResult);

        var tagResult = await imageStorageService.GetParamHashAsync(thumbnailName, c);
        if (tagResult.IsFailed) return ToActionResult(tagResult);
        
        var thumbnail = new ThumbnailUrlDto()
        {
            Name = thumbnailName,
            Theme = theme,
            ParamHash = tagResult.Value,
            Url = urlResult.Value,
        };
        
        return Ok(thumbnail);
    }
 
    
    private ActionResult ToActionResult<T>(Result<T> result)
    {
        if (result.IsSuccess) return Ok(result.Value);
        if (result.HasError<NotFoundError>(out var e)) return NotFound(e.First().Message);
        return BadRequest(result.Errors.First().Message);
    }

}