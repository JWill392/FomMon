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

namespace FomMon.Data.Contexts
{
    public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
    {
        public const string DbName = "application";
        public DbSet<Project> Projects => Set<Project>();
 
        public DbSet<PublicNotice> PublicNotices => Set<PublicNotice>();
        
        public DbSet<AreaWatch> AreaWatches => Set<AreaWatch>();
        public DbSet<AreaAlert> AreaWatchAlerts => Set<AreaAlert>();
        
        public DbSet<FeatureReference> FeatureReferences => Set<FeatureReference>();
        
        public DbSet<LayerType> LayerTypes => Set<LayerType>();
        
        public DbSet<User> Users => Set<User>();
        
        
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
            
            // **** Layer Type **** //
            builder.Entity<LayerType>() // seed with record for each kind
                .ToTable("layer_types", schema: LayerRegistry.Schema) // for direct layer downloads 
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

            return new AppDbContext(optionsBuilder.Options);
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

            return builder;
        }
    }
}
