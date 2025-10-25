using System.ComponentModel.DataAnnotations;
using FomMon.Data.Configuration.Layer;
using NetTopologySuite.Geometries;

namespace FomMon.ApiService.Contracts;

public record AreaWatchDto
{
    public required Guid Id { get; init; }
    
    [MaxLength(50)]
    public required string Name { get; init; } = string.Empty;
    
    public required Geometry Geometry { get; init; }
    
    public required List<LayerKind> Layers { get; init; }
    
    public string ThumbnailImageObjectName { get; init; } = string.Empty;
    public string ThumbnailImageUrl { get; set;  } = string.Empty;
}