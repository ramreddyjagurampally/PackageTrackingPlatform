using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using PackageTracking.Api.Data;
using PackageTracking.Api.Models;
using PackageTracking.Api.Services;

var builder = WebApplication.CreateBuilder(args);

// Load local User Secrets even when running without a launch profile.
builder.Configuration.AddUserSecrets<Program>(optional: true);

// Controllers
builder.Services.AddControllers();

// SQL Server
builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    var connectionString =
        builder.Configuration.GetConnectionString("DefaultConnection")
        ?? throw new InvalidOperationException(
            "Connection string 'DefaultConnection' was not found.");

    options.UseSqlServer(connectionString);
});

// ASP.NET Core Identity
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

// JWT settings
var jwtKey =
    builder.Configuration["Jwt:Key"]
    ?? throw new InvalidOperationException(
        "JWT key was not found. Configure Jwt:Key using User Secrets.");

var jwtIssuer =
    builder.Configuration["Jwt:Issuer"]
    ?? "PackageTracking.Api";

var jwtAudience =
    builder.Configuration["Jwt:Audience"]
    ?? "PackageTracking.Web";

// JWT authentication
builder.Services
    .AddAuthentication(options =>
    {
        options.DefaultAuthenticateScheme =
            JwtBearerDefaults.AuthenticationScheme;

        options.DefaultChallengeScheme =
            JwtBearerDefaults.AuthenticationScheme;
    })
    .AddJwtBearer(options =>
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
                        Encoding.UTF8.GetBytes(jwtKey)),

                ClockSkew = TimeSpan.Zero
            };
    });

builder.Services.AddAuthorization();

// AfterShip integration
builder.Services.AddHttpClient<AfterShipTrackingService>(client =>
{
    var baseUrl =
        builder.Configuration["AfterShip:BaseUrl"];

    if (!string.IsNullOrWhiteSpace(baseUrl))
    {
        client.BaseAddress = new Uri(
            baseUrl.EndsWith("/")
                ? baseUrl
                : $"{baseUrl}/");
    }
});

// React frontend access
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

// Create roles and assign Admin role to the configured user.
using (var scope = app.Services.CreateScope())
{
    var roleManager =
        scope.ServiceProvider
            .GetRequiredService<
                RoleManager<IdentityRole<int>>>();

    var userManager =
        scope.ServiceProvider
            .GetRequiredService<UserManager<AppUser>>();

    var roleNames = new[]
    {
        "Customer",
        "Employee",
        "Admin"
    };

    foreach (var roleName in roleNames)
    {
        var roleExists =
            await roleManager.RoleExistsAsync(roleName);

        if (!roleExists)
        {
            var roleResult =
                await roleManager.CreateAsync(
                    new IdentityRole<int>
                    {
                        Name = roleName
                    });

            if (!roleResult.Succeeded)
            {
                var errors = string.Join(
                    ", ",
                    roleResult.Errors.Select(
                        error => error.Description));

                throw new InvalidOperationException(
                    $"Could not create role '{roleName}': {errors}");
            }
        }
    }

    var adminEmail =
        app.Configuration["Admin:Email"];

    if (!string.IsNullOrWhiteSpace(adminEmail))
    {
        var normalizedAdminEmail =
            adminEmail.Trim().ToLowerInvariant();

        var adminUser =
            await userManager.FindByEmailAsync(
                normalizedAdminEmail);

        if (adminUser is null)
        {
            Console.WriteLine(
                $"Admin account '{normalizedAdminEmail}' was not found.");
        }
        else
        {
            var alreadyAdmin =
                await userManager.IsInRoleAsync(
                    adminUser,
                    "Admin");

            if (!alreadyAdmin)
            {
                var adminRoleResult =
                    await userManager.AddToRoleAsync(
                        adminUser,
                        "Admin");

                if (!adminRoleResult.Succeeded)
                {
                    var errors = string.Join(
                        ", ",
                        adminRoleResult.Errors.Select(
                            error => error.Description));

                    throw new InvalidOperationException(
                        $"Could not assign Admin role: {errors}");
                }

                Console.WriteLine(
                    $"Admin role assigned to {normalizedAdminEmail}.");
            }
        }
    }
}

// HTTP pipeline
app.UseCors("Frontend");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.MapGet("/", () =>
    Results.Ok(new
    {
        message = "Package Tracking API is running"
    }));

app.Run();