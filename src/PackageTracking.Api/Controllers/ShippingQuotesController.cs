using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PackageTracking.Api.Dtos;
using PackageTracking.Api.Services;

namespace PackageTracking.Api.Controllers;

[ApiController]
[Route("api/shipping-quotes")]
[Authorize(Roles = "Customer,Employee,Admin")]
public sealed class ShippingQuotesController
    : ControllerBase
{
    private readonly ShippingRateService
        _shippingRateService;

    public ShippingQuotesController(
        ShippingRateService shippingRateService)
    {
        _shippingRateService =
            shippingRateService;
    }

    [HttpPost]
    public ActionResult<
        IReadOnlyList<ShippingQuoteResponse>>
        GetQuotes(
            ShippingQuoteRequest request)
    {
        try
        {
            var quotes =
                _shippingRateService
                    .GetQuotes(request);

            return Ok(quotes);
        }
        catch (ArgumentOutOfRangeException exception)
        {
            return BadRequest(new
            {
                message =
                    exception.Message
            });
        }
        catch (ArgumentException exception)
        {
            return BadRequest(new
            {
                message =
                    exception.Message
            });
        }
    }
}