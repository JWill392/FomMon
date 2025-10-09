using FomMon.Data.Configuration.Layer;
using FomMon.Data.Models;
using NodaTime;

namespace FomMon.ApiService.Contracts;

public class AreaAlertDto
{
    public required int Id { get; set; }
    
    public required Guid AreaWatchId { get; set; }
    public required int FeatureId { get; set; } // variable table; no foreign key
    
    public required LayerKind LayerKind { get; set; } 
    public required Instant TriggeredAt { get; set; }

    public required FeatureReference FeatureReference { get; set; } = null!;
    
}