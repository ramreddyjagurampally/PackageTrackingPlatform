using SkiaSharp;
using ZXing;
using ZXing.Common;

namespace PackageTracking.Api.Services;

public sealed class BarcodeService
{
    public byte[] GenerateCode128Png(
        string trackingNumber)
    {
        var value =
            trackingNumber?.Trim().ToUpperInvariant()
            ?? string.Empty;

        if (string.IsNullOrWhiteSpace(value))
        {
            throw new ArgumentException(
                "A tracking number is required.",
                nameof(trackingNumber));
        }

        var writer =
            new ZXing.SkiaSharp.BarcodeWriter
            {
                Format =
                    BarcodeFormat.CODE_128,

                Options =
                    new EncodingOptions
                    {
                        Width = 900,
                        Height = 140,
                        Margin = 10,
                        PureBarcode = true
                    }
            };

        using var bitmap =
            writer.Write(value);

        using var encodedImage =
            bitmap.Encode(
                SKEncodedImageFormat.Png,
                100);

        if (encodedImage is null)
        {
            throw new InvalidOperationException(
                "The tracking barcode could not be generated.");
        }

        return encodedImage.ToArray();
    }
}