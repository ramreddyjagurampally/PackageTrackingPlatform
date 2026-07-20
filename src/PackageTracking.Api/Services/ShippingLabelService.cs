using PackageTracking.Api.Models;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace PackageTracking.Api.Services;

public sealed class ShippingLabelService
{
    private readonly BarcodeService _barcodeService;

    public ShippingLabelService(
        BarcodeService barcodeService)
    {
        _barcodeService = barcodeService;
    }

    public byte[] GeneratePdf(
        Shipment shipment)
    {
        ArgumentNullException.ThrowIfNull(shipment);

        if (shipment.SenderAddress is null)
        {
            throw new InvalidOperationException(
                "The shipment does not have a complete sender address.");
        }

        if (shipment.RecipientAddress is null)
        {
            throw new InvalidOperationException(
                "The shipment does not have a complete recipient address.");
        }

        var barcodeImage =
            _barcodeService.GenerateCode128Png(
                shipment.TrackingNumber);

        var document =
            Document.Create(document =>
            {
                document.Page(page =>
                {
                    page.Size(
                        4,
                        6,
                        Unit.Inch);

                    page.Margin(
                        0.12f,
                        Unit.Inch);

                    page.PageColor(
                        Colors.White);

                    page.DefaultTextStyle(
                        style =>
                            style
                                .FontSize(7)
                                .FontColor(
                                    Colors.Black));

                    page.Content()
                        .Column(column =>
                        {
                            column.Spacing(3);

                            column.Item()
                                .Row(row =>
                                {
                                    row.RelativeItem()
                                        .Text("PACKAGE TRACKING")
                                        .Bold()
                                        .FontSize(15);

                                    row.AutoItem()
                                        .AlignRight()
                                        .Text(
                                            GetServiceName(
                                                shipment.ServiceLevel))
                                        .Bold()
                                        .FontSize(9);
                                });

                            column.Item()
                                .BorderTop(2)
                                .PaddingTop(2)
                                .AlignCenter()
                                .Text(
                                    shipment.TrackingNumber)
                                .Bold()
                                .FontSize(12);

                            column.Item()
                                .Height(55)
                                .Image(barcodeImage)
                                .FitArea();

                            column.Item()
                                .AlignCenter()
                                .Text(
                                    shipment.TrackingNumber)
                                .Bold()
                                .FontSize(8);

                            column.Item()
                                .Element(container =>
                                    ComposeAddress(
                                        container,
                                        "FROM",
                                        shipment.SenderAddress,
                                        false));

                            column.Item()
                                .Element(container =>
                                    ComposeAddress(
                                        container,
                                        "SHIP TO",
                                        shipment.RecipientAddress,
                                        true));

                            column.Item()
                                .Border(1)
                                .Padding(4)
                                .Column(details =>
                                {
                                    details.Spacing(1);

                                    details.Item()
                                        .Row(row =>
                                        {
                                            row.RelativeItem()
                                                .Text(
                                                    $"Weight: {shipment.WeightKg:0.##} kg")
                                                .SemiBold();

                                            row.RelativeItem()
                                                .AlignRight()
                                                .Text("Pieces: 1")
                                                .SemiBold();
                                        });

                                    details.Item()
                                        .Text(
                                            $"Dimensions: {shipment.LengthCm:0.##} × " +
                                            $"{shipment.WidthCm:0.##} × " +
                                            $"{shipment.HeightCm:0.##} cm");

                                    details.Item()
                                        .Text(
                                            $"Route: {shipment.Origin} → " +
                                            shipment.Destination);

                                    details.Item()
                                        .Text(
                                            shipment.EstimatedDeliveryDateUtc.HasValue
                                                ? $"Estimated delivery: " +
                                                  $"{shipment.EstimatedDeliveryDateUtc.Value:MMM d, yyyy}"
                                                : "Estimated delivery: Not available");

                                    if (!string.IsNullOrWhiteSpace(
                                            shipment.DeliveryInstructions))
                                    {
                                        details.Item()
                                            .Text(
                                                $"Instructions: " +
                                                LimitText(
                                                    shipment.DeliveryInstructions,
                                                    90));
                                    }
                                });

                            column.Item()
                                .AlignCenter()
                                .Text(
                                    $"Created {shipment.CreatedAtUtc:MMM d, yyyy h:mm tt} UTC")
                                .FontSize(5.5f);
                        });
                });
            });

        return document.GeneratePdf();
    }

    private static void ComposeAddress(
        IContainer container,
        string heading,
        Address address,
        bool emphasize)
    {
        container
            .Border(
                emphasize ? 2 : 1)
            .Padding(4)
            .Column(column =>
            {
                column.Spacing(0.5f);

                column.Item()
                    .Text(heading)
                    .Bold()
                    .FontSize(
                        emphasize ? 9 : 7);

                column.Item()
                    .Text(
                        LimitText(
                            address.ContactName,
                            45))
                    .Bold()
                    .FontSize(
                        emphasize ? 11 : 8);

                if (!string.IsNullOrWhiteSpace(
                        address.CompanyName))
                {
                    column.Item()
                        .Text(
                            LimitText(
                                address.CompanyName,
                                55));
                }

                column.Item()
                    .Text(
                        LimitText(
                            address.AddressLine1,
                            65));

                if (!string.IsNullOrWhiteSpace(
                        address.AddressLine2))
                {
                    column.Item()
                        .Text(
                            LimitText(
                                address.AddressLine2,
                                65));
                }

                column.Item()
                    .Text(
                        $"{address.City}, " +
                        $"{address.StateOrProvince} " +
                        address.PostalCode)
                    .SemiBold();

                column.Item()
                    .Text(
                        address.CountryCode
                            .Trim()
                            .ToUpperInvariant());

                if (!string.IsNullOrWhiteSpace(
                        address.PhoneNumber))
                {
                    column.Item()
                        .Text(
                            $"Phone: " +
                            LimitText(
                                address.PhoneNumber,
                                30));
                }
            });
    }

    private static string GetServiceName(
        ShipmentServiceLevel serviceLevel)
    {
        return serviceLevel switch
        {
            ShipmentServiceLevel.Standard =>
                "STANDARD",

            ShipmentServiceLevel.Express =>
                "EXPRESS",

            ShipmentServiceLevel.SameDay =>
                "SAME DAY",

            _ =>
                serviceLevel
                    .ToString()
                    .ToUpperInvariant()
        };
    }

    private static string LimitText(
        string value,
        int maximumLength)
    {
        var cleaned =
            value.Trim();

        if (cleaned.Length <= maximumLength)
        {
            return cleaned;
        }

        return cleaned[..(maximumLength - 1)] + "…";
    }
}