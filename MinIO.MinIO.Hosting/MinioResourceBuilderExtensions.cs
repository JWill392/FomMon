using Aspire.Hosting;
using Aspire.Hosting.ApplicationModel;

namespace MinIO.MinIO.Hosting;

public static class MinioResourceBuilderExtensions
{
    public static IResourceBuilder<MinioResource> AddMinio(
        this IDistributedApplicationBuilder builder,
        string name,
        IResourceBuilder<ParameterResource> rootUser,
        IResourceBuilder<ParameterResource> rootPassword,
        int minioPort = 9000,
        int minioAdminPort = 9001)
    {
        var minioResource = new MinioResource(name, rootUser, rootPassword);

        return builder.AddResource(minioResource)
            .WithImage(MinioContainerImageTags.Image)
            .WithImageRegistry(MinioContainerImageTags.Registry)
            .WithImageTag(MinioContainerImageTags.Tag)
            .WithEnvironment("MINIO_ADDRESS", ":9000")
            .WithEnvironment("MINIO_CONSOLE_ADDRESS", ":9001")
            .WithEnvironment("MINIO_PROMETHEUS_AUTH_TYPE", "public")
            .WithHttpEndpoint(name: MinioResource.HttpEndpointName, port: minioPort, targetPort: 9000)
            .WithHttpEndpoint(name: MinioResource.HttpAdminEndpointName, port: minioAdminPort, targetPort: 9001)
            .WithEnvironment("MINIO_ROOT_USER", minioResource.RootUser)
            .WithEnvironment("MINIO_ROOT_PASSWORD", minioResource.RootPassword)
            .WithVolume("minio", "/data", isReadOnly:false)
            .WithArgs("server", "/data");
    }
    
    internal static class MinioContainerImageTags
    {
        public const string Registry = "docker.io";
        public const string Image = "minio/minio";
        public const string Tag = "latest";
    }
}