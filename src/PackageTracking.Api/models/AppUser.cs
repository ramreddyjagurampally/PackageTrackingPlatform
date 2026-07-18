using Microsoft.AspNetCore.Identity;

namespace PackageTracking.Api.Models;

public sealed class AppUser : IdentityUser<int>
{
    public string FullName { get; set; } = string.Empty;

    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}