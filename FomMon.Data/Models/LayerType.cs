using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using FomMon.Data.Configuration.Layer;
using NodaTime;

namespace FomMon.Data.Models;



/// <summary>
/// DB table to store layer type metadata (1 row per layer type)
/// </summary>
public sealed class LayerType : IVersioned
{
    [Key][DatabaseGenerated(DatabaseGeneratedOption.None)]
    public required LayerKind Kind { get; set; }


    /// <summary>
    /// Last time features were successfully downloaded
    /// </summary>
    public Instant? LastDownloaded { get; set; }
    
    /// <summary>
    /// Hit count from last download
    /// </summary>
    public long? FeatureCount { get; set; }

    public uint Version { get; set; }
}
