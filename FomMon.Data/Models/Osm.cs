using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using NodaTime;

namespace FomMon.Data.Models;


public enum OsmSetupStep
{
    NotStarted,
    DownloadedOsm,
    Imported,
    Initialized,
    DownloadedExternalLayers,
    Generalized,
    TileFunctionsCreated,
}



public sealed class Osm
{
    [Key][DatabaseGenerated(DatabaseGeneratedOption.None)]
    public int Key { get; set; }
    public OsmSetupStep SetupStep { get; set; }
    public Instant UpdatedAt { get; set; }
    public Instant InitializedAt { get; set; }
}