using FomMon.ApiService.Contracts;
using FomMon.ApiService.Infrastructure;
using FomMon.ApiService.Services;
using FomMon.Data.Models;
using MapsterMapper;
using Microsoft.AspNetCore.Mvc;

namespace FomMon.ApiService.Controllers;

[ApiController]
[Route("[controller]")]
public class UserController(
    IUserService service,
    IMapper mapper,
    ICurrentUser currentUser) : ControllerBase
{

    [HttpGet()]
    public async Task<ActionResult<UserDto>> GetById(CancellationToken c = default)
    {
        var result = await service.GetAsync(currentUser.Id!.Value, c);
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
}

