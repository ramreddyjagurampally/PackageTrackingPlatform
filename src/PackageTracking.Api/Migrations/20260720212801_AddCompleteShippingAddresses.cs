using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PackageTracking.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddCompleteShippingAddresses : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "RecipientAddressId",
                table: "Shipments",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SenderAddressId",
                table: "Shipments",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Addresses",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ContactName = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    CompanyName = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    AddressLine1 = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    AddressLine2 = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    City = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    StateOrProvince = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    PostalCode = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    CountryCode = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: false),
                    PhoneNumber = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    Email = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    IsResidential = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Addresses", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Shipments_RecipientAddressId",
                table: "Shipments",
                column: "RecipientAddressId");

            migrationBuilder.CreateIndex(
                name: "IX_Shipments_SenderAddressId",
                table: "Shipments",
                column: "SenderAddressId");

            migrationBuilder.AddForeignKey(
                name: "FK_Shipments_Addresses_RecipientAddressId",
                table: "Shipments",
                column: "RecipientAddressId",
                principalTable: "Addresses",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Shipments_Addresses_SenderAddressId",
                table: "Shipments",
                column: "SenderAddressId",
                principalTable: "Addresses",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Shipments_Addresses_RecipientAddressId",
                table: "Shipments");

            migrationBuilder.DropForeignKey(
                name: "FK_Shipments_Addresses_SenderAddressId",
                table: "Shipments");

            migrationBuilder.DropTable(
                name: "Addresses");

            migrationBuilder.DropIndex(
                name: "IX_Shipments_RecipientAddressId",
                table: "Shipments");

            migrationBuilder.DropIndex(
                name: "IX_Shipments_SenderAddressId",
                table: "Shipments");

            migrationBuilder.DropColumn(
                name: "RecipientAddressId",
                table: "Shipments");

            migrationBuilder.DropColumn(
                name: "SenderAddressId",
                table: "Shipments");
        }
    }
}
