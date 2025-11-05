using System.Diagnostics;
using FomMon.ApiService.Contracts;
using FomMon.ApiService.FomApi;
using FomMon.Data.Contexts;
using FomMon.Data.Models;
using FomMon.ServiceDefaults;
using Hangfire;
using Mapster;
using Microsoft.EntityFrameworkCore;
using OpenTelemetry.Trace;

namespace FomMon.ApiService.Jobs.FomDownload;



public static class FomDownloadJobExtensions
{
    public static IServiceCollection AddFomDownloadJob(this IServiceCollection services)
    {
        services.ConfigureOpenTelemetryTracerProvider(t => t.AddSource(FomDownloadJob.ActivitySourceName));
        services.AddScoped<IFomDownloadJob, FomDownloadJob>();
        
        return services;
    }

    public static void ConfigureJobs()
    {
        var getProjectJobName = nameof(IFomDownloadJob.GetProjects);
        RecurringJob.AddOrUpdate<IFomDownloadJob>(getProjectJobName, x => x.GetProjects(CancellationToken.None), Cron.Daily);
        RecurringJob.TriggerJob(getProjectJobName);  // immediately run once
        
        var getPublicNoticesJobName = nameof(IFomDownloadJob.GetPublicNotices);
        RecurringJob.AddOrUpdate<IFomDownloadJob>(getPublicNoticesJobName, x => x.GetPublicNotices(CancellationToken.None), Cron.Daily);
        RecurringJob.TriggerJob(getPublicNoticesJobName); // immediately run once
    }
}

public interface IFomDownloadJob
{
    Task GetProjects(CancellationToken c);
    Task GetPublicNotices(CancellationToken c);
}

/// <summary>
/// Downloads projects and their features from the external FOM API.  Composes Project + PublicNotice APIs into Project.
/// </summary>
public sealed class FomDownloadJob(
    FomApiClient apiClient, 
    AppDbContext dbContext,
    IClockService clock,
    ILogger<FomDownloadJob> logger) : IFomDownloadJob
{   
    public const string ActivitySourceName = nameof(FomDownloadJob);
    private static readonly ActivitySource ActivitySource = new(ActivitySourceName);


    public async Task GetProjects(CancellationToken c)
    {
        using var activity = ActivitySource.StartActivity(ActivityKind.Internal);
        activity?.SetTag("api_call", nameof(apiClient.ProjectController_findPublicSummaryAsync));
        
        logger.LogDebug("Getting projects");
        var projects = await DownloadProjects(activity, c);


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
        logger.LogDebug("Added {count} projects", pAddedList.Count);
        logger.LogDebug("Maybe updated {count} projects", pMayChangeList.Count);
        
        await dbContext.SaveChangesAsync(c);
    }

    private async Task<List<Project>> DownloadProjects(Activity? activity, CancellationToken c)
    {
        var apiCalled = clock.Now;

        try
        {
            
            var apiResult = await apiClient.ProjectController_findPublicSummaryAsync("", includeCommentOpen: "true",
                includePostCommentOpen: "true", forestClientName: "", openedOnOrAfter: "",
                cancellationToken: c);
            var projects = apiResult.Select(p =>
            {
                var state = ParseWorkflowState(p.WorkflowStateName);
                return new Project()
                {
                    Id = (int)p.Id,
                    Geometry = p.Geojson,
                    Name = p.Name,
                    State = state,
                    Created = apiCalled,
                    Closed = state == Project.WorkflowState.Finalized ? apiCalled : null
                };
            }).ToList();
            
            return projects;
        }
        catch (Exception e)
        {
            activity?.AddException(e);
            activity?.SetStatus(ActivityStatusCode.Error, e.Message);
            logger.LogError(e, "Error occurred while fetching projects from FOM API");
            throw;
        }
    }


    public async Task GetPublicNotices(CancellationToken c)
    {
        using var activity = ActivitySource.StartActivity(ActivityKind.Client);
        activity?.SetTag("api_call", nameof(apiClient.PublicNoticeController_findListForPublicFrontEndAsync));
        
        var apiCalled = clock.Now;
        var noticeDtoList = await DownloadPublicNotices(activity, c);

        // get project record for notices
        var projects = (await dbContext.Projects
            .Where(dbP => noticeDtoList.Select(p => p.ProjectId).Contains(dbP.Id))
            .ToListAsync(c)).ToDictionary(p => p.Id);

        // Get all existing public notices for the relevant projects
        var existingNotices = (await dbContext.PublicNotices
            .Where(n => noticeDtoList.Select(dto => dto.ProjectId).Contains(n.ProjectId))
            .ToListAsync(c))
            .ToDictionary(n => n.ProjectId);

        var addNotices = new List<PublicNotice>();
        var countUpdate = 0;
        foreach (var noticeDto in noticeDtoList)
        {
            if (!projects.ContainsKey(noticeDto.ProjectId))
            {
                if ((clock.LocalNow.Date - noticeDto.PostDate).Days > 2)
                {
                    logger.LogWarning("Old Public Notice found without Project: project {ProjectId}.  " +
                                          "This shouldn't happen after projects have a few days to appear in api, " +
                                          "but there's no real system impact to us.", 
                        noticeDto.ProjectId);   
                }
                else
                {
                    logger.LogInformation("New Public Notice found without Project: project {ProjectId}.  " +
                                          "This is common for projects under a day old; their publishing timings are different", 
                        noticeDto.ProjectId);   
                }
                
                continue;
            }
            
            if (existingNotices.TryGetValue(noticeDto.ProjectId, out var dbNotice))
            {
                // Update existing notice
                countUpdate++;
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
                
                addNotices.Add(notice);
            }
        }

        await dbContext.PublicNotices.AddRangeAsync(addNotices, c);
        await dbContext.SaveChangesAsync(c);
        logger.LogDebug("Added {countAdd} notices, Updated {countUpdate} notices", addNotices.Count, countUpdate);
    }

    private async Task<List<PublicNoticeDto>> DownloadPublicNotices(Activity? activity, CancellationToken stoppingToken)
    {

        try
        {
            var apiResult = await apiClient.PublicNoticeController_findListForPublicFrontEndAsync(stoppingToken);
            
            var notices = apiResult.Select(a => new PublicNoticeDto()
            {
                ProjectId = (int)a.ProjectId,
                CompanyId = a.Project.ForestClient.Id,
                CompanyName = a.Project.ForestClient.Name,
                Description = a.Project.Description,
                OperationStartYear = (int)a.Project.OperationStartYear,
                OperationEndYear = (int)a.Project.OperationEndYear,
                PostDate = a.PostDate,
            }).ToList();
            
            return notices;
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

