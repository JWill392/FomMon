using Aspire.Hosting;
using Aspire.Hosting.ApplicationModel;

namespace MinIO.MinIO.Hosting;

public sealed class MinioResource(string name, 
    IResourceBuilder<ParameterResource> rootUser, 
    IResourceBuilder<ParameterResource> rootPassword)
    : ContainerResource(name), IResourceWithConnectionString
{
    internal const string HttpEndpointName = "http";
    internal const string HttpAdminEndpointName = "admin";

    public ParameterResource RootUser { get; } = rootUser.Resource;
    public ParameterResource RootPassword { get; } = rootPassword.Resource;

    private EndpointReference? _httpEndpointReference;
    private EndpointReference? _httpAdminEndpointReference;

    public EndpointReference HttpEndpoint =>
        _httpEndpointReference ??= new EndpointReference(this, HttpEndpointName);

    public EndpointReference HttpAdminEndpoint =>
        _httpAdminEndpointReference ??= new EndpointReference(this, HttpAdminEndpointName);

    public ReferenceExpression ConnectionStringExpression => 
        ReferenceExpression.Create(
            $"Endpoint={HttpEndpoint.Property(EndpointProperty.HostAndPort)};AccessKey={RootUser};SecretKey={RootPassword}"
        );
    
}