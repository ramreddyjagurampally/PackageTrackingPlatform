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

    public DbSet<Address> Addresses =>
        Set<Address>();

    protected override void OnModelCreating(
        ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.Entity<Shipment>()
            .HasIndex(shipment => shipment.TrackingNumber)
            .IsUnique();

        builder.Entity<Shipment>()
            .Property(shipment => shipment.WeightKg)
            .HasPrecision(18, 2);

        builder.Entity<Shipment>()
            .Property(shipment => shipment.LengthCm)
            .HasPrecision(18, 2);

        builder.Entity<Shipment>()
            .Property(shipment => shipment.WidthCm)
            .HasPrecision(18, 2);

        builder.Entity<Shipment>()
            .Property(shipment => shipment.HeightCm)
            .HasPrecision(18, 2);

        builder.Entity<Shipment>()
            .Property(shipment => shipment.ShippingCost)
            .HasPrecision(18, 2);

        // Tracking-history relationship.
        // Deleting a shipment also deletes its tracking events.
        builder.Entity<ShipmentTrackingEvent>()
            .HasOne(trackingEvent => trackingEvent.Shipment)
            .WithMany(shipment => shipment.TrackingHistory)
            .HasForeignKey(trackingEvent => trackingEvent.ShipmentId)
            .OnDelete(DeleteBehavior.Cascade);

        // Sender-address relationship.
        // Restrict prevents an address from being deleted while
        // it is connected to a shipment.
        builder.Entity<Shipment>()
            .HasOne(shipment => shipment.SenderAddress)
            .WithMany()
            .HasForeignKey(shipment => shipment.SenderAddressId)
            .OnDelete(DeleteBehavior.Restrict);

        // Recipient-address relationship.
        // Restrict prevents an address from being deleted while
        // it is connected to a shipment.
        builder.Entity<Shipment>()
            .HasOne(shipment => shipment.RecipientAddress)
            .WithMany()
            .HasForeignKey(shipment => shipment.RecipientAddressId)
            .OnDelete(DeleteBehavior.Restrict);

        // Driver relationship.
        // When a driver is deleted, the shipment remains and
        // AssignedDriverId becomes null.
        builder.Entity<Shipment>()
            .HasOne(shipment => shipment.AssignedDriver)
            .WithMany(driver => driver.AssignedShipments)
            .HasForeignKey(shipment => shipment.AssignedDriverId)
            .OnDelete(DeleteBehavior.SetNull);

        // Customer relationship.
        // NoAction prevents SQL Server multiple cascade paths.
        builder.Entity<Shipment>()
            .HasOne(shipment => shipment.Customer)
            .WithMany(customer => customer.CustomerShipments)
            .HasForeignKey(shipment => shipment.CustomerId)
            .OnDelete(DeleteBehavior.NoAction);
    }
}