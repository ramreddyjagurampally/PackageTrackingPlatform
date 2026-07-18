using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PackageTracking.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddPackageDetails : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "TrackingNumber",
                table: "Shipments",
                type: "nvarchar(450)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AddColumn<string>(
                name: "DeliveryInstructions",
                table: "Shipments",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "EstimatedDeliveryDateUtc",
                table: "Shipments",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "HeightCm",
                table: "Shipments",
                type: "decimal(10,2)",
                precision: 10,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "LengthCm",
                table: "Shipments",
                type: "decimal(10,2)",
                precision: 10,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<int>(
                name: "ServiceLevel",
                table: "Shipments",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<decimal>(
                name: "ShippingCost",
                table: "Shipments",
                type: "decimal(10,2)",
                precision: 10,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "WeightKg",
                table: "Shipments",
                type: "decimal(10,2)",
                precision: 10,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "WidthCm",
                table: "Shipments",
                type: "decimal(10,2)",
                precision: 10,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.CreateIndex(
                name: "IX_Shipments_TrackingNumber",
                table: "Shipments",
                column: "TrackingNumber",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Shipments_TrackingNumber",
                table: "Shipments");

            migrationBuilder.DropColumn(
                name: "DeliveryInstructions",
                table: "Shipments");

            migrationBuilder.DropColumn(
                name: "EstimatedDeliveryDateUtc",
                table: "Shipments");

            migrationBuilder.DropColumn(
                name: "HeightCm",
                table: "Shipments");

            migrationBuilder.DropColumn(
                name: "LengthCm",
                table: "Shipments");

            migrationBuilder.DropColumn(
                name: "ServiceLevel",
                table: "Shipments");

            migrationBuilder.DropColumn(
                name: "ShippingCost",
                table: "Shipments");

            migrationBuilder.DropColumn(
                name: "WeightKg",
                table: "Shipments");

            migrationBuilder.DropColumn(
                name: "WidthCm",
                table: "Shipments");

            migrationBuilder.AlterColumn<string>(
                name: "TrackingNumber",
                table: "Shipments",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(450)");
        }
    }
}
