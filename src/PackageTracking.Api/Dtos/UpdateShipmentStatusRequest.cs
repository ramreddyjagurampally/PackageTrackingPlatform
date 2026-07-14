using System.ComponentModel.DataAnnotations;
using PackageTracking.Api.Models;

namespace PackageTracking.Api.Dtos;

public sealed class UpdateShipmentStatusRequest
{
    [Required]
    public ShipmentStatus? Status { get; init; }
}