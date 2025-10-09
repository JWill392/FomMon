using FomMon.Data.Configuration.Layer;

namespace FomMon.ApiService.Contracts;

public record LayerDto(
    LayerKind Kind,
    string Name,
    string Description,
    string TileSource,
    string Color
    )
{
    
}