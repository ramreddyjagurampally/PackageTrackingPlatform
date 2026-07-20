using System.ComponentModel.DataAnnotations;

namespace PackageTracking.Api.Dtos;

public sealed class AssignCustomerRequest
{
    [Range(1, int.MaxValue)]
    public int CustomerId { get; set; }
}