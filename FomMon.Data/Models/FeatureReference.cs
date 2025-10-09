using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using FomMon.Data.Configuration.Layer;
using NetTopologySuite.Geometries;
using NodaTime;

namespace FomMon.Data.Models;

public class FeatureReference : IDisposable
{
    public int Id { get; set; }
    public LayerKind LayerKind { get; set; }
    
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