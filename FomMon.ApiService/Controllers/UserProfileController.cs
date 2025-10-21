using FomMon.ApiService.Infrastructure;
using FomMon.ApiService.Services;
using Microsoft.AspNetCore.Mvc;
using SixLabors.ImageSharp;

namespace FomMon.ApiService.Controllers;

[ApiController]
[Route("User/ProfileImage")]
public class UserProfileController(
    IObjectStorageService objectStorageService, 
    IUserService userService, 
    ICurrentUser currentUser) : ControllerBase
{
    [HttpPost]
    [RequestSizeLimit(5 * 1024 * 1024)] // TODO configure centrally
    public async Task<IActionResult> UploadProfileImage(IFormFile file, CancellationToken c = default)
    {
        try
        {
            var (objectName, errors) = await userService.UploadProfileImage(currentUser.Id!.Value, file, c);
            if (errors is not null) return BadRequest(errors);
            
            return Ok(new { message = "Profile image uploaded successfully", objectName });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }


    [HttpGet]
    public async Task<IActionResult> GetProfileImageUrl(CancellationToken c = default)
    {
        var (user, errors) = await userService.GetAsync(currentUser.Id!.Value, c);
        if (errors is not null) return BadRequest(errors);

        if (String.IsNullOrEmpty(user.ProfileImageObjectName))
        {
            return NotFound(new { error = "Profile image not found" });
        }
        
        // Generate presigned URL (valid for 1 hour)
        var url = await objectStorageService.GetImageUrlAsync(user.ProfileImageObjectName, 3600, c);
        return Ok(new { url });
    }

    [HttpDelete]
    public async Task<IActionResult> DeleteProfileImage(CancellationToken c = default)
    {
        var result = await userService.DeleteProfileImage(currentUser.Id!.Value, c);
        
        if (result.HasError<NotFoundError>()) return NotFound();
        if (result.IsFailed) return BadRequest(result.Errors);

        return NoContent();
    }

    [HttpGet("identicon")]
    public async Task<IActionResult> GenerateIdenticon(CancellationToken c = default)
    {
        var (img, errors) = await userService.GenerateIdenticonAsync(currentUser.Id!.Value, c);
        if (errors is not null) return BadRequest(errors);
        
        using var image = img;
        using var imgStream = new MemoryStream();
        await img.SaveAsWebpAsync(imgStream, c);
        imgStream.Position = 0;
        return File(imgStream.ToArray(), "image/webp");
    }
}