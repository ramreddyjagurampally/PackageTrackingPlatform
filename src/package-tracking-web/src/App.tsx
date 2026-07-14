import { useState } from "react";
import type { FormEvent } from "react";
import "./App.css";

type TrackingEvent = {
  id: string;
  shipmentId: string;
  status: number;
  location: string;
  description: string;
  occurredAtUtc: string;
};

type Shipment = {
  id: string;
  trackingNumber: string;
  senderName: string;
  recipientName: string;
  origin: string;
  destination: string;
  currentStatus: number;
  createdAtUtc: string;
  trackingHistory: TrackingEvent[];
};

const statusNames = [
  "Created",
  "Package Received",
  "In Transit",
  "Out for Delivery",
  "Delivered",
];

function App() {
  const [trackingNumber, setTrackingNumber] = useState("");
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function trackShipment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanedTrackingNumber = trackingNumber.trim();

    if (!cleanedTrackingNumber) {
      setError("Please enter a tracking number.");
      setShipment(null);
      return;
    }

    setIsLoading(true);
    setError("");
    setShipment(null);

    try {
      const response = await fetch(
        `http://localhost:5133/api/shipments/${encodeURIComponent(
          cleanedTrackingNumber
        )}`
      );

      if (response.status === 404) {
        throw new Error("No shipment was found with that tracking number.");
      }

      if (!response.ok) {
        throw new Error("The shipment could not be loaded.");
      }

      const data: Shipment = await response.json();
      setShipment(data);
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "An unexpected error occurred.";

      setError(message);
    } finally {
      setIsLoading(false);
    }
  }

  function getStatusName(status: number) {
    return statusNames[status] ?? "Unknown";
  }

  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">Package Tracking Platform</p>
        <h1>Track your shipment</h1>

        <p className="subtitle">
          Enter your tracking number to view the current status and delivery
          history.
        </p>

        <form className="tracking-form" onSubmit={trackShipment}>
          <input
            type="text"
            value={trackingNumber}
            onChange={(event) => setTrackingNumber(event.target.value)}
            placeholder="Example: PTR-2B1B4D89B1"
            aria-label="Tracking number"
          />

          <button type="submit" disabled={isLoading}>
            {isLoading ? "Searching..." : "Track Package"}
          </button>
        </form>

        {error && <p className="error-message">{error}</p>}
      </section>

      {shipment && (
        <section className="shipment-card">
          <div className="shipment-heading">
            <div>
              <p className="label">Tracking number</p>
              <h2>{shipment.trackingNumber}</h2>
            </div>

            <span className="status-badge">
              {getStatusName(shipment.currentStatus)}
            </span>
          </div>

          <div className="shipment-grid">
            <div>
              <p className="label">Sender</p>
              <p>{shipment.senderName}</p>
            </div>

            <div>
              <p className="label">Recipient</p>
              <p>{shipment.recipientName}</p>
            </div>

            <div>
              <p className="label">Origin</p>
              <p>{shipment.origin}</p>
            </div>

            <div>
              <p className="label">Destination</p>
              <p>{shipment.destination}</p>
            </div>
          </div>

          <div className="history-section">
            <h3>Tracking history</h3>

            {shipment.trackingHistory.length === 0 ? (
              <p>No tracking events are available yet.</p>
            ) : (
              <div className="timeline">
                {shipment.trackingHistory.map((trackingEvent) => (
                  <article className="timeline-item" key={trackingEvent.id}>
                    <div className="timeline-dot" />

                    <div>
                      <div className="timeline-heading">
                        <strong>
                          {getStatusName(trackingEvent.status)}
                        </strong>

                        <time>
                          {new Date(
                            trackingEvent.occurredAtUtc
                          ).toLocaleString()}
                        </time>
                      </div>

                      <p>{trackingEvent.location}</p>
                      <small>{trackingEvent.description}</small>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </main>
  );
}

export default App;