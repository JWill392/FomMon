using System;
using System.Text.Json;
using Microsoft.EntityFrameworkCore.Migrations;
using NetTopologySuite.Geometries;
using NodaTime;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace FomMon.Data.Migrations
{
    /// <inheritdoc />
    public partial class create : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "layers");

            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:PostgresExtension:citext", ",,")
                .Annotation("Npgsql:PostgresExtension:postgis", ",,");

            migrationBuilder.CreateTable(
                name: "feature_references",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    layer_kind = table.Column<string>(type: "text", nullable: false),
                    source_feature_id = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    first_seen_at = table.Column<Instant>(type: "timestamp with time zone", nullable: false),
                    last_seen_at = table.Column<Instant>(type: "timestamp with time zone", nullable: false),
                    deleted_at = table.Column<Instant>(type: "timestamp with time zone", nullable: true),
                    is_deleted = table.Column<bool>(type: "boolean", nullable: false),
                    geometry = table.Column<Geometry>(type: "geometry", nullable: false),
                    attributes_snapshot = table.Column<JsonDocument>(type: "jsonb", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_feature_references", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "layer_types",
                schema: "layers",
                columns: table => new
                {
                    kind = table.Column<string>(type: "text", nullable: false),
                    last_downloaded = table.Column<Instant>(type: "timestamp with time zone", nullable: true),
                    feature_count = table.Column<long>(type: "bigint", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_layer_types", x => x.kind);
                });

            migrationBuilder.CreateTable(
                name: "projects",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    name = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    geometry = table.Column<Point>(type: "geometry", nullable: false),
                    state = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    created = table.Column<Instant>(type: "timestamp with time zone", nullable: false),
                    features_refreshed = table.Column<Instant>(type: "timestamp with time zone", nullable: true),
                    closed = table.Column<Instant>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_projects", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "users",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    display_name = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    email = table.Column<string>(type: "citext", maxLength: 255, nullable: true),
                    issuer = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    subject = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_users", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "public_notices",
                columns: table => new
                {
                    project_id = table.Column<long>(type: "bigint", nullable: false),
                    post_date = table.Column<LocalDate>(type: "date", nullable: false),
                    company_id = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    company_name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    description = table.Column<string>(type: "character varying(1024)", maxLength: 1024, nullable: false),
                    operation_start_year = table.Column<int>(type: "integer", nullable: false),
                    operation_end_year = table.Column<int>(type: "integer", nullable: false),
                    refreshed = table.Column<Instant>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_public_notices", x => x.project_id);
                    table.ForeignKey(
                        name: "fk_public_notices_projects_project_id",
                        column: x => x.project_id,
                        principalTable: "projects",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "area_watches",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    geometry = table.Column<Geometry>(type: "geometry", nullable: false),
                    added_date = table.Column<Instant>(type: "timestamp with time zone", nullable: false),
                    evaluated_date = table.Column<Instant>(type: "timestamp with time zone", nullable: false),
                    layers = table.Column<string[]>(type: "text[]", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_area_watches", x => x.id);
                    table.ForeignKey(
                        name: "fk_area_watches_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "area_watch_alerts",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    area_watch_id = table.Column<Guid>(type: "uuid", nullable: false),
                    feature_id = table.Column<int>(type: "integer", nullable: false),
                    layer_kind = table.Column<string>(type: "text", nullable: false),
                    triggered_at = table.Column<Instant>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_area_watch_alerts", x => x.id);
                    table.ForeignKey(
                        name: "fk_area_watch_alerts_area_watches_area_watch_id",
                        column: x => x.area_watch_id,
                        principalTable: "area_watches",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_area_watch_alerts_feature_references_feature_id",
                        column: x => x.feature_id,
                        principalTable: "feature_references",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                schema: "layers",
                table: "layer_types",
                columns: new[] { "kind", "feature_count", "last_downloaded" },
                values: new object[,]
                {
                    { "FomCutblock", null, null },
                    { "FomRetention", null, null },
                    { "FomRoad", null, null }
                });

            migrationBuilder.CreateIndex(
                name: "ix_area_watch_alerts_area_watch_id",
                table: "area_watch_alerts",
                column: "area_watch_id");

            migrationBuilder.CreateIndex(
                name: "ix_area_watch_alerts_feature_id",
                table: "area_watch_alerts",
                column: "feature_id");

            migrationBuilder.CreateIndex(
                name: "ix_area_watches_geometry",
                table: "area_watches",
                column: "geometry")
                .Annotation("Npgsql:IndexMethod", "GIST");

            migrationBuilder.CreateIndex(
                name: "ix_area_watches_user_id",
                table: "area_watches",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "ix_feature_references_geometry",
                table: "feature_references",
                column: "geometry")
                .Annotation("Npgsql:IndexMethod", "GIST");

            migrationBuilder.CreateIndex(
                name: "ix_users_email",
                table: "users",
                column: "email",
                unique: true,
                filter: "\"email\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_users_issuer_subject",
                table: "users",
                columns: new[] { "issuer", "subject" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "area_watch_alerts");

            migrationBuilder.DropTable(
                name: "layer_types",
                schema: "layers");

            migrationBuilder.DropTable(
                name: "public_notices");

            migrationBuilder.DropTable(
                name: "area_watches");

            migrationBuilder.DropTable(
                name: "feature_references");

            migrationBuilder.DropTable(
                name: "projects");

            migrationBuilder.DropTable(
                name: "users");
        }
    }
}
