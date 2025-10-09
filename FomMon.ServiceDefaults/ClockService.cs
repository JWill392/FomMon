using NodaTime;
using NodaTime.TimeZones;
using System.Diagnostics;

namespace FomMon.ServiceDefaults;

public interface IClockService
{
    DateTimeZone TimeZone { get; }

    Instant Now { get; }

    LocalDateTime LocalNow { get; }

    Instant? ToInstant(LocalDateTime? local);

    LocalDateTime? ToLocal(Instant? instant);
}


public class ClockService : IClockService // TODO allow setting date for testing
{
    private readonly IClock _clock;

    public DateTimeZone TimeZone { get; private set; }

    public ClockService()
        : this(SystemClock.Instance)
    {
    }

    public ClockService(IClock clock)
    {
        _clock = clock;

        // TODO: Get the current users timezone here instead of hard coding it...
        TimeZone = DateTimeZoneProviders.Tzdb.GetZoneOrNull("America/Vancouver") ?? throw new UnreachableException("Time zone not found");
    }

    public Instant Now
        => _clock.GetCurrentInstant();

    public LocalDateTime LocalNow
        => Now.InZone(TimeZone).LocalDateTime;

    public Instant? ToInstant(LocalDateTime? local)
        => local?.InZone(TimeZone, Resolvers.LenientResolver).ToInstant();

    public LocalDateTime? ToLocal(Instant? instant)
        => instant?.InZone(TimeZone).LocalDateTime;
}

