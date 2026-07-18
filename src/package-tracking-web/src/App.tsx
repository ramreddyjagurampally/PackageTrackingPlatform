import { useState } from "react";
import type { FormEvent } from "react";
import "./App.css";

type TrackingEvent = {
  id: number;
  shipmentId: number;
  status: number;
  location: string;
  description: string;
  occurredAtUtc: string;
};

type Shipment = {
  id: number;
  trackingNumber: string;
  senderName: string;
  recipientName: string;
  origin: string;
  destination: string;
  currentStatus: number;
  createdAtUtc: string;
  trackingHistory: TrackingEvent[];
};

type AuthUser = {
  id: number;
  fullName: string;
  email: string;
  roles: string[];
};

type AuthResponse = {
  token: string;
  expiresAtUtc: string;
  user: AuthUser;
};

type ApiError = {
  message?: string;
};

const apiBaseUrl = "http://localhost:5133";

const statusNames = [
  "Created",
  "Package Received",
  "In Transit",
  "Out for Delivery",
  "Delivered",
];

function readSavedAuth(): AuthResponse | null {
  const savedAuth = localStorage.getItem("packageTrackingAuth");

  if (!savedAuth) {
    return null;
  }

  try {
    return JSON.parse(savedAuth) as AuthResponse;
  } catch {
    localStorage.removeItem("packageTrackingAuth");
    return null;
  }
}

async function readErrorMessage(
  response: Response,
  fallbackMessage: string
) {
  try {
    const errorData = (await response.json()) as ApiError;
    return errorData.message || fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}

function App() {
  const [auth, setAuth] = useState<AuthResponse | null>(
    readSavedAuth
  );

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [trackingNumber, setTrackingNumber] = useState("");
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [trackingError, setTrackingError] = useState("");
  const [isTracking, setIsTracking] = useState(false);

  const [senderName, setSenderName] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [createError, setCreateError] = useState("");
  const [createdTrackingNumber, setCreatedTrackingNumber] =
    useState("");
  const [isCreating, setIsCreating] = useState(false);

  const [updateTrackingNumber, setUpdateTrackingNumber] =
    useState("");
  const [newStatus, setNewStatus] = useState("1");
  const [updateLocation, setUpdateLocation] = useState("");
  const [updateDescription, setUpdateDescription] = useState("");
  const [updateError, setUpdateError] = useState("");
  const [updateSuccess, setUpdateSuccess] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const canManageShipments =
    auth?.user.roles.some(
      (role) => role === "Admin" || role === "Employee"
    ) ?? false;

  function getStatusName(status: number) {
    return statusNames[status] ?? "Unknown";
  }

  function getAuthorizationHeaders() {
    if (!auth?.token) {
      return {};
    }

    return {
      Authorization: `Bearer ${auth.token}`,
    };
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!loginEmail.trim() || !loginPassword) {
      setLoginError("Please enter your email and password.");
      return;
    }

    setIsLoggingIn(true);
    setLoginError("");

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/auth/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: loginEmail.trim(),
            password: loginPassword,
          }),
        }
      );

      if (!response.ok) {
        const message = await readErrorMessage(
          response,
          "Login failed."
        );

        throw new Error(message);
      }

      const loginResponse =
        (await response.json()) as AuthResponse;

      localStorage.setItem(
        "packageTrackingAuth",
        JSON.stringify(loginResponse)
      );

      setAuth(loginResponse);
      setLoginPassword("");
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "An unexpected login error occurred.";

      setLoginError(message);
    } finally {
      setIsLoggingIn(false);
    }
  }

  function logout() {
    localStorage.removeItem("packageTrackingAuth");

    setAuth(null);
    setLoginPassword("");
    setCreateError("");
    setUpdateError("");
    setUpdateSuccess("");
  }

  async function loadShipment(
    shipmentTrackingNumber: string
  ): Promise<Shipment> {
    const response = await fetch(
      `${apiBaseUrl}/api/shipments/${encodeURIComponent(
        shipmentTrackingNumber
      )}`
    );

    if (response.status === 404) {
      throw new Error(
        "No shipment was found with that tracking number."
      );
    }

    if (!response.ok) {
      throw new Error("The shipment could not be loaded.");
    }

    return response.json();
  }

  async function trackShipment(
    event: FormEvent<HTMLFormElement>
  ) {
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
      const data = await loadShipment(cleanedTrackingNumber);

      setShipment(data);
      setUpdateTrackingNumber(data.trackingNumber);
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

  async function createShipment(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!canManageShipments) {
      setCreateError(
        "You must be logged in as an employee or administrator."
      );
      return;
    }

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
        `${apiBaseUrl}/api/shipments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAuthorizationHeaders(),
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
        const message = await readErrorMessage(
          response,
          "The shipment could not be created."
        );

        throw new Error(message);
      }

      const createdShipment =
        (await response.json()) as Shipment;

      setCreatedTrackingNumber(
        createdShipment.trackingNumber
      );

      setTrackingNumber(createdShipment.trackingNumber);
      setUpdateTrackingNumber(
        createdShipment.trackingNumber
      );
      setShipment(createdShipment);

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

  async function updateShipmentStatus(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!canManageShipments) {
      setUpdateError(
        "You must be logged in as an employee or administrator."
      );
      return;
    }

    const cleanedTrackingNumber =
      updateTrackingNumber.trim();

    if (
      !cleanedTrackingNumber ||
      !updateLocation.trim() ||
      !updateDescription.trim()
    ) {
      setUpdateError(
        "Please complete the tracking number, location, and description."
      );
      return;
    }

    setIsUpdating(true);
    setUpdateError("");
    setUpdateSuccess("");

    try {
      const statusValue = Number(newStatus);

      const response = await fetch(
        `${apiBaseUrl}/api/shipments/${encodeURIComponent(
          cleanedTrackingNumber
        )}/status`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...getAuthorizationHeaders(),
          },
          body: JSON.stringify({
            status: statusValue,
            location: updateLocation.trim(),
            description: updateDescription.trim(),
          }),
        }
      );

      if (!response.ok) {
        const message = await readErrorMessage(
          response,
          "The shipment status could not be updated."
        );

        throw new Error(message);
      }

      const refreshedShipment = await loadShipment(
        cleanedTrackingNumber
      );

      setShipment(refreshedShipment);
      setTrackingNumber(cleanedTrackingNumber);

      setUpdateSuccess(
        `Shipment updated to ${getStatusName(statusValue)}.`
      );

      setUpdateLocation("");
      setUpdateDescription("");
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "An unexpected error occurred.";

      setUpdateError(message);
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">
          Package Tracking Platform
        </p>

        <h1>Track your shipment</h1>

        <p className="subtitle">
          Enter your tracking number to view the current status
          and complete delivery history.
        </p>

        <form
          className="tracking-form"
          onSubmit={trackShipment}
        >
          <input
            type="text"
            value={trackingNumber}
            onChange={(event) =>
              setTrackingNumber(event.target.value)
            }
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

      <section className="create-section">
        {!auth ? (
          <>
            <div className="section-heading">
              <p className="eyebrow">Account Access</p>
              <h2>Employee and administrator login</h2>
              <p>
                Sign in to create shipments and update tracking
                information.
              </p>
            </div>

            <form className="create-form" onSubmit={login}>
              <label>
                Email
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(event) =>
                    setLoginEmail(event.target.value)
                  }
                  placeholder="Enter your email"
                />
              </label>

              <label>
                Password
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(event) =>
                    setLoginPassword(event.target.value)
                  }
                  placeholder="Enter your application password"
                />
              </label>

              <button
                type="submit"
                disabled={isLoggingIn}
              >
                {isLoggingIn ? "Signing in..." : "Login"}
              </button>
            </form>

            {loginError && (
              <p className="error-message">{loginError}</p>
            )}
          </>
        ) : (
          <div className="success-message">
            <strong>
              Signed in as {auth.user.fullName}
            </strong>

            <p>{auth.user.email}</p>

            <p>
              Roles: {auth.user.roles.join(", ")}
            </p>

            <button type="button" onClick={logout}>
              Logout
            </button>
          </div>
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
                {shipment.trackingHistory.map(
                  (trackingEvent) => (
                    <article
                      className="timeline-item"
                      key={trackingEvent.id}
                    >
                      <div className="timeline-dot" />

                      <div>
                        <div className="timeline-heading">
                          <strong>
                            {getStatusName(
                              trackingEvent.status
                            )}
                          </strong>

                          <time>
                            {new Date(
                              trackingEvent.occurredAtUtc
                            ).toLocaleString()}
                          </time>
                        </div>

                        <p>{trackingEvent.location}</p>
                        <small>
                          {trackingEvent.description}
                        </small>
                      </div>
                    </article>
                  )
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {canManageShipments && (
        <>
          <section className="create-section">
            <div className="section-heading">
              <p className="eyebrow">
                Shipment Management
              </p>

              <h2>Create a new shipment</h2>

              <p>
                Enter the sender, recipient, origin, and
                destination information.
              </p>
            </div>

            <form
              className="create-form"
              onSubmit={createShipment}
            >
              <label>
                Sender name
                <input
                  type="text"
                  value={senderName}
                  onChange={(event) =>
                    setSenderName(event.target.value)
                  }
                  placeholder="Enter sender name"
                />
              </label>

              <label>
                Recipient name
                <input
                  type="text"
                  value={recipientName}
                  onChange={(event) =>
                    setRecipientName(event.target.value)
                  }
                  placeholder="Enter recipient name"
                />
              </label>

              <label>
                Origin
                <input
                  type="text"
                  value={origin}
                  onChange={(event) =>
                    setOrigin(event.target.value)
                  }
                  placeholder="Example: Detroit, Michigan"
                />
              </label>

              <label>
                Destination
                <input
                  type="text"
                  value={destination}
                  onChange={(event) =>
                    setDestination(event.target.value)
                  }
                  placeholder="Example: Chicago, Illinois"
                />
              </label>

              <button
                type="submit"
                disabled={isCreating}
              >
                {isCreating
                  ? "Creating..."
                  : "Create Shipment"}
              </button>
            </form>

            {createError && (
              <p className="error-message">
                {createError}
              </p>
            )}

            {createdTrackingNumber && (
              <div className="success-message">
                <strong>
                  Shipment created successfully!
                </strong>

                <p>Your tracking number is:</p>
                <code>{createdTrackingNumber}</code>
              </div>
            )}
          </section>

          <section className="create-section">
            <div className="section-heading">
              <p className="eyebrow">Employee Tools</p>
              <h2>Update shipment status</h2>

              <p>
                Add the shipment’s new status, current
                location, and tracking description.
              </p>
            </div>

            <form
              className="create-form"
              onSubmit={updateShipmentStatus}
            >
              <label>
                Tracking number
                <input
                  type="text"
                  value={updateTrackingNumber}
                  onChange={(event) =>
                    setUpdateTrackingNumber(
                      event.target.value
                    )
                  }
                  placeholder="PTR-588AA51789"
                />
              </label>

              <label>
                New status
                <select
                  value={newStatus}
                  onChange={(event) =>
                    setNewStatus(event.target.value)
                  }
                >
                  <option value="1">
                    Package Received
                  </option>

                  <option value="2">
                    In Transit
                  </option>

                  <option value="3">
                    Out for Delivery
                  </option>

                  <option value="4">
                    Delivered
                  </option>
                </select>
              </label>

              <label>
                Current location
                <input
                  type="text"
                  value={updateLocation}
                  onChange={(event) =>
                    setUpdateLocation(event.target.value)
                  }
                  placeholder="Example: Toledo, Ohio"
                />
              </label>

              <label>
                Description
                <input
                  type="text"
                  value={updateDescription}
                  onChange={(event) =>
                    setUpdateDescription(
                      event.target.value
                    )
                  }
                  placeholder="Package arrived at the distribution center"
                />
              </label>

              <button
                type="submit"
                disabled={isUpdating}
              >
                {isUpdating
                  ? "Updating..."
                  : "Update Status"}
              </button>
            </form>

            {updateError && (
              <p className="error-message">
                {updateError}
              </p>
            )}

            {updateSuccess && (
              <div className="success-message">
                <strong>{updateSuccess}</strong>
              </div>
            )}
          </section>
        </>
      )}

      {auth && !canManageShipments && (
        <section className="create-section">
          <div className="section-heading">
            <p className="eyebrow">Customer Account</p>
            <h2>Tracking access only</h2>

            <p>
              Your account can track shipments, but it cannot
              create or update them.
            </p>
          </div>
        </section>
      )}
    </main>
  );
}

export default App;