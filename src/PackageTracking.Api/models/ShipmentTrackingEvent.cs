using System.Text.Json.Serialization;

namespace PackageTracking.Api.Models;

public sealed class ShipmentTrackingEvent
{
    public Guid Id { get; set; }

    public Guid ShipmentId { get; set; }

    public ShipmentStatus Status { get; set; }

    public string Location { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public DateTime OccurredAtUtc { get; set; } = DateTime.UtcNow;

    [JsonIgnore]
    public Shipment Shipment { get; set; } = null!;
}