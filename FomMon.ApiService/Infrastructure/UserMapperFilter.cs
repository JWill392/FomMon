using System.Security.Claims;
using FluentResults;
using FomMon.ApiService.Contracts;
using FomMon.ApiService.Services;
using FomMon.Data.Contexts;
using FomMon.Data.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;

namespace FomMon.ApiService.Infrastructure;

// Helper to read the internal UserId later
/// <summary>
/// Provides access to the current user's authentication status and ID.
/// </summary>
public interface ICurrentUser
{
    /// <summary>
    /// Gets whether the current user is authenticated.
    /// </summary>
    bool IsAuthenticated { get; }

    /// <summary>
    /// Gets the internal user ID if available.
    /// </summary>
    Guid? Id { get; }
}

/// <summary>
/// Implementation of ICurrentUser that retrieves user information from HttpContext.
/// </summary>
/// <param name="accessor">The HTTP context accessor.</param>
public sealed class HttpContextCurrentUser(IHttpContextAccessor accessor) : ICurrentUser
{
    /// <inheritdoc />
    public bool IsAuthenticated { get; } = accessor.HttpContext?.User?.Identity?.IsAuthenticated == true;

    /// <inheritdoc />
    public Guid? Id =>
        accessor.HttpContext?.Items.TryGetValue(CurrentUserHttpContextAccessor.ItemKey, out var val) == true
        && val is Guid g
            ? g
            : null;
}

internal static class CurrentUserHttpContextAccessor
{
    public const string ItemKey = "__app_user_id";
}



/// <summary>
/// Action filter that maps external authentication claims to internal user records.
/// </summary>
/// <param name="userService">The user service for managing user records.</param>
public sealed class UserMapperFilter(UserService userService, AppDbContext db) : IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        var principal = context.HttpContext.User;
        if (principal.Identity?.IsAuthenticated == true)
        {
            // Extract claims from Keycloak token
            var iss = principal.FindFirst("iss")?.Value;           // issuer (realm URL)
            var sub = principal.FindFirst(ClaimTypes.NameIdentifier)?.Value
                      ?? principal.FindFirst("sub")?.Value;        // subject (Keycloak user id)
            var email = principal.FindFirst(ClaimTypes.Email)?.Value
                        ?? principal.FindFirst("email")?.Value;
            var emailVerified = principal.FindFirst("email_verified")?.Value
                .Equals("true", StringComparison.OrdinalIgnoreCase) ?? false;
            var name = principal.FindFirst(ClaimTypes.Name)?.Value
                       ?? principal.FindFirst("preferred_username")?.Value
                       ?? principal.FindFirst("username")?.Value
                       ?? email ?? sub ?? string.Empty;

            if (string.IsNullOrWhiteSpace(iss) || string.IsNullOrWhiteSpace(sub))
            {
                return;
            }

            // TODO still gets duplicate calls if SPA messes up call order.  should just move into single user setup call.
            Result<User> result = Result.Fail("Upsert not executed");
            await db.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
            {
                await using var transaction = await db.Database.BeginTransactionAsync();
                
                result = await userService.UpsertAsync(new CreateUserRequest()
                {
                    Issuer = iss,
                    Subject = sub,
                    Email = emailVerified ? email : null,
                    DisplayName = name
                }, context.HttpContext.RequestAborted);
                if (!result.IsFailed)
                {
                    await transaction.CommitAsync();
                }
            });
            

            if (result.IsFailed)
            {
                if (result.HasError<DuplicateEmailError>())
                {
                    // Return 409 Conflict with ProblemDetails

                    context.Result = new ObjectResult(new ProblemDetails
                    {
                        Status = StatusCodes.Status409Conflict,
                        Title = "Email already in use",
                        Detail = "The provided email is already associated with another account.",
                        Instance = context.HttpContext.Request.Path,
                        Extensions =
                        {
                            ["conflictingEmail"] = email
                        }
                    })
                    {
                        StatusCode = StatusCodes.Status409Conflict
                    };
                    return;
                }
                
                throw new Exception(result.Errors[0].Message);
            }
            
            
            // Stash internal UserId for downstream use
            context.HttpContext.Items[CurrentUserHttpContextAccessor.ItemKey] = result.Value.Id;
        }

        await next();
    }
}

/// <summary>
/// Attribute that applies the UserMapperFilter to a controller or action method.
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public sealed class UserMapperAttribute() : TypeFilterAttribute(typeof(UserMapperFilter))
{
}

/// <summary>
/// Returns 401 if the authenticated principal could not be mapped to an app user.
/// </summary>
public sealed class RequireUserIdFilter(ICurrentUser currentUser) : IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        // respect [AllowAnonymous]
        var endpoint = context.HttpContext.GetEndpoint();
        if (endpoint?.Metadata.GetMetadata<IAllowAnonymous>() is not null)
        {
            await next();
            return;
        }

        if (currentUser.Id is null)
        {
            context.Result = new UnauthorizedResult();
            return;       
        }

        await next();
    }
}

[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public sealed class RequireUserIdAttribute() : TypeFilterAttribute(typeof(RequireUserIdFilter))
{
}