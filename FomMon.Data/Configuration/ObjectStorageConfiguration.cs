namespace FomMon.Data.Configuration;

public static class ObjectStorageConfiguration
{
    public const string UserProfileImageBucket = "profile-images";

    
    
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