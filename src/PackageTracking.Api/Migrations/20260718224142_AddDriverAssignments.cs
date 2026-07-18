using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PackageTracking.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddDriverAssignments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "AssignedDriverId",
                table: "Shipments",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Shipments_AssignedDriverId",
                table: "Shipments",
                column: "AssignedDriverId");

            migrationBuilder.AddForeignKey(
                name: "FK_Shipments_AspNetUsers_AssignedDriverId",
                table: "Shipments",
                column: "AssignedDriverId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Shipments_AspNetUsers_AssignedDriverId",
                table: "Shipments");

            migrationBuilder.DropIndex(
                name: "IX_Shipments_AssignedDriverId",
                table: "Shipments");

            migrationBuilder.DropColumn(
                name: "AssignedDriverId",
                table: "Shipments");
        }
    }
}
