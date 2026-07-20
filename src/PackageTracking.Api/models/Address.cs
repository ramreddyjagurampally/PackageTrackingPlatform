using System.ComponentModel.DataAnnotations;

namespace PackageTracking.Api.Models;

public class Address
{
    public int Id { get; set; }

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
    [StringLength(2, MinimumLength = 2)]
    public string CountryCode { get; set; } = "US";

    [MaxLength(30)]
    public string? PhoneNumber { get; set; }

    [EmailAddress]
    [MaxLength(256)]
    public string? Email { get; set; }

    public bool IsResidential { get; set; } = true;

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    public DateTime? UpdatedAtUtc { get; set; }
}