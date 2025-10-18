using FomMon.ApiService.Services;
using Microsoft.AspNetCore.Mvc;

namespace FomMon.ApiService.Controllers;

[ApiController]
[Route("api/users")]
public class UserProfileController(IProfileImageService imageService) : ControllerBase
{
    [HttpPost("{userId}/profile-image")]
    [RequestSizeLimit(5 * 1024 * 1024)] // TODO configure centrally
    public async Task<IActionResult> UploadProfileImage(Guid userId, IFormFile file)
    {
        try
        {
            var objectName = await imageService.UploadProfileImageAsync(userId, file);

            
            return Ok(new { message = "Profile image uploaded successfully", objectName });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Failed to upload image" });
        }
    }

    [HttpGet("{userId}/profile-image")]
    public async Task<IActionResult> GetProfileImage(Guid userId)
    {
        try
        {
            var stream = await imageService.GetProfileImageAsync(userId);
            return File(stream, "image/jpeg");
        }
        catch (Exception ex)
        {
            return NotFound(new { error = "Profile image not found" });
        }
    }

    [HttpGet("{userId}/profile-image-url")]
    public async Task<IActionResult> GetProfileImageUrl(Guid userId)
    {
        try
        {
            // Generate presigned URL (valid for 1 hour)
            var url = await imageService.GetProfileImageUrlAsync(userId, 3600);
            return Ok(new { url });
        }
        catch (Exception ex)
        {
            return NotFound(new { error = "Profile image not found" });
        }
    }

    [HttpDelete("{userId}/profile-image")]
    public async Task<IActionResult> DeleteProfileImage(Guid userId)
    {
        try
        {
            await imageService.DeleteProfileImageAsync(userId);
            
            return NoContent();
        }
        catch (Exception ex)
        {
            return NotFound(new { error = "Profile image not found" });
        }
    }
}