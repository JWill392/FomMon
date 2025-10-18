using FomMon.Data.Configuration;
using Microsoft.Extensions.Logging;
using Minio;
using Minio.DataModel.Args;

namespace FomMon.MigrationService;

public class MinioInitializer(IMinioClient minioClient, ILogger<MinioInitializer> logger)
{
    public async Task EnsureBucketsExistAsync(CancellationToken c = default)
    {
        await EnsureBucketExistsAsync(ObjectStorageConfiguration.UserProfileImageBucket, c);
    }

    private async Task EnsureBucketExistsAsync(string bucketName, CancellationToken c)
    {
        var beArgs = new BucketExistsArgs().WithBucket(bucketName);
        bool found = await minioClient.BucketExistsAsync(beArgs, c);
        
        if (!found)
        {
            var mbArgs = new MakeBucketArgs().WithBucket(bucketName);
            await minioClient.MakeBucketAsync(mbArgs, c);
            logger.LogInformation("Created bucket {BucketName}", bucketName);
        }
        else
        {
            logger.LogInformation("Bucket {BucketName} already exists", bucketName);
        }
    }
}