param(
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

$ProjectRoot = (Get-Location).Path
$ApiProject = Join-Path $ProjectRoot "src\PackageTracking.Api\PackageTracking.Api.csproj"
$ShipmentModelPath = Join-Path $ProjectRoot "src\PackageTracking.Api\Models\Shipment.cs"
$DtoPath = Join-Path $ProjectRoot "src\PackageTracking.Api\Dtos\CreateShipmentRequest.cs"
$ControllerPath = Join-Path $ProjectRoot "src\PackageTracking.Api\Controllers\ShipmentsController.cs"
$AppPath = Join-Path $ProjectRoot "src\package-tracking-web\src\App.tsx"

foreach ($requiredPath in @(
    $ApiProject,
    $ShipmentModelPath,
    $DtoPath,
    $ControllerPath,
    $AppPath
)) {
    if (-not (Test-Path $requiredPath)) {
        throw "Required file was not found: $requiredPath"
    }
}

$ShipmentModel = Get-Content $ShipmentModelPath -Raw
foreach ($requiredProperty in @("CustomerId", "CustomerName", "CustomerEmail")) {
    if ($ShipmentModel -notmatch $requiredProperty) {
        throw "Shipment.cs does not contain $requiredProperty. Complete Phase 5A before running Phase 5B."
    }
}

$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupRoot = Join-Path $ProjectRoot "phase5b-backup-$Timestamp"
New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null

function Backup-File {
    param([string]$Path)

    $RelativePath = $Path.Substring($ProjectRoot.Length).TrimStart("\")
    $Destination = Join-Path $BackupRoot $RelativePath
    $DestinationDirectory = Split-Path $Destination -Parent

    New-Item -ItemType Directory -Path $DestinationDirectory -Force | Out-Null
    Copy-Item $Path $Destination -Force
}

function Save-File {
    param(
        [string]$Path,
        [string]$Content
    )

    Set-Content -Path $Path -Value $Content -Encoding utf8
    Write-Host "Updated: $($Path.Substring($ProjectRoot.Length).TrimStart('\'))" -ForegroundColor Green
}

function Replace-Exact {
    param(
        [string]$Content,
        [string]$OldText,
        [string]$NewText,
        [string]$Description
    )

    if ($Content.Contains($NewText)) {
        Write-Host "Already applied: $Description" -ForegroundColor Yellow
        return $Content
    }

    if (-not $Content.Contains($OldText)) {
        throw "Could not locate the expected code for: $Description"
    }

    Write-Host "Applying: $Description" -ForegroundColor Cyan
    return $Content.Replace($OldText, $NewText)
}

Write-Host "Stopping the API if it is running..." -ForegroundColor Cyan
Get-Process -Name "PackageTracking.Api" -ErrorAction SilentlyContinue |
    Stop-Process -Force

Backup-File $DtoPath
Backup-File $ControllerPath
Backup-File $AppPath

# ---------------------------------------------------------------------------
# 1. Add CustomerEmail to CreateShipmentRequest
# ---------------------------------------------------------------------------
$Dto = Get-Content $DtoPath -Raw

$DtoOld = @'
    [Required]
    [MaxLength(150)]
    public string RecipientName { get; set; } = string.Empty;

    [Required]
    [MaxLength(250)]
    public string Origin { get; set; } = string.Empty;
'@

$DtoNew = @'
    [Required]
    [MaxLength(150)]
    public string RecipientName { get; set; } = string.Empty;

    [Required]
    [EmailAddress]
    [MaxLength(256)]
    public string CustomerEmail { get; set; } = string.Empty;

    [Required]
    [MaxLength(250)]
    public string Origin { get; set; } = string.Empty;
'@

$Dto = Replace-Exact `
    -Content $Dto `
    -OldText $DtoOld `
    -NewText $DtoNew `
    -Description "customer email in CreateShipmentRequest"

Save-File $DtoPath $Dto

# ---------------------------------------------------------------------------
# 2. Update ShipmentsController
# ---------------------------------------------------------------------------
$Controller = Get-Content $ControllerPath -Raw

if ($Controller -notmatch "using Microsoft\.AspNetCore\.Identity;") {
    $Controller = Replace-Exact `
        -Content $Controller `
        -OldText "using Microsoft.AspNetCore.Authorization;" `
        -NewText "using Microsoft.AspNetCore.Authorization;`r`nusing Microsoft.AspNetCore.Identity;" `
        -Description "Identity namespace"
}

$ControllerFieldOld = @'
    private readonly ApplicationDbContext _dbContext;
    private readonly AfterShipTrackingService _afterShipTrackingService;
'@

$ControllerFieldNew = @'
    private readonly ApplicationDbContext _dbContext;
    private readonly UserManager<AppUser> _userManager;
    private readonly AfterShipTrackingService _afterShipTrackingService;
'@

$Controller = Replace-Exact `
    -Content $Controller `
    -OldText $ControllerFieldOld `
    -NewText $ControllerFieldNew `
    -Description "UserManager field"

$ControllerConstructorOld = @'
    public ShipmentsController(
        ApplicationDbContext dbContext,
        AfterShipTrackingService afterShipTrackingService)
    {
        _dbContext = dbContext;
        _afterShipTrackingService = afterShipTrackingService;
    }
'@

$ControllerConstructorNew = @'
    public ShipmentsController(
        ApplicationDbContext dbContext,
        UserManager<AppUser> userManager,
        AfterShipTrackingService afterShipTrackingService)
    {
        _dbContext = dbContext;
        _userManager = userManager;
        _afterShipTrackingService = afterShipTrackingService;
    }
'@

$Controller = Replace-Exact `
    -Content $Controller `
    -OldText $ControllerConstructorOld `
    -NewText $ControllerConstructorNew `
    -Description "UserManager constructor injection"

$CreateValuesOld = @'
        var destination =
            request.Destination?.Trim() ?? string.Empty;

        if (string.IsNullOrWhiteSpace(senderName) ||
'@

$CreateValuesNew = @'
        var destination =
            request.Destination?.Trim() ?? string.Empty;

        var customerEmail =
            request.CustomerEmail?.Trim().ToLowerInvariant()
            ?? string.Empty;

        if (string.IsNullOrWhiteSpace(customerEmail))
        {
            return BadRequest(new
            {
                message = "A customer email is required."
            });
        }

        var customer =
            await _userManager.FindByEmailAsync(customerEmail);

        if (customer is null)
        {
            return BadRequest(new
            {
                message =
                    "No registered customer account was found with that email."
            });
        }

        if (!await _userManager.IsInRoleAsync(
                customer,
                "Customer"))
        {
            return BadRequest(new
            {
                message =
                    "The selected account does not have the Customer role."
            });
        }

        if (string.IsNullOrWhiteSpace(senderName) ||
'@

$Controller = Replace-Exact `
    -Content $Controller `
    -OldText $CreateValuesOld `
    -NewText $CreateValuesNew `
    -Description "customer lookup during shipment creation"

$ShipmentAssignmentOld = @'
            SenderName = senderName,
            RecipientName = recipientName,
            Origin = origin,
            Destination = destination,
            CurrentStatus = ShipmentStatus.Created,
'@

$ShipmentAssignmentNew = @'
            SenderName = senderName,
            RecipientName = recipientName,
            CustomerId = customer.Id,
            CustomerName = customer.FullName,
            CustomerEmail = customer.Email ?? customerEmail,
            Origin = origin,
            Destination = destination,
            CurrentStatus = ShipmentStatus.Created,
'@

$Controller = Replace-Exact `
    -Content $Controller `
    -OldText $ShipmentAssignmentOld `
    -NewText $ShipmentAssignmentNew `
    -Description "shipment customer ownership fields"

if ($Controller -notmatch '\[HttpGet\("my"\)\]') {
    $MyEndpoint = @'

    [HttpGet("my")]
    [Authorize(Roles = "Customer")]
    public async Task<ActionResult<IEnumerable<Shipment>>>
        GetMyShipments()
    {
        var customerId = GetCurrentUserId();

        if (!customerId.HasValue)
        {
            return Unauthorized(new
            {
                message =
                    "The customer account could not be identified."
            });
        }

        var customerEmail =
            User.FindFirstValue(ClaimTypes.Email)?
                .Trim()
                .ToLowerInvariant();

        var shipments = await _dbContext.Shipments
            .AsNoTracking()
            .Include(shipment => shipment.TrackingHistory)
            .Where(shipment =>
                shipment.CustomerId == customerId.Value ||
                (
                    shipment.CustomerId == null &&
                    customerEmail != null &&
                    shipment.CustomerEmail.ToLower() ==
                    customerEmail
                ))
            .OrderByDescending(shipment =>
                shipment.CreatedAtUtc)
            .ToListAsync();

        foreach (var shipment in shipments)
        {
            shipment.TrackingHistory =
                shipment.TrackingHistory
                    .OrderByDescending(trackingEvent =>
                        trackingEvent.OccurredAtUtc)
                    .ToList();
        }

        return Ok(shipments);
    }
'@

    $Controller = Replace-Exact `
        -Content $Controller `
        -OldText "`r`n    private int? GetCurrentUserId()" `
        -NewText "$MyEndpoint`r`n    private int? GetCurrentUserId()" `
        -Description "customer My Shipments endpoint"
}
else {
    Write-Host "Already applied: customer My Shipments endpoint" -ForegroundColor Yellow
}

Save-File $ControllerPath $Controller

# ---------------------------------------------------------------------------
# 3. Connect the React Customer Portal
# ---------------------------------------------------------------------------
$App = Get-Content $AppPath -Raw

$CustomerStateOld = @'
  const [senderName, setSenderName] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [origin, setOrigin] = useState("");
'@

$CustomerStateNew = @'
  const [senderName, setSenderName] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [origin, setOrigin] = useState("");
'@

$App = Replace-Exact `
    -Content $App `
    -OldText $CustomerStateOld `
    -NewText $CustomerStateNew `
    -Description "customer email React state"

$RoleOld = @'
  const isDriver = roles.includes("Driver");
  const canUpdateStatus = canManage || isDriver;
'@

$RoleNew = @'
  const isDriver = roles.includes("Driver");
  const isCustomer = roles.includes("Customer");
  const canUpdateStatus = canManage || isDriver;
'@

$App = Replace-Exact `
    -Content $App `
    -OldText $RoleOld `
    -NewText $RoleNew `
    -Description "Customer role detection"

$EffectOld = @'
    if (isDriver) {
      void loadDriverShipments();
    }
  }, [auth]);
'@

$EffectNew = @'
    if (isDriver) {
      void loadDriverShipments();
      return;
    }

    if (isCustomer) {
      void loadCustomerShipments();
    }
  }, [auth]);
'@

$App = Replace-Exact `
    -Content $App `
    -OldText $EffectOld `
    -NewText $EffectNew `
    -Description "automatic customer dashboard loading"

$RefreshOld = @'
  async function refreshDashboard() {
    if (canManage) {
      await loadOperationsData();
    } else if (isDriver) {
      await loadDriverShipments();
    }
  }
'@

$CustomerLoaderAndRefresh = @'
  async function loadCustomerShipments() {
    setIsLoadingDashboard(true);
    setDashboardError("");

    try {
      const response = await fetch(
        `${apiBaseUrl}/api/shipments/my`,
        {
          headers: authHeaders(),
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

      setShipments(
        (await response.json()) as Shipment[]
      );
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

  async function refreshDashboard() {
    if (canManage) {
      await loadOperationsData();
    } else if (isDriver) {
      await loadDriverShipments();
    } else if (isCustomer) {
      await loadCustomerShipments();
    }
  }
'@

$App = Replace-Exact `
    -Content $App `
    -OldText $RefreshOld `
    -NewText $CustomerLoaderAndRefresh `
    -Description "customer shipment loader and refresh"

$RequestBodyOld = @'
            senderName: senderName.trim(),
            recipientName: recipientName.trim(),
            origin: origin.trim(),
'@

$RequestBodyNew = @'
            senderName: senderName.trim(),
            recipientName: recipientName.trim(),
            customerEmail: customerEmail.trim(),
            origin: origin.trim(),
'@

$App = Replace-Exact `
    -Content $App `
    -OldText $RequestBodyOld `
    -NewText $RequestBodyNew `
    -Description "customer email in create-shipment request"

$ClearFormOld = @'
      setSenderName("");
      setRecipientName("");
      setOrigin("");
'@

$ClearFormNew = @'
      setSenderName("");
      setRecipientName("");
      setCustomerEmail("");
      setOrigin("");
'@

$App = Replace-Exact `
    -Content $App `
    -OldText $ClearFormOld `
    -NewText $ClearFormNew `
    -Description "customer email form reset"

$FormOld = @'
              <label>
                Origin
                <input
                  value={origin}
'@

$FormNew = @'
              <label>
                Customer account email
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(event) =>
                    setCustomerEmail(event.target.value)
                  }
                  placeholder="customer@example.com"
                  required
                />
              </label>

              <label>
                Origin
                <input
                  value={origin}
'@

$App = Replace-Exact `
    -Content $App `
    -OldText $FormOld `
    -NewText $FormNew `
    -Description "customer email field in shipment form"

$DashboardConditionOld =
    '{auth && (canManage || isDriver) && ('

$DashboardConditionNew =
    '{auth && (canManage || isDriver || isCustomer) && ('

$App = Replace-Exact `
    -Content $App `
    -OldText $DashboardConditionOld `
    -NewText $DashboardConditionNew `
    -Description "Customer Portal dashboard visibility"

$EyebrowOld = @'
                {isDriver && !canManage
                  ? "Driver Dashboard"
                  : "Operations Dashboard"}
'@

$EyebrowNew = @'
                {isCustomer && !canManage && !isDriver
                  ? "Customer Portal"
                  : isDriver && !canManage
                    ? "Driver Dashboard"
                    : "Operations Dashboard"}
'@

$App = Replace-Exact `
    -Content $App `
    -OldText $EyebrowOld `
    -NewText $EyebrowNew `
    -Description "Customer Portal title"

$HeadingOld = @'
                {isDriver && !canManage
                  ? "My assigned shipments"
                  : "Shipment overview"}
'@

$HeadingNew = @'
                {isCustomer && !canManage && !isDriver
                  ? "My shipments"
                  : isDriver && !canManage
                    ? "My assigned shipments"
                    : "Shipment overview"}
'@

$App = Replace-Exact `
    -Content $App `
    -OldText $HeadingOld `
    -NewText $HeadingNew `
    -Description "customer dashboard heading"

$PlaceholderOld =
    'placeholder="Search shipment, customer, location, or driver"'

$PlaceholderNew =
    'placeholder={isCustomer && !canManage && !isDriver ? "Search my shipments" : "Search shipment, customer, location, or driver"}'

$App = Replace-Exact `
    -Content $App `
    -OldText $PlaceholderOld `
    -NewText $PlaceholderNew `
    -Description "customer dashboard search text"

Save-File $AppPath $App

# ---------------------------------------------------------------------------
# 4. Build validation
# ---------------------------------------------------------------------------
if (-not $SkipBuild) {
    Write-Host ""
    Write-Host "Building the backend..." -ForegroundColor Cyan
    dotnet build $ApiProject

    if ($LASTEXITCODE -ne 0) {
        throw "Backend build failed. Backups are stored in $BackupRoot"
    }

    Write-Host ""
    Write-Host "Building the React frontend..." -ForegroundColor Cyan
    Push-Location (Join-Path $ProjectRoot "src\package-tracking-web")
    try {
        npm run build

        if ($LASTEXITCODE -ne 0) {
            throw "Frontend build failed. Backups are stored in $BackupRoot"
        }
    }
    finally {
        Pop-Location
    }
}

Write-Host ""
Write-Host "Phase 5B completed successfully." -ForegroundColor Green
Write-Host "Backup folder: $BackupRoot" -ForegroundColor DarkGray
Write-Host ""
Write-Host "Next test:" -ForegroundColor Cyan
Write-Host "1. Start the API and frontend."
Write-Host "2. Register or sign in as a Customer."
Write-Host "3. Sign in as Admin and create a shipment using that customer's email."
Write-Host "4. Sign back in as the Customer and confirm the shipment appears in My shipments."