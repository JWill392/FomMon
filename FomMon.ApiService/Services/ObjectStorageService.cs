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

    Task<Result<string>> GetParamHashAsync(string objectName, CancellationToken c = default);
    Task<Result<string>> GetImageUrlAsync(string objectName, int expiresInSeconds = 3600, CancellationToken c = default);
    Task<Result> DeleteImageAsync(string objectName, CancellationToken c = default);
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
public class ObjectNotTaggedError(string message) : Error(message);

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
        if(imgAllowedType is null) return Result.Fail(
            new InvalidFileTypeError($"File type '{foundTypes.FirstOrDefault()}' is not supported. " +
                                     $"Supported types: {String.Join(", ",allowedTypes)}"));

        // Validate file size
        // TODO configure max size
        if (imageStream.Length > MaxSizeMb * 1024 * 1024) 
            return Result.Fail(new FileSizeError($"File size exceeds {MaxSizeMb}MB limit"));

        
        return await Result.Try(async Task () =>
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
            activity?.SetStatus(ActivityStatusCode.Ok);
        });
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

    public async Task<Result<string>> GetParamHashAsync(string objectName, CancellationToken c = default)
    {
        return await GetObjectTagHashAsync(objectName, "paramHash", c);
    }
    private async Task<Result<string>> GetObjectTagHashAsync(string objectName, string tagName, CancellationToken c = default)
    {
        using var activity = ActivitySource.StartActivity();
        activity?.SetTag("object.name", objectName);

        var getTagArgs = new GetObjectTagsArgs()
            .WithBucket(BucketName)
            .WithObject(objectName);
        
        var tagResult = await Result.Try(async Task<Tagging> () => 
            await minioClient.GetObjectTagsAsync(getTagArgs, c), MinioCatchHandler);
        if (tagResult.IsFailed) return tagResult.ToResult<string>();
        
        if (!tagResult.Value.Tags.TryGetValue(tagName, out var tagValue))
            return Result.Fail(new ObjectNotTaggedError($"Object is not tagged with '{tagName}'"));
            
        return tagValue;
    }

    public async Task<Result<string>> GetImageUrlAsync(string objectName, int expiresInSeconds = 3600, CancellationToken c = default)
    {
        using var activity = ActivitySource.StartActivity();
        activity?.SetTag("object.name", objectName);
        activity?.SetTag("expires_in", expiresInSeconds);
        
        ArgumentException.ThrowIfNullOrWhiteSpace(objectName);

        // TODO redis cache

        var getResult = await Result.Try(async Task<string> () => 
                await minioClient.PresignedGetObjectAsync(
                    new PresignedGetObjectArgs()
                    .WithBucket(BucketName)
                    .WithObject(objectName)
                    .WithExpiry(expiresInSeconds))
        , MinioCatchHandler);
        if (getResult.IsFailed) return getResult;
        
        activity?.SetTag("url", getResult.Value);
        activity?.SetStatus(ActivityStatusCode.Ok);
        return getResult;
    }


    private static IError MinioCatchHandler(Exception ex)
    {
        Activity.Current?.SetStatus(ActivityStatusCode.Error, ex.Message);
        return ex switch
        {
            ObjectNotFoundException => new NotFoundError().CausedBy(ex),
            InvalidObjectNameException => new NotFoundError().CausedBy(ex),
            _ => new ExceptionalError(ex)
        };
    }

    public async Task<Result> DeleteImageAsync(string objectName, CancellationToken c = default)
    {
        using var activity = ActivitySource.StartActivity();
        activity?.SetTag("object.name", objectName);
        
        ArgumentException.ThrowIfNullOrWhiteSpace(objectName);

        return await Result.Try(async Task () =>
            await minioClient.RemoveObjectAsync(
                    new RemoveObjectArgs()
                    .WithBucket(BucketName)
                    .WithObject(objectName), c)
            , MinioCatchHandler);
        
    }
}