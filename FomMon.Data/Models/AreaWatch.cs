using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using FomMon.Data.Configuration.Layer;
using Microsoft.EntityFrameworkCore;
using NetTopologySuite.Geometries;
using NodaTime;

namespace FomMon.Data.Models;

[Index(nameof(UserId))]
public sealed class AreaWatch : IVersioned
{
    [Key][DatabaseGenerated(DatabaseGeneratedOption.None)]
    public Guid Id { get; set; }
    
    [ForeignKey(nameof(User))]
    public required Guid UserId { get; set; }
    
    [MaxLength(50)]
    public required string Name { get; set; } = string.Empty;
    
    public required Geometry Geometry { get; set; } // indexed in dbContext
    
    public required Instant AddedDate { get; set; }

    public Instant EvaluatedDate { get; set;}
    public User User { get; set; } = null!; // navigation property
    
    /// <summary>
    /// Layer kinds watched by this area
    /// </summary>
    public List<LayerKind> Layers { get; set; } = []; // not navigation (postgres stores as array on row)
    
    /// <summary>
    /// Features detected as added within this area
    /// </summary>
    public ICollection<AreaAlert> Alerts { get; set; } = []; // navigation
    
    public uint Version { get; set; }
    
    public override string ToString()
    {
        return $"AreaWatch(Id={Id}, UserId={UserId}, FeatureKinds={String.Join(", ", Layers)}, Geometry={Geometry}, AddedDate={AddedDate})";
    }

    
}


