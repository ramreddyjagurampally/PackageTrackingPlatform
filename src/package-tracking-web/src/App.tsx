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

  assignedDriverId: number | null;
  assignedDriverName?: string | null;

  trackingHistory?: TrackingEvent[];
};

type Driver = {
  id: number;
  fullName: string;
  email: string;
  createdAtUtc: string;
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
  const savedAuth =
    localStorage.getItem("packageTrackingAuth");

  if (!savedAuth) {
    return null;
  }

  try {
    const parsed =
      JSON.parse(savedAuth) as AuthResponse;

    if (
      parsed.expiresAtUtc &&
      new Date(parsed.expiresAtUtc) <=
        new Date()
    ) {
      localStorage.removeItem(
        "packageTrackingAuth"
      );

      return null;
    }

    return parsed;
  } catch {
    localStorage.removeItem(
      "packageTrackingAuth"
    );

    return null;
  }
}

async function readErrorMessage(
  response: Response,
  fallbackMessage: string
): Promise<string> {
  try {
    const data =
      (await response.json()) as ApiError;

    return data.message || fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}

function App() {
  const [auth, setAuth] =
    useState<AuthResponse | null>(
      readSavedAuth
    );

  const [loginEmail, setLoginEmail] =
    useState("");

  const [loginPassword, setLoginPassword] =
    useState("");

  const [loginError, setLoginError] =
    useState("");

  const [isLoggingIn, setIsLoggingIn] =
    useState(false);

  const [trackingNumber, setTrackingNumber] =
    useState("");

  const [shipment, setShipment] =
    useState<Shipment | null>(null);

  const [trackingError, setTrackingError] =
    useState("");

  const [isTracking, setIsTracking] =
    useState(false);

  const [shipments, setShipments] =
    useState<Shipment[]>([]);

  const [drivers, setDrivers] =
    useState<Driver[]>([]);

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

  // Create driver
  const [driverName, setDriverName] =
    useState("");

  const [driverEmail, setDriverEmail] =
    useState("");

  const [driverPassword, setDriverPassword] =
    useState("");

  const [driverError, setDriverError] =
    useState("");

  const [driverSuccess, setDriverSuccess] =
    useState("");

  const [
    isCreatingDriver,
    setIsCreatingDriver,
  ] = useState(false);

  // Driver assignment
  const [
    assignmentTrackingNumber,
    setAssignmentTrackingNumber,
  ] = useState("");

  const [
    selectedDriverId,
    setSelectedDriverId,
  ] = useState("");

  const [
    assignmentError,
    setAssignmentError,
  ] = useState("");

  const [
    assignmentSuccess,
    setAssignmentSuccess,
  ] = useState("");

  const [isAssigning, setIsAssigning] =
    useState(false);

  // Create shipment
  const [senderName, setSenderName] =
    useState("");

  const [recipientName, setRecipientName] =
    useState("");

  const [origin, setOrigin] =
    useState("");

  const [destination, setDestination] =
    useState("");

  const [weightKg, setWeightKg] =
    useState("1");

  const [lengthCm, setLengthCm] =
    useState("20");

  const [widthCm, setWidthCm] =
    useState("15");

  const [heightCm, setHeightCm] =
    useState("10");

  const [serviceLevel, setServiceLevel] =
    useState("0");

  const [
    deliveryInstructions,
    setDeliveryInstructions,
  ] = useState("");

  const [createError, setCreateError] =
    useState("");

  const [
    createdTrackingNumber,
    setCreatedTrackingNumber,
  ] = useState("");

  const [isCreating, setIsCreating] =
    useState(false);

  // Status update
  const [
    updateTrackingNumber,
    setUpdateTrackingNumber,
  ] = useState("");

  const [newStatus, setNewStatus] =
    useState("1");

  const [
    updateLocation,
    setUpdateLocation,
  ] = useState("");

  const [
    updateDescription,
    setUpdateDescription,
  ] = useState("");

  const [updateError, setUpdateError] =
    useState("");

  const [updateSuccess, setUpdateSuccess] =
    useState("");

  const [isUpdating, setIsUpdating] =
    useState(false);

  const roles =
    auth?.user.roles ?? [];

  const isAdmin =
    roles.includes("Admin");

  const isEmployee =
    roles.includes("Employee");

  const isDriver =
    roles.includes("Driver");

  const canManageShipments =
    isAdmin || isEmployee;

  const canUpdateShipment =
    canManageShipments || isDriver;

  const dashboardStats = useMemo(() => {
    return {
      total: shipments.length,

      active: shipments.filter(
        (item) => item.currentStatus !== 4
      ).length,

      created: shipments.filter(
        (item) => item.currentStatus === 0
      ).length,

      inTransit: shipments.filter(
        (item) => item.currentStatus === 2
      ).length,

      outForDelivery: shipments.filter(
        (item) => item.currentStatus === 3
      ).length,

      delivered: shipments.filter(
        (item) => item.currentStatus === 4
      ).length,
    };
  }, [shipments]);

  const filteredShipments = useMemo(() => {
    const searchValue =
      dashboardSearch
        .trim()
        .toLowerCase();

    return shipments.filter((item) => {
      const matchesStatus =
        dashboardStatus === "all" ||
        item.currentStatus ===
          Number(dashboardStatus);

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
          .includes(searchValue) ||
        (
          item.assignedDriverName ?? ""
        )
          .toLowerCase()
          .includes(searchValue);

      return matchesStatus &&
        matchesSearch;
    });
  }, [
    shipments,
    dashboardSearch,
    dashboardStatus,
  ]);

  useEffect(() => {
    if (!auth) {
      setShipments([]);
      setDrivers([]);
      return;
    }

    if (canManageShipments) {
      void loadOperationsData();
      return;
    }

    if (isDriver) {
      void loadDriverShipments();
    }
  }, [
    auth,
    canManageShipments,
    isDriver,
  ]);

  function getAuthorizationHeaders():
    Record<string, string> {
    if (!auth?.token) {
      return {};
    }

    return {
      Authorization:
        `Bearer ${auth.token}`,
    };
  }

  function getStatusName(
    status: number
  ): string {
    return statusNames[status] ??
      "Unknown";
  }

  function getServiceName(
    serviceLevelValue: number
  ): string {
    return (
      serviceNames[
        serviceLevelValue
      ] ?? "Unknown"
    );
  }

  function getStatusClass(
    status: number
  ): string {
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

  function selectShipmentForWork(
    selectedShipment: Shipment
  ): void {
    setTrackingNumber(
      selectedShipment.trackingNumber
    );

    setUpdateTrackingNumber(
      selectedShipment.trackingNumber
    );

    setAssignmentTrackingNumber(
      selectedShipment.trackingNumber
    );

    if (
      selectedShipment.currentStatus < 4
    ) {
      setNewStatus(
        String(
          selectedShipment.currentStatus +
            1
        )
      );
    }
  }

  async function login(
    event: FormEvent<HTMLFormElement>
  ): Promise<void> {
    event.preventDefault();

    if (
      !loginEmail.trim() ||
      !loginPassword
    ) {
      setLoginError(
        "Enter your email and password."
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
            "Content-Type":
              "application/json",
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
    } catch (error) {
      setLoginError(
        error instanceof Error
          ? error.message
          : "Login failed."
      );
    } finally {
      setIsLoggingIn(false);
    }
  }

  function logout(): void {
    localStorage.removeItem(
      "packageTrackingAuth"
    );

    setAuth(null);
    setShipment(null);
    setShipments([]);
    setDrivers([]);

    setDriverSuccess("");
    setAssignmentSuccess("");
    setUpdateSuccess("");
  }

  async function loadShipment(
    selectedTrackingNumber: string
  ): Promise<Shipment> {
    const response = await fetch(
      `${apiBaseUrl}/api/shipments/${encodeURIComponent(
        selectedTrackingNumber
      )}`
    );

    if (!response.ok) {
      throw new Error(
        await readErrorMessage(
          response,
          response.status === 404
            ? "Shipment not found."
            : "The shipment could not be loaded."
        )
      );
    }

    return (
      (await response.json()) as Shipment
    );
  }

  async function trackShipment(
    event: FormEvent<HTMLFormElement>
  ): Promise<void> {
    event.preventDefault();

    const cleanedTrackingNumber =
      trackingNumber.trim();

    if (!cleanedTrackingNumber) {
      setTrackingError(
        "Enter a tracking number."
      );

      return;
    }

    setIsTracking(true);
    setTrackingError("");

    try {
      const data =
        await loadShipment(
          cleanedTrackingNumber
        );

      setShipment(data);
      selectShipmentForWork(data);
    } catch (error) {
      setShipment(null);

      setTrackingError(
        error instanceof Error
          ? error.message
          : "The shipment could not be loaded."
      );
    } finally {
      setIsTracking(false);
    }
  }

  async function loadOperationsData():
    Promise<void> {
    if (!auth?.token) {
      return;
    }

    setIsLoadingDashboard(true);
    setDashboardError("");

    try {
      const [
        shipmentResponse,
        driverResponse,
      ] = await Promise.all([
        fetch(
          `${apiBaseUrl}/api/shipments`,
          {
            headers:
              getAuthorizationHeaders(),
          }
        ),

        fetch(
          `${apiBaseUrl}/api/drivers`,
          {
            headers:
              getAuthorizationHeaders(),
          }
        ),
      ]);

      if (!shipmentResponse.ok) {
        throw new Error(
          await readErrorMessage(
            shipmentResponse,
            "The shipment dashboard could not be loaded."
          )
        );
      }

      if (!driverResponse.ok) {
        throw new Error(
          await readErrorMessage(
            driverResponse,
            "The driver list could not be loaded."
          )
        );
      }

      const shipmentData =
        (await shipmentResponse.json()) as Shipment[];

      const driverData =
        (await driverResponse.json()) as Driver[];

      setShipments(shipmentData);
      setDrivers(driverData);
    } catch (error) {
      setDashboardError(
        error instanceof Error
          ? error.message
          : "The dashboard could not be loaded."
      );
    } finally {
      setIsLoadingDashboard(false);
    }
  }

  async function loadDriverShipments():
    Promise<void> {
    if (!auth?.token) {
      return;
    }

    setIsLoadingDashboard(true);
    setDashboardError("");

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/drivers/my-shipments`,
        {
          headers:
            getAuthorizationHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error(
          await readErrorMessage(
            response,
            "Your assigned shipments could not be loaded."
          )
        );
      }

      const data =
        (await response.json()) as Shipment[];

      setShipments(data);
    } catch (error) {
      setDashboardError(
        error instanceof Error
          ? error.message
          : "Assigned shipments could not be loaded."
      );
    } finally {
      setIsLoadingDashboard(false);
    }
  }

  async function refreshDashboard():
    Promise<void> {
    if (canManageShipments) {
      await loadOperationsData();
      return;
    }

    if (isDriver) {
      await loadDriverShipments();
    }
  }

  async function openShipment(
    selectedShipment: Shipment
  ): Promise<void> {
    setIsTracking(true);
    setTrackingError("");

    try {
      const completeShipment =
        await loadShipment(
          selectedShipment.trackingNumber
        );

      setShipment({
        ...completeShipment,

        assignedDriverId:
          selectedShipment.assignedDriverId,

        assignedDriverName:
          selectedShipment.assignedDriverName,
      });

      selectShipmentForWork(
        selectedShipment
      );

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } catch (error) {
      setTrackingError(
        error instanceof Error
          ? error.message
          : "The shipment could not be opened."
      );
    } finally {
      setIsTracking(false);
    }
  }

  async function createDriver(
    event: FormEvent<HTMLFormElement>
  ): Promise<void> {
    event.preventDefault();

    setIsCreatingDriver(true);
    setDriverError("");
    setDriverSuccess("");

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/drivers`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            ...getAuthorizationHeaders(),
          },

          body: JSON.stringify({
            fullName: driverName.trim(),
            email: driverEmail.trim(),
            password: driverPassword,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          await readErrorMessage(
            response,
            "The driver account could not be created."
          )
        );
      }

      setDriverSuccess(
        "Driver account created successfully."
      );

      setDriverName("");
      setDriverEmail("");
      setDriverPassword("");

      await loadOperationsData();
    } catch (error) {
      setDriverError(
        error instanceof Error
          ? error.message
          : "The driver account could not be created."
      );
    } finally {
      setIsCreatingDriver(false);
    }
  }

  async function assignDriver(
    event: FormEvent<HTMLFormElement>
  ): Promise<void> {
    event.preventDefault();

    if (
      !assignmentTrackingNumber.trim() ||
      !selectedDriverId
    ) {
      setAssignmentError(
        "Select a shipment and a driver."
      );

      return;
    }

    setIsAssigning(true);
    setAssignmentError("");
    setAssignmentSuccess("");

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/drivers/shipments/${encodeURIComponent(
          assignmentTrackingNumber.trim()
        )}/assign`,
        {
          method: "PUT",

          headers: {
            "Content-Type":
              "application/json",

            ...getAuthorizationHeaders(),
          },

          body: JSON.stringify({
            driverId:
              Number(selectedDriverId),
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          await readErrorMessage(
            response,
            "The shipment could not be assigned."
          )
        );
      }

      setAssignmentSuccess(
        "Shipment assigned successfully."
      );

      await loadOperationsData();
    } catch (error) {
      setAssignmentError(
        error instanceof Error
          ? error.message
          : "The shipment could not be assigned."
      );
    } finally {
      setIsAssigning(false);
    }
  }

  async function removeAssignment():
    Promise<void> {
    const cleanedTrackingNumber =
      assignmentTrackingNumber.trim();

    if (!cleanedTrackingNumber) {
      setAssignmentError(
        "Enter or select a tracking number."
      );

      return;
    }

    setIsAssigning(true);
    setAssignmentError("");
    setAssignmentSuccess("");

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/drivers/shipments/${encodeURIComponent(
          cleanedTrackingNumber
        )}/assignment`,
        {
          method: "DELETE",
          headers:
            getAuthorizationHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error(
          await readErrorMessage(
            response,
            "The assignment could not be removed."
          )
        );
      }

      setAssignmentSuccess(
        "Driver assignment removed."
      );

      await loadOperationsData();
    } catch (error) {
      setAssignmentError(
        error instanceof Error
          ? error.message
          : "The assignment could not be removed."
      );
    } finally {
      setIsAssigning(false);
    }
  }

  async function createShipment(
    event: FormEvent<HTMLFormElement>
  ): Promise<void> {
    event.preventDefault();

    setIsCreating(true);
    setCreateError("");
    setCreatedTrackingNumber("");

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/shipments`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            ...getAuthorizationHeaders(),
          },

          body: JSON.stringify({
            senderName:
              senderName.trim(),

            recipientName:
              recipientName.trim(),

            origin:
              origin.trim(),

            destination:
              destination.trim(),

            weightKg:
              Number(weightKg),

            lengthCm:
              Number(lengthCm),

            widthCm:
              Number(widthCm),

            heightCm:
              Number(heightCm),

            serviceLevel:
              Number(serviceLevel),

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

      setShipment(createdShipment);

      setCreatedTrackingNumber(
        createdShipment.trackingNumber
      );

      selectShipmentForWork(
        createdShipment
      );

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

      await loadOperationsData();
    } catch (error) {
      setCreateError(
        error instanceof Error
          ? error.message
          : "The shipment could not be created."
      );
    } finally {
      setIsCreating(false);
    }
  }

  async function updateShipmentStatus(
    event: FormEvent<HTMLFormElement>
  ): Promise<void> {
    event.preventDefault();

    setIsUpdating(true);
    setUpdateError("");
    setUpdateSuccess("");

    try {
      const cleanedTrackingNumber =
        updateTrackingNumber.trim();

      const response = await fetch(
        `${apiBaseUrl}/api/shipments/${encodeURIComponent(
          cleanedTrackingNumber
        )}/status`,
        {
          method: "PUT",

          headers: {
            "Content-Type":
              "application/json",

            ...getAuthorizationHeaders(),
          },

          body: JSON.stringify({
            status:
              Number(newStatus),

            location:
              updateLocation.trim(),

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
        await loadShipment(
          cleanedTrackingNumber
        );

      setShipment(
        refreshedShipment
      );

      setUpdateSuccess(
        `Shipment updated to ${getStatusName(
          Number(newStatus)
        )}.`
      );

      if (
        refreshedShipment.currentStatus < 4
      ) {
        setNewStatus(
          String(
            refreshedShipment.currentStatus +
              1
          )
        );
      }

      setUpdateLocation("");
      setUpdateDescription("");

      await refreshDashboard();
    } catch (error) {
      setUpdateError(
        error instanceof Error
          ? error.message
          : "The shipment status could not be updated."
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
          Track packages, manage drivers,
          assign deliveries, and update
          shipment progress.
        </p>

        <form
          className="tracking-form"
          onSubmit={trackShipment}
        >
          <input
            type="text"
            value={trackingNumber}
            onChange={(event) =>
              setTrackingNumber(
                event.target.value
              )
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

              <h2>Login</h2>

              <p>
                Administrators, employees,
                and drivers can sign in.
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
                  required
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
                  required
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
                Signed in as{" "}
                {auth.user.fullName}
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

      {auth &&
        (canManageShipments ||
          isDriver) && (
          <section className="dashboard-section">
            <div className="dashboard-heading">
              <div>
                <p className="eyebrow">
                  {isDriver &&
                  !canManageShipments
                    ? "Driver Dashboard"
                    : "Operations Dashboard"}
                </p>

                <h2>
                  {isDriver &&
                  !canManageShipments
                    ? "My assigned shipments"
                    : "Shipment overview"}
                </h2>
              </div>

              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  void refreshDashboard()
                }
                disabled={
                  isLoadingDashboard
                }
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
                <span>
                  Out for delivery
                </span>

                <strong>
                  {
                    dashboardStats
                      .outForDelivery
                  }
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
                placeholder="Search shipment, customer, location, or driver"
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
                    <th>Tracking</th>
                    <th>Recipient</th>
                    <th>Route</th>
                    <th>Status</th>

                    {canManageShipments && (
                      <th>Driver</th>
                    )}

                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredShipments.length ===
                  0 ? (
                    <tr>
                      <td
                        colSpan={
                          canManageShipments
                            ? 6
                            : 5
                        }
                        className="empty-table"
                      >
                        No matching shipments
                        were found.
                      </td>
                    </tr>
                  ) : (
                    filteredShipments.map(
                      (item) => (
                        <tr key={item.id}>
                          <td>
                            <strong>
                              {
                                item.trackingNumber
                              }
                            </strong>
                          </td>

                          <td>
                            <div>
                              {
                                item.recipientName
                              }
                            </div>

                            <small>
                              From{" "}
                              {item.senderName}
                            </small>
                          </td>

                          <td>
                            <div>
                              {item.origin}
                            </div>

                            <small>
                              To{" "}
                              {item.destination}
                            </small>
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

                          {canManageShipments && (
                            <td>
                              {item.assignedDriverName ||
                                "Not assigned"}
                            </td>
                          )}

                          <td>
                            <button
                              type="button"
                              className="table-button"
                              onClick={() =>
                                void openShipment(
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
              <p className="label">
                Sender
              </p>

              <p>{shipment.senderName}</p>
            </div>

            <div>
              <p className="label">
                Recipient
              </p>

              <p>
                {shipment.recipientName}
              </p>
            </div>

            <div>
              <p className="label">
                Origin
              </p>

              <p>{shipment.origin}</p>
            </div>

            <div>
              <p className="label">
                Destination
              </p>

              <p>
                {shipment.destination}
              </p>
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
                Package
              </p>

              <p>
                {shipment.weightKg} kg —{" "}
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

            {canManageShipments && (
              <div>
                <p className="label">
                  Assigned driver
                </p>

                <p>
                  {shipment.assignedDriverName ||
                    "Not assigned"}
                </p>
              </div>
            )}

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
                No tracking events are
                available.
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
                          {
                            trackingEvent.location
                          }
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

      {isAdmin && (
        <section className="management-section">
          <div className="section-heading">
            <p className="eyebrow">
              Driver Administration
            </p>

            <h2>
              Create a driver account
            </h2>

            <p>
              Create login credentials for
              a delivery driver.
            </p>
          </div>

          <form
            className="form-grid"
            onSubmit={createDriver}
          >
            <label>
              Driver name

              <input
                type="text"
                value={driverName}
                onChange={(event) =>
                  setDriverName(
                    event.target.value
                  )
                }
                required
              />
            </label>

            <label>
              Driver email

              <input
                type="email"
                value={driverEmail}
                onChange={(event) =>
                  setDriverEmail(
                    event.target.value
                  )
                }
                required
              />
            </label>

            <label>
              Temporary password

              <input
                type="password"
                value={driverPassword}
                onChange={(event) =>
                  setDriverPassword(
                    event.target.value
                  )
                }
                minLength={8}
                required
              />
            </label>

            <button
              type="submit"
              disabled={isCreatingDriver}
            >
              {isCreatingDriver
                ? "Creating..."
                : "Create Driver"}
            </button>
          </form>

          {driverError && (
            <p className="error-message">
              {driverError}
            </p>
          )}

          {driverSuccess && (
            <div className="success-message">
              <strong>
                {driverSuccess}
              </strong>
            </div>
          )}
        </section>
      )}

      {canManageShipments && (
        <div className="management-grid">
          <section className="management-section">
            <div className="section-heading">
              <p className="eyebrow">
                Driver Assignment
              </p>

              <h2>
                Assign a shipment
              </h2>
            </div>

            <form
              className="form-grid"
              onSubmit={assignDriver}
            >
              <label>
                Tracking number

                <input
                  type="text"
                  value={
                    assignmentTrackingNumber
                  }
                  onChange={(event) =>
                    setAssignmentTrackingNumber(
                      event.target.value
                    )
                  }
                  placeholder="PTR-..."
                  required
                />
              </label>

              <label>
                Driver

                <select
                  value={selectedDriverId}
                  onChange={(event) =>
                    setSelectedDriverId(
                      event.target.value
                    )
                  }
                  required
                >
                  <option value="">
                    Select a driver
                  </option>

                  {drivers.map((driver) => (
                    <option
                      key={driver.id}
                      value={driver.id}
                    >
                      {driver.fullName} —{" "}
                      {driver.email}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="submit"
                disabled={isAssigning}
              >
                {isAssigning
                  ? "Saving..."
                  : "Assign Driver"}
              </button>

              <button
                type="button"
                className="secondary-button"
                disabled={isAssigning}
                onClick={() =>
                  void removeAssignment()
                }
              >
                Remove Assignment
              </button>
            </form>

            {assignmentError && (
              <p className="error-message">
                {assignmentError}
              </p>
            )}

            {assignmentSuccess && (
              <div className="success-message">
                <strong>
                  {assignmentSuccess}
                </strong>
              </div>
            )}
          </section>

          <section className="management-section">
            <div className="section-heading">
              <p className="eyebrow">
                Shipment Management
              </p>

              <h2>
                Create a new shipment
              </h2>
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
                  required
                />
              </label>

              <label>
                Origin

                <input
                  type="text"
                  value={origin}
                  onChange={(event) =>
                    setOrigin(
                      event.target.value
                    )
                  }
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
                    Standard
                  </option>

                  <option value="1">
                    Express
                  </option>

                  <option value="2">
                    Same Day
                  </option>
                </select>
              </label>

              <label>
                Delivery instructions

                <input
                  type="text"
                  value={
                    deliveryInstructions
                  }
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
                  Shipment created
                  successfully
                </strong>

                <p>
                  {
                    createdTrackingNumber
                  }
                </p>
              </div>
            )}
          </section>
        </div>
      )}

      {canUpdateShipment && (
        <section className="management-section">
          <div className="section-heading">
            <p className="eyebrow">
              {isDriver &&
              !canManageShipments
                ? "Driver Tools"
                : "Employee Tools"}
            </p>

            <h2>
              Update shipment status
            </h2>
          </div>

          <form
            className="form-grid"
            onSubmit={updateShipmentStatus}
          >
            <label>
              Tracking number

              <input
                type="text"
                value={
                  updateTrackingNumber
                }
                onChange={(event) =>
                  setUpdateTrackingNumber(
                    event.target.value
                  )
                }
                required
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
                required
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
                required
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
              <strong>
                {updateSuccess}
              </strong>
            </div>
          )}
        </section>
      )}
    </main>
  );
}

export default App;