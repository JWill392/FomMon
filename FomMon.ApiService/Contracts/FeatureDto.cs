using System.Text.Json;
using FomMon.Common.Configuration.Layer;
using NetTopologySuite.Geometries;

namespace FomMon.ApiService.Contracts;

/** Data class for a raw feature record from a layer */
public record FeatureDto(
    int Id, 
    LayerKind Kind,
    Geometry Geometry,
    JsonDocument Properties) : IDisposable
{
    // public required int SourceFeatureId { get; init; }
    // public required LayerKind Kind { get; init; }
    //
    // public Geometry Geometry { get; set; } = null!;
    // public JsonDocument Attributes { get; set; } = null!;
    
    public void Dispose() => Properties?.Dispose();
}