using FomMon.Common.Configuration.Layer;

namespace FomMon.ApiService.Contracts;

public record LayerDto(
    LayerKind Kind,
    string Name,
    string FeatureName,
    string Description,
    string TileSource,
    string Color,
    string GeometryType,
    string Attribution,
    string SourceIdColumn,
    LayerColumnConfig[] Columns
    )
{
    
    
}