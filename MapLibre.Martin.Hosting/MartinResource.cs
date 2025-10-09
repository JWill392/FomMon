
using MapLibre.Martin.Hosting;

namespace Aspire.Hosting.ApplicationModel;

public sealed class MartinResource(string name) : ContainerResource(name), IResourceWithServiceDiscovery
{

    internal const string HttpEndpointName = "http";
    
    public MartinResourceSettings Settings { get; } = new();

    private EndpointReference? _httpReference;

    public EndpointReference HttpEndpoint =>
        _httpReference ??= new(this, HttpEndpointName);

}
