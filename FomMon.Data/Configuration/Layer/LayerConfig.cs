using FomMon.Data.Shared;

namespace FomMon.Data.Configuration.Layer;

public record LayerConfig(
    LayerKind Kind,
    string Name,
    string Description,
    string TableName,
    string SourceIdColumn,
    string? WfsUrl,
    string? WfsLayer,
    string TileSource,
    string Color,
    string GeometryType,
    string Attribution)
{
    // Override properties to add validation
    public string TableName { get; init; } = SqlUtil.ValidateSqlIdentifier(TableName);
    public string SourceIdColumn { get; init; } = SqlUtil.ValidateSqlIdentifier(SourceIdColumn);
}