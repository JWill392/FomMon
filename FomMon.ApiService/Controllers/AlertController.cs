using FomMon.ApiService.Contracts;
using FomMon.ApiService.Infrastructure;
using FomMon.ApiService.Services;
using FomMon.Data.Models;
using MapsterMapper;
using Microsoft.AspNetCore.Mvc;

namespace FomMon.ApiService.Controllers;

[ApiController]
[Route("[controller]")]
public class AlertController(
    IMapper mapper, 
    ICurrentUser currentUser,
    IAlertService service) : ControllerBase
{

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<AreaAlertDto>>?> GetAlerts([FromQuery] Guid? areaWatchId, CancellationToken c = default)
    {
        IReadOnlyList<AreaAlert>? found;
        if (areaWatchId is not null)
        {
            found = await service.GetAlertsAsync(areaWatchId.Value, currentUser.Id!.Value, c);
            if (found is null) return NotFound();
        }
        else
        {
            found = await service.GetAlertsAsync(currentUser.Id!.Value, c);
        }

        var result = mapper.Map<IReadOnlyList<AreaAlertDto>>(found!);

        return Ok(result);
    }

}