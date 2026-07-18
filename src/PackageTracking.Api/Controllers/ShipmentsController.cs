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
[Authorize(Roles = "Employee,Admin")]
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

    // Employee/Admin only:
    // GET api/shipments
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Shipment>>> GetAll()
    {
        var shipments = await _dbContext.Shipments
            .AsNoTracking()
            .OrderByDescending(shipment => shipment.CreatedAtUtc)
            .ToListAsync();

        return Ok(shipments);
    }

    // Public:
    // GET api/shipments/{trackingNumber}
    [AllowAnonymous]
    [HttpGet("{trackingNumber}")]
    public async Task<ActionResult<Shipment>> GetByTrackingNumber(
        string trackingNumber)
    {
        var cleanedTrackingNumber = trackingNumber.Trim();

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
                shipment.TrackingNumber == cleanedTrackingNumber);

        if (shipment is null)
        {
            return NotFound(new
            {
                message = "Shipment not found."
            });
        }

        shipment.TrackingHistory = shipment.TrackingHistory
            .OrderByDescending(trackingEvent =>
                trackingEvent.OccurredAtUtc)
            .ToList();

        return Ok(shipment);
    }

    // Employee/Admin only:
    // POST api/shipments
    [HttpPost]
    public async Task<ActionResult<Shipment>> Create(
        CreateShipmentRequest request)
    {
        var senderName = request.SenderName?.Trim() ?? string.Empty;
        var recipientName =
            request.RecipientName?.Trim() ?? string.Empty;
        var origin = request.Origin?.Trim() ?? string.Empty;
        var destination =
            request.Destination?.Trim() ?? string.Empty;

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

        var hasCarrierSlug =
            !string.IsNullOrWhiteSpace(request.CarrierSlug);

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

        var shipment = new Shipment
        {
            TrackingNumber = GenerateTrackingNumber(),
            SenderName = senderName,
            RecipientName = recipientName,
            Origin = origin,
            Destination = destination,

            CarrierSlug = hasCarrierSlug
                ? request.CarrierSlug!
                    .Trim()
                    .ToLowerInvariant()
                : null,

            CarrierTrackingNumber =
                hasCarrierTrackingNumber
                    ? request.CarrierTrackingNumber!.Trim()
                    : null,

            UsesCarrierTracking =
                hasCarrierSlug &&
                hasCarrierTrackingNumber,

            CurrentStatus = ShipmentStatus.Created
        };

        _dbContext.Shipments.Add(shipment);
        await _dbContext.SaveChangesAsync();

        var trackingEvent = new ShipmentTrackingEvent
        {
            ShipmentId = shipment.Id,
            Status = ShipmentStatus.Created,
            Location = shipment.Origin,
            Description = shipment.UsesCarrierTracking
                ? $"Shipment created with carrier {shipment.CarrierSlug}."
                : "Shipment was created."
        };

        _dbContext.ShipmentTrackingEvents.Add(trackingEvent);
        await _dbContext.SaveChangesAsync();

        shipment.TrackingHistory.Add(trackingEvent);

        return CreatedAtAction(
            nameof(GetByTrackingNumber),
            new
            {
                trackingNumber = shipment.TrackingNumber
            },
            shipment);
    }

    // Employee/Admin only:
    // PUT api/shipments/{trackingNumber}/status
    [HttpPut("{trackingNumber}/status")]
    public async Task<ActionResult> UpdateStatus(
        string trackingNumber,
        UpdateShipmentStatusRequest request)
    {
        var cleanedTrackingNumber = trackingNumber.Trim();

        if (string.IsNullOrWhiteSpace(cleanedTrackingNumber))
        {
            return BadRequest(new
            {
                message = "A tracking number is required."
            });
        }

        var shipment = await _dbContext.Shipments
            .FirstOrDefaultAsync(shipment =>
                shipment.TrackingNumber == cleanedTrackingNumber);

        if (shipment is null)
        {
            return NotFound(new
            {
                message = "Shipment not found."
            });
        }

        if (!request.Status.HasValue)
        {
            return BadRequest(new
            {
                message = "A shipment status is required."
            });
        }

        var newStatus = request.Status.Value;

        if (!Enum.IsDefined(newStatus))
        {
            return BadRequest(new
            {
                message = "The shipment status is invalid."
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
                    $"{GetStatusDisplayName(shipment.CurrentStatus)} to " +
                    $"{GetStatusDisplayName(newStatus)}."
            });
        }

        var location =
            request.Location?.Trim() ?? string.Empty;

        var description =
            request.Description?.Trim() ?? string.Empty;

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

        shipment.CurrentStatus = newStatus;

        var trackingEvent = new ShipmentTrackingEvent
        {
            ShipmentId = shipment.Id,
            Status = newStatus,
            Location = location,
            Description = description
        };

        _dbContext.ShipmentTrackingEvents.Add(trackingEvent);
        await _dbContext.SaveChangesAsync();

        return Ok(new
        {
            message =
                $"Shipment updated to " +
                $"{GetStatusDisplayName(newStatus)}.",

            shipment.Id,
            shipment.TrackingNumber,
            shipment.CarrierSlug,
            shipment.CarrierTrackingNumber,
            shipment.UsesCarrierTracking,
            shipment.CurrentStatus,

            TrackingEvent = trackingEvent
        });
    }

    // Employee/Admin only:
    // POST api/shipments/{trackingNumber}/register-carrier
    [HttpPost("{trackingNumber}/register-carrier")]
    public async Task<IActionResult> RegisterCarrierTracking(
        string trackingNumber,
        CancellationToken cancellationToken)
    {
        var cleanedTrackingNumber = trackingNumber.Trim();

        if (string.IsNullOrWhiteSpace(cleanedTrackingNumber))
        {
            return BadRequest(new
            {
                message = "A tracking number is required."
            });
        }

        var shipment = await _dbContext.Shipments
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
            string.IsNullOrWhiteSpace(shipment.CarrierSlug) ||
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
            StatusCode = (int)result.StatusCode,
            ContentType = "application/json",
            Content = result.ResponseBody
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

            _ => status.ToString()
        };
    }

    private static string GenerateTrackingNumber()
    {
        var uniquePart = Guid.NewGuid()
            .ToString("N")[..10]
            .ToUpperInvariant();

        return $"PTR-{uniquePart}";
    }
}