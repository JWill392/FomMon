namespace FomMon.Data.Contexts;


public sealed record AppDbConfig
{
    public required string OsmSchema { get; init; } = "osm";
    public required string LayersSchema { get; init; } = "layers";
}