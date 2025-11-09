using FluentResults;
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
    IImageStorageService imageStorageService,
    IMapper mapper,
    ICurrentUser currentUser) : ControllerBase
{

    [HttpGet()]
    public async Task<ActionResult<UserDto>> GetById(CancellationToken c = default)
    {
        var result = await userService.GetAsync(currentUser.Id!.Value, c);
        if (result.IsFailed) return ToActionResult(result);
        
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
            if (result.IsFailed) return ToActionResult(result);
            
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
        var userResult = await userService.GetAsync(currentUser.Id!.Value, c);
        if (userResult.IsFailed) return ToActionResult(userResult);

        if (userResult.Value.ProfileImageObjectName.IsNullOrEmpty()) return NotFound();
        
        var url = await imageStorageService.TryGetImageUrlAsync(userResult.Value.ProfileImageObjectName, 3600, getParamHash:false, c:c); 
        return Ok(new { url });
    }

    [HttpGet("profile-image/identicon")]
    public async Task<IActionResult> GenerateIdenticon(CancellationToken c = default)
    {
        var result = await userService.GenerateIdenticonAsync(currentUser.Id!.Value, c);
        if (result.IsFailed) return ToActionResult(result);
        
        using var imgStream = new MemoryStream();
        await result.Value.SaveAsWebpAsync(imgStream, c);
        imgStream.Position = 0;
        return File(imgStream.ToArray(), "image/webp");
    }

    [HttpPost("profile-image/identicon")]
    public async Task<IActionResult> SetIdenticon(CancellationToken c = default)
    {
        var result = await userService.SetProfileImageIdenticonAsync(currentUser.Id!.Value, c);
        return ToActionResult(result);
    }

    private ActionResult ToActionResult<T>(Result<T> result)
    {
        if (result.IsSuccess) return Ok(result.Value);
        if (result.HasError<NotFoundError>(out var e)) return NotFound(e.First().Message);
        return BadRequest(result.Errors.First().Message);
    }
}

