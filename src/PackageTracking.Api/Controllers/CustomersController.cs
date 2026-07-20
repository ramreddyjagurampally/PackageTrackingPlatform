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
public sealed class CustomersController : ControllerBase
{
    private readonly ApplicationDbContext _dbContext;
    private readonly UserManager<AppUser> _userManager;
    private readonly RoleManager<IdentityRole<int>> _roleManager;

    public CustomersController(
        ApplicationDbContext dbContext,
        UserManager<AppUser> userManager,
        RoleManager<IdentityRole<int>> roleManager)
    {
        _dbContext = dbContext;
        _userManager = userManager;
        _roleManager = roleManager;
    }

    // Public customer registration.
    [AllowAnonymous]
    [HttpPost("register")]
    public async Task<ActionResult> Register(
        RegisterCustomerRequest request)
    {
        var fullName =
            request.FullName?.Trim() ??
            string.Empty;

        var email =
            request.Email?.Trim()
                .ToLowerInvariant() ??
            string.Empty;

        if (string.IsNullOrWhiteSpace(fullName))
        {
            return BadRequest(new
            {
                message =
                    "The customer's full name is required."
            });
        }

        if (string.IsNullOrWhiteSpace(email))
        {
            return BadRequest(new
            {
                message =
                    "The customer's email address is required."
            });
        }

        var existingUser =
            await _userManager.FindByEmailAsync(email);

        if (existingUser is not null)
        {
            return Conflict(new
            {
                message =
                    "An account already exists with this email address."
            });
        }

        const string customerRoleName =
            "Customer";

        if (!await _roleManager.RoleExistsAsync(
                customerRoleName))
        {
            var roleResult =
                await _roleManager.CreateAsync(
                    new IdentityRole<int>
                    {
                        Name =
                            customerRoleName
                    });

            if (!roleResult.Succeeded)
            {
                return StatusCode(
                    StatusCodes.Status500InternalServerError,
                    new
                    {
                        message =
                            "The customer role could not be created.",

                        errors =
                            roleResult.Errors.Select(
                                error =>
                                    error.Description)
                    });
            }
        }

        var customer =
            new AppUser
            {
                FullName =
                    fullName,

                Email =
                    email,

                UserName =
                    email,

                EmailConfirmed =
                    true,

                CreatedAtUtc =
                    DateTime.UtcNow
            };

        var createResult =
            await _userManager.CreateAsync(
                customer,
                request.Password);

        if (!createResult.Succeeded)
        {
            return BadRequest(new
            {
                message =
                    "The customer account could not be created.",

                errors =
                    createResult.Errors.Select(
                        error =>
                            error.Description)
            });
        }

        var addRoleResult =
            await _userManager.AddToRoleAsync(
                customer,
                customerRoleName);

        if (!addRoleResult.Succeeded)
        {
            await _userManager.DeleteAsync(
                customer);

            return StatusCode(
                StatusCodes.Status500InternalServerError,
                new
                {
                    message =
                        "The Customer role could not be assigned.",

                    errors =
                        addRoleResult.Errors.Select(
                            error =>
                                error.Description)
                });
        }

        return StatusCode(
            StatusCodes.Status201Created,
            new
            {
                message =
                    "Customer account created successfully.",

                customer =
                    new
                    {
                        customer.Id,
                        customer.FullName,
                        customer.Email,
                        customer.CreatedAtUtc
                    }
            });
    }

    // Employees and administrators can list customer accounts.
    [Authorize(Roles = "Employee,Admin")]
    [HttpGet]
    public async Task<ActionResult> GetCustomers()
    {
        var customers =
            await _userManager.GetUsersInRoleAsync(
                "Customer");

        var result =
            customers
                .OrderBy(customer =>
                    customer.FullName)
                .Select(customer =>
                    new
                    {
                        customer.Id,
                        customer.FullName,
                        customer.Email,
                        customer.CreatedAtUtc
                    })
                .ToList();

        return Ok(result);
    }

    // A customer can view only shipments connected
    // to their own account.
    [Authorize(Roles = "Customer")]
    [HttpGet("my-shipments")]
    public async Task<ActionResult<IEnumerable<Shipment>>>
        GetMyShipments()
    {
        var currentCustomerId =
            GetCurrentUserId();

        if (!currentCustomerId.HasValue)
        {
            return Unauthorized(new
            {
                message =
                    "The customer account could not be identified."
            });
        }

        var shipments =
            await _dbContext.Shipments
                .AsNoTracking()
                .Include(shipment =>
                    shipment.AssignedDriver)
                .Where(shipment =>
                    shipment.CustomerId ==
                    currentCustomerId.Value)
                .OrderByDescending(shipment =>
                    shipment.CreatedAtUtc)
                .ToListAsync();

        foreach (var shipment in shipments)
        {
            shipment.AssignedDriverName =
                shipment.AssignedDriver?.FullName;
        }

        return Ok(shipments);
    }

    // Employees and administrators can connect a
    // customer account to a shipment.
    [Authorize(Roles = "Employee,Admin")]
    [HttpPut("shipments/{trackingNumber}/assign")]
    public async Task<ActionResult> AssignCustomer(
        string trackingNumber,
        AssignCustomerRequest request)
    {
        var cleanedTrackingNumber =
            trackingNumber?.Trim() ??
            string.Empty;

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
                message =
                    "Shipment not found."
            });
        }

        var customer =
            await _userManager.FindByIdAsync(
                request.CustomerId.ToString());

        if (customer is null)
        {
            return NotFound(new
            {
                message =
                    "Customer account not found."
            });
        }

        var isCustomer =
            await _userManager.IsInRoleAsync(
                customer,
                "Customer");

        if (!isCustomer)
        {
            return BadRequest(new
            {
                message =
                    "The selected account is not a customer account."
            });
        }

        shipment.CustomerId =
            customer.Id;

        await _dbContext.SaveChangesAsync();

        return Ok(new
        {
            message =
                "Customer assigned to the shipment successfully.",

            shipment.TrackingNumber,

            customer =
                new
                {
                    customer.Id,
                    customer.FullName,
                    customer.Email
                }
        });
    }

    // Employees and administrators can remove the
    // customer connection from a shipment.
    [Authorize(Roles = "Employee,Admin")]
    [HttpDelete(
        "shipments/{trackingNumber}/assignment")]
    public async Task<ActionResult>
        RemoveCustomerAssignment(
            string trackingNumber)
    {
        var cleanedTrackingNumber =
            trackingNumber?.Trim() ??
            string.Empty;

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
                message =
                    "Shipment not found."
            });
        }

        if (!shipment.CustomerId.HasValue)
        {
            return BadRequest(new
            {
                message =
                    "This shipment does not have an assigned customer."
            });
        }

        shipment.CustomerId =
            null;

        await _dbContext.SaveChangesAsync();

        return Ok(new
        {
            message =
                "Customer assignment removed successfully.",

            shipment.TrackingNumber
        });
    }

    private int? GetCurrentUserId()
    {
        var userIdValue =
            User.FindFirstValue(
                ClaimTypes.NameIdentifier)
            ??
            User.FindFirstValue(
                JwtRegisteredClaimNames.Sub);

        return int.TryParse(
            userIdValue,
            out var userId)
            ? userId
            : null;
    }
}