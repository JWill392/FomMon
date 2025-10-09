using FomMon.ApiService.Services;
using FomMon.Data.Configuration.Layer;
using Microsoft.AspNetCore.Mvc;

namespace FomMon.ApiService.Controllers;

[ApiController]
[Route("[controller]")]
public class WfsController(
    ILogger<WfsController> logger, 
    IConfiguration config,
    IWfsDownloader wfs) : ControllerBase
{
    // private readonly string _downloadPath = config["DownloadPath"] ?? Path.GetTempPath();

    [HttpPost("download")]
    public async Task<IActionResult> DownloadWfsLayer([FromQuery] LayerKind kind, int? limit, CancellationToken c = default)
    {
        // try
        // {
            await wfs.DownloadToDbAsync(kind, limit, c);

            logger.LogInformation("Downloaded {kind}", kind);
            return Ok();
        // }
        // catch (Exception ex)
        // {
        //     logger.LogError(ex, "Failed to download WFS layer");
        //     return StatusCode(500, ex.Message);
        // }
    }
}