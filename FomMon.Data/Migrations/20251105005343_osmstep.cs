using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FomMon.Data.Migrations
{
    /// <inheritdoc />
    public partial class osmstep : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "setup_state",
                schema: "osm",
                table: "osm",
                newName: "setup_step");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "setup_step",
                schema: "osm",
                table: "osm",
                newName: "setup_state");
        }
    }
}
