using System.ComponentModel.DataAnnotations;

namespace PackageTracking.Api.Dtos;

public sealed class ShippingQuoteRequest
{
    [Required]
    public CreateShipmentAddressRequest SenderAddress { get; set; } =
        new();

    [Required]
    public CreateShipmentAddressRequest RecipientAddress { get; set; } =
        new();

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
}