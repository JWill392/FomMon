using System.Diagnostics;
using FluentResults;
using FomMon.Common.Configuration.Minio;
using Minio;
using Minio.DataModel.Args;
using Minio.DataModel.Tags;
using Minio.Exceptions;
using OpenTelemetry.Trace;
using SixLabors.ImageSharp;

namespace FomMon.ApiService.Services;

public interface IImageStorageService
{
    Task<Result> UploadImageAsync(string objectName, Stream imageStream, long length, string? paramHash = null,
        CancellationToken c = default);
    Task<string?> TryGetImageUrlAsync(string objectName, int expiresInSeconds = 3600, bool getParamHash = false, CancellationToken c = default);
    Task<bool> TryDeleteImageAsync(string objectName, CancellationToken c = default);
}


public static class MinioObjectStorageServiceExtensions
{
    public static IServiceCollection AddMinioObjectStorageService(this IServiceCollection services)
    {
        services.AddSingleton<IImageStorageService, MinioImageStorageService>();

        services.ConfigureOpenTelemetryTracerProvider(t => t.AddSource(MinioImageStorageService.ActivitySourceName));
        
        return services;
    }
}

public class InvalidFileTypeError(string message) : Error(message);
public class FileSizeError(string message) : Error(message);

public class MinioImageStorageService(
    IMinioClient minioClient,
    ILogger<MinioImageStorageService> logger)
    : IImageStorageService
{
    private const int MaxSizeMb = 5;
    
    private const string BucketName = MinioConfiguration.ImageBucket;

    public const string ActivitySourceName = nameof(MinioImageStorageService);
    private static readonly ActivitySource ActivitySource = new(ActivitySourceName);

    /// <summary>
    /// Uploads an image to the object storage. Validates the image format and size before uploading.
    /// </summary>
    /// <param name="objectName">The name of the object to store in the storage service.</param>
    /// <param name="imageStream">The stream of the image file being uploaded.</param>
    /// <param name="length">The length of the image stream in bytes.</param>
    /// <param name="paramHash">Optional parameter to include a parameter hash value.  Should allow identifying whether parameters have changed since image generated.</param>
    /// <param name="c">A CancellationToken to observe while performing the upload operation.</param>
    /// <returns>Returns a result object indicating success or containing errors if the upload fails.</returns>
    public async Task<Result> UploadImageAsync(string objectName, Stream imageStream, long length,
        string? paramHash = null, CancellationToken c = default)
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
            if (paramHash is not null)
            {
                var tags = new Dictionary<string, string> { ["paramHash"] = paramHash };
                putObjectArgs.WithTagging(Tagging.GetObjectTags(tags));
            }

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

    /// <summary>
    /// Attempts to generate a presigned URL for an image in the object storage.
    /// Returns null if the specified image object is not found.
    /// </summary>
    /// <param name="objectName">The name of the object to generate the presigned URL for.</param>
    /// <param name="expiresInSeconds">The duration in seconds for which the presigned URL remains valid. Defaults to 3600 seconds.</param>
    /// <param name="getParamHash">Specifies whether to retrieve 'paramHash' as query parameter. It is hash of parameters that generated image.</param>
    /// <param name="c">A CancellationToken to observe while waiting for the task to complete.</param>
    /// <returns>Returns the presigned URL as a string on success, or null if the object is not found.</returns>
    public async Task<string?> TryGetImageUrlAsync(string objectName, int expiresInSeconds = 3600,
        bool getParamHash = false, CancellationToken c = default)
    {
        using var activity = ActivitySource.StartActivity();
        activity?.SetTag("object.name", objectName);
        activity?.SetTag("expires_in", expiresInSeconds);
        activity?.SetTag("get_param_hash", getParamHash);
        
        ArgumentException.ThrowIfNullOrWhiteSpace(objectName);
        
        // TODO redis cache

        try
        {
            string? paramHash = null;
            if (getParamHash)
            {
                var getTagArgs = new GetObjectTagsArgs()
                    .WithBucket(BucketName)
                    .WithObject(objectName);
                var tags = await minioClient.GetObjectTagsAsync(getTagArgs, c);
                tags.Tags.TryGetValue("paramHash", out paramHash);
            }
            
            var presignedGetObjectArgs = new PresignedGetObjectArgs()
                .WithBucket(BucketName)
                .WithObject(objectName)
                .WithExpiry(expiresInSeconds);
            

            var url = await minioClient.PresignedGetObjectAsync(presignedGetObjectArgs);
            if (paramHash is not null)
            {
                var uriBuilder = new UriBuilder(url);
                var query = System.Web.HttpUtility.ParseQueryString(uriBuilder.Query);
                query["paramHash"] = paramHash;
                uriBuilder.Query = query.ToString();
                url = uriBuilder.ToString();
            }

            activity?.SetTag("param_hash", paramHash);
            activity?.SetTag("url", url);
            activity?.SetStatus(ActivityStatusCode.Ok);
            return url;
        }
        catch (ObjectNotFoundException)
        {
            return null;
        }
        catch (Exception ex)
        {
            activity?.SetStatus(ActivityStatusCode.Error, ex.Message);
            logger.LogError(ex, "Error generating presigned URL for object {objectName}", objectName);
            throw;
        }
    }

    public async Task<bool> TryDeleteImageAsync(string objectName, CancellationToken c = default)
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
        catch (InvalidObjectNameException ex)
        {
            return false;
        }
        catch (Exception ex)
        {
            activity?.SetStatus(ActivityStatusCode.Error, ex.Message);
            logger.LogError(ex, "Error deleting profile image for object {objectName}", objectName);
            throw;
        }

        return true;
    }
}