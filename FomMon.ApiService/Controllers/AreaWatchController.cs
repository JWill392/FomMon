using FomMon.ApiService.Contracts;
using FomMon.ApiService.Infrastructure;
using FomMon.Data.Models;
using MapsterMapper;
using Microsoft.AspNetCore.Mvc;

namespace FomMon.ApiService.Controllers;

[ApiController]
[Route("[controller]")]
public class AreaWatchController(
    IAreaWatchService service, 
    IMapper mapper, 
    ICurrentUser currentUser
    ) : ControllerBase
{

    [HttpPost]
    public async Task<ActionResult<AreaWatchDto>> Create([FromBody] CreateAreaWatchRequest dto, CancellationToken c = default)
    {
        AreaWatch created = await service.CreateAsync(dto, currentUser.Id!.Value, c);
        
        AreaWatchDto result = mapper.Map<AreaWatchDto>(created);
        
        return CreatedAtAction(
            nameof(GetById),
            new { id = result.Id}, 
            result);
    }
    [HttpGet("{id:Guid}")]
    public async Task<ActionResult<AreaWatchDto>> GetById(Guid id, CancellationToken c = default)
    {
        AreaWatch? found = await service.GetByIdAsync(id, currentUser.Id!.Value, c);
        if (found is null)
            return NotFound();
        
        AreaWatchDto result = mapper.Map<AreaWatchDto>(found);
        
        return Ok(result);
    }

    [HttpPatch("{id:Guid}")]
    public async Task<ActionResult<AreaWatchDto>> Update(Guid id, [FromBody] UpdateAreaWatchRequest dto,
        CancellationToken c = default)
    {   
        AreaWatch? updated = await service.UpdateAsync(id, dto, currentUser.Id!.Value, c);
        if (updated is null)
            return NotFound();

        AreaWatchDto result = mapper.Map<AreaWatchDto>(updated);
        
        return Ok(result);
    }
    
    
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<AreaWatchDto>>> Get(CancellationToken c = default)
    {
        IReadOnlyList<AreaWatch> watches = await service.ListAsync(currentUser.Id!.Value, c);

        var watchDtos = mapper.Map<IReadOnlyList<AreaWatchDto>>(watches);

        return Ok(watchDtos);
    }

    [HttpDelete("{id:Guid}")]
    public async Task<ActionResult> Delete(Guid id, CancellationToken c = default)
    {
        if (!await service.DeleteAsync(id, currentUser.Id!.Value, c))
        {
            return NotFound(); 
        }

        return Ok();
    }
}