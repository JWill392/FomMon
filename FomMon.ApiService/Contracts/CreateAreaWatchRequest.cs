using System.ComponentModel.DataAnnotations;
using FomMon.Common.Configuration.Layer;
using NetTopologySuite.Geometries;

namespace FomMon.ApiService.Contracts;

public record CreateAreaWatchRequest
{
    public required Guid Id { get; init; } 
    
    [MaxLength(50)]
    public required string Name { get; init; } = string.Empty;

    [Required]
    public required Geometry Geometry { get; init; }
    
    [Required]
    [MinLength(1)]
    public required List<LayerKind> Layers { get; init; }
}
