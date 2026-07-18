import { useEffect, useMemo, useState } from "react";
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

  weightKg: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  serviceLevel: number;
  estimatedDeliveryDateUtc: string | null;
  shippingCost: number;
  deliveryInstructions: string;

  trackingHistory?: TrackingEvent[];
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

const serviceNames = [
  "Standard",
  "Express",
  "Same Day",
];

function readSavedAuth(): AuthResponse | null {
  const savedAuth = localStorage.getItem("packageTrackingAuth");

  if (!savedAuth) {
    return null;
  }

  try {
    const parsedAuth = JSON.parse(savedAuth) as AuthResponse;

    if (
      parsedAuth.expiresAtUtc &&
      new Date(parsedAuth.expiresAtUtc) <= new Date()
    ) {
      localStorage.removeItem("packageTrackingAuth");
      return null;
    }

    return parsedAuth;
  } catch {
    localStorage.removeItem("packageTrackingAuth");
    return null;
  }
}

async function readErrorMessage(
  response: Response,
  fallbackMessage: string
): Promise<string> {
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

  const [weightKg, setWeightKg] = useState("1");
  const [lengthCm, setLengthCm] = useState("20");
  const [widthCm, setWidthCm] = useState("15");
  const [heightCm, setHeightCm] = useState("10");
  const [serviceLevel, setServiceLevel] = useState("0");

  const [
    deliveryInstructions,
    setDeliveryInstructions,
  ] = useState("");

  const [createError, setCreateError] = useState("");
  const [
    createdTrackingNumber,
    setCreatedTrackingNumber,
  ] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const [
    updateTrackingNumber,
    setUpdateTrackingNumber,
  ] = useState("");

  const [newStatus, setNewStatus] = useState("1");
  const [updateLocation, setUpdateLocation] = useState("");
  const [
    updateDescription,
    setUpdateDescription,
  ] = useState("");

  const [updateError, setUpdateError] = useState("");
  const [updateSuccess, setUpdateSuccess] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const [
    dashboardShipments,
    setDashboardShipments,
  ] = useState<Shipment[]>([]);

  const [dashboardSearch, setDashboardSearch] =
    useState("");

  const [dashboardStatus, setDashboardStatus] =
    useState("all");

  const [dashboardError, setDashboardError] =
    useState("");

  const [
    isLoadingDashboard,
    setIsLoadingDashboard,
  ] = useState(false);

  const canManageShipments =
    auth?.user.roles.some(
      (role) =>
        role === "Admin" ||
        role === "Employee"
    ) ?? false;

  const dashboardStats = useMemo(() => {
    return {
      total: dashboardShipments.length,

      active: dashboardShipments.filter(
        (item) => item.currentStatus !== 4
      ).length,

      created: dashboardShipments.filter(
        (item) => item.currentStatus === 0
      ).length,

      inTransit: dashboardShipments.filter(
        (item) => item.currentStatus === 2
      ).length,

      outForDelivery: dashboardShipments.filter(
        (item) => item.currentStatus === 3
      ).length,

      delivered: dashboardShipments.filter(
        (item) => item.currentStatus === 4
      ).length,
    };
  }, [dashboardShipments]);

  const filteredDashboardShipments = useMemo(() => {
    const searchValue =
      dashboardSearch.trim().toLowerCase();

    return dashboardShipments.filter((item) => {
      const matchesStatus =
        dashboardStatus === "all" ||
        item.currentStatus === Number(dashboardStatus);

      const matchesSearch =
        !searchValue ||
        item.trackingNumber
          .toLowerCase()
          .includes(searchValue) ||
        item.senderName
          .toLowerCase()
          .includes(searchValue) ||
        item.recipientName
          .toLowerCase()
          .includes(searchValue) ||
        item.origin
          .toLowerCase()
          .includes(searchValue) ||
        item.destination
          .toLowerCase()
          .includes(searchValue);

      return matchesStatus && matchesSearch;
    });
  }, [
    dashboardShipments,
    dashboardSearch,
    dashboardStatus,
  ]);

  useEffect(() => {
    if (auth && canManageShipments) {
      void loadDashboard();
    } else {
      setDashboardShipments([]);
    }
  }, [auth, canManageShipments]);

  function getStatusName(status: number): string {
    return statusNames[status] ?? "Unknown";
  }

  function getServiceName(
    selectedServiceLevel: number
  ): string {
    return (
      serviceNames[selectedServiceLevel] ??
      "Unknown"
    );
  }

  function getStatusClass(status: number): string {
    switch (status) {
      case 0:
        return "status-created";

      case 1:
        return "status-received";

      case 2:
        return "status-transit";

      case 3:
        return "status-delivery";

      case 4:
        return "status-delivered";

      default:
        return "";
    }
  }

  function getAuthorizationHeaders():
    Record<string, string> {
    if (!auth?.token) {
      return {};
    }

    return {
      Authorization: `Bearer ${auth.token}`,
    };
  }

  async function login(
    event: FormEvent<HTMLFormElement>
  ): Promise<void> {
    event.preventDefault();

    if (!loginEmail.trim() || !loginPassword) {
      setLoginError(
        "Please enter your email and password."
      );

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
        throw new Error(
          await readErrorMessage(
            response,
            "Login failed."
          )
        );
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
      setLoginError(
        requestError instanceof Error
          ? requestError.message
          : "An unexpected login error occurred."
      );
    } finally {
      setIsLoggingIn(false);
    }
  }

  function logout(): void {
    localStorage.removeItem("packageTrackingAuth");

    setAuth(null);
    setShipment(null);
    setDashboardShipments([]);
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
      throw new Error(
        await readErrorMessage(
          response,
          "The shipment could not be loaded."
        )
      );
    }

    return (await response.json()) as Shipment;
  }

  async function trackShipment(
    event: FormEvent<HTMLFormElement>
  ): Promise<void> {
    event.preventDefault();

    const cleanedTrackingNumber =
      trackingNumber.trim();

    if (!cleanedTrackingNumber) {
      setTrackingError(
        "Please enter a tracking number."
      );

      setShipment(null);
      return;
    }

    setIsTracking(true);
    setTrackingError("");
    setShipment(null);

    try {
      const data = await loadShipment(
        cleanedTrackingNumber
      );

      setShipment(data);
      setUpdateTrackingNumber(
        data.trackingNumber
      );

      if (data.currentStatus < 4) {
        setNewStatus(
          String(data.currentStatus + 1)
        );
      }
    } catch (requestError) {
      setTrackingError(
        requestError instanceof Error
          ? requestError.message
          : "An unexpected tracking error occurred."
      );
    } finally {
      setIsTracking(false);
    }
  }

  async function loadDashboard(): Promise<void> {
    if (!auth?.token || !canManageShipments) {
      return;
    }

    setIsLoadingDashboard(true);
    setDashboardError("");

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/shipments`,
        {
          headers: {
            ...getAuthorizationHeaders(),
          },
        }
      );

      if (response.status === 401) {
        throw new Error(
          "Your login session expired. Please log in again."
        );
      }

      if (response.status === 403) {
        throw new Error(
          "Your account does not have dashboard access."
        );
      }

      if (!response.ok) {
        throw new Error(
          await readErrorMessage(
            response,
            "The shipment dashboard could not be loaded."
          )
        );
      }

      const data =
        (await response.json()) as Shipment[];

      setDashboardShipments(data);
    } catch (requestError) {
      setDashboardError(
        requestError instanceof Error
          ? requestError.message
          : "An unexpected dashboard error occurred."
      );
    } finally {
      setIsLoadingDashboard(false);
    }
  }

  async function openDashboardShipment(
    selectedShipment: Shipment
  ): Promise<void> {
    setTrackingError("");
    setIsTracking(true);

    try {
      const fullShipment = await loadShipment(
        selectedShipment.trackingNumber
      );

      setShipment(fullShipment);
      setTrackingNumber(
        fullShipment.trackingNumber
      );

      setUpdateTrackingNumber(
        fullShipment.trackingNumber
      );

      if (fullShipment.currentStatus < 4) {
        setNewStatus(
          String(fullShipment.currentStatus + 1)
        );
      }

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } catch (requestError) {
      setTrackingError(
        requestError instanceof Error
          ? requestError.message
          : "The shipment could not be opened."
      );
    } finally {
      setIsTracking(false);
    }
  }

  async function createShipment(
    event: FormEvent<HTMLFormElement>
  ): Promise<void> {
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
      setCreateError(
        "Please complete all sender and destination fields."
      );

      return;
    }

    if (
      Number(weightKg) <= 0 ||
      Number(lengthCm) <= 0 ||
      Number(widthCm) <= 0 ||
      Number(heightCm) <= 0
    ) {
      setCreateError(
        "Weight and dimensions must be greater than zero."
      );

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

            weightKg: Number(weightKg),
            lengthCm: Number(lengthCm),
            widthCm: Number(widthCm),
            heightCm: Number(heightCm),

            serviceLevel: Number(serviceLevel),

            deliveryInstructions:
              deliveryInstructions.trim(),
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          await readErrorMessage(
            response,
            "The shipment could not be created."
          )
        );
      }

      const createdShipment =
        (await response.json()) as Shipment;

      setCreatedTrackingNumber(
        createdShipment.trackingNumber
      );

      setTrackingNumber(
        createdShipment.trackingNumber
      );

      setUpdateTrackingNumber(
        createdShipment.trackingNumber
      );

      setNewStatus("1");
      setShipment(createdShipment);

      setSenderName("");
      setRecipientName("");
      setOrigin("");
      setDestination("");

      setWeightKg("1");
      setLengthCm("20");
      setWidthCm("15");
      setHeightCm("10");

      setServiceLevel("0");
      setDeliveryInstructions("");

      await loadDashboard();
    } catch (requestError) {
      setCreateError(
        requestError instanceof Error
          ? requestError.message
          : "An unexpected shipment error occurred."
      );
    } finally {
      setIsCreating(false);
    }
  }

  async function updateShipmentStatus(
    event: FormEvent<HTMLFormElement>
  ): Promise<void> {
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
            description:
              updateDescription.trim(),
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          await readErrorMessage(
            response,
            "The shipment status could not be updated."
          )
        );
      }

      const refreshedShipment =
        await loadShipment(cleanedTrackingNumber);

      setShipment(refreshedShipment);
      setTrackingNumber(cleanedTrackingNumber);

      setUpdateSuccess(
        `Shipment updated to ${getStatusName(
          statusValue
        )}.`
      );

      if (refreshedShipment.currentStatus < 4) {
        setNewStatus(
          String(
            refreshedShipment.currentStatus + 1
          )
        );
      }

      setUpdateLocation("");
      setUpdateDescription("");

      await loadDashboard();
    } catch (requestError) {
      setUpdateError(
        requestError instanceof Error
          ? requestError.message
          : "An unexpected status error occurred."
      );
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
          Enter a tracking number to view its status,
          package information, estimated delivery, and
          complete history.
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
            placeholder="Example: PTR-A8B1388E99"
          />

          <button
            type="submit"
            disabled={isTracking}
          >
            {isTracking
              ? "Searching..."
              : "Track Package"}
          </button>
        </form>

        {trackingError && (
          <p className="error-message">
            {trackingError}
          </p>
        )}
      </section>

      <section className="account-section">
        {!auth ? (
          <>
            <div className="section-heading">
              <p className="eyebrow">
                Account Access
              </p>

              <h2>
                Employee and administrator login
              </h2>

              <p>
                Sign in to manage shipments and
                view the operations dashboard.
              </p>
            </div>

            <form
              className="form-grid"
              onSubmit={login}
            >
              <label>
                Email

                <input
                  type="email"
                  value={loginEmail}
                  onChange={(event) =>
                    setLoginEmail(
                      event.target.value
                    )
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
                    setLoginPassword(
                      event.target.value
                    )
                  }
                  placeholder="Enter your password"
                />
              </label>

              <button
                type="submit"
                disabled={isLoggingIn}
              >
                {isLoggingIn
                  ? "Signing in..."
                  : "Login"}
              </button>
            </form>

            {loginError && (
              <p className="error-message">
                {loginError}
              </p>
            )}
          </>
        ) : (
          <div className="signed-in-panel">
            <div>
              <strong>
                Signed in as {auth.user.fullName}
              </strong>

              <p>{auth.user.email}</p>

              <p>
                Roles:{" "}
                {auth.user.roles.join(", ")}
              </p>
            </div>

            <button
              type="button"
              onClick={logout}
            >
              Logout
            </button>
          </div>
        )}
      </section>

      {canManageShipments && (
        <section className="dashboard-section">
          <div className="dashboard-heading">
            <div>
              <p className="eyebrow">
                Operations Dashboard
              </p>

              <h2>Shipment overview</h2>

              <p>
                Search, filter, and open every shipment.
              </p>
            </div>

            <button
              type="button"
              className="secondary-button"
              onClick={() => void loadDashboard()}
              disabled={isLoadingDashboard}
            >
              {isLoadingDashboard
                ? "Refreshing..."
                : "Refresh"}
            </button>
          </div>

          <div className="stats-grid">
            <article className="stat-card">
              <span>Total shipments</span>
              <strong>
                {dashboardStats.total}
              </strong>
            </article>

            <article className="stat-card">
              <span>Active</span>
              <strong>
                {dashboardStats.active}
              </strong>
            </article>

            <article className="stat-card">
              <span>Created</span>
              <strong>
                {dashboardStats.created}
              </strong>
            </article>

            <article className="stat-card">
              <span>In transit</span>
              <strong>
                {dashboardStats.inTransit}
              </strong>
            </article>

            <article className="stat-card">
              <span>Out for delivery</span>
              <strong>
                {dashboardStats.outForDelivery}
              </strong>
            </article>

            <article className="stat-card">
              <span>Delivered</span>
              <strong>
                {dashboardStats.delivered}
              </strong>
            </article>
          </div>

          <div className="dashboard-controls">
            <input
              type="search"
              value={dashboardSearch}
              onChange={(event) =>
                setDashboardSearch(
                  event.target.value
                )
              }
              placeholder="Search tracking number, customer, or location"
            />

            <select
              value={dashboardStatus}
              onChange={(event) =>
                setDashboardStatus(
                  event.target.value
                )
              }
            >
              <option value="all">
                All statuses
              </option>

              <option value="0">
                Created
              </option>

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
          </div>

          {dashboardError && (
            <p className="error-message">
              {dashboardError}
            </p>
          )}

          <div className="table-wrap">
            <table className="shipment-table">
              <thead>
                <tr>
                  <th>Tracking number</th>
                  <th>Recipient</th>
                  <th>Route</th>
                  <th>Service</th>
                  <th>Status</th>
                  <th>Cost</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredDashboardShipments.length ===
                0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="empty-table"
                    >
                      No matching shipments were found.
                    </td>
                  </tr>
                ) : (
                  filteredDashboardShipments.map(
                    (item) => (
                      <tr key={item.id}>
                        <td>
                          <strong>
                            {item.trackingNumber}
                          </strong>
                        </td>

                        <td>
                          <div>
                            {item.recipientName}
                          </div>

                          <small>
                            From {item.senderName}
                          </small>
                        </td>

                        <td>
                          <div>{item.origin}</div>

                          <small>
                            To {item.destination}
                          </small>
                        </td>

                        <td>
                          {getServiceName(
                            item.serviceLevel
                          )}
                        </td>

                        <td>
                          <span
                            className={`table-status ${getStatusClass(
                              item.currentStatus
                            )}`}
                          >
                            {getStatusName(
                              item.currentStatus
                            )}
                          </span>
                        </td>

                        <td>
                          $
                          {Number(
                            item.shippingCost || 0
                          ).toFixed(2)}
                        </td>

                        <td>
                          <button
                            type="button"
                            className="table-button"
                            onClick={() =>
                              void openDashboardShipment(
                                item
                              )
                            }
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    )
                  )
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {shipment && (
        <section className="shipment-card">
          <div className="shipment-heading">
            <div>
              <p className="label">
                Tracking number
              </p>

              <h2>
                {shipment.trackingNumber}
              </h2>
            </div>

            <span
              className={`status-badge ${getStatusClass(
                shipment.currentStatus
              )}`}
            >
              {getStatusName(
                shipment.currentStatus
              )}
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
              <p className="label">
                Destination
              </p>

              <p>{shipment.destination}</p>
            </div>

            <div>
              <p className="label">
                Service
              </p>

              <p>
                {getServiceName(
                  shipment.serviceLevel
                )}
              </p>
            </div>

            <div>
              <p className="label">
                Package weight
              </p>

              <p>{shipment.weightKg} kg</p>
            </div>

            <div>
              <p className="label">
                Dimensions
              </p>

              <p>
                {shipment.lengthCm} ×{" "}
                {shipment.widthCm} ×{" "}
                {shipment.heightCm} cm
              </p>
            </div>

            <div>
              <p className="label">
                Shipping cost
              </p>

              <p>
                $
                {Number(
                  shipment.shippingCost || 0
                ).toFixed(2)}
              </p>
            </div>

            <div>
              <p className="label">
                Estimated delivery
              </p>

              <p>
                {shipment.estimatedDeliveryDateUtc
                  ? new Date(
                      shipment.estimatedDeliveryDateUtc
                    ).toLocaleString()
                  : "Not available"}
              </p>
            </div>

            <div>
              <p className="label">
                Delivery instructions
              </p>

              <p>
                {shipment.deliveryInstructions ||
                  "No special instructions"}
              </p>
            </div>
          </div>

          <div className="history-section">
            <h3>Tracking history</h3>

            {!shipment.trackingHistory ||
            shipment.trackingHistory.length ===
              0 ? (
              <p>
                No tracking events are available.
              </p>
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

                        <p>
                          {trackingEvent.location}
                        </p>

                        <small>
                          {
                            trackingEvent.description
                          }
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
        <div className="management-grid">
          <section className="management-section">
            <div className="section-heading">
              <p className="eyebrow">
                Shipment Management
              </p>

              <h2>Create a new shipment</h2>

              <p>
                Enter customer, package, service, and
                delivery information.
              </p>
            </div>

            <form
              className="form-grid"
              onSubmit={createShipment}
            >
              <label>
                Sender name

                <input
                  type="text"
                  value={senderName}
                  onChange={(event) =>
                    setSenderName(
                      event.target.value
                    )
                  }
                  placeholder="Enter sender name"
                  required
                />
              </label>

              <label>
                Recipient name

                <input
                  type="text"
                  value={recipientName}
                  onChange={(event) =>
                    setRecipientName(
                      event.target.value
                    )
                  }
                  placeholder="Enter recipient name"
                  required
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
                  placeholder="Detroit, Michigan"
                  required
                />
              </label>

              <label>
                Destination

                <input
                  type="text"
                  value={destination}
                  onChange={(event) =>
                    setDestination(
                      event.target.value
                    )
                  }
                  placeholder="Cleveland, Ohio"
                  required
                />
              </label>

              <label>
                Weight in kilograms

                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={weightKg}
                  onChange={(event) =>
                    setWeightKg(
                      event.target.value
                    )
                  }
                  required
                />
              </label>

              <label>
                Length in centimeters

                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={lengthCm}
                  onChange={(event) =>
                    setLengthCm(
                      event.target.value
                    )
                  }
                  required
                />
              </label>

              <label>
                Width in centimeters

                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={widthCm}
                  onChange={(event) =>
                    setWidthCm(
                      event.target.value
                    )
                  }
                  required
                />
              </label>

              <label>
                Height in centimeters

                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={heightCm}
                  onChange={(event) =>
                    setHeightCm(
                      event.target.value
                    )
                  }
                  required
                />
              </label>

              <label>
                Service level

                <select
                  value={serviceLevel}
                  onChange={(event) =>
                    setServiceLevel(
                      event.target.value
                    )
                  }
                >
                  <option value="0">
                    Standard — approximately 5 days
                  </option>

                  <option value="1">
                    Express — approximately 2 days
                  </option>

                  <option value="2">
                    Same Day — approximately 8 hours
                  </option>
                </select>
              </label>

              <label>
                Delivery instructions

                <input
                  type="text"
                  value={deliveryInstructions}
                  onChange={(event) =>
                    setDeliveryInstructions(
                      event.target.value
                    )
                  }
                  placeholder="Leave at front door"
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
                  Shipment created successfully
                </strong>

                <p>Your tracking number is:</p>

                <code>
                  {createdTrackingNumber}
                </code>
              </div>
            )}
          </section>

          <section className="management-section">
            <div className="section-heading">
              <p className="eyebrow">
                Employee Tools
              </p>

              <h2>Update shipment status</h2>

              <p>
                Add the next status, location, and
                tracking description.
              </p>
            </div>

            {shipment?.currentStatus === 4 && (
              <div className="success-message">
                <strong>
                  This shipment is delivered.
                </strong>

                <p>
                  Delivered shipments cannot receive
                  more updates.
                </p>
              </div>
            )}

            <form
              className="form-grid"
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
                  placeholder="PTR-A8B1388E99"
                />
              </label>

              <label>
                New status

                <select
                  value={newStatus}
                  onChange={(event) =>
                    setNewStatus(
                      event.target.value
                    )
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
                    setUpdateLocation(
                      event.target.value
                    )
                  }
                  placeholder="Toledo, Ohio"
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
                  placeholder="Package departed the facility"
                />
              </label>

              <button
                type="submit"
                disabled={
                  isUpdating ||
                  shipment?.currentStatus === 4
                }
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
        </div>
      )}
    </main>
  );
}

export default App;