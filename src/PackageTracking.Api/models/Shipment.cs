using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace PackageTracking.Api.Models;

public sealed class Shipment
{
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required]
    [MaxLength(30)]
    public string TrackingNumber { get; set; } = string.Empty;

    [Required]
    [MaxLength(150)]
    public string SenderName { get; set; } = string.Empty;

    [Required]
    [MaxLength(150)]
    public string RecipientName { get; set; } = string.Empty;

    // Existing summary fields are temporarily retained so that
    // current shipments and frontend pages continue to work.
    [Required]
    [MaxLength(200)]
    public string Origin { get; set; } = string.Empty;

    [Required]
    [MaxLength(200)]
    public string Destination { get; set; } = string.Empty;

    // Complete sender address.
    // Nullable during the migration so existing shipments do not break.
    public int? SenderAddressId { get; set; }

    [JsonIgnore]
    public Address? SenderAddress { get; set; }

    // Complete recipient address.
    // Nullable during the migration so existing shipments do not break.
    public int? RecipientAddressId { get; set; }

    [JsonIgnore]
    public Address? RecipientAddress { get; set; }

    public ShipmentStatus CurrentStatus { get; set; } =
        ShipmentStatus.Created;

    public DateTime CreatedAtUtc { get; set; } =
        DateTime.UtcNow;

    public decimal WeightKg { get; set; }

    public decimal LengthCm { get; set; }

    public decimal WidthCm { get; set; }

    public decimal HeightCm { get; set; }

    public ShipmentServiceLevel ServiceLevel { get; set; } =
        ShipmentServiceLevel.Standard;

    public DateTime? EstimatedDeliveryDateUtc { get; set; }

    public decimal ShippingCost { get; set; }

    [MaxLength(500)]
    public string DeliveryInstructions { get; set; } =
        string.Empty;

    [MaxLength(100)]
    public string? CarrierSlug { get; set; }

    [MaxLength(100)]
    public string? CarrierTrackingNumber { get; set; }

    public bool UsesCarrierTracking { get; set; }

    // Driver assigned to deliver this shipment.
    public int? AssignedDriverId { get; set; }

    [JsonIgnore]
    public AppUser? AssignedDriver { get; set; }

    [NotMapped]
    public string? AssignedDriverName { get; set; }

    // Customer who owns this shipment.
    public int? CustomerId { get; set; }

    [JsonIgnore]
    public AppUser? Customer { get; set; }

    [NotMapped]
    public string? CustomerName { get; set; }

    [NotMapped]
    public string? CustomerEmail { get; set; }

    public ICollection<ShipmentTrackingEvent> TrackingHistory { get; set; } =
        new List<ShipmentTrackingEvent>();
}