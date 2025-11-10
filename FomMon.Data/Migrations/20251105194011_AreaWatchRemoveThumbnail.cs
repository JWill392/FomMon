using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FomMon.Data.Migrations
{
    /// <inheritdoc />
    public partial class AreaWatchRemoveThumbnail : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "thumbnail_image_object_name",
                table: "area_watches");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "thumbnail_image_object_name",
                table: "area_watches",
                type: "character varying(255)",
                maxLength: 255,
                nullable: false,
                defaultValue: "");
        }
    }
}
