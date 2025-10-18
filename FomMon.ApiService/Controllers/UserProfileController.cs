using FomMon.ApiService.Infrastructure;
using FomMon.ApiService.Services;
using Microsoft.AspNetCore.Mvc;

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
            var (user, errors) = await userService.GetAsync(currentUser.Id!.Value, c);
            if (errors is not null) return BadRequest(errors);
            
            // version existing image; see minio policy for deletion schedule
            bool imageExists = !String.IsNullOrEmpty(user.ProfileImageObjectName);
            string objectName = imageExists ? user.ProfileImageObjectName : 
                $"{currentUser.Id!.Value}.{Guid.NewGuid().ToString()}.png";
            
            await objectStorageService.UploadImageAsync(objectName, file, c);

            if (!imageExists)
            {
                var userResult = await userService.SetProfileImageObjectAsync(currentUser.Id!.Value, objectName, c);
                if (userResult.IsFailed)
                {
                    await objectStorageService.DeleteImageAsync(objectName, c);
                    return BadRequest(userResult.Errors);
                }
            }
            
            
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
        try
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
        catch (Exception ex)
        {
            return NotFound(new { error = "Profile image not found" });
        }
    }

    [HttpDelete]
    public async Task<IActionResult> DeleteProfileImage(CancellationToken c = default)
    {
        try
        {
            var (user, errors) = await userService.GetAsync(currentUser.Id!.Value, c);
            if (errors is not null) return BadRequest(errors);
            if (String.IsNullOrEmpty(user.ProfileImageObjectName))
                return NotFound(new { error = "Profile image not found" });
            
            await objectStorageService.DeleteImageAsync(user.ProfileImageObjectName, c);
            
            var userResult = await userService.SetProfileImageObjectAsync(currentUser.Id!.Value, String.Empty, c);
            if (userResult.IsFailed)
            {
                // TODO undelete
                throw new Exception("Failed to delete profile image");
            }
            
            return NoContent();
        }
        catch (Exception ex)
        {
            return NotFound(new { error = "Profile image not found" });
        }
    }
}