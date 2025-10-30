using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Diagnostics;
using FomMon.Common.Configuration.Layer;
using Microsoft.EntityFrameworkCore;
using NodaTime;

namespace FomMon.Data.Models;

[Index(nameof(AreaWatchId))]
[Index(nameof(FeatureId))]
[DebuggerDisplay("{ToString()}")]
public sealed class AreaAlert
{
    [Key][DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    public int Id { get; set; }
    public Guid AreaWatchId { get; set; }
    public int FeatureId { get; set; } // variable table; no foreign key
    
    public required LayerKind LayerKind { get; set; } // denormalized from featureref
    
    
    public required Instant TriggeredAt { get; set; }
    
    [ForeignKey(nameof(AreaWatchId))]
    public AreaWatch AreaWatch { get; set; } = null!; // Navigation property
    
    
    [ForeignKey(nameof(FeatureId))]
    public FeatureReference FeatureReference { get; set; } = null!; // Navigation property

    public override string ToString() => $"AreaAlert({Id}, {LayerKind}, {AreaWatchId}, {FeatureId})";
}

