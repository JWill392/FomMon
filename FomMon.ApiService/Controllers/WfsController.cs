using FomMon.ApiService.Jobs;
using FomMon.Common.Configuration.Layer;
using Microsoft.AspNetCore.Mvc;

namespace FomMon.ApiService.Controllers;

[ApiController]
[Route("[controller]")]
public class WfsController(
    ILogger<WfsController> logger, 
    IConfiguration config,
    IWfsDownloadJob wfs) : ControllerBase
{

    /// <summary>
    /// Admin manual layer download.  Should typically be executed as scheduled job.
    /// TODO role back security
    /// </summary>
    [HttpPost("download")]
    public async Task<IActionResult> DownloadWfsLayer([FromQuery] LayerKind kind, int? limit, CancellationToken c = default)
    {
        try
        {
            await wfs.DownloadToDbAsync(kind, 
                limit: limit, 
                updateAge: null,
                zeroFeatureAttempts:0,
                c: c);

            logger.LogInformation("Downloaded {kind}", kind);
            return Ok();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to download WFS layer");
            return StatusCode(500, ex.Message);
        }
    }
}