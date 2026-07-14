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
  const [trackingError, setTrackingError] = useState("");
  const [isTracking, setIsTracking] = useState(false);

  const [senderName, setSenderName] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [createError, setCreateError] = useState("");
  const [createdTrackingNumber, setCreatedTrackingNumber] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  async function trackShipment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanedTrackingNumber = trackingNumber.trim();

    if (!cleanedTrackingNumber) {
      setTrackingError("Please enter a tracking number.");
      setShipment(null);
      return;
    }

    setIsTracking(true);
    setTrackingError("");
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

      setTrackingError(message);
    } finally {
      setIsTracking(false);
    }
  }

  async function createShipment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (
      !senderName.trim() ||
      !recipientName.trim() ||
      !origin.trim() ||
      !destination.trim()
    ) {
      setCreateError("Please complete every field.");
      return;
    }

    setIsCreating(true);
    setCreateError("");
    setCreatedTrackingNumber("");

    try {
      const response = await fetch(
        "http://localhost:5133/api/shipments",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            senderName: senderName.trim(),
            recipientName: recipientName.trim(),
            origin: origin.trim(),
            destination: destination.trim(),
          }),
        }
      );

      if (!response.ok) {
        throw new Error("The shipment could not be created.");
      }

      const createdShipment: Shipment = await response.json();

      setCreatedTrackingNumber(createdShipment.trackingNumber);
      setTrackingNumber(createdShipment.trackingNumber);

      setSenderName("");
      setRecipientName("");
      setOrigin("");
      setDestination("");
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "An unexpected error occurred.";

      setCreateError(message);
    } finally {
      setIsCreating(false);
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
          Enter your tracking number to view the current status and complete
          delivery history.
        </p>

        <form className="tracking-form" onSubmit={trackShipment}>
          <input
            type="text"
            value={trackingNumber}
            onChange={(event) => setTrackingNumber(event.target.value)}
            placeholder="Example: PTR-2B1B4D89B1"
            aria-label="Tracking number"
          />

          <button type="submit" disabled={isTracking}>
            {isTracking ? "Searching..." : "Track Package"}
          </button>
        </form>

        {trackingError && (
          <p className="error-message">{trackingError}</p>
        )}
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
                  <article
                    className="timeline-item"
                    key={trackingEvent.id}
                  >
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

      <section className="create-section">
        <div className="section-heading">
          <p className="eyebrow">Shipment Management</p>
          <h2>Create a new shipment</h2>
          <p>
            Enter the sender, recipient, origin, and destination information.
          </p>
        </div>

        <form className="create-form" onSubmit={createShipment}>
          <label>
            Sender name
            <input
              type="text"
              value={senderName}
              onChange={(event) => setSenderName(event.target.value)}
              placeholder="Enter sender name"
            />
          </label>

          <label>
            Recipient name
            <input
              type="text"
              value={recipientName}
              onChange={(event) => setRecipientName(event.target.value)}
              placeholder="Enter recipient name"
            />
          </label>

          <label>
            Origin
            <input
              type="text"
              value={origin}
              onChange={(event) => setOrigin(event.target.value)}
              placeholder="Example: Detroit, Michigan"
            />
          </label>

          <label>
            Destination
            <input
              type="text"
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
              placeholder="Example: Chicago, Illinois"
            />
          </label>

          <button type="submit" disabled={isCreating}>
            {isCreating ? "Creating..." : "Create Shipment"}
          </button>
        </form>

        {createError && <p className="error-message">{createError}</p>}

        {createdTrackingNumber && (
          <div className="success-message">
            <strong>Shipment created successfully!</strong>
            <p>Your tracking number is:</p>
            <code>{createdTrackingNumber}</code>
          </div>
        )}
      </section>
    </main>
  );
}

export default App;