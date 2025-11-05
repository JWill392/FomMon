using System.Diagnostics;
using FluentResults;
using FomMon.Common.Configuration.Minio;
using Minio;
using Minio.DataModel.Args;
using OpenTelemetry.Trace;
using SixLabors.ImageSharp;

namespace FomMon.ApiService.Services;

public interface IObjectStorageService
{

    Task<Result> UploadImageAsync(string objectName, Stream imageStream, long length,
        CancellationToken c = default);
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

public class InvalidFileTypeError(string message) : Error(message);
public class FileSizeError(string message) : Error(message);

public class MinioObjectStorageService(
    IMinioClient minioClient,
    ILogger<MinioObjectStorageService> logger)
    : IObjectStorageService
{
    private const int MaxSizeMb = 5;
    
    private const string BucketName = MinioConfiguration.ImageBucket;

    public const string ActivitySourceName = nameof(MinioObjectStorageService);
    private static readonly ActivitySource ActivitySource = new(ActivitySourceName);

    public async Task<Result> UploadImageAsync(string objectName, Stream imageStream, long length, CancellationToken c = default)
    {
        using var activity = ActivitySource.StartActivity();
        activity?.SetTag("object.name", objectName);
        activity?.SetTag("object.size", length);

        ArgumentException.ThrowIfNullOrWhiteSpace(objectName);

        // Validate file type
        string[] allowedTypes = ["image/jpeg", "image/png", "image/webp"];
        (string? imgAllowedType, string[] foundTypes) = await ValidFormat(imageStream, allowedTypes, c);
        if(imgAllowedType is null) return Result.Fail(new InvalidFileTypeError($"File type '{foundTypes.FirstOrDefault()}' is not supported. Supported types: {String.Join(", ",allowedTypes)}"));

        // Validate file size
        // TODO configure max size
        if (imageStream.Length > MaxSizeMb * 1024 * 1024) 
            return Result.Fail(new FileSizeError($"File size exceeds {MaxSizeMb}MB limit"));
        
        try
        {
            var putObjectArgs = new PutObjectArgs()
                .WithBucket(BucketName)
                .WithObject(objectName)
                .WithStreamData(imageStream)
                .WithObjectSize(imageStream.Length)
                .WithContentType(imgAllowedType); 

            await minioClient.PutObjectAsync(putObjectArgs, c);
        }
        catch (Exception ex)
        {
            activity?.SetStatus(ActivityStatusCode.Error, ex.Message);
            logger.LogError(ex, "Error uploading profile image for object {objectName}", objectName);
            throw;
        }
        
        activity?.SetStatus(ActivityStatusCode.Ok);
        return Result.Ok();
    }

    private async Task<(string? validType, string[] foundTypes)> ValidFormat(Stream imageStream, string[] allowedMimetypes, CancellationToken c = default)
    {
        try
        {
            var format = await Image.DetectFormatAsync(imageStream, c);
            var foundTypes = format.MimeTypes.ToArray();
            logger.LogInformation("Found types: {FoundTypes}", String.Join(", ", foundTypes));

            string? validType = foundTypes.Intersect(allowedMimetypes).FirstOrDefault();

            return (validType, foundTypes);
        }
        catch (Exception ex) when (ex is InvalidImageContentException or 
                                       NotSupportedException or 
                                       UnknownImageFormatException)
        {
            logger.LogDebug($"Exception parsing image: {ex.Message}");
            return (null, []);
        }
    }

    public async Task<Stream> GetImageAsync(string objectName, CancellationToken c = default)
    {
        using var activity = ActivitySource.StartActivity();
        activity?.SetTag("object.name", objectName);
        
        ArgumentException.ThrowIfNullOrWhiteSpace(objectName);

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