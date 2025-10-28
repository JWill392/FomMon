using FomMon.Data.Configuration;
using Microsoft.Extensions.Logging;
using Minio;
using Minio.DataModel.Args;
using Minio.DataModel.ILM;

namespace FomMon.MigrationService;

public class MinioInitializer(IMinioClient minioClient, ILogger<MinioInitializer> logger)
{
    public async Task EnsureBucketsExistAsync(CancellationToken c = default)
    {
        await EnsureBucketExistsAsync(ObjectStorageConfiguration.ImageBucket, c);
        await ConfigureBucketVersioningAsync(ObjectStorageConfiguration.ImageBucket, c);
        await ConfigureBucketLifecycleAsync(ObjectStorageConfiguration.ImageBucket, c);
    }

    private async Task EnsureBucketExistsAsync(string bucketName, CancellationToken c)
    {
        var beArgs = new BucketExistsArgs().WithBucket(bucketName);
        bool found = await minioClient.BucketExistsAsync(beArgs, c);
        
        if (!found)
        {
            var mbArgs = new MakeBucketArgs()
                .WithBucket(bucketName);
            await minioClient.MakeBucketAsync(mbArgs, c);
            logger.LogInformation("Created bucket {BucketName}", bucketName);
        }
        else
        {
            logger.LogInformation("Bucket {BucketName} already exists", bucketName);
        }
    }

    private async Task ConfigureBucketVersioningAsync(string bucketName, CancellationToken c)
    {
        try
        {
            var versioningArgs = new SetVersioningArgs()
                .WithBucket(bucketName)
                .WithVersioningEnabled();
            
            await minioClient.SetVersioningAsync(versioningArgs, c);
            logger.LogInformation("Enabled versioning for bucket {BucketName}", bucketName);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to enable versioning for bucket {BucketName}", bucketName);
            throw;
        }
    }
    private async Task ConfigureBucketLifecycleAsync(string bucketName, CancellationToken c)
    {
        try
        {
            var lifecycleArgs = new SetBucketLifecycleArgs()
                .WithBucket(bucketName)
                .WithLifecycleConfiguration(new LifecycleConfiguration([
                    new LifecycleRule
                    {
                        ID = "DeleteOldVersions",
                        Status = LifecycleRule.LifecycleRuleStatusEnabled,
                        NoncurrentVersionExpirationObject = new NoncurrentVersionExpiration(nonCurrentDays: 7),
                        
                    },
                    new LifecycleRule
                    {
                        ID = "DeferCurrentVersionDeletion",
                        Status = LifecycleRule.LifecycleRuleStatusEnabled,
                        Expiration = new Expiration
                        {
                            Days = 7,
                            ExpiredObjectDeleteMarker = true
                        }
                    }
                ]));
            
            await minioClient.SetBucketLifecycleAsync(lifecycleArgs, c);
            logger.LogInformation("Configured lifecycle policy for bucket {BucketName}", bucketName);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to configure lifecycle policy for bucket {BucketName}", bucketName);
            throw;
        }
    }
}