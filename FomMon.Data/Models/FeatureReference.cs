using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json;
using FomMon.Data.Configuration.Layer;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using NodaTime;

namespace FomMon.Data.Models;

[Index(nameof(LayerKind), nameof(SourceFeatureId),  IsUnique = true)]
public class FeatureReference : IDisposable
{
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)][Key]
    public int Id { get; set; }
    
    [Required]
    public required LayerKind LayerKind { get; set; }
    
    [MaxLength(100)]
    public string SourceFeatureId { get; set; } = null!; // Value from the layer's source ID column

    // Application audit
    public Instant FirstSeenAt { get; set; }
    public Instant LastSeenAt { get; set; }
    /// <summary>
    /// Time this was last noticed to be missing.  May be set while IsDeleted=false if it returned.
    /// </summary>
    public Instant? DeletedAt { get; set; }
    public bool IsDeleted { get; set; } // Mark as deleted if missing from layer

    public required Geometry Geometry { get; set; }
    
    
    public JsonDocument? AttributesSnapshot { get; set; } // JSON

    public void Dispose() => AttributesSnapshot?.Dispose();
}