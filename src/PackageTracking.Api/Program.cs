using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using PackageTracking.Api.Data;
using PackageTracking.Api.Models;
using PackageTracking.Api.Services;
using QuestPDF.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

// Configure the QuestPDF license.
// Use Community only when your project qualifies for that license.
QuestPDF.Settings.License =
    LicenseType.Community;

// Load local development secrets.
builder.Configuration.AddUserSecrets<Program>(
    optional: true
);

// Add API controllers.
builder.Services.AddControllers();

// Configure SQL Server and Entity Framework Core.
builder.Services.AddDbContext<ApplicationDbContext>(
    options =>
    {
        var connectionString =
            builder.Configuration.GetConnectionString(
                "DefaultConnection"
            )
            ?? throw new InvalidOperationException(
                "Connection string 'DefaultConnection' was not found."
            );

        options.UseSqlServer(connectionString);
    }
);

// Configure ASP.NET Core Identity.
builder.Services
    .AddIdentityCore<AppUser>(
        options =>
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
        }
    )
    .AddRoles<IdentityRole<int>>()
    .AddEntityFrameworkStores<ApplicationDbContext>()
    .AddDefaultTokenProviders();

// Read JWT configuration.
var jwtKey =
    builder.Configuration["Jwt:Key"]
    ?? throw new InvalidOperationException(
        "JWT key was not found. Configure Jwt:Key using user secrets."
    );

var jwtIssuer =
    builder.Configuration["Jwt:Issuer"]
    ?? "PackageTracking.Api";

var jwtAudience =
    builder.Configuration["Jwt:Audience"]
    ?? "PackageTracking.Web";

// Configure JWT authentication.
builder.Services
    .AddAuthentication(
        options =>
        {
            options.DefaultAuthenticateScheme =
                JwtBearerDefaults.AuthenticationScheme;

            options.DefaultChallengeScheme =
                JwtBearerDefaults.AuthenticationScheme;
        }
    )
    .AddJwtBearer(
        options =>
        {
            options.TokenValidationParameters =
                new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidateAudience = true,
                    ValidateLifetime = true,
                    ValidateIssuerSigningKey = true,

                    ValidIssuer = jwtIssuer,
                    ValidAudience = jwtAudience,

                    IssuerSigningKey =
                        new SymmetricSecurityKey(
                            Encoding.UTF8.GetBytes(jwtKey)
                        ),

                    ClockSkew = TimeSpan.Zero
                };
        }
    );

// Configure role-based authorization.
builder.Services.AddAuthorization();

// Phase 6B: shared shipping-rate engine.
builder.Services.AddScoped<ShippingRateService>();

// Phase 6C: barcode and PDF shipping-label services.
builder.Services.AddScoped<BarcodeService>();
builder.Services.AddScoped<ShippingLabelService>();

// Configure AfterShip service.
builder.Services.AddHttpClient<AfterShipTrackingService>(
    client =>
    {
        var baseUrl =
            builder.Configuration["AfterShip:BaseUrl"];

        if (!string.IsNullOrWhiteSpace(baseUrl))
        {
            client.BaseAddress =
                new Uri(
                    baseUrl.EndsWith("/")
                        ? baseUrl
                        : $"{baseUrl}/"
                );
        }
    }
);

// Allow the React frontend to call the API.
builder.Services.AddCors(
    options =>
    {
        options.AddPolicy(
            "Frontend",
            policy =>
            {
                policy
                    .WithOrigins(
                        "http://localhost:5173",
                        "http://localhost:5174",
                        "http://localhost:5175",
                        "http://localhost:5176",
                        "http://127.0.0.1:5173",
                        "http://127.0.0.1:5174",
                        "http://127.0.0.1:5175",
                        "http://127.0.0.1:5176"
                    )
                    .AllowAnyHeader()
                    .AllowAnyMethod();
            }
        );
    }
);

var app = builder.Build();

// Create application roles when the API starts.
using (var scope = app.Services.CreateScope())
{
    var roleManager =
        scope.ServiceProvider
            .GetRequiredService<
                RoleManager<IdentityRole<int>>
            >();

    var roleNames = new[]
    {
        "Customer",
        "Employee",
        "Driver",
        "Admin"
    };

    foreach (var roleName in roleNames)
    {
        var roleExists =
            await roleManager.RoleExistsAsync(roleName);

        if (roleExists)
        {
            continue;
        }

        var createRoleResult =
            await roleManager.CreateAsync(
                new IdentityRole<int>
                {
                    Name = roleName
                }
            );

        if (!createRoleResult.Succeeded)
        {
            var errors =
                string.Join(
                    ", ",
                    createRoleResult.Errors.Select(
                        error => error.Description
                    )
                );

            throw new InvalidOperationException(
                $"Could not create role {roleName}: {errors}"
            );
        }
    }
}

// Middleware order is important.
app.UseCors("Frontend");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// API health-check endpoint.
app.MapGet(
    "/",
    () =>
        Results.Ok(
            new
            {
                message =
                    "Package Tracking API is running"
            }
        )
);

app.Run();