using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PackageTracking.Api.Data;
using PackageTracking.Api.Models;
using PackageTracking.Api.Services;

namespace PackageTracking.Api.Controllers;

[ApiController]
[Route("api/shipping-labels")]
[Authorize(
    Roles = "Customer,Employee,Admin")]
public sealed class ShippingLabelsController
    : ControllerBase
{
    private readonly ApplicationDbContext
        _dbContext;

    private readonly ShippingLabelService
        _shippingLabelService;

    private readonly BarcodeService
        _barcodeService;

    public ShippingLabelsController(
        ApplicationDbContext dbContext,
        ShippingLabelService shippingLabelService,
        BarcodeService barcodeService)
    {
        _dbContext = dbContext;
        _shippingLabelService =
            shippingLabelService;
        _barcodeService =
            barcodeService;
    }

    [HttpGet("{trackingNumber}/pdf")]
    public async Task<IActionResult> DownloadPdf(
        string trackingNumber)
    {
        var shipment =
            await FindShipmentAsync(
                trackingNumber);

        if (shipment is null)
        {
            return NotFound(new
            {
                message =
                    "Shipment not found."
            });
        }

        if (!CanAccessShipment(shipment))
        {
            return Forbid();
        }

        try
        {
            var pdf =
                _shippingLabelService
                    .GeneratePdf(shipment);

            var safeTrackingNumber =
                shipment.TrackingNumber
                    .Replace(
                        "/",
                        "-",
                        StringComparison.Ordinal)
                    .Replace(
                        "\\",
                        "-",
                        StringComparison.Ordinal);

            return File(
                pdf,
                "application/pdf",
                $"shipping-label-{safeTrackingNumber}.pdf");
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(new
            {
                message =
                    exception.Message
            });
        }
    }

    [HttpGet("{trackingNumber}/barcode")]
    public async Task<IActionResult> DownloadBarcode(
        string trackingNumber)
    {
        var shipment =
            await FindShipmentAsync(
                trackingNumber);

        if (shipment is null)
        {
            return NotFound(new
            {
                message =
                    "Shipment not found."
            });
        }

        if (!CanAccessShipment(shipment))
        {
            return Forbid();
        }

        var barcode =
            _barcodeService
                .GenerateCode128Png(
                    shipment.TrackingNumber);

        return File(
            barcode,
            "image/png");
    }

    private async Task<Shipment?>
        FindShipmentAsync(
            string trackingNumber)
    {
        var cleanedTrackingNumber =
            trackingNumber?.Trim()
            ?? string.Empty;

        if (string.IsNullOrWhiteSpace(
                cleanedTrackingNumber))
        {
            return null;
        }

        return await _dbContext.Shipments
            .AsNoTracking()
            .Include(shipment =>
                shipment.SenderAddress)
            .Include(shipment =>
                shipment.RecipientAddress)
            .FirstOrDefaultAsync(shipment =>
                shipment.TrackingNumber ==
                cleanedTrackingNumber);
    }

    private bool CanAccessShipment(
        Shipment shipment)
    {
        if (User.IsInRole("Admin") ||
            User.IsInRole("Employee"))
        {
            return true;
        }

        if (!User.IsInRole("Customer"))
        {
            return false;
        }

        var userIdValue =
            User.FindFirstValue(
                ClaimTypes.NameIdentifier)
            ??
            User.FindFirstValue(
                JwtRegisteredClaimNames.Sub);

        return int.TryParse(
                   userIdValue,
                   out var customerId)
               &&
               shipment.CustomerId ==
               customerId;
    }
}