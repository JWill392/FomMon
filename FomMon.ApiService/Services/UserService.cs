using FluentResults;
using FomMon.ApiService.Contracts;
using FomMon.Data.Contexts;
using FomMon.Data.Models;
using MapsterMapper;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace FomMon.ApiService.Services;

public class DuplicateEmailError : Error
{
    public DuplicateEmailError(string email) : base($"Duplicate email: {email}")
    {
        Metadata.Add("email", email);
    }
}
public class NotFoundError : Error;
public interface IUserService
{
    Task<Result<User>> CreateAsync(CreateUserRequest dto, CancellationToken c = default);
    Task<Result<User>> GetAsync(Guid id, CancellationToken c = default);
    Task<Result<User>> UpsertAsync(CreateUserRequest dto, CancellationToken c = default);
    
    Task<Result<User>> UpdateAsync(CreateUserRequest dto, CancellationToken c = default);
}

public sealed class UserService(AppDbContext db, 
    IMapper mapper, 
    ILogger<UserService> logger) : IUserService
{
    
    public async Task<Result<User>> CreateAsync(CreateUserRequest dto, CancellationToken c = default)
    {
        if (string.IsNullOrWhiteSpace(dto.Email))
            throw new ArgumentException("Email is required");
        ArgumentException.ThrowIfNullOrWhiteSpace(dto.Issuer);
        ArgumentException.ThrowIfNullOrWhiteSpace(dto.Subject);
        
        var user = mapper.Map<User>(dto);
        user.Id = Guid.CreateVersion7();
        user.Email = user.Email?.ToLowerInvariant().Trim();
        
        
        
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
            else
                throw;
        }
        
        return Result.Ok(user);
    }

    public async Task<Result<User>> GetAsync(Guid id, CancellationToken c = default)
    {
        var user = await db.Users.FindAsync([id], c);
        if (user is null)
            return Result.Fail(new NotFoundError());
        
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
            _ => await UpdateAsync(dto, c),
        };
    }

    public async Task<Result<User>> UpdateAsync(CreateUserRequest dto, CancellationToken c = default)
    {
        ArgumentNullException.ThrowIfNull(dto);
        ArgumentException.ThrowIfNullOrWhiteSpace(dto.Issuer);
        ArgumentException.ThrowIfNullOrWhiteSpace(dto.Subject);
        
        dto = dto with { Email = dto.Email?.ToLowerInvariant().Trim() };
        
        var user = await db.Users
            .FirstOrDefaultAsync(u => u.Issuer == dto.Issuer && u.Subject == dto.Subject, c);
        
        if (user is null) return Result.Fail(new NotFoundError());
        
        mapper.Map(dto, user); // patch fields
        //user.Email = dto.Email;
        //user.DisplayName = dto.DisplayName;
        logger.LogInformation($"Updating user {user.Id} with email {user.Email} state: {db.Entry(user)} user is tracked: {
            ReferenceEquals(user, db.ChangeTracker.Entries<User>().FirstOrDefault(u => u.Entity.Id == user.Id)?.Entity)}");
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
}