using PackageTracking.Api.Dtos;
using PackageTracking.Api.Models;

namespace PackageTracking.Api.Services;

public sealed class ShippingRateService
{
    private const decimal DimensionalWeightDivisor =
        5000m;

    public IReadOnlyList<ShippingQuoteResponse> GetQuotes(
        ShippingQuoteRequest request,
        DateTime? quoteTimeUtc = null)
    {
        ArgumentNullException.ThrowIfNull(request);

        ValidatePackage(
            request.WeightKg,
            request.LengthCm,
            request.WidthCm,
            request.HeightCm);

        var createdAtUtc =
            quoteTimeUtc ?? DateTime.UtcNow;

        return Enum
            .GetValues<ShipmentServiceLevel>()
            .Select(serviceLevel =>
                GetQuote(
                    request.WeightKg,
                    request.LengthCm,
                    request.WidthCm,
                    request.HeightCm,
                    serviceLevel,
                    createdAtUtc))
            .OrderBy(quote => quote.TotalPrice)
            .ToList();
    }

    public ShippingQuoteResponse GetQuote(
        decimal actualWeightKg,
        decimal lengthCm,
        decimal widthCm,
        decimal heightCm,
        ShipmentServiceLevel serviceLevel,
        DateTime? quoteTimeUtc = null)
    {
        ValidatePackage(
            actualWeightKg,
            lengthCm,
            widthCm,
            heightCm);

        if (!Enum.IsDefined(serviceLevel))
        {
            throw new ArgumentOutOfRangeException(
                nameof(serviceLevel),
                "The service level is invalid.");
        }

        var createdAtUtc =
            quoteTimeUtc ?? DateTime.UtcNow;

        var dimensionalWeightKg =
            CalculateDimensionalWeight(
                lengthCm,
                widthCm,
                heightCm);

        var billableWeightKg =
            Math.Max(
                actualWeightKg,
                dimensionalWeightKg);

        var pricing =
            GetPricing(serviceLevel);

        var weightCharge =
            RoundCurrency(
                billableWeightKg *
                pricing.PricePerKg);

        var totalPrice =
            RoundCurrency(
                pricing.BaseCharge +
                weightCharge +
                pricing.ServiceSurcharge);

        return new ShippingQuoteResponse
        {
            ServiceLevel =
                serviceLevel,

            ServiceName =
                GetServiceDisplayName(
                    serviceLevel),

            CurrencyCode =
                "USD",

            EstimatedDeliveryDateUtc =
                CalculateEstimatedDeliveryDate(
                    createdAtUtc,
                    serviceLevel),

            ActualWeightKg =
                RoundWeight(actualWeightKg),

            DimensionalWeightKg =
                RoundWeight(dimensionalWeightKg),

            BillableWeightKg =
                RoundWeight(billableWeightKg),

            BaseCharge =
                pricing.BaseCharge,

            WeightCharge =
                weightCharge,

            ServiceSurcharge =
                pricing.ServiceSurcharge,

            TotalPrice =
                totalPrice
        };
    }

    private static decimal CalculateDimensionalWeight(
        decimal lengthCm,
        decimal widthCm,
        decimal heightCm)
    {
        return
            lengthCm *
            widthCm *
            heightCm /
            DimensionalWeightDivisor;
    }

    private static (
        decimal BaseCharge,
        decimal PricePerKg,
        decimal ServiceSurcharge)
        GetPricing(
            ShipmentServiceLevel serviceLevel)
    {
        return serviceLevel switch
        {
            ShipmentServiceLevel.Standard =>
                (
                    BaseCharge: 8.00m,
                    PricePerKg: 1.25m,
                    ServiceSurcharge: 0.00m
                ),

            ShipmentServiceLevel.Express =>
                (
                    BaseCharge: 10.00m,
                    PricePerKg: 2.25m,
                    ServiceSurcharge: 5.00m
                ),

            ShipmentServiceLevel.SameDay =>
                (
                    BaseCharge: 15.00m,
                    PricePerKg: 3.50m,
                    ServiceSurcharge: 10.00m
                ),

            _ =>
                throw new ArgumentOutOfRangeException(
                    nameof(serviceLevel),
                    "The service level is invalid.")
        };
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
                throw new ArgumentOutOfRangeException(
                    nameof(serviceLevel),
                    "The service level is invalid.")
        };
    }

    private static string GetServiceDisplayName(
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

    private static decimal RoundCurrency(
        decimal amount)
    {
        return Math.Round(
            amount,
            2,
            MidpointRounding.AwayFromZero);
    }

    private static decimal RoundWeight(
        decimal weight)
    {
        return Math.Round(
            weight,
            2,
            MidpointRounding.AwayFromZero);
    }

    private static void ValidatePackage(
        decimal weightKg,
        decimal lengthCm,
        decimal widthCm,
        decimal heightCm)
    {
        if (weightKg <= 0)
        {
            throw new ArgumentOutOfRangeException(
                nameof(weightKg),
                "Package weight must be greater than zero.");
        }

        if (lengthCm <= 0)
        {
            throw new ArgumentOutOfRangeException(
                nameof(lengthCm),
                "Package length must be greater than zero.");
        }

        if (widthCm <= 0)
        {
            throw new ArgumentOutOfRangeException(
                nameof(widthCm),
                "Package width must be greater than zero.");
        }

        if (heightCm <= 0)
        {
            throw new ArgumentOutOfRangeException(
                nameof(heightCm),
                "Package height must be greater than zero.");
        }
    }
}