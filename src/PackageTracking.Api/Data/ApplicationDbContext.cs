using Microsoft.EntityFrameworkCore;
using PackageTracking.Api.Models;

namespace PackageTracking.Api.Data;

public sealed class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(
        DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    public DbSet<Shipment> Shipments => Set<Shipment>();
}