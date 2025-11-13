using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FomMon.Data.Migrations
{
    /// <inheritdoc />
    public partial class FeatureReferenceAttributesRename : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "attributes_snapshot",
                table: "feature_references",
                newName: "properties");

            migrationBuilder.AlterColumn<int>(
                name: "source_feature_id",
                table: "feature_references",
                type: "integer",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(100)",
                oldMaxLength: 100);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "properties",
                table: "feature_references",
                newName: "attributes_snapshot");

            migrationBuilder.AlterColumn<string>(
                name: "source_feature_id",
                table: "feature_references",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer");
        }
    }
}
