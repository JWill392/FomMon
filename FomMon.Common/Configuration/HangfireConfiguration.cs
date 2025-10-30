using Hangfire;
using Hangfire.Redis.StackExchange;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;

namespace FomMon.Common.Configuration;

public static class HangfireExtensions
{
    public static IHostApplicationBuilder AddHangfireRedis(this IHostApplicationBuilder builder, string redis, string prefix, Action<IGlobalConfiguration>? configure = null)
    {
        builder.Services.AddHangfire(c =>
            {
                c
                    .SetDataCompatibilityLevel(CompatibilityLevel.Version_180)
                    .UseSimpleAssemblyNameTypeSerializer()
                    .UseRecommendedSerializerSettings()
                    .UseRedisStorage(builder.Configuration.GetConnectionString(redis),
                        new RedisStorageOptions()
                        {
                            Prefix = prefix,
                        })
                    .WithJobExpirationTimeout(TimeSpan.FromDays(7));

                configure?.Invoke(c);
            }
        );
        builder.Services.AddHangfireServer();
        return builder;
    }
}