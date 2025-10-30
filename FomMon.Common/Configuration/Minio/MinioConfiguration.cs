using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Minio;

namespace FomMon.Common.Configuration.Minio;

public static class MinioConfiguration
{
    public const string ImageBucket = "fommon-images";

    public static IHostApplicationBuilder AddMinio(this IHostApplicationBuilder builder, string connectionStringName)
    {
        builder.Services.AddMinio(c =>
        {
            var config = ParseMinioConnectionString(builder.Configuration.GetConnectionString(connectionStringName) 
                                                    ?? throw new ArgumentException("Missing minio connection string"));
            c.WithEndpoint(config.endpoint);
            c.WithCredentials(config.username, config.password);
            if (builder.Environment.IsDevelopment()) c.WithSSL(false);
        });
        return builder;
    }

    public static (string endpoint, string username, string password) ParseMinioConnectionString(
        string connectionstring)
    {
        
        var minioParams = connectionstring.Split(';')
            .Select(p => p.Split('='))
            .ToDictionary(p => p[0], p => p[1]);
        
        if (!minioParams.TryGetValue("Endpoint", out var endpoint)) throw new ArgumentException("Missing Endpoint");
        if (!minioParams.TryGetValue("AccessKey", out var accessKey)) throw new ArgumentException("Missing AccessKey");
        if (!minioParams.TryGetValue("SecretKey", out var secretKey)) throw new ArgumentException("Missing SecretKey");
        
        return (endpoint, accessKey, secretKey);
    }
}