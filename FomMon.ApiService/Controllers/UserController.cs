using FomMon.ApiService.Contracts;
using FomMon.ApiService.Infrastructure;
using FomMon.ApiService.Services;
using FomMon.Data.Models;
using MapsterMapper;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using SixLabors.ImageSharp;

namespace FomMon.ApiService.Controllers;

[ApiController]
[Route("[controller]")]
public class UserController(
    IUserService userService,
    IObjectStorageService objectStorageService,
    IMapper mapper,
    ICurrentUser currentUser) : ControllerBase
{

    [HttpGet()]
    public async Task<ActionResult<UserDto>> GetById(CancellationToken c = default)
    {
        var result = await userService.GetAsync(currentUser.Id!.Value, c);
        if (result.IsFailed)
        {
            if (result.HasError<NotFoundError>())
                return NotFound();
            
            return BadRequest();
        }
        User user = result.Value;
        
        var userDto = mapper.Map<UserDto>(user);
        return Ok(userDto);
    }
    
    [HttpPost("profile-image")]
    [RequestSizeLimit(5 * 1024 * 1024)] // TODO configure centrally
    public async Task<IActionResult> UploadProfileImage(IFormFile file, CancellationToken c = default)
    {
        try
        {
            await using var imageStream = file.OpenReadStream();
            var result = await userService.UploadProfileImage(currentUser.Id!.Value, imageStream, file.Length, c);
            if (result.IsFailed)
            {
                if (result.HasError<NotFoundError>())
                    return NotFound();
    
                return BadRequest(new {errors = result.Errors.Select(e => e.Message)});
            }
            
            // TODO return URL
            
            return Ok(new { message = "Profile image uploaded successfully", result.Value });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }


    [HttpGet("profile-image")]
    public async Task<IActionResult> GetProfileImageUrl(CancellationToken c = default)
    {
        var (user, errors) = await userService.GetAsync(currentUser.Id!.Value, c);
        if (errors is not null) return BadRequest(errors);

        if (user.ProfileImageObjectName.IsNullOrEmpty()) return NotFound();
        
        var url = await objectStorageService.GetImageUrlAsync(user.ProfileImageObjectName, 3600, c);
        return Ok(new { url });
    }

    [HttpGet("profile-image/identicon")]
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

