using FluentResults;
using FomMon.ApiService.Contracts;
using FomMon.Data.Contexts;
using FomMon.Data.Models;
using Hangfire;
using MapsterMapper;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Drawing;
using SixLabors.ImageSharp.Drawing.Processing;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;

namespace FomMon.ApiService.Services;

public class DuplicateEmailError : Error
{
    public DuplicateEmailError(string email) : base($"Duplicate email: {email}")
    {
        Metadata.Add("email", email);
    }
}
public class NotFoundError : Error;

public sealed class UserService(AppDbContext db, 
    IMapper mapper, 
    ILogger<UserService> logger,
    VersionedEntityObjectStorageService entityObjectStorageService)
{
    
    public async Task<Result<User>> CreateAsync(CreateUserRequest dto, CancellationToken c = default)
    {
        if (string.IsNullOrWhiteSpace(dto.Email))
            throw new ArgumentException("Email is required");
        ArgumentException.ThrowIfNullOrWhiteSpace(dto.Issuer);
        ArgumentException.ThrowIfNullOrWhiteSpace(dto.Subject);
        
        var user = mapper.Map<User>(dto);
        user.Id = Guid.CreateVersion7();
        user.Email = user.Email.ToLowerInvariant().Trim();
        
        await db.Users.AddAsync(user, c);
        
        try
        {
            await db.SaveChangesAsync(c);
        }
        catch (DbUpdateException ex) when 
        (ex.InnerException is PostgresException
        {
            SqlState: PostgresErrorCodes.UniqueViolation,
            ConstraintName: User.Constraint.UniqueEmail
        })
        {
            // read-verify to distinguish types (otherwise email constraint may mask subject, issuer)
            if (await db.Users.AnyAsync(u => u.Email == user.Email && 
                                        !(u.Issuer == user.Issuer && u.Subject == user.Subject), c))
                return Result.Fail(new DuplicateEmailError(dto.Email));
            
            throw;
        }
        
        // generate identicon in a background job if no profile image
        // TODO move to user-add event
        BackgroundJob.Enqueue(() => SetProfileImageIdenticonAsync(user.Id, c));
        
        return Result.Ok(user);
    }
    

    public async Task<Result<User>> GetAsync(Guid id, CancellationToken c = default)
    {
        var user = await db.Users.FindAsync([id], c);
        if (user is null) return Result.Fail(new NotFoundError());
        
        return Result.Ok(user);
    }


    /// <summary>
    /// Upsert by issuer and subject.
    /// </summary>
    public async Task<Result<User>> UpsertAsync(CreateUserRequest dto, CancellationToken c = default)
    {
        ArgumentNullException.ThrowIfNull(dto);
        ArgumentException.ThrowIfNullOrWhiteSpace(dto.Issuer);
        ArgumentException.ThrowIfNullOrWhiteSpace(dto.Subject);
        
        dto = dto with
        {
            Email = dto.Email?.ToLowerInvariant().Trim(), 
            Issuer = dto.Issuer.ToLowerInvariant().Trim(),
            Subject = dto.Subject.Trim()
        };

        var user = await db.Users
            .FirstOrDefaultAsync(u => u.Issuer == dto.Issuer && u.Subject == dto.Subject, c);
        

        return user switch
        {
            null => await CreateAsync(dto, c),
            _ => await UpdateAsync(user.Id, dto, c),
        };
    }

    public async Task<Result<User>> UpdateAsync(Guid id, CreateUserRequest dto, CancellationToken c = default)
    {
        ArgumentNullException.ThrowIfNull(dto);
        ArgumentException.ThrowIfNullOrWhiteSpace(dto.Issuer);
        ArgumentException.ThrowIfNullOrWhiteSpace(dto.Subject);
        
        
        var user = await db.Users.FindAsync([id], c);
        if (user is null) return Result.Fail(new NotFoundError());

        user.DisplayName = dto.DisplayName;
        if(dto.Email is not null) user.Email = dto.Email.ToLowerInvariant().Trim();
        
        if (db.Entry(user).State != EntityState.Unchanged)
        {
            logger.LogInformation($"Updating user {user.Id} with email {user.Email} state: {db.Entry(user)} user is tracked: {
                ReferenceEquals(user, db.ChangeTracker.Entries<User>().FirstOrDefault(u => u.Entity.Id == user.Id)?.Entity)}");    
        }
        try
        {
            await db.SaveChangesAsync(c);
        }
        catch (DbUpdateException ex) when 
            (ex.InnerException is PostgresException
             {
                 SqlState: PostgresErrorCodes.UniqueViolation,
                 ConstraintName: User.Constraint.UniqueEmail
             })
        {
            return Result.Fail(new DuplicateEmailError(dto.Email ?? ""));
        }

        return Result.Ok(user);
    }

    
    public async Task<Result<string>> UploadProfileImage(Guid id, IFormFile file, CancellationToken c = default)
    {
        await using var imageStream = file.OpenReadStream();
        return await UploadProfileImage(id, imageStream, file.Length, c);   
    }
    public async Task<Result<string>> UploadProfileImage(Guid id, Stream imageStream, long length, CancellationToken c = default)
    {
        var user = await db.Users.FindAsync([id], c);
        if (user is null) return Result.Fail(new NotFoundError());
            
        return await entityObjectStorageService.UploadImageAsync(user, 
            u => u.ProfileImageObjectName, 
            u => $"{u.Id}.{DateTime.UtcNow.Ticks}", 
            imageStream, length, c);
    }


    // ReSharper disable once MemberCanBePrivate.Global
    public async Task<Result<string>> SetProfileImageIdenticonAsync(Guid id, CancellationToken c = default)
    {
        var user = await db.Users.FindAsync([id], c);
        if (user is null) return Result.Fail(new NotFoundError());
        
        var (identicon, genError) = await GenerateIdenticonAsync(id, c);
        if (genError is not null) return Result.Fail(genError);
        
        using var imageStream = new MemoryStream();
        await identicon.SaveAsWebpAsync(imageStream, c);
        imageStream.Position = 0;
        
        var (objectName, uploadError) = await UploadProfileImage(id, imageStream, imageStream.Length, c);
        if (uploadError is not null) return Result.Fail(uploadError);

        user.ProfileImageObjectName = objectName;
        await db.SaveChangesAsync(c);
        return Result.Ok(objectName);
    }
    
    private const int ProfileWidth = 400;
    private const int ProfileHeight = 400;
    /// <summary>
    /// Generate a simple unique profile image based on the name hash.
    /// https://github.blog/news-insights/company-news/identicons/
    /// </summary>
    public async Task<Result<Image<Rgba32>>> GenerateIdenticonAsync(Guid id, CancellationToken c = default)
    {
        var user = await db.Users.FindAsync([id], c);
        if (user is null) return Result.Fail(new NotFoundError());
        
        string[] colors = [
            "#084b83", "#42bfdd", "#bbe6e4", "#f0f6f6", "#ff66b3",
            "#f79256", "#fbd1a2", "#7dcfb6", "#00b2ca", "#1d4e89"
        ];
        
        const int padding = 80;

        const int blockCountX = 5;
        const int blockCountY = 5;
        
        const int blockWidth = (ProfileWidth - padding * 2) / blockCountX;
        const int blockHeight = (ProfileHeight - padding * 2) / blockCountY;


        var hash = GetStableHash(user.Email);

        var blocks = new bool[blockCountY, blockCountX];
        int i = 0;
        for (int y = 0; y < blockCountY; y++)
        {
            for (int x = 0; x < Math.Ceiling(blockCountX / 2.0); x++)
            {
                bool set = (hash & (1 << i)) != 0;
                
                blocks[y, x] = set;
                blocks[y, blocks.GetLength(0) - x - 1] = set; // mirror horizontally
                i++;
            }
        }

        var img = new Image<Rgba32>(ProfileWidth, ProfileHeight, backgroundColor: Color.ParseHex("#ffffff00"));
        var color = Color.ParseHex(colors[Math.Abs(hash % colors.Length)]);
        
        for (int y = 0; y < blockCountY; y++)
        {
            for (int x = 0; x < blockCountX; x++)
            {
                if (!blocks[y, x]) continue;
                var blockX = padding + x * blockWidth;
                var blockY = padding + y * blockHeight;
                img.Mutate(ctx => ctx.Fill(color, new RectangularPolygon(blockX, blockY, blockWidth, blockHeight)));
            }
        }

        return Result.Ok(img);
    }

    
    private static int GetStableHash(string str)
    {
        unchecked
        {
            int hash1 = 5381;
            int hash2 = hash1;

            for(int i = 0; i < str.Length && str[i] != '\0'; i += 2)
            {
                hash1 = ((hash1 << 5) + hash1) ^ str[i];
                if (i == str.Length - 1 || str[i+1] == '\0')
                    break;
                hash2 = ((hash2 << 5) + hash2) ^ str[i+1];
            }

            return hash1 + (hash2*1566083941);
        }
    }
}