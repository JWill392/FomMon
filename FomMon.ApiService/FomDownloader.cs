using System.Diagnostics;
using FomMon.ApiService.Contracts;
using FomMon.ApiService.FomApi;
using FomMon.Data.Contexts;
using FomMon.Data.Models;
using FomMon.ServiceDefaults;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Mapster;
using OpenTelemetry.Metrics;
using OpenTelemetry.Trace;

namespace FomMon.ApiService;

public interface IFomDownloader
{
    public Task GetProjects(CancellationToken c);
    public Task GetPublicNotices(CancellationToken c);
}

public class FomDownloaderSettings
{
    public TimeSpan RefreshProjectInterval { get; set; }
}

public static class FomDownloaderExtensions
{
    public static IServiceCollection AddFomDownloader(this IServiceCollection services, Action<FomDownloaderSettings>? configure = null)
    {
        
        services.AddOptions<FomDownloaderSettings>()
            .BindConfiguration("FomDownloader")
            .PostConfigure(configure ?? (o => {}))
            .ValidateDataAnnotations()
            .Validate(s => s.RefreshProjectInterval > TimeSpan.Zero, "RefreshProjectInterval must be > 0")
            .ValidateOnStart();


        services.AddScoped<IFomDownloader, FomDownloader>();

        services.ConfigureOpenTelemetryTracerProvider(t =>
        {
            t.AddSource(FomDownloader.ActivitySourceName);
        });
        services.ConfigureOpenTelemetryMeterProvider(m =>
        {

        });
        
        return services;
    }
}

/// <summary>
/// Downloads projects and their features from the external FOM API.  Composes Project + PublicNotice APIs into Project.
/// </summary>
/// <param name="env"></param>
/// <param name="apiClient"></param>
/// <param name="dbContext"></param>
/// <param name="clock"></param>
/// <param name="queue"></param>
/// <param name="logger"></param>
/// <param name="opt"></param>
public sealed class FomDownloader(
    FomApiClient apiClient, 
    AppDbContext dbContext,
    IClockService clock,
    IBackgroundTaskQueue queue,
    ILogger<FomDownloader> logger,
    IOptions<FomDownloaderSettings> opt) : IFomDownloader
{
    private readonly FomDownloaderSettings _settings = opt.Value;
    
    public const string ActivitySourceName = "FomMon.FomDownloader";
    private static readonly ActivitySource ActivitySource = new(ActivitySourceName);


    public async Task GetProjects(CancellationToken c)
    {
        
        var projects = await DownloadProjects(c);


        var existingProjects = (await dbContext.Projects
            .Where(dbP => projects.Select(p => p.Id).Contains(dbP.Id))
            .ToListAsync(c)).ToDictionary(p => p.Id);

        List<Project> pAddedList = [];
        List<Project> pMayChangeList = [];

        foreach (var p in projects)
        {
            if (!existingProjects.TryGetValue(p.Id, out var pdb))
            {
                pAddedList.Add(p);
            }
            else
            {
                pdb.State = p.State;
                pdb.Name = p.Name;
                pdb.Geometry = p.Geometry;

                if (pdb.Closed is null && p.State == Project.WorkflowState.Finalized)
                    pdb.Closed = clock.Now;

                pMayChangeList.Add(pdb);
            }
        }

        dbContext.AddRange(pAddedList);
        await dbContext.SaveChangesAsync(c);

        // Call public notice API to get additional project info
        await queue.QueueWorkAsync((s, ct) => s.GetRequiredService<IFomDownloader>().GetPublicNotices(ct));


        // TODO mark FeatureType.Downloaded once all tasks complete (prob need better job library first)
    }

    private async Task<List<Project>> DownloadProjects(CancellationToken c)
    {
        using var activity = ActivitySource.StartActivity(ActivityKind.Client);
        activity?.SetTag("api_call", nameof(apiClient.ProjectController_findPublicSummaryAsync));
        var apiCalled = clock.Now;

        List<Project> projects;
        try
        {
            var apiResult = await apiClient.ProjectController_findPublicSummaryAsync("", includeCommentOpen: "true",
                includePostCommentOpen: "true", forestClientName: "", openedOnOrAfter: "",
                cancellationToken: c);
            
            projects = apiResult.Select(p =>
            {
                var state = ParseWorkflowState(p.WorkflowStateName);
                return new Project()
                {
                    Id = (int)p.Id,
                    Geometry = p.Geojson,
                    Name = p.Name,
                    State = state,
                    Created = apiCalled,
                    FeaturesRefreshed = null, // set on downloading features
                    Closed = state == Project.WorkflowState.Finalized ? apiCalled : null
                };
            }).ToList();
        }
        catch (Exception e)
        {
            activity?.AddException(e);
            activity?.SetStatus(ActivityStatusCode.Error, e.Message);
            logger.LogError(e, "Error occurred while fetching projects from FOM API");
            throw;
        }
        return projects;
    }


    public async Task GetPublicNotices(CancellationToken c)
    {
        var apiCalled = clock.Now;
        var noticeDtoList = await DownloadPublicNotices(c);

        // get project record for notices
        var projects = (await dbContext.Projects
            .Where(dbP => noticeDtoList.Select(p => p.ProjectId).Contains(dbP.Id))
            .ToListAsync(c)).ToDictionary(p => p.Id);

        // Get all existing public notices for the relevant projects
        var existingNotices = (await dbContext.PublicNotices
            .Where(n => noticeDtoList.Select(dto => dto.ProjectId).Contains(n.ProjectId))
            .ToListAsync(c))
            .ToDictionary(n => n.ProjectId);

        var noticeList = new List<PublicNotice>();
        foreach (var noticeDto in noticeDtoList)
        {
            if (!projects.ContainsKey(noticeDto.ProjectId))
            {
                logger.LogWarning("Public Notice found without Project: project {ProjectId}", noticeDto.ProjectId);
                continue;
            }
            
            if (existingNotices.TryGetValue(noticeDto.ProjectId, out var dbNotice))
            {
                // Update existing notice
                dbNotice.CompanyId = noticeDto.CompanyId;
                dbNotice.CompanyName = noticeDto.CompanyName;
                dbNotice.Description = noticeDto.Description;
                dbNotice.OperationStartYear = noticeDto.OperationStartYear;
                dbNotice.OperationEndYear = noticeDto.OperationEndYear;
                dbNotice.PostDate = noticeDto.PostDate;
                dbNotice.Refreshed = apiCalled;
            }
            else
            {
                // Add new notice
                var notice = noticeDto.Adapt<PublicNotice>();
                notice.Refreshed = apiCalled;
                
                noticeList.Add(notice);
            }
        }

        await dbContext.PublicNotices.AddRangeAsync(noticeList, c);
        await dbContext.SaveChangesAsync(c);
    }

    private async Task<List<PublicNoticeDto>> DownloadPublicNotices(CancellationToken stoppingToken)
    {
        using var activity = ActivitySource.StartActivity(ActivityKind.Client);
        activity?.SetTag("api_call", nameof(apiClient.PublicNoticeController_findListForPublicFrontEndAsync));

        try
        {
            logger.LogInformation("Fetching public notices {clock.Now}", clock.Now);
            var apiResult = await apiClient.PublicNoticeController_findListForPublicFrontEndAsync(stoppingToken);
            return apiResult.Select(a => new PublicNoticeDto()
            {
                ProjectId = (int)a.ProjectId,
                CompanyId = a.Project.ForestClient.Id,
                CompanyName = a.Project.ForestClient.Name,
                Description = a.Project.Description,
                OperationStartYear = (int)a.Project.OperationStartYear,
                OperationEndYear = (int)a.Project.OperationEndYear,
                PostDate = a.PostDate,
            }).ToList();
        }
        catch (Exception e)
        {
            activity?.AddException(e);
            activity?.SetStatus(ActivityStatusCode.Error, e.Message);
            logger.LogError(e, "Error occurred while fetching project notices from FOM API");
            throw;
        }
    }

    private static Project.WorkflowState ParseWorkflowState(string state)
    {
        return state.ToLower() switch
        {
            "initial" => Project.WorkflowState.Initial,
            "published" => Project.WorkflowState.Published,
            "commenting open" => Project.WorkflowState.CommentOpen,
            "commenting closed" => Project.WorkflowState.CommentClosed,
            "finalized" => Project.WorkflowState.Finalized,
            "expired" => Project.WorkflowState.Expired,
            _ => throw new ArgumentException($"Invalid workflow state: {state}")
        };
    }
}

