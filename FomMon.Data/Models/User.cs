using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace FomMon.Data.Models;

[Index(nameof(Issuer), nameof(Subject), IsUnique = true)]
public sealed class User : IVersioned
{
    [Key][DatabaseGenerated(DatabaseGeneratedOption.None)]
    public required Guid Id { get; set; }
    
    public uint Version { get; set; }
    
    [MaxLength(50)]
    public string DisplayName { get; set; } = string.Empty;
    
    [Column(TypeName = "citext")] // case-insensitive
    [EmailAddress]
    [MaxLength(255)]
    public required string Email { get; set; } // unique index in dbContext
    
    [MaxLength(50)]
    public string Issuer { get; set; } = string.Empty;
    
    [MaxLength(50)]
    public string Subject { get; set; } = string.Empty;

    [MaxLength(255)]
    public string ProfileImageObjectName { get; set; } = string.Empty;

    public override string ToString()
    {
        return $"User(Id={Id}, DisplayName={DisplayName}, Email={Email})";
    }

    public static class Constraint
    {
        public const string UniqueEmail = "ix_users_email";
    }
}

