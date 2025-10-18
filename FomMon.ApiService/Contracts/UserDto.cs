using System.ComponentModel.DataAnnotations;

namespace FomMon.ApiService.Contracts;

public record UserDto
{
    public required Guid Id { get; init; }
    
    [MaxLength(50)]
    public string DisplayName { get; init; } = string.Empty;
    
    [EmailAddress]
    [MaxLength(255)]
    public required string Email { get; init; }

    [MaxLength(255)]
    public string ProfileImageObjectName { get; init; } = string.Empty;
}

public class UserIdentityDto
{
    public required Guid Id { get; init; }
}