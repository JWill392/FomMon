using System.Linq.Expressions;
using FluentResults;
using FomMon.Data.Contexts;
using Microsoft.IdentityModel.Tokens;

namespace FomMon.ApiService.Services;

public interface IEntityObjectStorageService
{
    public Task<Result<string>> UploadImageAsync<T>(T entity,
        Expression<Func<T, string>> propertyExpression,
        Func<T, string> nameFactory,
        Stream imageStream, long length, CancellationToken c = default) where T : class;
}

/// <summary>
/// Uploads an image to object storage and updates the entity with the object name.
/// </summary>
public class VersionedEntityObjectStorageService(IImageStorageService imageStorageService, AppDbContext db) : IEntityObjectStorageService
{
    public async Task<Result<string>> UploadImageAsync<T>(T entity, 
        Expression<Func<T, string>> propertyExpression,
        Func<T, string> nameFactory,
        Stream imageStream, long length, CancellationToken c = default) where T : class
    {
        if (propertyExpression.Body is not MemberExpression memberExpression)
            throw new ArgumentException("Expression must be a member expression", nameof(propertyExpression));
    
        var propertyInfo = memberExpression.Member as System.Reflection.PropertyInfo;
        if (propertyInfo is null)
            throw new ArgumentException("Expression must refer to a property", nameof(propertyExpression));

        var objectName = propertyExpression.Compile().Invoke(entity);
        
        // version existing image by using same object name; see minio policy for deletion schedule
        bool addNewObject = String.IsNullOrEmpty(objectName);
        if (addNewObject)
        {
            objectName = nameFactory.Invoke(entity);
            propertyInfo.SetValue(entity, objectName);
        }
        
        var uploadResult = await imageStorageService.UploadImageAsync(objectName, imageStream, length, c:c);
        if (uploadResult.IsFailed) return Result.Fail(uploadResult.Errors);

        if (addNewObject)
        {
            try
            {
                await db.SaveChangesAsync(c);
            }
            catch (Exception e)
            {
                // clean up failed upload
                await imageStorageService.DeleteImageAsync(objectName, c);
                throw;
            }
        }

        return Result.Ok(objectName);
    }
}