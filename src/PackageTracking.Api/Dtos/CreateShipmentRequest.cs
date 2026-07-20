using System.ComponentModel.DataAnnotations;
using PackageTracking.Api.Models;

namespace PackageTracking.Api.Dtos;

public sealed class CreateShipmentRequest
{
    // Existing fields are retained temporarily so the current
    // frontend and existing shipment workflow continue working.

    [Required]
    [MaxLength(150)]
    public string SenderName { get; set; } = string.Empty;

    [Required]
    [MaxLength(150)]
    public string RecipientName { get; set; } = string.Empty;

    [Required]
    [EmailAddress]
    [MaxLength(256)]
    public string CustomerEmail { get; set; } = string.Empty;

    [Required]
    [MaxLength(250)]
    public string Origin { get; set; } = string.Empty;

    [Required]
    [MaxLength(250)]
    public string Destination { get; set; } = string.Empty;

    // Complete sender and recipient addresses.
    // These remain optional during the transition so the current
    // frontend does not immediately stop working.

    public CreateShipmentAddressRequest? SenderAddress { get; set; }

    public CreateShipmentAddressRequest? RecipientAddress { get; set; }

    [Range(
        0.01,
        1000,
        ErrorMessage = "Weight must be between 0.01 and 1000 kilograms.")]
    public decimal WeightKg { get; set; }

    [Range(
        0.1,
        300,
        ErrorMessage = "Length must be between 0.1 and 300 centimeters.")]
    public decimal LengthCm { get; set; }

    [Range(
        0.1,
        300,
        ErrorMessage = "Width must be between 0.1 and 300 centimeters.")]
    public decimal WidthCm { get; set; }

    [Range(
        0.1,
        300,
        ErrorMessage = "Height must be between 0.1 and 300 centimeters.")]
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

public sealed class CreateShipmentAddressRequest
{
    [Required]
    [MaxLength(150)]
    public string ContactName { get; set; } = string.Empty;

    [MaxLength(150)]
    public string? CompanyName { get; set; }

    [Required]
    [MaxLength(200)]
    public string AddressLine1 { get; set; } = string.Empty;

    [MaxLength(200)]
    public string? AddressLine2 { get; set; }

    [Required]
    [MaxLength(100)]
    public string City { get; set; } = string.Empty;

    [Required]
    [MaxLength(100)]
    public string StateOrProvince { get; set; } = string.Empty;

    [Required]
    [MaxLength(20)]
    public string PostalCode { get; set; } = string.Empty;

    [Required]
    [StringLength(
        2,
        MinimumLength = 2,
        ErrorMessage = "Country code must contain exactly two characters.")]
    public string CountryCode { get; set; } = "US";

    [MaxLength(30)]
    public string? PhoneNumber { get; set; }

    [EmailAddress]
    [MaxLength(256)]
    public string? Email { get; set; }

    public bool IsResidential { get; set; } = true;
}