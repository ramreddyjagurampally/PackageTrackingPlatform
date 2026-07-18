using System.ComponentModel.DataAnnotations;

namespace PackageTracking.Api.Dtos;

public sealed class AssignDriverRequest
{
    [Range(1, int.MaxValue)]
    public int DriverId { get; set; }
}