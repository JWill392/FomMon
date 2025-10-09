using FomMon.ApiService.Contracts;
using FomMon.Data.Contexts;
using Mapster;
using MapsterMapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FomMon.ApiService.Controllers;


[ApiController]
[Route("[controller]")]
public class ProjectsController(AppDbContext db, IMapper mapper) : ControllerBase
{
    
    [HttpGet][AllowAnonymous]
    public async Task<ActionResult<IEnumerable<ProjectDto>>> GetProjects()
    {
        // TODO change to feature service 
        var projects = await db.Projects
            .AsNoTracking()
            .Include(p => p.PublicNotice)
            .ProjectToType<ProjectDto>(mapper.Config)
            .ToListAsync();
        return Ok(projects);
    }
}