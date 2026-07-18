using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PackageTracking.Api.Data;
using PackageTracking.Api.Dtos;
using PackageTracking.Api.Models;

namespace PackageTracking.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public sealed class DriversController : ControllerBase
{
    private readonly UserManager<AppUser> _userManager;
    private readonly RoleManager<IdentityRole<int>> _roleManager;
    private readonly ApplicationDbContext _dbContext;

    public DriversController(
        UserManager<AppUser> userManager,
        RoleManager<IdentityRole<int>> roleManager,
        ApplicationDbContext dbContext)
    {
        _userManager = userManager;
        _roleManager = roleManager;
        _dbContext = dbContext;
    }

    // Admin and employees can view all drivers.
    [HttpGet]
    [Authorize(Roles = "Employee,Admin")]
    public async Task<ActionResult> GetDrivers()
    {
        if (!await _roleManager.RoleExistsAsync("Driver"))
        {
            return Ok(Array.Empty<object>());
        }

        var drivers =
            await _userManager.GetUsersInRoleAsync("Driver");

        var response = drivers
            .OrderBy(driver => driver.FullName)
            .Select(driver => new
            {
                driver.Id,
                driver.FullName,
                driver.Email,
                driver.CreatedAtUtc
            });

        return Ok(response);
    }

    // Only an administrator can create driver accounts.
    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult> CreateDriver(
        CreateDriverRequest request)
    {
        var fullName =
            request.FullName?.Trim() ?? string.Empty;

        var email =
            request.Email?.Trim().ToLowerInvariant()
            ?? string.Empty;

        if (string.IsNullOrWhiteSpace(fullName) ||
            string.IsNullOrWhiteSpace(email) ||
            string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new
            {
                message =
                    "Full name, email, and password are required."
            });
        }

        var existingUser =
            await _userManager.FindByEmailAsync(email);

        if (existingUser is not null)
        {
            return Conflict(new
            {
                message =
                    "An account already exists with that email."
            });
        }

        if (!await _roleManager.RoleExistsAsync("Driver"))
        {
            var createRoleResult =
                await _roleManager.CreateAsync(
                    new IdentityRole<int>
                    {
                        Name = "Driver"
                    });

            if (!createRoleResult.Succeeded)
            {
                return BadRequest(new
                {
                    message = string.Join(
                        " ",
                        createRoleResult.Errors.Select(
                            error => error.Description))
                });
            }
        }

        var driver = new AppUser
        {
            FullName = fullName,
            Email = email,
            UserName = email,
            EmailConfirmed = true,
            CreatedAtUtc = DateTime.UtcNow
        };

        var createUserResult =
            await _userManager.CreateAsync(
                driver,
                request.Password);

        if (!createUserResult.Succeeded)
        {
            return BadRequest(new
            {
                message = string.Join(
                    " ",
                    createUserResult.Errors.Select(
                        error => error.Description))
            });
        }

        var assignRoleResult =
            await _userManager.AddToRoleAsync(
                driver,
                "Driver");

        if (!assignRoleResult.Succeeded)
        {
            await _userManager.DeleteAsync(driver);

            return BadRequest(new
            {
                message = string.Join(
                    " ",
                    assignRoleResult.Errors.Select(
                        error => error.Description))
            });
        }

        return Created(
            $"/api/drivers/{driver.Id}",
            new
            {
                message =
                    "Driver account created successfully.",

                driver.Id,
                driver.FullName,
                driver.Email,

                Role = "Driver"
            });
    }

    // Admin or employee assigns a shipment to a driver.
    [HttpPut("shipments/{trackingNumber}/assign")]
    [Authorize(Roles = "Employee,Admin")]
    public async Task<ActionResult> AssignShipment(
        string trackingNumber,
        AssignDriverRequest request)
    {
        var cleanedTrackingNumber =
            trackingNumber.Trim();

        if (string.IsNullOrWhiteSpace(
                cleanedTrackingNumber))
        {
            return BadRequest(new
            {
                message =
                    "A tracking number is required."
            });
        }

        var shipment =
            await _dbContext.Shipments
                .FirstOrDefaultAsync(shipment =>
                    shipment.TrackingNumber ==
                    cleanedTrackingNumber);

        if (shipment is null)
        {
            return NotFound(new
            {
                message = "Shipment not found."
            });
        }

        if (shipment.CurrentStatus ==
            ShipmentStatus.Delivered)
        {
            return BadRequest(new
            {
                message =
                    "A delivered shipment cannot be assigned."
            });
        }

        var driver =
            await _userManager.FindByIdAsync(
                request.DriverId.ToString());

        if (driver is null)
        {
            return NotFound(new
            {
                message =
                    "Driver account not found."
            });
        }

        var isDriver =
            await _userManager.IsInRoleAsync(
                driver,
                "Driver");

        if (!isDriver)
        {
            return BadRequest(new
            {
                message =
                    "The selected account is not a driver."
            });
        }

        shipment.AssignedDriverId = driver.Id;

        await _dbContext.SaveChangesAsync();

        return Ok(new
        {
            message =
                $"Shipment assigned to {driver.FullName}.",

            shipment.Id,
            shipment.TrackingNumber,

            Driver = new
            {
                driver.Id,
                driver.FullName,
                driver.Email
            }
        });
    }

    // Admin or employee removes a driver assignment.
    [HttpDelete(
        "shipments/{trackingNumber}/assignment")]
    [Authorize(Roles = "Employee,Admin")]
    public async Task<ActionResult> RemoveAssignment(
        string trackingNumber)
    {
        var cleanedTrackingNumber =
            trackingNumber.Trim();

        var shipment =
            await _dbContext.Shipments
                .FirstOrDefaultAsync(shipment =>
                    shipment.TrackingNumber ==
                    cleanedTrackingNumber);

        if (shipment is null)
        {
            return NotFound(new
            {
                message = "Shipment not found."
            });
        }

        shipment.AssignedDriverId = null;

        await _dbContext.SaveChangesAsync();

        return Ok(new
        {
            message =
                "Driver assignment removed successfully."
        });
    }

    // A driver sees only packages assigned to their account.
    [HttpGet("my-shipments")]
    [Authorize(Roles = "Driver")]
    public async Task<ActionResult> GetMyShipments()
    {
        var driverId = GetCurrentUserId();

        if (!driverId.HasValue)
        {
            return Unauthorized(new
            {
                message =
                    "The driver account could not be identified."
            });
        }

        var shipments =
            await _dbContext.Shipments
                .AsNoTracking()
                .Where(shipment =>
                    shipment.AssignedDriverId ==
                    driverId.Value)
                .OrderBy(shipment =>
                    shipment.CurrentStatus ==
                    ShipmentStatus.Delivered)
                .ThenBy(shipment =>
                    shipment.EstimatedDeliveryDateUtc)
                .ToListAsync();

        return Ok(shipments);
    }

    private int? GetCurrentUserId()
    {
        var userIdValue =
            User.FindFirstValue(
                ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue(
                JwtRegisteredClaimNames.Sub);

        return int.TryParse(
            userIdValue,
            out var userId)
            ? userId
            : null;
    }
}