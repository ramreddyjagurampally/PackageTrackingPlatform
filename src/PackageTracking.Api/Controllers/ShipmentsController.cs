using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PackageTracking.Api.Data;
using PackageTracking.Api.Dtos;
using PackageTracking.Api.Models;

namespace PackageTracking.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public sealed class ShipmentsController : ControllerBase
{
    private readonly ApplicationDbContext _dbContext;

    public ShipmentsController(ApplicationDbContext dbContext)
    {
        _dbContext = dbContext;
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
        var shipment = await _dbContext.Shipments
            .AsNoTracking()
            .FirstOrDefaultAsync(shipment =>
                shipment.TrackingNumber == trackingNumber);

        if (shipment is null)
        {
            return NotFound(new
            {
                message = "Shipment not found."
            });
        }

        return Ok(shipment);
    }

    [HttpPost]
    public async Task<ActionResult<Shipment>> Create(
        CreateShipmentRequest request)
    {
        var shipment = new Shipment
        {
            TrackingNumber = GenerateTrackingNumber(),
            SenderName = request.SenderName,
            RecipientName = request.RecipientName,
            Origin = request.Origin,
            Destination = request.Destination
        };

        _dbContext.Shipments.Add(shipment);
        await _dbContext.SaveChangesAsync();

        return CreatedAtAction(
            nameof(GetByTrackingNumber),
            new { trackingNumber = shipment.TrackingNumber },
            shipment);
    }

    [HttpPut("{trackingNumber}/status")]
    public async Task<ActionResult<Shipment>> UpdateStatus(
        string trackingNumber,
        UpdateShipmentStatusRequest request)
    {
        var shipment = await _dbContext.Shipments
            .FirstOrDefaultAsync(shipment =>
                shipment.TrackingNumber == trackingNumber);

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

        if (!Enum.IsDefined(request.Status.Value))
        {
            return BadRequest(new
            {
                message = "The shipment status is invalid."
            });
        }

        shipment.CurrentStatus = request.Status.Value;

        await _dbContext.SaveChangesAsync();

        return Ok(shipment);
    }

    private static string GenerateTrackingNumber()
    {
        var uniquePart = Guid.NewGuid()
            .ToString("N")[..10]
            .ToUpperInvariant();

        return $"PTR-{uniquePart}";
    }
}