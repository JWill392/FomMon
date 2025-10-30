
using Aspire.Hosting;
using Aspire.Hosting.ApplicationModel;

namespace MapLibre.Martin.Hosting;

public sealed class MartinResource(string name) : ContainerResource(name), IResourceWithServiceDiscovery
{

    internal const string HttpEndpointName = "http";
    
    public MartinResourceSettings Settings { get; } = new();

    private EndpointReference? _httpReference;

    public EndpointReference HttpEndpoint =>
        _httpReference ??= new(this, HttpEndpointName);

}
