namespace PackageTracking.Api.Models;

public enum ShipmentStatus
{
    // Keep the original numeric values unchanged.
    Created = 0,
    PackageReceived = 1,
    InTransit = 2,
    OutForDelivery = 3,
    Delivered = 4,

    // New detailed tracking statuses.
    ArrivedAtOriginFacility = 5,
    DepartedOriginFacility = 6,
    ArrivedAtDestinationFacility = 7,
    DeliveryAttempted = 8,
    Delayed = 9,
    Damaged = 10,
    Cancelled = 11
}