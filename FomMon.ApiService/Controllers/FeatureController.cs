using FomMon.ApiService.Services;
using FomMon.Common.Configuration.Layer;
using Microsoft.AspNetCore.Mvc;

namespace FomMon.ApiService.Controllers;

[ApiController]
[Route("[controller]")]
public class FeatureController(IFeatureService featureService) : Controller
{
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById([FromQuery] LayerKind kind, int id, CancellationToken c = default)
    {
        var feat = await featureService.GetDtoAsync(kind, id, c);
        if (feat is null) return NotFound();

        return Ok(feat);
    }
}