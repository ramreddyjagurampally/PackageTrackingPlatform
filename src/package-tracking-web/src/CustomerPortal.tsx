import {
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  FormEvent,
} from "react";

type AuthInformation = {
  token: string;

  user: {
    fullName: string;
    roles: string[];
  };
};

type CustomerPortalProps = {
  auth: AuthInformation | null;
};

type Customer = {
  id: number;
  fullName: string;
  email: string;
  createdAtUtc: string;
};

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

  customerId: number | null;
  customerName?: string | null;
  customerEmail?: string | null;

  trackingHistory?: TrackingEvent[];
};

type ApiError = {
  message?: string;
  errors?: string[];
};

const apiBaseUrl =
  "http://localhost:5133";

const statusNames = [
  "Label Created",
  "Package Received",
  "In Transit",
  "Out for Delivery",
  "Delivered",
  "Arrived at Origin Facility",
  "Departed Origin Facility",
  "Arrived at Destination Facility",
  "Delivery Attempted",
  "Delayed",
  "Damaged",
  "Cancelled",
];

const serviceNames = [
  "Standard",
  "Express",
  "Same Day",
];

function getStatusName(
  status: number
): string {
  return statusNames[status] ??
    "Unknown";
}

function getServiceName(
  serviceLevel: number
): string {
  return serviceNames[serviceLevel] ??
    "Unknown";
}

function getStatusClass(
  status: number
): string {
  switch (status) {
    case 0:
      return "status-created";

    case 1:
    case 5:
      return "status-received";

    case 2:
    case 6:
    case 7:
      return "status-transit";

    case 3:
    case 8:
      return "status-delivery";

    case 4:
      return "status-delivered";

    case 9:
      return "status-delayed";

    case 10:
      return "status-damaged";

    case 11:
      return "status-cancelled";

    default:
      return "";
  }
}

async function readErrorMessage(
  response: Response,
  fallbackMessage: string
): Promise<string> {
  try {
    const data =
      (await response.json()) as ApiError;

    if (
      data.errors &&
      data.errors.length > 0
    ) {
      return `${data.message ??
        fallbackMessage} ${data.errors.join(
        " "
      )}`;
    }

    return data.message ??
      fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}

export default function CustomerPortal({
  auth,
}: CustomerPortalProps) {
  const roles =
    auth?.user.roles ?? [];

  const isAdmin =
    roles.includes("Admin");

  const isEmployee =
    roles.includes("Employee");

  const isCustomer =
    roles.includes("Customer");

  const canManageCustomers =
    isAdmin || isEmployee;

  // Registration
  const [
    registrationName,
    setRegistrationName,
  ] = useState("");

  const [
    registrationEmail,
    setRegistrationEmail,
  ] = useState("");

  const [
    registrationPassword,
    setRegistrationPassword,
  ] = useState("");

  const [
    registrationError,
    setRegistrationError,
  ] = useState("");

  const [
    registrationSuccess,
    setRegistrationSuccess,
  ] = useState("");

  const [
    isRegistering,
    setIsRegistering,
  ] = useState(false);

  // Customer management
  const [
    customers,
    setCustomers,
  ] = useState<Customer[]>([]);

  const [
    customerListError,
    setCustomerListError,
  ] = useState("");

  const [
    isLoadingCustomers,
    setIsLoadingCustomers,
  ] = useState(false);

  const [
    customerTrackingNumber,
    setCustomerTrackingNumber,
  ] = useState("");

  const [
    selectedCustomerId,
    setSelectedCustomerId,
  ] = useState("");

  const [
    assignmentError,
    setAssignmentError,
  ] = useState("");

  const [
    assignmentSuccess,
    setAssignmentSuccess,
  ] = useState("");

  const [
    isSavingAssignment,
    setIsSavingAssignment,
  ] = useState(false);

  // Customer dashboard
  const [
    myShipments,
    setMyShipments,
  ] = useState<Shipment[]>([]);

  const [
    selectedShipment,
    setSelectedShipment,
  ] = useState<Shipment | null>(
    null
  );

  const [
    dashboardError,
    setDashboardError,
  ] = useState("");

  const [
    isLoadingShipments,
    setIsLoadingShipments,
  ] = useState(false);

  const customerStats = useMemo(() => {
    return {
      total: myShipments.length,

      active: myShipments.filter(
        (shipment) =>
          shipment.currentStatus !== 4 &&
          shipment.currentStatus !== 11
      ).length,

      delivered: myShipments.filter(
        (shipment) =>
          shipment.currentStatus === 4
      ).length,

      delayed: myShipments.filter(
        (shipment) =>
          shipment.currentStatus === 9
      ).length,
    };
  }, [myShipments]);

  useEffect(() => {
    if (!auth) {
      setCustomers([]);
      setMyShipments([]);
      setSelectedShipment(null);
      return;
    }

    if (canManageCustomers) {
      void loadCustomers();
    }

    if (
      isCustomer &&
      !canManageCustomers
    ) {
      void loadMyShipments();
    }
  }, [
    auth,
    canManageCustomers,
    isCustomer,
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

  async function registerCustomer(
    event: FormEvent<HTMLFormElement>
  ): Promise<void> {
    event.preventDefault();

    setIsRegistering(true);
    setRegistrationError("");
    setRegistrationSuccess("");

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/customers/register`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            fullName:
              registrationName.trim(),

            email:
              registrationEmail.trim(),

            password:
              registrationPassword,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          await readErrorMessage(
            response,
            "The customer account could not be created."
          )
        );
      }

      setRegistrationSuccess(
        "Customer account created successfully. You can now log in."
      );

      setRegistrationName("");
      setRegistrationEmail("");
      setRegistrationPassword("");
    } catch (error) {
      setRegistrationError(
        error instanceof Error
          ? error.message
          : "The customer account could not be created."
      );
    } finally {
      setIsRegistering(false);
    }
  }

  async function loadCustomers():
    Promise<void> {
    if (!auth?.token) {
      return;
    }

    setIsLoadingCustomers(true);
    setCustomerListError("");

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/customers`,
        {
          headers:
            getAuthorizationHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error(
          await readErrorMessage(
            response,
            "The customer list could not be loaded."
          )
        );
      }

      const data =
        (await response.json()) as Customer[];

      setCustomers(data);
    } catch (error) {
      setCustomerListError(
        error instanceof Error
          ? error.message
          : "The customer list could not be loaded."
      );
    } finally {
      setIsLoadingCustomers(false);
    }
  }

  async function assignCustomer(
    event: FormEvent<HTMLFormElement>
  ): Promise<void> {
    event.preventDefault();

    const cleanedTrackingNumber =
      customerTrackingNumber.trim();

    if (
      !cleanedTrackingNumber ||
      !selectedCustomerId
    ) {
      setAssignmentError(
        "Enter a tracking number and select a customer."
      );

      return;
    }

    setIsSavingAssignment(true);
    setAssignmentError("");
    setAssignmentSuccess("");

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/customers/shipments/${encodeURIComponent(
          cleanedTrackingNumber
        )}/assign`,
        {
          method: "PUT",

          headers: {
            "Content-Type":
              "application/json",

            ...getAuthorizationHeaders(),
          },

          body: JSON.stringify({
            customerId:
              Number(selectedCustomerId),
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          await readErrorMessage(
            response,
            "The customer could not be assigned."
          )
        );
      }

      const selectedCustomer =
        customers.find(
          (customer) =>
            customer.id ===
            Number(selectedCustomerId)
        );

      setAssignmentSuccess(
        selectedCustomer
          ? `${selectedCustomer.fullName} was assigned to ${cleanedTrackingNumber}.`
          : `Customer assigned to ${cleanedTrackingNumber}.`
      );
    } catch (error) {
      setAssignmentError(
        error instanceof Error
          ? error.message
          : "The customer could not be assigned."
      );
    } finally {
      setIsSavingAssignment(false);
    }
  }

  async function removeCustomerAssignment():
    Promise<void> {
    const cleanedTrackingNumber =
      customerTrackingNumber.trim();

    if (!cleanedTrackingNumber) {
      setAssignmentError(
        "Enter a tracking number."
      );

      return;
    }

    setIsSavingAssignment(true);
    setAssignmentError("");
    setAssignmentSuccess("");

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/customers/shipments/${encodeURIComponent(
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
            "The customer assignment could not be removed."
          )
        );
      }

      setAssignmentSuccess(
        `Customer assignment removed from ${cleanedTrackingNumber}.`
      );
    } catch (error) {
      setAssignmentError(
        error instanceof Error
          ? error.message
          : "The customer assignment could not be removed."
      );
    } finally {
      setIsSavingAssignment(false);
    }
  }

  async function loadMyShipments():
    Promise<void> {
    if (!auth?.token) {
      return;
    }

    setIsLoadingShipments(true);
    setDashboardError("");

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/customers/my-shipments`,
        {
          headers:
            getAuthorizationHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error(
          await readErrorMessage(
            response,
            "Your shipments could not be loaded."
          )
        );
      }

      const data =
        (await response.json()) as Shipment[];

      setMyShipments(data);
    } catch (error) {
      setDashboardError(
        error instanceof Error
          ? error.message
          : "Your shipments could not be loaded."
      );
    } finally {
      setIsLoadingShipments(false);
    }
  }

  async function openShipmentDetails(
    trackingNumber: string
  ): Promise<void> {
    setDashboardError("");

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/shipments/${encodeURIComponent(
          trackingNumber
        )}`
      );

      if (!response.ok) {
        throw new Error(
          await readErrorMessage(
            response,
            "The shipment details could not be loaded."
          )
        );
      }

      const data =
        (await response.json()) as Shipment;

      setSelectedShipment(data);

      window.scrollTo({
        top:
          document.body.scrollHeight,

        behavior: "smooth",
      });
    } catch (error) {
      setDashboardError(
        error instanceof Error
          ? error.message
          : "The shipment details could not be loaded."
      );
    }
  }

  return (
    <>
      {!auth && (
        <section className="management-section">
          <div className="section-heading">
            <p className="eyebrow">
              New Customer
            </p>

            <h2>
              Create a customer account
            </h2>

            <p>
              Register to see shipments
              connected to your account.
            </p>
          </div>

          <form
            className="form-grid"
            onSubmit={registerCustomer}
          >
            <label>
              Full name

              <input
                type="text"
                value={registrationName}
                onChange={(event) =>
                  setRegistrationName(
                    event.target.value
                  )
                }
                required
              />
            </label>

            <label>
              Email

              <input
                type="email"
                value={registrationEmail}
                onChange={(event) =>
                  setRegistrationEmail(
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
                value={
                  registrationPassword
                }
                onChange={(event) =>
                  setRegistrationPassword(
                    event.target.value
                  )
                }
                minLength={8}
                required
              />
            </label>

            <button
              type="submit"
              disabled={isRegistering}
            >
              {isRegistering
                ? "Creating account..."
                : "Create Customer Account"}
            </button>
          </form>

          {registrationError && (
            <p className="error-message">
              {registrationError}
            </p>
          )}

          {registrationSuccess && (
            <div className="success-message">
              <strong>
                {registrationSuccess}
              </strong>
            </div>
          )}
        </section>
      )}

      {auth &&
        canManageCustomers && (
          <div className="management-grid">
            <section className="management-section">
              <div className="section-heading">
                <p className="eyebrow">
                  Customer Assignment
                </p>

                <h2>
                  Connect a customer to a
                  shipment
                </h2>
              </div>

              <form
                className="form-grid"
                onSubmit={assignCustomer}
              >
                <label>
                  Tracking number

                  <input
                    type="text"
                    value={
                      customerTrackingNumber
                    }
                    onChange={(event) =>
                      setCustomerTrackingNumber(
                        event.target.value
                      )
                    }
                    placeholder="PTR-..."
                    required
                  />
                </label>

                <label>
                  Customer

                  <select
                    value={
                      selectedCustomerId
                    }
                    onChange={(event) =>
                      setSelectedCustomerId(
                        event.target.value
                      )
                    }
                    required
                  >
                    <option value="">
                      Select a customer
                    </option>

                    {customers.map(
                      (customer) => (
                        <option
                          key={customer.id}
                          value={customer.id}
                        >
                          {customer.fullName}
                          {" — "}
                          {customer.email}
                        </option>
                      )
                    )}
                  </select>
                </label>

                <button
                  type="submit"
                  disabled={
                    isSavingAssignment
                  }
                >
                  {isSavingAssignment
                    ? "Saving..."
                    : "Assign Customer"}
                </button>

                <button
                  type="button"
                  className="secondary-button"
                  disabled={
                    isSavingAssignment
                  }
                  onClick={() =>
                    void removeCustomerAssignment()
                  }
                >
                  Remove Customer Assignment
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
              <div className="dashboard-heading">
                <div className="section-heading">
                  <p className="eyebrow">
                    Customer Directory
                  </p>

                  <h2>
                    Registered customers
                  </h2>
                </div>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    void loadCustomers()
                  }
                  disabled={
                    isLoadingCustomers
                  }
                >
                  {isLoadingCustomers
                    ? "Refreshing..."
                    : "Refresh"}
                </button>
              </div>

              {customerListError && (
                <p className="error-message">
                  {customerListError}
                </p>
              )}

              <div className="table-wrap">
                <table className="shipment-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Created</th>
                    </tr>
                  </thead>

                  <tbody>
                    {customers.length ===
                    0 ? (
                      <tr>
                        <td
                          colSpan={3}
                          className="empty-table"
                        >
                          No customer accounts
                          were found.
                        </td>
                      </tr>
                    ) : (
                      customers.map(
                        (customer) => (
                          <tr
                            key={
                              customer.id
                            }
                          >
                            <td>
                              <strong>
                                {
                                  customer.fullName
                                }
                              </strong>
                            </td>

                            <td>
                              {
                                customer.email
                              }
                            </td>

                            <td>
                              {new Date(
                                customer.createdAtUtc
                              ).toLocaleDateString()}
                            </td>
                          </tr>
                        )
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

      {auth &&
        isCustomer &&
        !canManageCustomers && (
          <section className="dashboard-section">
            <div className="dashboard-heading">
              <div>
                <p className="eyebrow">
                  Customer Dashboard
                </p>

                <h2>
                  Welcome,{" "}
                  {auth.user.fullName}
                </h2>

                <p>
                  View shipments connected
                  to your customer account.
                </p>
              </div>

              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  void loadMyShipments()
                }
                disabled={
                  isLoadingShipments
                }
              >
                {isLoadingShipments
                  ? "Refreshing..."
                  : "Refresh"}
              </button>
            </div>

            <div className="stats-grid">
              <article className="stat-card">
                <span>
                  Total shipments
                </span>

                <strong>
                  {customerStats.total}
                </strong>
              </article>

              <article className="stat-card">
                <span>
                  Active shipments
                </span>

                <strong>
                  {customerStats.active}
                </strong>
              </article>

              <article className="stat-card">
                <span>Delivered</span>

                <strong>
                  {customerStats.delivered}
                </strong>
              </article>

              <article className="stat-card">
                <span>Delayed</span>

                <strong>
                  {customerStats.delayed}
                </strong>
              </article>
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
                    <th>Route</th>
                    <th>Status</th>
                    <th>
                      Estimated delivery
                    </th>
                    <th>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {myShipments.length ===
                  0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="empty-table"
                      >
                        No shipments are
                        connected to your
                        account yet.
                      </td>
                    </tr>
                  ) : (
                    myShipments.map(
                      (shipment) => (
                        <tr
                          key={shipment.id}
                        >
                          <td>
                            <strong>
                              {
                                shipment.trackingNumber
                              }
                            </strong>
                          </td>

                          <td>
                            <div>
                              {
                                shipment.origin
                              }
                            </div>

                            <small>
                              To{" "}
                              {
                                shipment.destination
                              }
                            </small>
                          </td>

                          <td>
                            <span
                              className={`table-status ${getStatusClass(
                                shipment.currentStatus
                              )}`}
                            >
                              {getStatusName(
                                shipment.currentStatus
                              )}
                            </span>
                          </td>

                          <td>
                            {shipment.estimatedDeliveryDateUtc
                              ? new Date(
                                  shipment.estimatedDeliveryDateUtc
                                ).toLocaleString()
                              : "Not available"}
                          </td>

                          <td>
                            <button
                              type="button"
                              className="table-button"
                              onClick={() =>
                                void openShipmentDetails(
                                  shipment.trackingNumber
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

      {auth &&
        isCustomer &&
        !canManageCustomers &&
        selectedShipment && (
          <section className="shipment-card">
            <div className="shipment-heading">
              <div>
                <p className="label">
                  Tracking number
                </p>

                <h2>
                  {
                    selectedShipment.trackingNumber
                  }
                </h2>
              </div>

              <span
                className={`status-badge ${getStatusClass(
                  selectedShipment.currentStatus
                )}`}
              >
                {getStatusName(
                  selectedShipment.currentStatus
                )}
              </span>
            </div>

            <div className="shipment-grid">
              <div>
                <p className="label">
                  Sender
                </p>

                <p>
                  {
                    selectedShipment.senderName
                  }
                </p>
              </div>

              <div>
                <p className="label">
                  Recipient
                </p>

                <p>
                  {
                    selectedShipment.recipientName
                  }
                </p>
              </div>

              <div>
                <p className="label">
                  Origin
                </p>

                <p>
                  {selectedShipment.origin}
                </p>
              </div>

              <div>
                <p className="label">
                  Destination
                </p>

                <p>
                  {
                    selectedShipment.destination
                  }
                </p>
              </div>

              <div>
                <p className="label">
                  Service
                </p>

                <p>
                  {getServiceName(
                    selectedShipment.serviceLevel
                  )}
                </p>
              </div>

              <div>
                <p className="label">
                  Package
                </p>

                <p>
                  {
                    selectedShipment.weightKg
                  }{" "}
                  kg —{" "}
                  {
                    selectedShipment.lengthCm
                  }{" "}
                  ×{" "}
                  {
                    selectedShipment.widthCm
                  }{" "}
                  ×{" "}
                  {
                    selectedShipment.heightCm
                  }{" "}
                  cm
                </p>
              </div>

              <div>
                <p className="label">
                  Estimated delivery
                </p>

                <p>
                  {selectedShipment.estimatedDeliveryDateUtc
                    ? new Date(
                        selectedShipment.estimatedDeliveryDateUtc
                      ).toLocaleString()
                    : "Not available"}
                </p>
              </div>

              <div>
                <p className="label">
                  Delivery instructions
                </p>

                <p>
                  {selectedShipment.deliveryInstructions ||
                    "No special instructions"}
                </p>
              </div>
            </div>

            <div className="history-section">
              <h3>
                Tracking history
              </h3>

              {!selectedShipment.trackingHistory ||
              selectedShipment
                .trackingHistory.length ===
                0 ? (
                <p>
                  No tracking events are
                  available.
                </p>
              ) : (
                <div className="timeline">
                  {selectedShipment.trackingHistory.map(
                    (trackingEvent) => (
                      <article
                        className="timeline-item"
                        key={
                          trackingEvent.id
                        }
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
    </>
  );
}