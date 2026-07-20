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

type Address = {
  id?: number;
  contactName: string;
  companyName?: string | null;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  stateOrProvince: string;
  postalCode: string;
  countryCode: string;
  phoneNumber?: string | null;
  email?: string | null;
  isResidential: boolean;
};

type AddressForm = {
  contactName: string;
  companyName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  stateOrProvince: string;
  postalCode: string;
  countryCode: string;
  phoneNumber: string;
  email: string;
  isResidential: boolean;
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
  customerId?: number | null;
  customerName?: string | null;
  customerEmail?: string | null;
  senderAddressId?: number | null;
  senderAddress?: Address | null;
  recipientAddressId?: number | null;
  recipientAddress?: Address | null;
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
  title?: string;
  errors?: Record<string, string[]>;
};

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ??
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

const statusOptions = [
  { value: 0, label: "Label Created" },
  { value: 1, label: "Package Received" },
  { value: 5, label: "Arrived at Origin Facility" },
  { value: 6, label: "Departed Origin Facility" },
  { value: 2, label: "In Transit" },
  { value: 7, label: "Arrived at Destination Facility" },
  { value: 3, label: "Out for Delivery" },
  { value: 8, label: "Delivery Attempted" },
  { value: 4, label: "Delivered" },
  { value: 9, label: "Delayed" },
  { value: 10, label: "Damaged" },
  { value: 11, label: "Cancelled" },
];

const serviceNames = ["Standard", "Express", "Same Day"];

function createEmptyAddress(): AddressForm {
  return {
    contactName: "",
    companyName: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    stateOrProvince: "",
    postalCode: "",
    countryCode: "",
    phoneNumber: "",
    email: "",
    isResidential: true,
  };
}

function readSavedAuth(): AuthResponse | null {
  const savedAuth = localStorage.getItem(
    "packageTrackingAuth"
  );

  if (!savedAuth) {
    return null;
  }

  try {
    const parsedAuth = JSON.parse(
      savedAuth
    ) as AuthResponse;

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

    if (errorData.message) {
      return errorData.message;
    }

    if (errorData.errors) {
      const validationMessages = Object.values(
        errorData.errors
      ).flat();

      if (validationMessages.length > 0) {
        return validationMessages.join(" ");
      }
    }

    return errorData.title || fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}

function normalizeOptionalText(value: string): string | null {
  const cleanedValue = value.trim();
  return cleanedValue ? cleanedValue : null;
}

function normalizeAddress(address: AddressForm) {
  return {
    contactName: address.contactName.trim(),
    companyName: normalizeOptionalText(address.companyName),
    addressLine1: address.addressLine1.trim(),
    addressLine2: normalizeOptionalText(address.addressLine2),
    city: address.city.trim(),
    stateOrProvince: address.stateOrProvince.trim(),
    postalCode: address.postalCode.trim(),
    countryCode: address.countryCode.trim().toUpperCase(),
    phoneNumber: normalizeOptionalText(address.phoneNumber),
    email: normalizeOptionalText(address.email),
    isResidential: address.isResidential,
  };
}

function buildLocationSummary(address: AddressForm): string {
  return [
    address.city.trim(),
    address.stateOrProvince.trim(),
    address.countryCode.trim().toUpperCase(),
  ]
    .filter(Boolean)
    .join(", ");
}

function getAddressSearchText(address?: Address | null): string {
  if (!address) {
    return "";
  }

  return [
    address.contactName,
    address.companyName,
    address.addressLine1,
    address.addressLine2,
    address.city,
    address.stateOrProvince,
    address.postalCode,
    address.countryCode,
    address.phoneNumber,
    address.email,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

type AddressDetailsProps = {
  title: string;
  address?: Address | null;
  fallbackName: string;
  fallbackLocation: string;
  showFullDetails: boolean;
};

function AddressDetails({
  title,
  address,
  fallbackName,
  fallbackLocation,
  showFullDetails,
}: AddressDetailsProps) {
  return (
    <div>
      <p className="label">{title}</p>

      {!address ? (
        <>
          <p>{fallbackName}</p>
          <small>{fallbackLocation}</small>
        </>
      ) : showFullDetails ? (
        <div className="address-details">
          <p>
            <strong>{address.contactName}</strong>
          </p>

          {address.companyName && <p>{address.companyName}</p>}
          <p>{address.addressLine1}</p>
          {address.addressLine2 && <p>{address.addressLine2}</p>}

          <p>
            {address.city}, {address.stateOrProvince}{" "}
            {address.postalCode}
          </p>

          <p>{address.countryCode}</p>

          {address.phoneNumber && <p>{address.phoneNumber}</p>}
          {address.email && <p>{address.email}</p>}

          <small>
            {address.isResidential
              ? "Residential address"
              : "Commercial address"}
          </small>
        </div>
      ) : (
        <>
          <p>{address.contactName}</p>
          <small>
            {address.city}, {address.stateOrProvince},{" "}
            {address.countryCode}
          </small>
        </>
      )}
    </div>
  );
}

function App() {
  const [auth, setAuth] =
    useState<AuthResponse | null>(readSavedAuth);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [trackingNumber, setTrackingNumber] = useState("");
  const [shipment, setShipment] = useState<Shipment | null>(
    null
  );
  const [trackingError, setTrackingError] = useState("");
  const [isTracking, setIsTracking] = useState(false);

  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [dashboardSearch, setDashboardSearch] = useState("");
  const [dashboardStatus, setDashboardStatus] = useState("all");
  const [dashboardError, setDashboardError] = useState("");
  const [isLoadingDashboard, setIsLoadingDashboard] =
    useState(false);

  const [driverName, setDriverName] = useState("");
  const [driverEmail, setDriverEmail] = useState("");
  const [driverPassword, setDriverPassword] = useState("");
  const [driverError, setDriverError] = useState("");
  const [driverSuccess, setDriverSuccess] = useState("");
  const [isCreatingDriver, setIsCreatingDriver] =
    useState(false);

  const [assignmentTrackingNumber, setAssignmentTrackingNumber] =
    useState("");
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [assignmentError, setAssignmentError] = useState("");
  const [assignmentSuccess, setAssignmentSuccess] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);

  const [customerEmail, setCustomerEmail] = useState("");
  const [senderAddress, setSenderAddress] =
    useState<AddressForm>(createEmptyAddress);
  const [recipientAddress, setRecipientAddress] =
    useState<AddressForm>(createEmptyAddress);
  const [weightKg, setWeightKg] = useState("");
  const [lengthCm, setLengthCm] = useState("");
  const [widthCm, setWidthCm] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [serviceLevel, setServiceLevel] = useState("");
  const [deliveryInstructions, setDeliveryInstructions] =
    useState("");
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

  const roles = auth?.user.roles ?? [];
  const isAdmin = roles.includes("Admin");
  const isEmployee = roles.includes("Employee");
  const isDriver = roles.includes("Driver");
  const isCustomer = roles.includes("Customer");
  const canManageShipments = isAdmin || isEmployee;
  const canUpdateShipment = canManageShipments || isDriver;

  const canViewSelectedShipmentFullAddress = Boolean(
    shipment &&
      auth &&
      (canManageShipments ||
        (isDriver && shipment.assignedDriverId === auth.user.id) ||
        (isCustomer && shipment.customerId === auth.user.id))
  );

  const dashboardStats = useMemo(() => {
    return {
      total: shipments.length,
      active: shipments.filter(
        (item) =>
          item.currentStatus !== 4 && item.currentStatus !== 11
      ).length,
      created: shipments.filter(
        (item) => item.currentStatus === 0
      ).length,
      inTransit: shipments.filter((item) =>
        [1, 2, 5, 6, 7, 9].includes(item.currentStatus)
      ).length,
      outForDelivery: shipments.filter((item) =>
        [3, 8].includes(item.currentStatus)
      ).length,
      delivered: shipments.filter(
        (item) => item.currentStatus === 4
      ).length,
    };
  }, [shipments]);

  const filteredShipments = useMemo(() => {
    const searchValue = dashboardSearch.trim().toLowerCase();

    return shipments.filter((item) => {
      const matchesStatus =
        dashboardStatus === "all" ||
        item.currentStatus === Number(dashboardStatus);

      const searchableText = [
        item.trackingNumber,
        item.senderName,
        item.recipientName,
        item.origin,
        item.destination,
        item.assignedDriverName ?? "",
        item.customerName ?? "",
        item.customerEmail ?? "",
        getAddressSearchText(item.senderAddress),
        getAddressSearchText(item.recipientAddress),
      ]
        .join(" ")
        .toLowerCase();

      return (
        matchesStatus &&
        (!searchValue || searchableText.includes(searchValue))
      );
    });
  }, [shipments, dashboardSearch, dashboardStatus]);

  useEffect(() => {
    if (!auth) {
      setShipments([]);
      setDrivers([]);
      return;
    }

    if (canManageShipments) {
      void loadOperationsData();
    } else if (isDriver) {
      void loadDriverShipments();
    } else if (isCustomer) {
      void loadCustomerShipments();
    }
  }, [auth, canManageShipments, isCustomer, isDriver]);

  function getAuthorizationHeaders(): Record<string, string> {
    if (!auth?.token) {
      return {};
    }

    return {
      Authorization: `Bearer ${auth.token}`,
    };
  }

  function getStatusName(status: number): string {
    return statusNames[status] ?? "Unknown";
  }

  function getServiceName(serviceLevelValue: number): string {
    return serviceNames[serviceLevelValue] ?? "Unknown";
  }

  function getSuggestedNextStatus(currentStatus: number): string {
    switch (currentStatus) {
      case 0:
        return "1";
      case 1:
        return "5";
      case 5:
        return "6";
      case 6:
        return "2";
      case 2:
        return "7";
      case 7:
        return "3";
      case 3:
        return "4";
      case 8:
        return "3";
      case 9:
        return "2";
      case 10:
        return "11";
      default:
        return "1";
    }
  }

  function getStatusClass(status: number): string {
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

  function isFinalStatus(status: number): boolean {
    return status === 4 || status === 11;
  }

  function updateSenderAddress(
    field: keyof AddressForm,
    value: string | boolean
  ): void {
    setSenderAddress((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateRecipientAddress(
    field: keyof AddressForm,
    value: string | boolean
  ): void {
    setRecipientAddress((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function selectShipmentForWork(selectedShipment: Shipment): void {
    setTrackingNumber(selectedShipment.trackingNumber);
    setUpdateTrackingNumber(selectedShipment.trackingNumber);
    setAssignmentTrackingNumber(selectedShipment.trackingNumber);

    if (!isFinalStatus(selectedShipment.currentStatus)) {
      setNewStatus(
        getSuggestedNextStatus(selectedShipment.currentStatus)
      );
    }
  }

  async function login(
    event: FormEvent<HTMLFormElement>
  ): Promise<void> {
    event.preventDefault();

    if (!loginEmail.trim() || !loginPassword) {
      setLoginError("Enter your email and password.");
      return;
    }

    setIsLoggingIn(true);
    setLoginError("");

    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: loginEmail.trim(),
          password: loginPassword,
        }),
      });

      if (!response.ok) {
        throw new Error(
          await readErrorMessage(response, "Login failed.")
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
        error instanceof Error ? error.message : "Login failed."
      );
    } finally {
      setIsLoggingIn(false);
    }
  }

  function logout(): void {
    localStorage.removeItem("packageTrackingAuth");
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

    return (await response.json()) as Shipment;
  }

  async function trackShipment(
    event: FormEvent<HTMLFormElement>
  ): Promise<void> {
    event.preventDefault();

    const cleanedTrackingNumber = trackingNumber.trim();

    if (!cleanedTrackingNumber) {
      setTrackingError("Enter a tracking number.");
      return;
    }

    setIsTracking(true);
    setTrackingError("");

    try {
      const data = await loadShipment(cleanedTrackingNumber);
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

  async function loadOperationsData(): Promise<void> {
    if (!auth?.token) {
      return;
    }

    setIsLoadingDashboard(true);
    setDashboardError("");

    try {
      const [shipmentResponse, driverResponse] = await Promise.all([
        fetch(`${apiBaseUrl}/api/shipments`, {
          headers: getAuthorizationHeaders(),
        }),
        fetch(`${apiBaseUrl}/api/drivers`, {
          headers: getAuthorizationHeaders(),
        }),
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

      setShipments(
        (await shipmentResponse.json()) as Shipment[]
      );
      setDrivers((await driverResponse.json()) as Driver[]);
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

  async function loadDriverShipments(): Promise<void> {
    if (!auth?.token) {
      return;
    }

    setIsLoadingDashboard(true);
    setDashboardError("");

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/drivers/my-shipments`,
        { headers: getAuthorizationHeaders() }
      );

      if (!response.ok) {
        throw new Error(
          await readErrorMessage(
            response,
            "Your assigned shipments could not be loaded."
          )
        );
      }

      setShipments((await response.json()) as Shipment[]);
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

  async function loadCustomerShipments(): Promise<void> {
    if (!auth?.token) {
      return;
    }

    setIsLoadingDashboard(true);
    setDashboardError("");

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/shipments/my`,
        { headers: getAuthorizationHeaders() }
      );

      if (!response.ok) {
        throw new Error(
          await readErrorMessage(
            response,
            "Your shipments could not be loaded."
          )
        );
      }

      setShipments((await response.json()) as Shipment[]);
    } catch (error) {
      setDashboardError(
        error instanceof Error
          ? error.message
          : "Your shipments could not be loaded."
      );
    } finally {
      setIsLoadingDashboard(false);
    }
  }

  async function refreshDashboard(): Promise<void> {
    if (canManageShipments) {
      await loadOperationsData();
    } else if (isDriver) {
      await loadDriverShipments();
    } else if (isCustomer) {
      await loadCustomerShipments();
    }
  }

  async function openShipment(
    selectedShipment: Shipment
  ): Promise<void> {
    setIsTracking(true);
    setTrackingError("");

    try {
      const completeShipment = await loadShipment(
        selectedShipment.trackingNumber
      );

      setShipment({
        ...completeShipment,
        assignedDriverId:
          completeShipment.assignedDriverId ??
          selectedShipment.assignedDriverId,
        assignedDriverName:
          completeShipment.assignedDriverName ??
          selectedShipment.assignedDriverName,
        customerId:
          completeShipment.customerId ?? selectedShipment.customerId,
      });

      selectShipmentForWork(selectedShipment);
      window.scrollTo({ top: 0, behavior: "smooth" });
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
      const response = await fetch(`${apiBaseUrl}/api/drivers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthorizationHeaders(),
        },
        body: JSON.stringify({
          fullName: driverName.trim(),
          email: driverEmail.trim(),
          password: driverPassword,
        }),
      });

      if (!response.ok) {
        throw new Error(
          await readErrorMessage(
            response,
            "The driver account could not be created."
          )
        );
      }

      setDriverSuccess("Driver account created successfully.");
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

    if (!assignmentTrackingNumber.trim() || !selectedDriverId) {
      setAssignmentError("Select a shipment and a driver.");
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
            "Content-Type": "application/json",
            ...getAuthorizationHeaders(),
          },
          body: JSON.stringify({
            driverId: Number(selectedDriverId),
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

      setAssignmentSuccess("Shipment assigned successfully.");
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

  async function removeAssignment(): Promise<void> {
    const cleanedTrackingNumber = assignmentTrackingNumber.trim();

    if (!cleanedTrackingNumber) {
      setAssignmentError("Enter or select a tracking number.");
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
          headers: getAuthorizationHeaders(),
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

      setAssignmentSuccess("Driver assignment removed.");
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

  function validateShipmentForm(): string | null {
    const requiredAddressValues = [
      senderAddress.contactName,
      senderAddress.addressLine1,
      senderAddress.city,
      senderAddress.stateOrProvince,
      senderAddress.postalCode,
      senderAddress.countryCode,
      recipientAddress.contactName,
      recipientAddress.addressLine1,
      recipientAddress.city,
      recipientAddress.stateOrProvince,
      recipientAddress.postalCode,
      recipientAddress.countryCode,
    ];

    if (
      !customerEmail.trim() ||
      requiredAddressValues.some((value) => !value.trim())
    ) {
      return "Complete the customer, sender, and recipient required fields.";
    }

    if (
      senderAddress.countryCode.trim().length !== 2 ||
      recipientAddress.countryCode.trim().length !== 2
    ) {
      return "Country codes must contain exactly two letters.";
    }

    const packageValues = [
      Number(weightKg),
      Number(lengthCm),
      Number(widthCm),
      Number(heightCm),
    ];

    if (
      packageValues.some(
        (value) => !Number.isFinite(value) || value <= 0
      )
    ) {
      return "Package weight and dimensions must be greater than zero.";
    }

    if (serviceLevel === "") {
      return "Select a service level.";
    }

    return null;
  }

  async function createShipment(
    event: FormEvent<HTMLFormElement>
  ): Promise<void> {
    event.preventDefault();

    const validationMessage = validateShipmentForm();

    if (validationMessage) {
      setCreateError(validationMessage);
      return;
    }

    setIsCreating(true);
    setCreateError("");
    setCreatedTrackingNumber("");

    try {
      const response = await fetch(`${apiBaseUrl}/api/shipments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthorizationHeaders(),
        },
        body: JSON.stringify({
          senderName: senderAddress.contactName.trim(),
          recipientName: recipientAddress.contactName.trim(),
          customerEmail: customerEmail.trim(),
          origin: buildLocationSummary(senderAddress),
          destination: buildLocationSummary(recipientAddress),
          senderAddress: normalizeAddress(senderAddress),
          recipientAddress: normalizeAddress(recipientAddress),
          weightKg: Number(weightKg),
          lengthCm: Number(lengthCm),
          widthCm: Number(widthCm),
          heightCm: Number(heightCm),
          serviceLevel: Number(serviceLevel),
          deliveryInstructions: deliveryInstructions.trim(),
        }),
      });

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
      setCreatedTrackingNumber(createdShipment.trackingNumber);
      selectShipmentForWork(createdShipment);

      setCustomerEmail("");
      setSenderAddress(createEmptyAddress());
      setRecipientAddress(createEmptyAddress());
      setWeightKg("");
      setLengthCm("");
      setWidthCm("");
      setHeightCm("");
      setServiceLevel("");
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
      const cleanedTrackingNumber = updateTrackingNumber.trim();
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
            status: Number(newStatus),
            location: updateLocation.trim(),
            description: updateDescription.trim(),
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

      const refreshedShipment = await loadShipment(
        cleanedTrackingNumber
      );

      setShipment(refreshedShipment);
      setUpdateSuccess(
        `Shipment updated to ${getStatusName(Number(newStatus))}.`
      );

      if (!isFinalStatus(refreshedShipment.currentStatus)) {
        setNewStatus(
          getSuggestedNextStatus(refreshedShipment.currentStatus)
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
        <p className="eyebrow">Package Tracking Platform</p>
        <h1>Track your shipment</h1>
        <p className="subtitle">
          Track packages, manage deliveries, and view shipment
          history.
        </p>

        <form className="tracking-form" onSubmit={trackShipment}>
          <input
            type="text"
            value={trackingNumber}
            onChange={(event) =>
              setTrackingNumber(event.target.value)
            }
            placeholder="Tracking number"
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

      <section className="account-section">
        {!auth ? (
          <>
            <div className="section-heading">
              <p className="eyebrow">Account Access</p>
              <h2>Login</h2>
              <p>
                Customers, administrators, employees, and drivers
                can sign in.
              </p>
            </div>

            <form className="form-grid" onSubmit={login}>
              <label>
                Email
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(event) =>
                    setLoginEmail(event.target.value)
                  }
                  autoComplete="email"
                  required
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
                  autoComplete="current-password"
                  required
                />
              </label>

              <button type="submit" disabled={isLoggingIn}>
                {isLoggingIn ? "Signing in..." : "Login"}
              </button>
            </form>

            {loginError && (
              <p className="error-message">{loginError}</p>
            )}
          </>
        ) : (
          <div className="signed-in-panel">
            <div>
              <strong>Signed in as {auth.user.fullName}</strong>
              <p>{auth.user.email}</p>
              <p>Roles: {auth.user.roles.join(", ")}</p>
            </div>

            <button type="button" onClick={logout}>
              Logout
            </button>
          </div>
        )}
      </section>

      {auth && (canManageShipments || isDriver || isCustomer) && (
        <section className="dashboard-section">
          <div className="dashboard-heading">
            <div>
              <p className="eyebrow">
                {isCustomer && !canManageShipments && !isDriver
                  ? "Customer Portal"
                  : isDriver && !canManageShipments
                    ? "Driver Dashboard"
                    : "Operations Dashboard"}
              </p>

              <h2>
                {isCustomer && !canManageShipments && !isDriver
                  ? "My shipments"
                  : isDriver && !canManageShipments
                    ? "My assigned shipments"
                    : "Shipment overview"}
              </h2>
            </div>

            <button
              type="button"
              className="secondary-button"
              onClick={() => void refreshDashboard()}
              disabled={isLoadingDashboard}
            >
              {isLoadingDashboard ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          <div className="stats-grid">
            <article className="stat-card">
              <span>Total shipments</span>
              <strong>{dashboardStats.total}</strong>
            </article>
            <article className="stat-card">
              <span>Active</span>
              <strong>{dashboardStats.active}</strong>
            </article>
            <article className="stat-card">
              <span>Label created</span>
              <strong>{dashboardStats.created}</strong>
            </article>
            <article className="stat-card">
              <span>In network</span>
              <strong>{dashboardStats.inTransit}</strong>
            </article>
            <article className="stat-card">
              <span>Delivery activity</span>
              <strong>{dashboardStats.outForDelivery}</strong>
            </article>
            <article className="stat-card">
              <span>Delivered</span>
              <strong>{dashboardStats.delivered}</strong>
            </article>
          </div>

          <div className="dashboard-controls">
            <input
              type="search"
              value={dashboardSearch}
              onChange={(event) =>
                setDashboardSearch(event.target.value)
              }
              placeholder={
                isCustomer && !canManageShipments && !isDriver
                  ? "Search my shipments"
                  : "Search shipments"
              }
            />

            <select
              value={dashboardStatus}
              onChange={(event) =>
                setDashboardStatus(event.target.value)
              }
            >
              <option value="all">All statuses</option>
              {statusOptions.map((statusOption) => (
                <option
                  key={statusOption.value}
                  value={statusOption.value}
                >
                  {statusOption.label}
                </option>
              ))}
            </select>
          </div>

          {dashboardError && (
            <p className="error-message">{dashboardError}</p>
          )}

          <div className="table-wrap">
            <table className="shipment-table">
              <thead>
                <tr>
                  <th>Tracking</th>
                  <th>Recipient</th>
                  <th>Route</th>
                  <th>Status</th>
                  {canManageShipments && <th>Driver</th>}
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredShipments.length === 0 ? (
                  <tr>
                    <td
                      colSpan={canManageShipments ? 6 : 5}
                      className="empty-table"
                    >
                      No matching shipments were found.
                    </td>
                  </tr>
                ) : (
                  filteredShipments.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.trackingNumber}</strong>
                      </td>
                      <td>
                        <div>{item.recipientName}</div>
                        <small>From {item.senderName}</small>
                      </td>
                      <td>
                        <div>{item.origin}</div>
                        <small>To {item.destination}</small>
                      </td>
                      <td>
                        <span
                          className={`table-status ${getStatusClass(
                            item.currentStatus
                          )}`}
                        >
                          {getStatusName(item.currentStatus)}
                        </span>
                      </td>
                      {canManageShipments && (
                        <td>
                          {item.assignedDriverName || "Not assigned"}
                        </td>
                      )}
                      <td>
                        <button
                          type="button"
                          className="table-button"
                          onClick={() => void openShipment(item)}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
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
              <p className="label">Tracking number</p>
              <h2>{shipment.trackingNumber}</h2>
            </div>

            <span
              className={`status-badge ${getStatusClass(
                shipment.currentStatus
              )}`}
            >
              {getStatusName(shipment.currentStatus)}
            </span>
          </div>

          <div className="shipment-grid">
            <AddressDetails
              title="Sender"
              address={shipment.senderAddress}
              fallbackName={shipment.senderName}
              fallbackLocation={shipment.origin}
              showFullDetails={canViewSelectedShipmentFullAddress}
            />

            <AddressDetails
              title="Recipient"
              address={shipment.recipientAddress}
              fallbackName={shipment.recipientName}
              fallbackLocation={shipment.destination}
              showFullDetails={canViewSelectedShipmentFullAddress}
            />

            <div>
              <p className="label">Origin</p>
              <p>{shipment.origin}</p>
            </div>

            <div>
              <p className="label">Destination</p>
              <p>{shipment.destination}</p>
            </div>

            <div>
              <p className="label">Service</p>
              <p>{getServiceName(shipment.serviceLevel)}</p>
            </div>

            <div>
              <p className="label">Package</p>
              <p>
                {shipment.weightKg} kg — {shipment.lengthCm} ×{" "}
                {shipment.widthCm} × {shipment.heightCm} cm
              </p>
            </div>

            <div>
              <p className="label">Shipping cost</p>
              <p>
                ${Number(shipment.shippingCost || 0).toFixed(2)}
              </p>
            </div>

            <div>
              <p className="label">Estimated delivery</p>
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
                <p className="label">Assigned driver</p>
                <p>
                  {shipment.assignedDriverName || "Not assigned"}
                </p>
              </div>
            )}

            <div>
              <p className="label">Delivery instructions</p>
              <p>
                {shipment.deliveryInstructions ||
                  "No special instructions"}
              </p>
            </div>
          </div>

          <div className="history-section">
            <h3>Tracking history</h3>

            {!shipment.trackingHistory ||
            shipment.trackingHistory.length === 0 ? (
              <p>No tracking events are available.</p>
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

      {isAdmin && (
        <section className="management-section">
          <div className="section-heading">
            <p className="eyebrow">Driver Administration</p>
            <h2>Create a driver account</h2>
            <p>Create login credentials for a delivery driver.</p>
          </div>

          <form className="form-grid" onSubmit={createDriver}>
            <label>
              Driver name
              <input
                type="text"
                value={driverName}
                onChange={(event) =>
                  setDriverName(event.target.value)
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
                  setDriverEmail(event.target.value)
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
                  setDriverPassword(event.target.value)
                }
                minLength={8}
                required
              />
            </label>

            <button type="submit" disabled={isCreatingDriver}>
              {isCreatingDriver ? "Creating..." : "Create Driver"}
            </button>
          </form>

          {driverError && (
            <p className="error-message">{driverError}</p>
          )}

          {driverSuccess && (
            <div className="success-message">
              <strong>{driverSuccess}</strong>
            </div>
          )}
        </section>
      )}

      {canManageShipments && (
        <div className="management-grid">
          <section className="management-section">
            <div className="section-heading">
              <p className="eyebrow">Driver Assignment</p>
              <h2>Assign a shipment</h2>
            </div>

            <form className="form-grid" onSubmit={assignDriver}>
              <label>
                Tracking number
                <input
                  type="text"
                  value={assignmentTrackingNumber}
                  onChange={(event) =>
                    setAssignmentTrackingNumber(event.target.value)
                  }
                  required
                />
              </label>

              <label>
                Driver
                <select
                  value={selectedDriverId}
                  onChange={(event) =>
                    setSelectedDriverId(event.target.value)
                  }
                  required
                >
                  <option value="">Select a driver</option>
                  {drivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.fullName} — {driver.email}
                    </option>
                  ))}
                </select>
              </label>

              <button type="submit" disabled={isAssigning}>
                {isAssigning ? "Saving..." : "Assign Driver"}
              </button>

              <button
                type="button"
                className="secondary-button"
                disabled={isAssigning}
                onClick={() => void removeAssignment()}
              >
                Remove Assignment
              </button>
            </form>

            {assignmentError && (
              <p className="error-message">{assignmentError}</p>
            )}

            {assignmentSuccess && (
              <div className="success-message">
                <strong>{assignmentSuccess}</strong>
              </div>
            )}
          </section>

          <section className="management-section">
            <div className="section-heading">
              <p className="eyebrow">Shipment Management</p>
              <h2>Create a new shipment</h2>
              <p>
                Enter the complete sender, recipient, and package
                information.
              </p>
            </div>

            <form className="form-grid" onSubmit={createShipment}>
              <div
                className="form-section-heading"
                style={{ gridColumn: "1 / -1" }}
              >
                <h3>Customer account</h3>
              </div>

              <label>
                Customer account email
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(event) =>
                    setCustomerEmail(event.target.value)
                  }
                  required
                />
              </label>

              <div
                className="form-section-heading"
                style={{ gridColumn: "1 / -1" }}
              >
                <h3>Sender address</h3>
              </div>

              <label>
                Contact name
                <input
                  type="text"
                  value={senderAddress.contactName}
                  onChange={(event) =>
                    updateSenderAddress(
                      "contactName",
                      event.target.value
                    )
                  }
                  required
                />
              </label>

              <label>
                Company
                <input
                  type="text"
                  value={senderAddress.companyName}
                  onChange={(event) =>
                    updateSenderAddress(
                      "companyName",
                      event.target.value
                    )
                  }
                />
              </label>

              <label>
                Street address
                <input
                  type="text"
                  value={senderAddress.addressLine1}
                  onChange={(event) =>
                    updateSenderAddress(
                      "addressLine1",
                      event.target.value
                    )
                  }
                  required
                />
              </label>

              <label>
                Apartment, suite, or unit
                <input
                  type="text"
                  value={senderAddress.addressLine2}
                  onChange={(event) =>
                    updateSenderAddress(
                      "addressLine2",
                      event.target.value
                    )
                  }
                />
              </label>

              <label>
                City
                <input
                  type="text"
                  value={senderAddress.city}
                  onChange={(event) =>
                    updateSenderAddress("city", event.target.value)
                  }
                  required
                />
              </label>

              <label>
                State or province
                <input
                  type="text"
                  value={senderAddress.stateOrProvince}
                  onChange={(event) =>
                    updateSenderAddress(
                      "stateOrProvince",
                      event.target.value
                    )
                  }
                  required
                />
              </label>

              <label>
                Postal code
                <input
                  type="text"
                  value={senderAddress.postalCode}
                  onChange={(event) =>
                    updateSenderAddress(
                      "postalCode",
                      event.target.value
                    )
                  }
                  required
                />
              </label>

              <label>
                Country code
                <input
                  type="text"
                  minLength={2}
                  maxLength={2}
                  value={senderAddress.countryCode}
                  onChange={(event) =>
                    updateSenderAddress(
                      "countryCode",
                      event.target.value.toUpperCase()
                    )
                  }
                  required
                />
              </label>

              <label>
                Phone
                <input
                  type="tel"
                  value={senderAddress.phoneNumber}
                  onChange={(event) =>
                    updateSenderAddress(
                      "phoneNumber",
                      event.target.value
                    )
                  }
                />
              </label>

              <label>
                Email
                <input
                  type="email"
                  value={senderAddress.email}
                  onChange={(event) =>
                    updateSenderAddress("email", event.target.value)
                  }
                />
              </label>

              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={senderAddress.isResidential}
                  onChange={(event) =>
                    updateSenderAddress(
                      "isResidential",
                      event.target.checked
                    )
                  }
                />
                Residential address
              </label>

              <div
                className="form-section-heading"
                style={{ gridColumn: "1 / -1" }}
              >
                <h3>Recipient address</h3>
              </div>

              <label>
                Contact name
                <input
                  type="text"
                  value={recipientAddress.contactName}
                  onChange={(event) =>
                    updateRecipientAddress(
                      "contactName",
                      event.target.value
                    )
                  }
                  required
                />
              </label>

              <label>
                Company
                <input
                  type="text"
                  value={recipientAddress.companyName}
                  onChange={(event) =>
                    updateRecipientAddress(
                      "companyName",
                      event.target.value
                    )
                  }
                />
              </label>

              <label>
                Street address
                <input
                  type="text"
                  value={recipientAddress.addressLine1}
                  onChange={(event) =>
                    updateRecipientAddress(
                      "addressLine1",
                      event.target.value
                    )
                  }
                  required
                />
              </label>

              <label>
                Apartment, suite, or unit
                <input
                  type="text"
                  value={recipientAddress.addressLine2}
                  onChange={(event) =>
                    updateRecipientAddress(
                      "addressLine2",
                      event.target.value
                    )
                  }
                />
              </label>

              <label>
                City
                <input
                  type="text"
                  value={recipientAddress.city}
                  onChange={(event) =>
                    updateRecipientAddress(
                      "city",
                      event.target.value
                    )
                  }
                  required
                />
              </label>

              <label>
                State or province
                <input
                  type="text"
                  value={recipientAddress.stateOrProvince}
                  onChange={(event) =>
                    updateRecipientAddress(
                      "stateOrProvince",
                      event.target.value
                    )
                  }
                  required
                />
              </label>

              <label>
                Postal code
                <input
                  type="text"
                  value={recipientAddress.postalCode}
                  onChange={(event) =>
                    updateRecipientAddress(
                      "postalCode",
                      event.target.value
                    )
                  }
                  required
                />
              </label>

              <label>
                Country code
                <input
                  type="text"
                  minLength={2}
                  maxLength={2}
                  value={recipientAddress.countryCode}
                  onChange={(event) =>
                    updateRecipientAddress(
                      "countryCode",
                      event.target.value.toUpperCase()
                    )
                  }
                  required
                />
              </label>

              <label>
                Phone
                <input
                  type="tel"
                  value={recipientAddress.phoneNumber}
                  onChange={(event) =>
                    updateRecipientAddress(
                      "phoneNumber",
                      event.target.value
                    )
                  }
                />
              </label>

              <label>
                Email
                <input
                  type="email"
                  value={recipientAddress.email}
                  onChange={(event) =>
                    updateRecipientAddress(
                      "email",
                      event.target.value
                    )
                  }
                />
              </label>

              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={recipientAddress.isResidential}
                  onChange={(event) =>
                    updateRecipientAddress(
                      "isResidential",
                      event.target.checked
                    )
                  }
                />
                Residential address
              </label>

              <div
                className="form-section-heading"
                style={{ gridColumn: "1 / -1" }}
              >
                <h3>Package and service</h3>
              </div>

              <label>
                Weight in kilograms
                <input
                  type="number"
                  min="0.01"
                  max="1000"
                  step="0.01"
                  value={weightKg}
                  onChange={(event) =>
                    setWeightKg(event.target.value)
                  }
                  required
                />
              </label>

              <label>
                Length in centimeters
                <input
                  type="number"
                  min="0.1"
                  max="300"
                  step="0.1"
                  value={lengthCm}
                  onChange={(event) =>
                    setLengthCm(event.target.value)
                  }
                  required
                />
              </label>

              <label>
                Width in centimeters
                <input
                  type="number"
                  min="0.1"
                  max="300"
                  step="0.1"
                  value={widthCm}
                  onChange={(event) =>
                    setWidthCm(event.target.value)
                  }
                  required
                />
              </label>

              <label>
                Height in centimeters
                <input
                  type="number"
                  min="0.1"
                  max="300"
                  step="0.1"
                  value={heightCm}
                  onChange={(event) =>
                    setHeightCm(event.target.value)
                  }
                  required
                />
              </label>

              <label>
                Service level
                <select
                  value={serviceLevel}
                  onChange={(event) =>
                    setServiceLevel(event.target.value)
                  }
                  required
                >
                  <option value="">Select service level</option>
                  <option value="0">Standard</option>
                  <option value="1">Express</option>
                  <option value="2">Same Day</option>
                </select>
              </label>

              <label>
                Delivery instructions
                <input
                  type="text"
                  value={deliveryInstructions}
                  onChange={(event) =>
                    setDeliveryInstructions(event.target.value)
                  }
                />
              </label>

              <button type="submit" disabled={isCreating}>
                {isCreating ? "Creating..." : "Create Shipment"}
              </button>
            </form>

            {createError && (
              <p className="error-message">{createError}</p>
            )}

            {createdTrackingNumber && (
              <div className="success-message">
                <strong>Shipment created successfully</strong>
                <p>{createdTrackingNumber}</p>
              </div>
            )}
          </section>
        </div>
      )}

      {canUpdateShipment && (
        <section className="management-section">
          <div className="section-heading">
            <p className="eyebrow">
              {isDriver && !canManageShipments
                ? "Driver Tools"
                : "Employee Tools"}
            </p>
            <h2>Update shipment status</h2>
            <p>
              The backend verifies that the selected status
              transition is valid.
            </p>
          </div>

          {shipment && isFinalStatus(shipment.currentStatus) && (
            <div className="success-message">
              <strong>
                {getStatusName(shipment.currentStatus)} is a final
                status.
              </strong>
              <p>This shipment cannot receive more updates.</p>
            </div>
          )}

          <form className="form-grid" onSubmit={updateShipmentStatus}>
            <label>
              Tracking number
              <input
                type="text"
                value={updateTrackingNumber}
                onChange={(event) =>
                  setUpdateTrackingNumber(event.target.value)
                }
                required
              />
            </label>

            <label>
              New status
              <select
                value={newStatus}
                onChange={(event) => setNewStatus(event.target.value)}
              >
                {statusOptions
                  .filter((statusOption) => statusOption.value !== 0)
                  .map((statusOption) => (
                    <option
                      key={statusOption.value}
                      value={statusOption.value}
                    >
                      {statusOption.label}
                    </option>
                  ))}
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
                required
              />
            </label>

            <label>
              Description
              <input
                type="text"
                value={updateDescription}
                onChange={(event) =>
                  setUpdateDescription(event.target.value)
                }
                required
              />
            </label>

            <button
              type="submit"
              disabled={
                isUpdating ||
                (shipment !== null &&
                  shipment.trackingNumber === updateTrackingNumber &&
                  isFinalStatus(shipment.currentStatus))
              }
            >
              {isUpdating ? "Updating..." : "Update Status"}
            </button>
          </form>

          {updateError && (
            <p className="error-message">{updateError}</p>
          )}

          {updateSuccess && (
            <div className="success-message">
              <strong>{updateSuccess}</strong>
            </div>
          )}
        </section>
      )}
    </main>
  );
}

export default App;