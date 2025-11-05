using FomMon.Common.Shared;
using FomMon.Data.Contexts;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace FomMon.ApiService.Jobs.Osm;

public interface IOsmTileFunctionGenerator
{
    Task CreateTileFunctionsAsync(CancellationToken c = default);
}

public class OsmTileFunctionGenerator(
    IOptions<OsmConfig> options,
    AppDbContext db,
    ILogger<OsmTileFunctionGenerator> logger) : IOsmTileFunctionGenerator
{
    private readonly OsmConfig _config = options.Value;
    private readonly Dictionary<string, List<string>> _tableColumns = new();

    public async Task CreateTileFunctionsAsync(CancellationToken c = default)
    {
        string schema = _config.Schema;

        var layerFunctions = new Dictionary<string, string>();
        
        await CreateZoomNumberedFunctionAsync(schema, "land_tile", "land", 6, 11, c);
        layerFunctions.Add("land", "land_tile");
        
        await CreateZoomSuffixFunctionAsync(schema, "water_tile", "water_polygons", 
            [("s", 7 ), ("m", 9), ("l", 11)], c);
        layerFunctions.Add("water_polygons", "water_tile");
        
        await CreateZoomSuffixFunctionAsync(schema, "boundaries_tile", "boundaries", [("s", 2 ), ("m", 6), ("l", 8)], c);
        layerFunctions.Add("boundaries", "boundaries_tile");
        
        await CreateZoomSuffixFunctionAsync(schema, "ocean_tile", "ocean", [("low", 9)], c);
        layerFunctions.Add("ocean", "ocean_tile");
        
        await CreateZoomSuffixFunctionAsync(schema, "streets_tile", "streets", [("low", 10),("med", 13)], c);
        layerFunctions.Add("streets", "streets_tile");

        (string table, int minZoom)[] shortbreadLayers = [
            ("addresses", 17),
            ("boundaries", 2),
            ("boundary_labels", 2),
            ("bridges", 10),
            ("buildings", 14),
            ("dam_lines", 10),
            ("dam_polygons", 12),
            ("ferries", 10),
            ("land", 6),
            ("ocean", 0),
            ("pier_lines", 12),
            ("pier_polygons", 12),
            ("place_labels", 5),
            ("pois", 16),
            ("public_transport", 12),
            ("sites", 10),
            ("street_labels", 12),
            ("street_polygons", 12),
            ("streets", 5),
            ("water_lines", 9),
            ("water_polygons", 4),
            ("water_polygons_labels", 10)
        ];
        
        await CreateCombinedFunctionAsync(schema, "osm_tile", shortbreadLayers, layerFunctions, c);
        
        logger.LogInformation("PostgreSQL tile functions created successfully");
    }

    private async Task CreateCombinedFunctionAsync(string schema, string functionName, 
        (string table, int minZoom)[] layers, Dictionary<string, string> layerFunctions, CancellationToken c)
    {
        SqlUtil.ValidateSqlIdentifier(schema);
        SqlUtil.ValidateSqlIdentifier(functionName);
        
        var sql = await GenerateCombinedFunction(schema, functionName, layers, layerFunctions, c);
        
        logger.LogInformation("Creating combined tile function for {Schema}.{Table}", schema, functionName);
        
        await db.Database.ExecuteSqlRawAsync(sql, c);
    }

    private async Task<string> GenerateCombinedFunction(string schema, string functionName, 
        (string layer, int minZoom)[] layers, Dictionary<string, string> layerFunctions, CancellationToken c = default)
    {
        
        var layerSqlList = new List<string>();
        foreach (var (table, minZoom) in layers)
        {
            var cols = (await GetColumnsAsync(schema, table, c)).ToHashSet();
            string layerSql = "";
            if (layerFunctions.TryGetValue(table, out var func))
            {
                layerSql = $"{schema}.{func}(z, x, y, query_params)";
            }
            else
            {
                layerSql = TableAsTile(schema, functionName, table, table, cols, fixedZoom:null);
            }
            layerSqlList.Add($"CASE WHEN z >= {minZoom} THEN ({layerSql}) ELSE ''::bytea END");
        }
        
        
        return $@"
CREATE OR REPLACE FUNCTION {schema}.{functionName}(z integer, x integer, y integer, query_params json)
RETURNS bytea AS $$
DECLARE
  mvt bytea;
  envelope geometry;
BEGIN
  envelope := ST_TileEnvelope({functionName}.z, {functionName}.x, {functionName}.y);
  SELECT INTO mvt
{string.Join("\n||\n", layerSqlList)};
  
  RETURN mvt;
END
$$ LANGUAGE plpgsql IMMUTABLE STRICT PARALLEL SAFE;
";
    }

    private async Task CreateZoomNumberedFunctionAsync(
        string schema,
        string functionName,
        string tableName,
        int zoomFrom,
        int zoomTo,
        CancellationToken c = default)
    {
        SqlUtil.ValidateSqlIdentifier(schema);
        SqlUtil.ValidateSqlIdentifier(functionName);
        SqlUtil.ValidateSqlIdentifier(tableName);
        

        var sql = await GenerateZoomFunction(schema, functionName, tableName, zoomFrom, zoomTo, c:c);

        logger.LogInformation("Creating tile function for {Schema}.{Table} (z{From}-z{To})",
            schema, tableName, zoomFrom, zoomTo);

        await db.Database.ExecuteSqlRawAsync(sql, c);
    }

    private async Task CreateZoomSuffixFunctionAsync(
        string schema,
        string functionName,
        string tableName,
        (string suffix, int zoom)[] zoomMap,
        CancellationToken c = default)
    {
        SqlUtil.ValidateSqlIdentifier(schema);
        SqlUtil.ValidateSqlIdentifier(functionName);
        SqlUtil.ValidateSqlIdentifier(tableName);
        foreach (var (suffix, _) in zoomMap) SqlUtil.ValidateSqlIdentifier(suffix);

        var sql = await GenerateZoomFunction(schema, functionName, tableName, zoomMap: zoomMap, c:c);

        logger.LogInformation("Creating tile function for {Schema}.{Table} with suffixes: {Suffixes}",
            schema, tableName, string.Join(", ", zoomMap));

        
        await db.Database.ExecuteSqlRawAsync(sql, c);
    }


    private async Task<string> GenerateZoomFunction(string schema, string functionName, string baseTable,  int? zoomFrom = null, int? zoomTo = null, (string suffix, int zoom)[]? zoomMap = null, CancellationToken c = default)
    {
        var sourceTables = GetSourceTables(baseTable, zoomFrom, zoomTo, zoomMap);
        HashSet<string>? columns = null;
        foreach (var (_, _, table) in sourceTables)
        {
            var cols = await GetColumnsAsync(schema, table, c);
            columns ??= cols.ToHashSet();
            columns.IntersectWith(cols);
        }
        columns ??= [];
        
        var executionCases = new List<string>();
        foreach (var (zoom, isFixedZoom, fullTableName) in sourceTables)
        {
            var tableSql = TableAsTile(schema, functionName, baseTable, fullTableName, columns, isFixedZoom?zoom:null, into:"mvt");
            executionCases.Add($"    WHEN z {(isFixedZoom?"=":"<=")} {zoom} THEN {tableSql};");
        }
        

        return $@"
CREATE OR REPLACE FUNCTION {schema}.{functionName}(z integer, x integer, y integer, query_params json)
RETURNS bytea AS $$
DECLARE
  mvt bytea;
  envelope geometry;
BEGIN
  envelope := ST_TileEnvelope({functionName}.z, {functionName}.x, {functionName}.y);
  -- Execute query based on zoom level
  CASE
{string.Join("\n", executionCases)}
    ELSE
      {TableAsTile(schema, functionName, baseTable, baseTable, columns, fixedZoom: null, into:"mvt")
      // TODO BUG this causes 1px overlapping geometry at tile edges for land zoom 12+
      };
  END CASE;

  RETURN mvt;
END
$$ LANGUAGE plpgsql IMMUTABLE STRICT PARALLEL SAFE;
";
    }

    private List<(int zoom, bool fixedZoom, string table)> GetSourceTables(string tableName, int? zoomFrom = null, int? zoomTo = null,
        (string suffix, int zoom)[]? zoomMap = null)
    {
        List<(int zoom, bool fixedZoom, string table)> tableList = [];
        if (zoomFrom is not null && zoomTo is not null)
        {
            // add numbered zoom tables (e.g., land_z6, land_z7, etc.)
            for (int z = zoomFrom.Value; z <= zoomTo; z++)
            {
                tableList.Add((z, true, $"{tableName}_z{z}"));
            }
        } else if (zoomMap is not null) {
            // add mapped zoom tables (e.g., water_s, water_m, water_l)
            foreach (var (suffix, maxZoom) in zoomMap.OrderBy(z => z.zoom))
            {
                tableList.Add((maxZoom, false, $"{tableName}_{suffix}"));
            } 
        }
        else
        {
            throw new ArgumentException("Either zoomFrom and zoomTo must be specified, or zoomMap must be specified");       
        }
        return tableList;
    }
    private string TableAsTile(string schema, string functionName, string name, string table, HashSet<string> columns, int? fixedZoom = null, string? into = null)
    {
        var columnSql = string.Join(Environment.NewLine, columns.Except(["geom", "minzoom", "x", "y"]).Select(col => $""", "{col}" """));
        
        var where = fixedZoom is null ?
            $"WHERE t.geom && envelope" :
            $"""
              WHERE {functionName}.z = {fixedZoom} AND t.x = {functionName}.x AND t.y = {functionName}.y
              """
            ;
        var minZoomFeature = columns.Contains("minzoom") ? $"AND t.minzoom <= {functionName}.z" : "";
        return $"""
                SELECT {(into is not null?$"INTO {into}":"")} 
                ST_AsMVT(tile, '{name}', 4096, 'geom') 
                FROM (
                    SELECT
                      ST_AsMVTGeom(
                        t.geom,
                        envelope,
                        4096, 64, true) AS geom
                        {columnSql} 
                    FROM {schema}.{table} AS t
                    {where}
                    {minZoomFeature}
                ) as tile WHERE geom IS NOT NULL
                """;
    } // osm data is 3857, so we can use envelope directly without transform

    private async Task<List<string>> GetColumnsAsync(string schema, string tableName, CancellationToken c)
    {
        SqlUtil.ValidateSqlIdentifier(schema);
        SqlUtil.ValidateSqlIdentifier(tableName);

        var key = $"{schema}.{tableName}";
        
        if (_tableColumns.TryGetValue(key, out var columns)) return columns;

        var result = await db.Database.SqlQuery<string>($@"
SELECT column_name As Value
FROM information_schema.columns
WHERE table_schema = {schema}
AND table_name = {tableName}
").ToListAsync(c);
        
        logger.LogInformation("Found columns for {Schema}.{Table}: {Columns}", schema, tableName, string.Join(", ", result));
        _tableColumns[key] = result;
        return result;
    }
    
}