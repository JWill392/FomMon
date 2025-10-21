using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using FomMon.Data.Configuration.Layer;
using NetTopologySuite.Geometries;
using NodaTime;

namespace FomMon.ApiService.Contracts;

public class FeatureReferenceDto
{
    public int Id { get; set; }
    public LayerKind LayerKind { get; set; } = null!;

    [MaxLength(100)]
    public string SourceFeatureId { get; set; } = null!; // Value from the layer's source ID column

    // Application audit
    public Instant FirstSeenAt { get; set; }
    public Instant LastSeenAt { get; set; }
    public Instant? DeletedAt { get; set; }
    public bool IsDeleted { get; set; } // Mark as deleted if missing from layer

    
}

