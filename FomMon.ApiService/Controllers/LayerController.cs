using FomMon.ApiService.Contracts;
using FomMon.Data.Configuration.Layer;
using MapsterMapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FomMon.ApiService.Controllers;

[ApiController]
[Route("[controller]")]
public class LayerController(
    IMapper mapper
) : ControllerBase
{
    [HttpGet][AllowAnonymous]
    public ActionResult<List<LayerDto>> Get(CancellationToken c = default)
    {
        var layerDto = mapper.Map<List<LayerDto>>(LayerRegistry.All);
        
        return Ok(layerDto);
    }
}