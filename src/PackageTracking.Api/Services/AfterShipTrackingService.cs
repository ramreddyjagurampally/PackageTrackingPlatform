using System.Net;
using System.Net.Http.Json;
using PackageTracking.Api.Models;

namespace PackageTracking.Api.Services;

public sealed class AfterShipTrackingService
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;

    public AfterShipTrackingService(
        HttpClient httpClient,
        IConfiguration configuration)
    {
        _httpClient = httpClient;
        _configuration = configuration;
    }

    public async Task<AfterShipRegistrationResult> RegisterTrackingAsync(
        Shipment shipment,
        CancellationToken cancellationToken = default)
    {
        if (!shipment.UsesCarrierTracking ||
            string.IsNullOrWhiteSpace(shipment.CarrierSlug) ||
            string.IsNullOrWhiteSpace(shipment.CarrierTrackingNumber))
        {
            return new AfterShipRegistrationResult(
                false,
                HttpStatusCode.BadRequest,
                "The shipment does not contain valid carrier information.");
        }

        var apiKey = _configuration["AfterShip:ApiKey"];

        if (string.IsNullOrWhiteSpace(apiKey))
        {
            throw new InvalidOperationException(
                "The AfterShip API key is not configured.");
        }

        var requestBody = new
        {
            id = shipment.Id.ToString("N"),
            tracking_number = shipment.CarrierTrackingNumber,
            slug = shipment.CarrierSlug,
            title = shipment.TrackingNumber
        };

        using var request = new HttpRequestMessage(
            HttpMethod.Post,
            "trackings");

        request.Headers.Add("as-api-key", apiKey);
        request.Content = JsonContent.Create(requestBody);

        using var response = await _httpClient.SendAsync(
            request,
            cancellationToken);

        var responseBody = await response.Content.ReadAsStringAsync(
            cancellationToken);

        return new AfterShipRegistrationResult(
            response.IsSuccessStatusCode,
            response.StatusCode,
            responseBody);
    }
}

public sealed record AfterShipRegistrationResult(
    bool IsSuccess,
    HttpStatusCode StatusCode,
    string ResponseBody);