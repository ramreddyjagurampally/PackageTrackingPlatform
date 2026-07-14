# Package Tracking Platform

A package tracking REST API built with ASP.NET Core, Entity Framework Core, and SQL Server.

## Features

- Create new shipments
- Generate unique tracking numbers
- Retrieve all shipments
- Search by tracking number
- Update shipment status
- Store shipment information in SQL Server
- Manage database changes with Entity Framework Core migrations

## Technologies

- C#
- .NET 10
- ASP.NET Core Web API
- Entity Framework Core
- SQL Server
- Git and GitHub

## Shipment Statuses

- Created
- Package Received
- In Transit
- Out for Delivery
- Delivered

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/shipments` | Create a shipment |
| GET | `/api/shipments` | Retrieve all shipments |
| GET | `/api/shipments/{trackingNumber}` | Find a shipment |
| PUT | `/api/shipments/{trackingNumber}/status` | Update shipment status |

## Run Locally

Update the SQL Server connection string in:

`src/PackageTracking.Api/appsettings.json`

Apply the database migration:

```bash
dotnet ef database update --project src/PackageTracking.Api