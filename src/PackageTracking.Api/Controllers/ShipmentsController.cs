using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PackageTracking.Api.Data;
using PackageTracking.Api.Dtos;
using PackageTracking.Api.Models;
using PackageTracking.Api.Services;

namespace PackageTracking.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public sealed class ShipmentsController : ControllerBase
{
    private readonly ApplicationDbContext _dbContext;
    private readonly AfterShipTrackingService _afterShipTrackingService;

    public ShipmentsController(
        ApplicationDbContext dbContext,
        AfterShipTrackingService afterShipTrackingService)
    {
        _dbContext = dbContext;
        _afterShipTrackingService = afterShipTrackingService;
    }

    // Employees and administrators can view all shipments.
    [HttpGet]
    [Authorize(Roles = "Employee,Admin")]
    public async Task<ActionResult<IEnumerable<Shipment>>> GetAll()
    {
        var shipments = await _dbContext.Shipments
            .AsNoTracking()
            .Include(shipment => shipment.AssignedDriver)
            .OrderByDescending(shipment => shipment.CreatedAtUtc)
            .ToListAsync();

        foreach (var shipment in shipments)
        {
            shipment.AssignedDriverName =
                shipment.AssignedDriver?.FullName;
        }

        return Ok(shipments);
    }

    // Anyone can track a shipment using its tracking number.
    [AllowAnonymous]
    [HttpGet("{trackingNumber}")]
    public async Task<ActionResult<Shipment>> GetByTrackingNumber(
        string trackingNumber)
    {
        var cleanedTrackingNumber =
            trackingNumber.Trim();

        if (string.IsNullOrWhiteSpace(cleanedTrackingNumber))
        {
            return BadRequest(new
            {
                message = "A tracking number is required."
            });
        }

        var shipment = await _dbContext.Shipments
            .AsNoTracking()
            .Include(shipment => shipment.TrackingHistory)
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

        shipment.TrackingHistory =
            shipment.TrackingHistory
                .OrderByDescending(trackingEvent =>
                    trackingEvent.OccurredAtUtc)
                .ToList();

        return Ok(shipment);
    }

    // Employees and administrators can create shipments.
    [HttpPost]
    [Authorize(Roles = "Employee,Admin")]
    public async Task<ActionResult<Shipment>> Create(
        CreateShipmentRequest request)
    {
        var senderName =
            request.SenderName?.Trim()
            ?? string.Empty;

        var recipientName =
            request.RecipientName?.Trim()
            ?? string.Empty;

        var origin =
            request.Origin?.Trim()
            ?? string.Empty;

        var destination =
            request.Destination?.Trim()
            ?? string.Empty;

        if (string.IsNullOrWhiteSpace(senderName) ||
            string.IsNullOrWhiteSpace(recipientName) ||
            string.IsNullOrWhiteSpace(origin) ||
            string.IsNullOrWhiteSpace(destination))
        {
            return BadRequest(new
            {
                message =
                    "Sender, recipient, origin, and destination are required."
            });
        }

        if (request.WeightKg <= 0 ||
            request.LengthCm <= 0 ||
            request.WidthCm <= 0 ||
            request.HeightCm <= 0)
        {
            return BadRequest(new
            {
                message =
                    "Package weight and dimensions must be greater than zero."
            });
        }

        if (!request.ServiceLevel.HasValue ||
            !Enum.IsDefined(request.ServiceLevel.Value))
        {
            return BadRequest(new
            {
                message =
                    "A valid service level is required."
            });
        }

        var hasCarrierSlug =
            !string.IsNullOrWhiteSpace(
                request.CarrierSlug);

        var hasCarrierTrackingNumber =
            !string.IsNullOrWhiteSpace(
                request.CarrierTrackingNumber);

        if (hasCarrierSlug != hasCarrierTrackingNumber)
        {
            return BadRequest(new
            {
                message =
                    "Carrier and carrier tracking number must be provided together."
            });
        }

        var serviceLevel =
            request.ServiceLevel.Value;

        var createdAtUtc =
            DateTime.UtcNow;

        var shipment = new Shipment
        {
            TrackingNumber =
                GenerateTrackingNumber(),

            SenderName = senderName,
            RecipientName = recipientName,
            Origin = origin,
            Destination = destination,

            CurrentStatus =
                ShipmentStatus.Created,

            WeightKg = request.WeightKg,
            LengthCm = request.LengthCm,
            WidthCm = request.WidthCm,
            HeightCm = request.HeightCm,

            ServiceLevel = serviceLevel,

            EstimatedDeliveryDateUtc =
                CalculateEstimatedDeliveryDate(
                    createdAtUtc,
                    serviceLevel),

            ShippingCost =
                CalculateShippingCost(
                    request.WeightKg,
                    request.LengthCm,
                    request.WidthCm,
                    request.HeightCm,
                    serviceLevel),

            DeliveryInstructions =
                request.DeliveryInstructions?.Trim()
                ?? string.Empty,

            CarrierSlug = hasCarrierSlug
                ? request.CarrierSlug!
                    .Trim()
                    .ToLowerInvariant()
                : null,

            CarrierTrackingNumber =
                hasCarrierTrackingNumber
                    ? request.CarrierTrackingNumber!
                        .Trim()
                    : null,

            UsesCarrierTracking =
                hasCarrierSlug &&
                hasCarrierTrackingNumber
        };

        _dbContext.Shipments.Add(shipment);

        await _dbContext.SaveChangesAsync();

        var trackingEvent =
            new ShipmentTrackingEvent
            {
                ShipmentId = shipment.Id,

                Status =
                    ShipmentStatus.Created,

                Location =
                    shipment.Origin,

                Description =
                    $"Shipment was created with " +
                    $"{GetServiceLevelDisplayName(serviceLevel)} service."
            };

        _dbContext.ShipmentTrackingEvents.Add(
            trackingEvent);

        await _dbContext.SaveChangesAsync();

        shipment.TrackingHistory.Add(
            trackingEvent);

        return CreatedAtAction(
            nameof(GetByTrackingNumber),
            new
            {
                trackingNumber =
                    shipment.TrackingNumber
            },
            shipment);
    }

    // Employees, administrators, and assigned drivers
    // can update shipment status.
    [HttpPut("{trackingNumber}/status")]
    [Authorize(Roles = "Employee,Admin,Driver")]
    public async Task<ActionResult> UpdateStatus(
        string trackingNumber,
        UpdateShipmentStatusRequest request)
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

        // Drivers can update only shipments assigned to them.
        if (User.IsInRole("Driver") &&
            !User.IsInRole("Admin") &&
            !User.IsInRole("Employee"))
        {
            var currentDriverId =
                GetCurrentUserId();

            if (!currentDriverId.HasValue)
            {
                return Unauthorized(new
                {
                    message =
                        "The driver account could not be identified."
                });
            }

            if (shipment.AssignedDriverId !=
                currentDriverId.Value)
            {
                return StatusCode(
                    StatusCodes.Status403Forbidden,
                    new
                    {
                        message =
                            "Drivers can update only shipments assigned to them."
                    });
            }
        }

        if (shipment.CurrentStatus ==
            ShipmentStatus.Delivered)
        {
            return BadRequest(new
            {
                message =
                    "A delivered shipment cannot receive more updates."
            });
        }

        if (!request.Status.HasValue)
        {
            return BadRequest(new
            {
                message =
                    "A shipment status is required."
            });
        }

        var newStatus =
            request.Status.Value;

        if (!Enum.IsDefined(newStatus))
        {
            return BadRequest(new
            {
                message =
                    "The shipment status is invalid."
            });
        }

        if (!IsValidStatusTransition(
                shipment.CurrentStatus,
                newStatus))
        {
            return BadRequest(new
            {
                message =
                    $"A shipment cannot move from " +
                    $"{GetStatusDisplayName(shipment.CurrentStatus)} " +
                    $"to {GetStatusDisplayName(newStatus)}."
            });
        }

        var location =
            request.Location?.Trim()
            ?? string.Empty;

        var description =
            request.Description?.Trim()
            ?? string.Empty;

        if (string.IsNullOrWhiteSpace(location))
        {
            return BadRequest(new
            {
                message =
                    "A current shipment location is required."
            });
        }

        if (string.IsNullOrWhiteSpace(description))
        {
            return BadRequest(new
            {
                message =
                    "A tracking description is required."
            });
        }

        if (newStatus ==
                ShipmentStatus.Delivered &&
            !string.Equals(
                location,
                shipment.Destination,
                StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new
            {
                message =
                    $"The delivered location must match the destination: " +
                    $"{shipment.Destination}."
            });
        }

        shipment.CurrentStatus =
            newStatus;

        var trackingEvent =
            new ShipmentTrackingEvent
            {
                ShipmentId = shipment.Id,
                Status = newStatus,
                Location = location,
                Description = description
            };

        _dbContext.ShipmentTrackingEvents.Add(
            trackingEvent);

        await _dbContext.SaveChangesAsync();

        return Ok(new
        {
            message =
                $"Shipment updated to " +
                $"{GetStatusDisplayName(newStatus)}.",

            shipment.Id,
            shipment.TrackingNumber,
            shipment.CurrentStatus,

            TrackingEvent =
                trackingEvent
        });
    }

    // Employees and administrators can register
    // an external carrier tracking number.
    [HttpPost("{trackingNumber}/register-carrier")]
    [Authorize(Roles = "Employee,Admin")]
    public async Task<IActionResult> RegisterCarrierTracking(
        string trackingNumber,
        CancellationToken cancellationToken)
    {
        var cleanedTrackingNumber =
            trackingNumber.Trim();

        var shipment =
            await _dbContext.Shipments
                .FirstOrDefaultAsync(
                    shipment =>
                        shipment.TrackingNumber ==
                        cleanedTrackingNumber,
                    cancellationToken);

        if (shipment is null)
        {
            return NotFound(new
            {
                message = "Shipment not found."
            });
        }

        if (!shipment.UsesCarrierTracking ||
            string.IsNullOrWhiteSpace(
                shipment.CarrierSlug) ||
            string.IsNullOrWhiteSpace(
                shipment.CarrierTrackingNumber))
        {
            return BadRequest(new
            {
                message =
                    "This shipment does not have complete carrier information."
            });
        }

        var result =
            await _afterShipTrackingService
                .RegisterTrackingAsync(
                    shipment,
                    cancellationToken);

        return new ContentResult
        {
            StatusCode =
                (int)result.StatusCode,

            ContentType =
                "application/json",

            Content =
                result.ResponseBody
        };
    }

    private static bool IsValidStatusTransition(
        ShipmentStatus currentStatus,
        ShipmentStatus newStatus)
    {
        return (currentStatus, newStatus) switch
        {
            (
                ShipmentStatus.Created,
                ShipmentStatus.PackageReceived
            ) => true,

            (
                ShipmentStatus.PackageReceived,
                ShipmentStatus.InTransit
            ) => true,

            (
                ShipmentStatus.InTransit,
                ShipmentStatus.OutForDelivery
            ) => true,

            (
                ShipmentStatus.OutForDelivery,
                ShipmentStatus.Delivered
            ) => true,

            _ => false
        };
    }

    private static decimal CalculateShippingCost(
        decimal actualWeightKg,
        decimal lengthCm,
        decimal widthCm,
        decimal heightCm,
        ShipmentServiceLevel serviceLevel)
    {
        var dimensionalWeightKg =
            lengthCm *
            widthCm *
            heightCm /
            5000m;

        var billableWeightKg =
            Math.Max(
                actualWeightKg,
                dimensionalWeightKg);

        var pricing =
            serviceLevel switch
            {
                ShipmentServiceLevel.Standard =>
                    (
                        BasePrice: 8.00m,
                        PricePerKg: 1.25m
                    ),

                ShipmentServiceLevel.Express =>
                    (
                        BasePrice: 15.00m,
                        PricePerKg: 2.25m
                    ),

                ShipmentServiceLevel.SameDay =>
                    (
                        BasePrice: 25.00m,
                        PricePerKg: 3.50m
                    ),

                _ =>
                    throw new ArgumentOutOfRangeException(
                        nameof(serviceLevel))
            };

        return Math.Round(
            pricing.BasePrice +
            billableWeightKg *
            pricing.PricePerKg,
            2,
            MidpointRounding.AwayFromZero);
    }

    private static DateTime CalculateEstimatedDeliveryDate(
        DateTime createdAtUtc,
        ShipmentServiceLevel serviceLevel)
    {
        return serviceLevel switch
        {
            ShipmentServiceLevel.Standard =>
                createdAtUtc.AddDays(5),

            ShipmentServiceLevel.Express =>
                createdAtUtc.AddDays(2),

            ShipmentServiceLevel.SameDay =>
                createdAtUtc.AddHours(8),

            _ =>
                createdAtUtc.AddDays(5)
        };
    }

    private static string GetServiceLevelDisplayName(
        ShipmentServiceLevel serviceLevel)
    {
        return serviceLevel switch
        {
            ShipmentServiceLevel.Standard =>
                "Standard",

            ShipmentServiceLevel.Express =>
                "Express",

            ShipmentServiceLevel.SameDay =>
                "Same Day",

            _ =>
                serviceLevel.ToString()
        };
    }

    private static string GetStatusDisplayName(
        ShipmentStatus status)
    {
        return status switch
        {
            ShipmentStatus.Created =>
                "Created",

            ShipmentStatus.PackageReceived =>
                "Package Received",

            ShipmentStatus.InTransit =>
                "In Transit",

            ShipmentStatus.OutForDelivery =>
                "Out for Delivery",

            ShipmentStatus.Delivered =>
                "Delivered",

            _ =>
                status.ToString()
        };
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

    private static string GenerateTrackingNumber()
    {
        var uniquePart =
            Guid.NewGuid()
                .ToString("N")[..10]
                .ToUpperInvariant();

        return $"PTR-{uniquePart}";
    }
}