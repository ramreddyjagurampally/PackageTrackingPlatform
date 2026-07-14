using System.ComponentModel.DataAnnotations;
using PackageTracking.Api.Models;

namespace PackageTracking.Api.Dtos;

public sealed class UpdateShipmentStatusRequest
{
    [Required]
    public ShipmentStatus? Status { get; init; }

    [Required]
    [StringLength(150)]
    public string Location { get; init; } = string.Empty;

    [Required]
    [StringLength(300)]
    public string Description { get; init; } = string.Empty;
}