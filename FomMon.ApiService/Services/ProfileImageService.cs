using System.Diagnostics;
using FluentResults;
using FomMon.ApiService.Contracts;
using Minio;
using Minio.DataModel.Args;
using OpenTelemetry.Trace;

namespace FomMon.ApiService.Services;

public interface IProfileImageService
{
    Task<string> UploadProfileImageAsync(Guid userId, IFormFile file, CancellationToken c = default);
    Task<Stream> GetProfileImageAsync(Guid userId, CancellationToken c = default);
    Task<string> GetProfileImageUrlAsync(Guid userId, int expiresInSeconds = 3600, CancellationToken c = default);
    Task DeleteProfileImageAsync(Guid userId, CancellationToken c = default);
}

public static class ProfileImageServiceExtensions
{
    public static IServiceCollection AddProfileImageService(this IServiceCollection services)
    {
        services.AddSingleton<IProfileImageService, MinioProfileImageService>();

        services.ConfigureOpenTelemetryTracerProvider(t => t.AddSource(MinioProfileImageService.ActivitySourceName));
        
        return services;
    }
}

public class MinioProfileImageService(
    IMinioClient minioClient,
    ILogger<MinioProfileImageService> logger,
    IUserService userService)
    : IProfileImageService
{
    private const string BucketName = "profile-images";

    public const string ActivitySourceName = "FomMon.ProfileImageService";
    private static readonly ActivitySource ActivitySource = new(ActivitySourceName);
    

    public async Task<string> UploadProfileImageAsync(Guid userId, IFormFile file, CancellationToken c = default)
    {
        using var activity = ActivitySource.StartActivity();
        activity?.SetTag("user.id", userId);
        if (file == null || file.Length == 0)
            throw new ArgumentException("File is required");
        

        // Validate file type
        // TODO use results instead of exceptions so controller can return error message
        var allowedTypes = new[] { "image/jpeg", "image/jpg", "image/png", "image/webp" };
        if (!allowedTypes.Contains(file.ContentType.ToLower()))
            throw new ArgumentException("Invalid file type");

        // Validate file size
        // TODO configure max size
        const int maxSizeMb = 5; 
        if (file.Length > maxSizeMb * 1024 * 1024) 
            throw new ArgumentException($"File size exceeds {maxSizeMb}MB limit"); 

        var objectName = $"{userId}/{Guid.NewGuid()}.jpg";
        
        activity?.SetTag("object.name", objectName);
        activity?.SetTag("object.size", file.Length);
        activity?.SetTag("object.type", file.ContentType);

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
            
            logger.LogInformation("Uploaded profile image for user {UserId}", userId);
        }
        catch (Exception ex)
        {
            activity?.SetStatus(ActivityStatusCode.Error, ex.Message);
            throw;
        }

        var result = await userService.SetProfileImageObjectAsync(userId, objectName, c);
        if (result.IsFailed)
        {
            activity?.SetStatus(ActivityStatusCode.Error, result.Errors.First().Message);
            throw new Exception("Error setting profile image object name: " + result.Errors.First().Message);
        }
        
        activity?.SetStatus(ActivityStatusCode.Ok);
        return objectName;
    }

    public async Task<Stream> GetProfileImageAsync(Guid userId, CancellationToken c = default)
    {
        using var activity = ActivitySource.StartActivity();
        activity?.SetTag("user.id", userId);

        var (user, errors) = await userService.GetAsync(userId, c);
        if (errors.Any()) throw new Exception("Error getting user: " + errors.First().Message);
        
        var objectName = user.ProfileImageObjectName;
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
            logger.LogError(ex, "Error getting profile image for user {UserId}", userId);
            throw;
        }
    }

    public async Task<string> GetProfileImageUrlAsync(Guid userId, int expiresInSeconds = 3600, CancellationToken c = default)
    {
        using var activity = ActivitySource.StartActivity();
        activity?.SetTag("user.id", userId);
        
        // TODO redis cache
        
        var (user, errors) = await userService.GetAsync(userId, c);
        if (errors.Any()) throw new Exception("Error getting user: " + errors.First().Message);
        
        var objectName = user.ProfileImageObjectName;
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
            logger.LogError(ex, "Error generating presigned URL for user {UserId}", userId);
            throw;
        }
    }

    public async Task DeleteProfileImageAsync(Guid userId, CancellationToken c = default)
    {
        using var activity = ActivitySource.StartActivity();
        activity?.SetTag("user.id", userId);
        
        var (user, errors) = await userService.GetAsync(userId, c);
        if (errors.Any()) throw new Exception("Error getting user: " + errors.First().Message);
        
        var objectName = user.ProfileImageObjectName;
        if (String.IsNullOrEmpty(objectName)) return;
        
        try
        {
            var result = await userService.SetProfileImageObjectAsync(userId, String.Empty, c);
            if (result.IsFailed) throw new Exception("Error setting profile image object name: " + result.Errors.First().Message);
            
            var removeObjectArgs = new RemoveObjectArgs()
                .WithBucket(BucketName)
                .WithObject(objectName);

            await minioClient.RemoveObjectAsync(removeObjectArgs, c);
            
            
            activity?.SetStatus(ActivityStatusCode.Ok);
            logger.LogInformation("Deleted profile image for user {UserId}", userId);
        }
        catch (Exception ex)
        {
            await userService.SetProfileImageObjectAsync(userId, objectName, c); // failed to remove; add back
            
            activity?.SetStatus(ActivityStatusCode.Error, ex.Message);
            logger.LogError(ex, "Error deleting profile image for user {UserId}", userId);
            throw;
        }
    }
}