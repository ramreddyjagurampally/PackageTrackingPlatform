namespace PackageTracking.Api.Models;

public sealed class Shipment
{
    public Guid Id { get; init; } = Guid.NewGuid();

    public string TrackingNumber { get; init; } = string.Empty;

    public string SenderName { get; set; } = string.Empty;

    public string RecipientName { get; set; } = string.Empty;

    public string Origin { get; set; } = string.Empty;

    public string Destination { get; set; } = string.Empty;

    public ShipmentStatus CurrentStatus { get; set; } =
        ShipmentStatus.Created;

    public DateTime CreatedAtUtc { get; init; } = DateTime.UtcNow;
}
