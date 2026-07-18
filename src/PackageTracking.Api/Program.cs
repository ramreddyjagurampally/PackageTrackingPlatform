using Microsoft.EntityFrameworkCore;
using PackageTracking.Api.Data;
using PackageTracking.Api.Services;

var builder = WebApplication.CreateBuilder(args);

// Controllers
builder.Services.AddControllers();

// Database
builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    var connectionString =
        builder.Configuration.GetConnectionString("DefaultConnection")
        ?? throw new InvalidOperationException(
            "Connection string 'DefaultConnection' was not found.");

    options.UseSqlServer(connectionString);
});

// AfterShip service
builder.Services.AddHttpClient<AfterShipTrackingService>(client =>
{
    var baseUrl = builder.Configuration["AfterShip:BaseUrl"];

    if (!string.IsNullOrWhiteSpace(baseUrl))
    {
        client.BaseAddress = new Uri(
            baseUrl.EndsWith("/")
                ? baseUrl
                : $"{baseUrl}/");
    }
});

// Allow the React website to call the API
builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        policy
            .WithOrigins("http://localhost:5173")
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var app = builder.Build();

app.UseCors("Frontend");

app.MapControllers();

app.MapGet("/", () =>
    Results.Ok(new
    {
        message = "Package Tracking API is running"
    }));

app.Run();