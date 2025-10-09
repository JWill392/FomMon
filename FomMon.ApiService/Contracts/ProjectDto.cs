using FomMon.Data.Models;
using NetTopologySuite.Geometries;

namespace FomMon.ApiService.Contracts;

public record ProjectDto
{
    public required long Id { get; init; }
    public required string Name { get; init; } = string.Empty;
    public required Point Location { get; init; }

    public Project.WorkflowState State { get; init; }
    public string StateDescription => Project.GetWorkflowStateDescription(State);

    public PublicNoticeDto? PublicNotice { get; init; }

}