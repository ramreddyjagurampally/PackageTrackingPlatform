using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PackageTracking.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCarrierTrackingFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CarrierSlug",
                table: "Shipments",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CarrierTrackingNumber",
                table: "Shipments",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "UsesCarrierTracking",
                table: "Shipments",
                type: "bit",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CarrierSlug",
                table: "Shipments");

            migrationBuilder.DropColumn(
                name: "CarrierTrackingNumber",
                table: "Shipments");

            migrationBuilder.DropColumn(
                name: "UsesCarrierTracking",
                table: "Shipments");
        }
    }
}
