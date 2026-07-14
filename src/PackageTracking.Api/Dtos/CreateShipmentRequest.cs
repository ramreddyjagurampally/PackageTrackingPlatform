using System.ComponentModel.DataAnnotations;

namespace PackageTracking.Api.Dtos;

public sealed class CreateShipmentRequest
{
    [Required]
    [StringLength(100)]
    public string SenderName { get; init; } = string.Empty;

    [Required]
    [StringLength(100)]
    public string RecipientName { get; init; } = string.Empty;

    [Required]
    [StringLength(150)]
    public string Origin { get; init; } = string.Empty;

    [Required]
    [StringLength(150)]
    public string Destination { get; init; } = string.Empty;
}
