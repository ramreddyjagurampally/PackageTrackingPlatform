using PackageTracking.Api.Models;

namespace PackageTracking.Api.Dtos;

public sealed class ShippingQuoteResponse
{
    public ShipmentServiceLevel ServiceLevel { get; set; }

    public string ServiceName { get; set; } =
        string.Empty;

    public string CurrencyCode { get; set; } =
        "USD";

    public DateTime EstimatedDeliveryDateUtc { get; set; }

    public decimal ActualWeightKg { get; set; }

    public decimal DimensionalWeightKg { get; set; }

    public decimal BillableWeightKg { get; set; }

    public decimal BaseCharge { get; set; }

    public decimal WeightCharge { get; set; }

    public decimal ServiceSurcharge { get; set; }

    public decimal TotalPrice { get; set; }
}