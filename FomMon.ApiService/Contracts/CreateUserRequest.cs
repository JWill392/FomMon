using System.ComponentModel.DataAnnotations;

namespace FomMon.ApiService.Contracts;

public record CreateUserRequest
{
    [MaxLength(50)]
    public string DisplayName { get; init; } = string.Empty;
    
    [Required]
    [EmailAddress]
    [MaxLength(255)]
    public required string? Email { get; init; }
    
    [Required]
    [MaxLength(50)]
    public string Issuer { get; set; } = string.Empty;
    
    [Required]
    [MaxLength(50)]
    public string Subject { get; set; } = string.Empty;

}