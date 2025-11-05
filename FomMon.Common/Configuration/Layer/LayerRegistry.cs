using System.Collections.Immutable;
using FomMon.Common.Shared;

namespace FomMon.Common.Configuration.Layer;

/// <summary>
/// Configuration for layers.
/// NOTE: currently requires a migration.  WFS download will run automatically on apiservice start,
/// but tileserver needs restart after first run (structure change).
/// </summary>
public static class LayerRegistry
{
    public static readonly string Schema = "layers"; // TODO unify with AppDbConfig.LayersSchema
    public static readonly int DefaultSrid = 4326;
    public static readonly string DefaultSridString = "EPSG:4326";
    public static readonly string GeometryColumn = "geometry";
    
    internal static readonly bool Initialized = false;

    static LayerRegistry()
    {
        SqlUtil.ValidateSqlIdentifier(GeometryColumn);
        All = [
            new(
                Kind: LayerKind.From("FomCutblock"),
                Name: "Cutblocks",
                Description: "FOM Cutblocks",
                TableName: "fom_cutblock",
                SourceIdColumn: "objectid",
                WfsUrl: "https://openmaps.gov.bc.ca/geo/pub/wfs?service=WFS",
                WfsLayer: "pub:WHSE_FOREST_TENURE.FOM_CUTBLOCK_SP",
                TileSource: "fom_cutblock",
                Color: "#A5124D",
                GeometryType: "POLYGON",
                Attribution: "Forest Operations Map NRS BC"
            ),
            new(
                Kind: LayerKind.From("FomRoad"),
                Name: "Roads",
                Description: "FOM Roads",
                TableName: "fom_road",
                SourceIdColumn: "objectid",
                WfsUrl: "https://openmaps.gov.bc.ca/geo/pub/wfs?service=WFS",
                WfsLayer: "pub:WHSE_FOREST_TENURE.FOM_ROAD_SECTION_SP",
                TileSource: "fom_road",
                Color: "#7691BC",
                GeometryType: "LINESTRING",
                Attribution: "Forest Operations Map NRS BC"
            ),
            new(
                Kind: LayerKind.From("FomRetention"),
                Name: "Retention",
                Description: "FOM Retention",
                TableName: "fom_retention",
                SourceIdColumn: "objectid",
                WfsUrl: "https://openmaps.gov.bc.ca/geo/pub/wfs?service=WFS",
                WfsLayer: "pub:WHSE_FOREST_TENURE.FOM_WLDLFE_TREE_RETNTN_AREA_SP",
                TileSource: "fom_retention",
                Color: "#80D39B",
                GeometryType: "POLYGON",
                Attribution: "Forest Operations Map NRS BC"
            ),
            new(
                Kind: LayerKind.From("FireCurrent"),
                Name: "Current Wildfires",
                Description: "Perimiters of current wildfires in BC.",
                TableName: "fire_current",
                SourceIdColumn: "objectid",
                WfsUrl: "https://openmaps.gov.bc.ca/geo/pub/wfs?service=WFS",
                WfsLayer: "pub:WHSE_LAND_AND_NATURAL_RESOURCE.PROT_CURRENT_FIRE_POLYS_SP",
                TileSource: "fire_current",
                Color: "#ED7527",
                GeometryType: "POLYGON",
                Attribution: "BC Wildfire Service"
            ),
        ];
        ByKind = All.ToDictionary(k=>k.Kind);
        AllKind = All.Select(m => m.Kind).ToImmutableHashSet();
        Initialized = true;
    }

    public static readonly List<LayerConfig> All;

    public static readonly IReadOnlyDictionary<LayerKind, LayerConfig> ByKind;

    public static LayerConfig Get(LayerKind kind)
    {
        if (ByKind.TryGetValue(kind, out var config)) return config;
        throw new KeyNotFoundException($"LayerKind '{kind.Value}' is not registered.");
    }
    public static readonly ImmutableHashSet<LayerKind> AllKind;

}