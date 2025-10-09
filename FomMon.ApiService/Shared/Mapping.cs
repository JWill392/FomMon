using Mapster;
using NetTopologySuite.Geometries;

namespace FomMon.ApiService.Shared;


public static class MappingExtensions
{
    public static IServiceCollection AddMappings(this IServiceCollection services)
    {
        var config = new TypeAdapterConfig();
        config.Scan(AppDomain.CurrentDomain.GetAssemblies()); // get all IRegister classes

        services.AddSingleton(config);
        services.AddMapster(); 

        return services;
    }
}


public class Mapping : IRegister
{
    public void Register(TypeAdapterConfig config)
    {
        // Geometry needs to know SRID when constructing, so just copy from source geometry
        config.NewConfig<Geometry, Geometry>()
            .MapWith(g => g.Copy()); 
        // if ever need to construct from scratch, add default SRID factory:  MapContext.Current.GetService<GeometryFactory>().CreateGeometry(g)
    }
}
