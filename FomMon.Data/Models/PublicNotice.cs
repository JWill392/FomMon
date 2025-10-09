using System.ComponentModel.DataAnnotations;
using NodaTime;

namespace FomMon.Data.Models;

// TODO merge into Project type
public sealed class PublicNotice
{
    [Key]
    public required long ProjectId { get; set; } // PK and FK to Project

    public required LocalDate PostDate { get; set; }
    [MaxLength(32)]
    public required string CompanyId { get; set; }
    [MaxLength(255)]
    public required string CompanyName { get; set; }
    [MaxLength(1024)]
    public required string Description { get; set; }
    public int OperationStartYear { get; set; }
    public int OperationEndYear { get; set; }
    public Instant Refreshed { get; set; }

    public Project Project { get; set; } = null!;
}