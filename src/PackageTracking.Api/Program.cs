using Microsoft.EntityFrameworkCore;
using PackageTracking.Api.Data;
using PackageTracking.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();

builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(
        builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddHttpClient<AfterShipTrackingService>(client =>
{
    var baseUrl = builder.Configuration["AfterShip:BaseUrl"];

    if (string.IsNullOrWhiteSpace(baseUrl))
    {
        throw new InvalidOperationException(
            "The AfterShip base URL is not configured.");
    }

    client.BaseAddress = new Uri(
        baseUrl.EndsWith("/")
            ? baseUrl
            : $"{baseUrl}/");
});