using System.ComponentModel.DataAnnotations;
using NodaTime;

namespace FomMon.ApiService.Contracts;

public record PublicNoticeDto
{
    public required long ProjectId { get; init; }
    /// <summary>
    /// Date public notice posted
    /// </summary>
    public required LocalDate PostDate { get; init; }
    [MaxLength(32)]
    public required string CompanyId { get; init; }
    [MaxLength(255)]
    public required string CompanyName { get; init; }

    [MaxLength(1024)]
    public required string Description { get; init; }
    public required int OperationStartYear { get; init; }
    public required int OperationEndYear { get; init; }

}