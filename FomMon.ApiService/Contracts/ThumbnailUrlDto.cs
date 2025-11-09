using FomMon.Data.Models;

namespace FomMon.ApiService.Contracts;

public record ThumbnailUrlDto()
{
    public required string Name { get; init; }
    public required string Url { get; init; }
    public required string ParamHash { get; init; }
    public required ThumbnailTheme Theme { get; init; }
}