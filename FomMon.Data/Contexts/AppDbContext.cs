using FomMon.Common.Configuration.Layer;
using FomMon.Data.Models;
using FomMon.Data.Shared;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Npgsql.EntityFrameworkCore.PostgreSQL.Infrastructure;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using Npgsql;

namespace FomMon.Data.Contexts
{
    public sealed class AppDbContext(DbContextOptions<AppDbContext> options, IOptions<AppDbConfig> config) : DbContext(options)
    {
        public const string DbName = "application";
        public DbSet<Project> Projects => Set<Project>();
 
        public DbSet<PublicNotice> PublicNotices => Set<PublicNotice>();
        
        public DbSet<AreaWatch> AreaWatches => Set<AreaWatch>();
        public DbSet<AreaAlert> AreaWatchAlerts => Set<AreaAlert>();
        
        public DbSet<FeatureReference> FeatureReferences => Set<FeatureReference>();
        
        public DbSet<LayerType> LayerTypes => Set<LayerType>();
        
        public DbSet<User> Users => Set<User>();
        
        public DbSet<Osm> Osm => Set<Osm>();
        
        
        protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
        {
            // Store all enums as strings by default
            configurationBuilder
                .Properties<Enum>()
                .HaveConversion<string>()
                .HaveMaxLength(32);

            configurationBuilder
                .Properties<LayerKind>()
                .HaveConversion<LayerKindConverter>();
        }
        private class LayerKindConverter() : ValueConverter<LayerKind, string>(
            v => v.Value,
            v => LayerKind.From(v));


        protected override void OnModelCreating(ModelBuilder builder)
        {
            builder.HasPostgresExtension("postgis");
            builder.HasPostgresExtension("citext");

            // Project to PublicNotice 1-1
            builder.Entity<Project>()
                .HasOne(p => p.PublicNotice)
                .WithOne(n => n.Project)
                .HasForeignKey<PublicNotice>(n => n.ProjectId)
                .IsRequired(false);
            
            // **** OSM **** //
            builder.Entity<Osm>()
                .ToTable("osm", schema: config.Value.OsmSchema);
            
            // **** Layer Type **** //
            builder.Entity<LayerType>() // seed with record for each kind
                .ToTable("layer_types", schema: config.Value.LayersSchema) // for direct layer downloads 
                .HasData(LayerRegistry.All
                        .Select(f => new LayerType() 
                {
                    Kind = f.Kind, 
                    LastDownloaded = null,
                }));
            
            // **** Area Watch **** //
            builder.Entity<AreaWatch>() // index intersection
                .HasIndex(f => f.Geometry)
                .HasMethod("GIST");

            builder.Entity<AreaWatch>()
                .PrimitiveCollection(f => f.Layers)
                .ElementType()
                .HasConversion<LayerKindConverter>();
                
                
            // **** FeatureReference **** //
            builder.Entity<FeatureReference>() // index intersection
                .HasIndex(f => f.Geometry)
                .HasMethod("GIST");
            
            // **** User **** //
            builder.Entity<User>()
                .HasIndex(u => u.Email)
                .IsUnique()
                .HasDatabaseName(User.Constraint.UniqueEmail); // used to disambiguate dup key exceptions
            
            // IVersioned
            foreach (var entityType in builder.Model.GetEntityTypes())
            {
                var clrType = entityType.ClrType;
                if (typeof(IVersioned).IsAssignableFrom(clrType))
                {
                    builder.Entity(clrType)
                        .Property(nameof(IVersioned.Version))
                        .IsRowVersion();
                }
            }
            
            PostgresReservedKeywordValidator.ValidateModel(builder);
        }

        internal static void SetNpgsqlOptions(NpgsqlDbContextOptionsBuilder opt)
        {
            opt.UseNetTopologySuite();
            opt.EnableRetryOnFailure();
            opt.UseNodaTime();
        }
        internal static void SetDbContextOptions(DbContextOptionsBuilder opt, bool isDevelopment)
        {
            opt.UseSnakeCaseNamingConvention();
            if (isDevelopment) opt.EnableSensitiveDataLogging();
        }
    }


    /// <summary>
    /// For design-time sql access, eg when creating migrations.
    /// command: dotnet ef migrations add InitialCreate --project ..\FomMon.Data\FomMon.Data.csproj
    /// </summary>
    public class AppDbContextDesignFactory : IDesignTimeDbContextFactory<AppDbContext>
    {
        public AppDbContext CreateDbContext(string[] args)
        {
            var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();
            optionsBuilder.UseNpgsql($"Host=postgres;Database={AppDbContext.DbName}", AppDbContext.SetNpgsqlOptions);
            AppDbContext.SetDbContextOptions(optionsBuilder, true);

            
            return new AppDbContext(optionsBuilder.Options, LoadConfig());
        }

        private IOptions<AppDbConfig> LoadConfig()
        {
            // Load configuration for design-time
            var configuration = new ConfigurationBuilder()
                .SetBasePath(Directory.GetCurrentDirectory())
                .AddJsonFile("appsettings.json", optional: true)
                .AddJsonFile("appsettings.Development.json", optional: true)
                .Build();

            var appDbConfig = configuration.GetSection("AppDbConfig").Get<AppDbConfig>() ?? 
                              throw new Exception("Missing required config section AppDbConfig");
            return Options.Create(appDbConfig);
        }
    }

    
    
    public static class DataServiceCollectionExtensions
    {
        public static IHostApplicationBuilder AddAppDbContext(
            this IHostApplicationBuilder builder)
        {
            // Try standard and env-var (Aspire) forms before failing.
            string? connectionString =
                builder.Configuration.GetConnectionString(AppDbContext.DbName) ??
                builder.Configuration.GetSection("ConnectionStrings").GetValue<string>(AppDbContext.DbName) ??
                throw new InvalidOperationException($"Connection string not found {AppDbContext.DbName}"); // development design-time override
            
            if (builder.Environment.IsDevelopment()) connectionString = $"{connectionString};Include Error Detail=true";

            builder.Services.AddNpgsql<AppDbContext>(
                connectionString,
                AppDbContext.SetNpgsqlOptions,
                o => AppDbContext.SetDbContextOptions(o, builder.Environment.IsDevelopment()));

            builder.Services.AddSingleton<IDatabaseConfiguration, AppDbDatabaseConfiguration>();
            
            builder.Services.Configure<AppDbConfig>(builder.Configuration.GetSection("AppDbConfig"));
            
            return builder;
        }
    }
    
    
    public interface IDatabaseConfiguration
    {
        string Host { get; }
        int Port { get; }
        string Database { get; }
        string Username { get; }
        string Password { get; }
    }
    public class AppDbDatabaseConfiguration(IConfiguration configuration) : IDatabaseConfiguration
    {
        private readonly NpgsqlConnectionStringBuilder _builder = new(configuration.GetConnectionString("application") ??
                                                                      throw new Exception("Connection string not found"));
    
        public string Host => _builder.Host ?? throw new InvalidOperationException();
        public int Port => _builder.Port;
        public string Database => _builder.Database ?? throw new InvalidOperationException();
        public string Username => _builder.Username ?? throw new InvalidOperationException();
        public string Password => _builder.Password ?? throw new InvalidOperationException();
    }
}
