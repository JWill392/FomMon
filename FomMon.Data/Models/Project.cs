using System.ComponentModel.DataAnnotations;
using NetTopologySuite.Geometries;
using NodaTime;

namespace FomMon.Data.Models;

public sealed class Project : IVersioned
{

    [Key]
    public required long Id { get; set; }

    [MaxLength(500)]
    public required string Name { get; set; } = string.Empty;
    public required Point Geometry { get; set; }

    public required WorkflowState State { get; set; } 
    [MaxLength(24)]
    public string StateDescription => GetWorkflowStateDescription(State);

    public required Instant Created { get; set; }

    /// <summary>
    /// Time features were last downloaded
    /// </summary>
    public Instant? FeaturesRefreshed { get; set; } = null;

    public Instant? Closed { get; set; } = null;

    public PublicNotice? PublicNotice { get; set; }

    public uint Version { get; set; }
    
    public enum WorkflowState
    {
        Initial,
        Published,
        CommentOpen,
        CommentClosed,
        Finalized,
        Expired
    }

    public static string GetWorkflowStateDescription(WorkflowState state)
    {
        return state switch
        {
            WorkflowState.Initial => "Initial",
            WorkflowState.Published => "Published",
            WorkflowState.CommentOpen => "Commenting Open",
            WorkflowState.CommentClosed => "Commenting Closed",
            WorkflowState.Finalized => "Finalized",
            WorkflowState.Expired => "Expired",
            _ => state.ToString()
        };
    }

}