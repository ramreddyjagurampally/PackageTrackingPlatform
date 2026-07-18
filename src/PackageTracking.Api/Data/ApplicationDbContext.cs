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
    }
}