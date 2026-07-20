using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Identity;

namespace PackageTracking.Api.Models;

public sealed class AppUser : IdentityUser<int>
{
    public string FullName { get; set; } = string.Empty;

    public DateTime CreatedAtUtc { get; set; } =
        DateTime.UtcNow;

    // Shipments assigned to this user as a driver.
    [JsonIgnore]
    public ICollection<Shipment> AssignedShipments { get; set; } =
        new List<Shipment>();

    // Shipments owned by this user as a customer.
    [JsonIgnore]
    public ICollection<Shipment> CustomerShipments { get; set; } =
        new List<Shipment>();
}