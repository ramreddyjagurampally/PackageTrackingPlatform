using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using PackageTracking.Api.Data;
using PackageTracking.Api.Models;
using PackageTracking.Api.Services;

var builder = WebApplication.CreateBuilder(args);

// Add API controllers.
builder.Services.AddControllers();

// Configure SQL Server.
builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    var connectionString =
        builder.Configuration.GetConnectionString("DefaultConnection")
        ?? throw new InvalidOperationException(
            "Connection string 'DefaultConnection' was not found.");

    options.UseSqlServer(connectionString);
});

// Configure ASP.NET Core Identity.
builder.Services
    .AddIdentityCore<AppUser>(options =>
    {
        options.User.RequireUniqueEmail = true;

        options.Password.RequiredLength = 8;
        options.Password.RequireDigit = true;
        options.Password.RequireLowercase = true;
        options.Password.RequireUppercase = true;
        options.Password.RequireNonAlphanumeric = false;

        options.Lockout.MaxFailedAccessAttempts = 5;
        options.Lockout.DefaultLockoutTimeSpan =
            TimeSpan.FromMinutes(10);
    })
    .AddRoles<IdentityRole<int>>()
    .AddEntityFrameworkStores<ApplicationDbContext>()
    .AddDefaultTokenProviders();

// Configure the AfterShip service.
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

// Allow the React frontend to access the API.
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