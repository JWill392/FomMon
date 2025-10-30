using System.ComponentModel.DataAnnotations;
using FomMon.Common.Configuration.Layer;
using FomMon.Data.Models;
using Mapster;
using NetTopologySuite.Geometries;

namespace FomMon.ApiService.Contracts;

public record UpdateAreaWatchRequest
{
    [MaxLength(50)]
    public string? Name { get; init; }
    
    public Geometry? Geometry { get; init; }

    public List<LayerKind>? Layers { get; init; }
    

    public sealed class Mapping : IRegister
    {
        public void Register(TypeAdapterConfig config)
        {
            config.ForType<UpdateAreaWatchRequest, AreaWatch>()
                .IgnoreNullValues(true) // patch behavior
                .Ignore(dest => dest.Id)
                .Ignore(dest => dest.UserId)
                .Ignore(dest => dest.AddedDate);
        }
    }
}



