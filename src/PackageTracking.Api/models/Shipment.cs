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

    // Package information
    public decimal WeightKg { get; set; }

    public decimal LengthCm { get; set; }

    public decimal WidthCm { get; set; }

    public decimal HeightCm { get; set; }

    public ShipmentServiceLevel ServiceLevel { get; set; } =
        ShipmentServiceLevel.Standard;

    public DateTime? EstimatedDeliveryDateUtc { get; set; }

    public decimal ShippingCost { get; set; }

    public string DeliveryInstructions { get; set; } = string.Empty;

    // External carrier information
    public string? CarrierSlug { get; set; }

    public string? CarrierTrackingNumber { get; set; }

    public bool UsesCarrierTracking { get; set; }

    public ICollection<ShipmentTrackingEvent> TrackingHistory { get; set; } =
        new List<ShipmentTrackingEvent>();
}
