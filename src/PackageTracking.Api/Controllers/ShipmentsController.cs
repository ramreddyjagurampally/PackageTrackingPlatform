using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PackageTracking.Api.Data;
using PackageTracking.Api.Dtos;
using PackageTracking.Api.Models;
using PackageTracking.Api.Services;

namespace PackageTracking.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
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

    [HttpGet]
    public async Task<ActionResult<IEnumerable<Shipment>>> GetAll()
    {
        var shipments = await _dbContext.Shipments
            .AsNoTracking()
            .OrderByDescending(shipment => shipment.CreatedAtUtc)
            .ToListAsync();

        return Ok(shipments);
    }

    [HttpGet("{trackingNumber}")]
    public async Task<ActionResult<Shipment>> GetByTrackingNumber(
        string trackingNumber)
    {
        var cleanedTrackingNumber = trackingNumber.Trim();

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

    [HttpPost]
    public async Task<ActionResult<Shipment>> Create(
        CreateShipmentRequest request)
    {
        var hasCarrierSlug =
            !string.IsNullOrWhiteSpace(request.CarrierSlug);

        var hasCarrierTrackingNumber =
            !string.IsNullOrWhiteSpace(request.CarrierTrackingNumber);

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
            SenderName = request.SenderName.Trim(),
            RecipientName = request.RecipientName.Trim(),
            Origin = request.Origin.Trim(),
            Destination = request.Destination.Trim(),

            CarrierSlug = hasCarrierSlug
                ? request.CarrierSlug!.Trim().ToLowerInvariant()
                : null,

            CarrierTrackingNumber = hasCarrierTrackingNumber
                ? request.CarrierTrackingNumber!.Trim()
                : null,

            UsesCarrierTracking =
                hasCarrierSlug && hasCarrierTrackingNumber
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

    [HttpPut("{trackingNumber}/status")]
    public async Task<ActionResult> UpdateStatus(
        string trackingNumber,
        UpdateShipmentStatusRequest request)
    {
        var cleanedTrackingNumber = trackingNumber.Trim();

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

        shipment.CurrentStatus = newStatus;

        var trackingEvent = new ShipmentTrackingEvent
        {
            ShipmentId = shipment.Id,
            Status = newStatus,
            Location = request.Location.Trim(),
            Description = request.Description.Trim()
        };

        _dbContext.ShipmentTrackingEvents.Add(trackingEvent);
        await _dbContext.SaveChangesAsync();

        return Ok(new
        {
            shipment.Id,
            shipment.TrackingNumber,
            shipment.CarrierSlug,
            shipment.CarrierTrackingNumber,
            shipment.UsesCarrierTracking,
            shipment.CurrentStatus,
            TrackingEvent = trackingEvent
        });
    }

    [HttpPost("{trackingNumber}/register-carrier")]
    public async Task<IActionResult> RegisterCarrierTracking(
        string trackingNumber,
        CancellationToken cancellationToken)
    {
        var cleanedTrackingNumber = trackingNumber.Trim();

        var shipment = await _dbContext.Shipments
            .FirstOrDefaultAsync(
                shipment =>
                    shipment.TrackingNumber == cleanedTrackingNumber,
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
            await _afterShipTrackingService.RegisterTrackingAsync(
                shipment,
                cancellationToken);

        return new ContentResult
        {
            StatusCode = (int)result.StatusCode,
            ContentType = "application/json",
            Content = result.ResponseBody
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