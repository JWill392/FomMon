using System.Diagnostics;
using Minio;
using Minio.DataModel.Args;
using OpenTelemetry.Trace;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Metadata;

namespace FomMon.ApiService.Services;

public interface IObjectStorageService
{
    Task UploadImageAsync(string objectName, IFormFile file, CancellationToken c = default);
    Task<Stream> GetImageAsync(string objectName, CancellationToken c = default);
    Task<string> GetImageUrlAsync(string objectName, int expiresInSeconds = 3600, CancellationToken c = default);
    Task DeleteImageAsync(string objectName, CancellationToken c = default);
}

public static class MinioObjectStorageServiceExtensions
{
    public static IServiceCollection AddMinioObjectStorageService(this IServiceCollection services)
    {
        services.AddSingleton<IObjectStorageService, MinioObjectStorageService>();

        services.ConfigureOpenTelemetryTracerProvider(t => t.AddSource(MinioObjectStorageService.ActivitySourceName));
        
        return services;
    }
}

public class MinioObjectStorageService(
    IMinioClient minioClient,
    ILogger<MinioObjectStorageService> logger)
    : IObjectStorageService
{
    private const int MaxSizeMb = 5;
    
    private const string BucketName = Data.Configuration.ObjectStorageConfiguration.ImageBucket;

    public const string ActivitySourceName = "FomMon.ProfileImageService";
    private static readonly ActivitySource ActivitySource = new(ActivitySourceName);
    
    
    public async Task UploadImageAsync(string objectName, IFormFile file, CancellationToken c = default)
    {
        using var activity = ActivitySource.StartActivity();
        activity?.SetTag("object.name", objectName);
        activity?.SetTag("object.size", file.Length);
        activity?.SetTag("object.type", file.ContentType);
        
        ArgumentException.ThrowIfNullOrWhiteSpace(objectName);
        if (file == null || file.Length == 0)
            throw new ArgumentException("File is required");

        // Validate file type
        // TODO use results instead of exceptions so controller can return error message
        if (!await IsValidFormat(file, ["image/jpeg", "image/png", "image/webp"], c))
        {
            throw new ArgumentException("Invalid file type");
        }

        // Validate file size
        // TODO configure max size
        if (file.Length > MaxSizeMb * 1024 * 1024) 
            throw new ArgumentException($"File size exceeds {MaxSizeMb}MB limit");
        
        try
        {
            await using var stream = file.OpenReadStream();
            
            var putObjectArgs = new PutObjectArgs()
                .WithBucket(BucketName)
                .WithObject(objectName)
                .WithStreamData(stream)
                .WithObjectSize(file.Length)
                .WithContentType(file.ContentType);

            await minioClient.PutObjectAsync(putObjectArgs, c);
        }
        catch (Exception ex)
        {
            activity?.SetStatus(ActivityStatusCode.Error, ex.Message);
            logger.LogError(ex, "Error uploading profile image for object {objectName}", objectName);
            throw;
        }
        
        activity?.SetStatus(ActivityStatusCode.Ok);
    }

    private  async Task<bool> IsValidFormat(IFormFile file, string[] allowedMimetypes, CancellationToken c = default)
    {
        await using var stream = file.OpenReadStream();
        try
        {
            var format = await Image.DetectFormatAsync(stream, c);

            bool valid = format.MimeTypes.Intersect(allowedMimetypes).Any();
            
            if (!valid) logger.LogWarning("Invalid image format: {format}", format.Name);
            
            return valid;
        }
        catch (Exception ex) when (ex is InvalidImageContentException or 
                                       NotSupportedException or 
                                       UnknownImageFormatException)
        {
            return false;
        }

    }

    public async Task<Stream> GetImageAsync(string objectName, CancellationToken c = default)
    {
        using var activity = ActivitySource.StartActivity();
        activity?.SetTag("object.name", objectName);
        
        ArgumentException.ThrowIfNullOrWhiteSpace(objectName);
        
        if (String.IsNullOrEmpty(objectName)) return Stream.Null;

        try
        {
            var memoryStream = new MemoryStream();

            var getObjectArgs = new GetObjectArgs()
                .WithBucket(BucketName)
                .WithObject(objectName)
                .WithCallbackStream(stream => stream.CopyTo(memoryStream));

            await minioClient.GetObjectAsync(getObjectArgs, c);

            activity?.SetStatus(ActivityStatusCode.Ok);
            memoryStream.Position = 0;
            return memoryStream;
        }
        catch (Exception ex)
        {
            activity?.SetStatus(ActivityStatusCode.Error, ex.Message);
            logger.LogError(ex, "Error getting profile image for object {objectName}", objectName);
            throw;
        }
    }

    public async Task<string> GetImageUrlAsync(string objectName, int expiresInSeconds = 3600, CancellationToken c = default)
    {
        using var activity = ActivitySource.StartActivity();
        activity?.SetTag("object.name", objectName);
        
        ArgumentException.ThrowIfNullOrWhiteSpace(objectName);
        
        // TODO redis cache
        
        if (String.IsNullOrEmpty(objectName)) return String.Empty;
        
        try
        {
            var presignedGetObjectArgs = new PresignedGetObjectArgs()
                .WithBucket(BucketName)
                .WithObject(objectName)
                .WithExpiry(expiresInSeconds);

            var url = await minioClient.PresignedGetObjectAsync(presignedGetObjectArgs);
            
            activity?.SetTag("url", url);
            activity?.SetStatus(ActivityStatusCode.Ok);
            return url;
        }
        catch (Exception ex)
        {
            activity?.SetStatus(ActivityStatusCode.Error, ex.Message);
            logger.LogError(ex, "Error generating presigned URL for object {objectName}", objectName);
            throw;
        }
    }

    public async Task DeleteImageAsync(string objectName, CancellationToken c = default)
    {
        using var activity = ActivitySource.StartActivity();
        activity?.SetTag("object.name", objectName);
        
        ArgumentException.ThrowIfNullOrWhiteSpace(objectName);
        
        try
        {
            var removeObjectArgs = new RemoveObjectArgs()
                .WithBucket(BucketName)
                .WithObject(objectName);

            await minioClient.RemoveObjectAsync(removeObjectArgs, c);
            
            
            activity?.SetStatus(ActivityStatusCode.Ok);
        }
        catch (Exception ex)
        {
            activity?.SetStatus(ActivityStatusCode.Error, ex.Message);
            logger.LogError(ex, "Error deleting profile image for object {objectName}", objectName);
            throw;
        }
    }
}