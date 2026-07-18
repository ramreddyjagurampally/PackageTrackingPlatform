using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using PackageTracking.Api.Models;

namespace PackageTracking.Api.Data;

public sealed class ApplicationDbContext
    : IdentityDbContext<AppUser, IdentityRole<int>, int>
{
    public ApplicationDbContext(
        DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    public DbSet<Shipment> Shipments =>
        Set<Shipment>();

    public DbSet<ShipmentTrackingEvent> ShipmentTrackingEvents =>
        Set<ShipmentTrackingEvent>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.Entity<AppUser>()
            .Property(user => user.FullName)
            .HasMaxLength(150)
            .IsRequired();

        builder.Entity<Shipment>()
            .HasIndex(shipment => shipment.TrackingNumber)
            .IsUnique();

        builder.Entity<Shipment>()
            .Property(shipment => shipment.WeightKg)
            .HasPrecision(10, 2);

        builder.Entity<Shipment>()
            .Property(shipment => shipment.LengthCm)
            .HasPrecision(10, 2);

        builder.Entity<Shipment>()
            .Property(shipment => shipment.WidthCm)
            .HasPrecision(10, 2);

        builder.Entity<Shipment>()
            .Property(shipment => shipment.HeightCm)
            .HasPrecision(10, 2);

        builder.Entity<Shipment>()
            .Property(shipment => shipment.ShippingCost)
            .HasPrecision(10, 2);

        builder.Entity<Shipment>()
            .Property(shipment => shipment.DeliveryInstructions)
            .HasMaxLength(500);

        builder.Entity<Shipment>()
            .HasOne(shipment => shipment.AssignedDriver)
            .WithMany(driver => driver.AssignedShipments)
            .HasForeignKey(shipment => shipment.AssignedDriverId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}