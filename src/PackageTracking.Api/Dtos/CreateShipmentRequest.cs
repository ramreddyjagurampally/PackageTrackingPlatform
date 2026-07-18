using System.ComponentModel.DataAnnotations;
using PackageTracking.Api.Models;

namespace PackageTracking.Api.Dtos;

public sealed class CreateShipmentRequest
{
    [Required]
    [MaxLength(150)]
    public string SenderName { get; set; } = string.Empty;

    [Required]
    [MaxLength(150)]
    public string RecipientName { get; set; } = string.Empty;

    [Required]
    [MaxLength(250)]
    public string Origin { get; set; } = string.Empty;

    [Required]
    [MaxLength(250)]
    public string Destination { get; set; } = string.Empty;

    [Range(0.01, 1000)]
    public decimal WeightKg { get; set; }

    [Range(0.1, 300)]
    public decimal LengthCm { get; set; }

    [Range(0.1, 300)]
    public decimal WidthCm { get; set; }

    [Range(0.1, 300)]
    public decimal HeightCm { get; set; }

    [Required]
    public ShipmentServiceLevel? ServiceLevel { get; set; }

    [MaxLength(500)]
    public string? DeliveryInstructions { get; set; }

    [MaxLength(100)]
    public string? CarrierSlug { get; set; }

    [MaxLength(150)]
    public string? CarrierTrackingNumber { get; set; }
}
