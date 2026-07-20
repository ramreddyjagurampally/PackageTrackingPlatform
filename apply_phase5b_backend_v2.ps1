param(
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

$ProjectRoot = (Get-Location).Path
$ApiProject = Join-Path $ProjectRoot "src\PackageTracking.Api\PackageTracking.Api.csproj"
$DtoPath = Join-Path $ProjectRoot "src\PackageTracking.Api\Dtos\CreateShipmentRequest.cs"
$ControllerPath = Join-Path $ProjectRoot "src\PackageTracking.Api\Controllers\ShipmentsController.cs"

foreach ($path in @($ApiProject, $DtoPath, $ControllerPath)) {
    if (-not (Test-Path $path)) {
        throw "Required file not found: $path"
    }
}

$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BackupRoot = Join-Path $ProjectRoot "phase5b-backend-backup-$Timestamp"
New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null

function Backup-ProjectFile {
    param([string]$Path)

    $Relative = $Path.Substring($ProjectRoot.Length).TrimStart("\")
    $Destination = Join-Path $BackupRoot $Relative
    New-Item -ItemType Directory -Path (Split-Path $Destination -Parent) -Force | Out-Null
    Copy-Item $Path $Destination -Force
}

function Save-Utf8File {
    param(
        [string]$Path,
        [string]$Content
    )

    Set-Content -Path $Path -Value $Content -Encoding utf8
    Write-Host "Updated: $($Path.Substring($ProjectRoot.Length).TrimStart('\'))" -ForegroundColor Green
}

function Replace-RegexOnce {
    param(
        [string]$Content,
        [string]$Pattern,
        [string]$Replacement,
        [string]$Description
    )

    $Regex = [regex]::new(
        $Pattern,
        [System.Text.RegularExpressions.RegexOptions]::Singleline
    )

    if (-not $Regex.IsMatch($Content)) {
        throw "Could not locate code for: $Description"
    }

    Write-Host "Applying: $Description" -ForegroundColor Cyan
    return $Regex.Replace($Content, $Replacement, 1)
}

Write-Host "Stopping PackageTracking.Api..." -ForegroundColor Cyan
Get-Process -Name "PackageTracking.Api" -ErrorAction SilentlyContinue |
    Stop-Process -Force

Backup-ProjectFile $DtoPath
Backup-ProjectFile $ControllerPath

# ---------------------------------------------------------------------------
# CreateShipmentRequest.cs
# ---------------------------------------------------------------------------
$Dto = Get-Content $DtoPath -Raw

if ($Dto -notmatch 'public\s+string\s+CustomerEmail\s*\{') {
    $Dto = Replace-RegexOnce `
        -Content $Dto `
        -Pattern '(public\s+string\s+RecipientName\s*\{\s*get;\s*set;\s*\}\s*=\s*string\.Empty\s*;)' `
        -Replacement @'
$1

    [Required]
    [EmailAddress]
    [MaxLength(256)]
    public string CustomerEmail { get; set; } = string.Empty;
'@ `
        -Description "CustomerEmail property in CreateShipmentRequest"
}
else {
    Write-Host "Already present: CustomerEmail DTO property" -ForegroundColor Yellow
}

Save-Utf8File $DtoPath $Dto

# ---------------------------------------------------------------------------
# ShipmentsController.cs
# ---------------------------------------------------------------------------
$Controller = Get-Content $ControllerPath -Raw

if ($Controller -notmatch 'using\s+Microsoft\.AspNetCore\.Identity\s*;') {
    $IdentityUsingReplacement = '$1' + "`r`nusing Microsoft.AspNetCore.Identity;"

    $Controller = Replace-RegexOnce `
        -Content $Controller `
        -Pattern '(using\s+Microsoft\.AspNetCore\.Authorization\s*;)' `
        -Replacement $IdentityUsingReplacement `
        -Description "Microsoft.AspNetCore.Identity namespace"
}

if ($Controller -notmatch 'UserManager<AppUser>\s+_userManager') {
    $UserManagerFieldReplacement =
        '$1' + "`r`n    private readonly UserManager<AppUser> _userManager;"

    $Controller = Replace-RegexOnce `
        -Content $Controller `
        -Pattern '(private\s+readonly\s+ApplicationDbContext\s+_dbContext\s*;)' `
        -Replacement $UserManagerFieldReplacement `
        -Description "UserManager field"
}

if ($Controller -notmatch '_userManager\s*=\s*userManager\s*;') {
    $ConstructorPattern = @'
public\s+ShipmentsController\s*\(
(?<parameters>[\s\S]*?)
\)\s*
\{
(?<body>[\s\S]*?)
\}
'@

    $ConstructorRegex = [regex]::new(
        $ConstructorPattern,
        [System.Text.RegularExpressions.RegexOptions]::IgnorePatternWhitespace
    )

    $Match = $ConstructorRegex.Match($Controller)

    if (-not $Match.Success) {
        throw "Could not locate the ShipmentsController constructor."
    }

    $Parameters = $Match.Groups["parameters"].Value.Trim()
    $Body = $Match.Groups["body"].Value.Trim()

    if ($Parameters -notmatch 'UserManager<AppUser>') {
        if ($Parameters.Length -gt 0) {
            $Parameters = $Parameters.TrimEnd() + ",`r`n        UserManager<AppUser> userManager"
        }
        else {
            $Parameters = "UserManager<AppUser> userManager"
        }
    }

    if ($Body -notmatch '_userManager\s*=') {
        $Body = $Body.TrimEnd() + "`r`n        _userManager = userManager;"
    }

    $NewConstructor = @"
public ShipmentsController(
        $Parameters)
    {
        $Body
    }
"@

    $Controller = $Controller.Remove(
        $Match.Index,
        $Match.Length
    ).Insert(
        $Match.Index,
        $NewConstructor
    )

    Write-Host "Applying: UserManager constructor injection" -ForegroundColor Cyan
}
else {
    Write-Host "Already present: UserManager constructor injection" -ForegroundColor Yellow
}

if ($Controller -notmatch 'No registered customer account was found with that email') {
    $CustomerLookup = @'

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
'@

    $DestinationRegex = [regex]::new(
        '(?<destination>var\s+destination\s*=\s*[\s\S]*?;)(?<after>\s*(?:if|var\s+shipment|var\s+trackingNumber))',
        [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
    )

    $DestinationMatch = $DestinationRegex.Match($Controller)

    if (-not $DestinationMatch.Success) {
        throw "Could not locate the destination variable inside the Create shipment method."
    }

    $Replacement =
        $DestinationMatch.Groups["destination"].Value +
        $CustomerLookup +
        $DestinationMatch.Groups["after"].Value

    $Controller = $Controller.Remove(
        $DestinationMatch.Index,
        $DestinationMatch.Length
    ).Insert(
        $DestinationMatch.Index,
        $Replacement
    )

    Write-Host "Applying: customer lookup during shipment creation" -ForegroundColor Cyan
}
else {
    Write-Host "Already present: customer account lookup" -ForegroundColor Yellow
}

if ($Controller -notmatch 'CustomerId\s*=\s*customer\.Id') {
    $AssignmentPattern = @'
(?<recipient>
RecipientName\s*=\s*(?:recipientName|request\.RecipientName(?:\.Trim\(\))?)\s*,)
'@

    $AssignmentRegex = [regex]::new(
        $AssignmentPattern,
        [System.Text.RegularExpressions.RegexOptions]::IgnorePatternWhitespace
    )

    $AssignmentMatch = $AssignmentRegex.Match($Controller)

    if (-not $AssignmentMatch.Success) {
        throw "Could not locate RecipientName in the new Shipment object."
    }

    $CustomerAssignments = @'
$1
            CustomerId = customer.Id,
            CustomerName = customer.FullName,
            CustomerEmail = customer.Email ?? customerEmail,
'@

    $Controller = $AssignmentRegex.Replace(
        $Controller,
        $CustomerAssignments,
        1
    )

    Write-Host "Applying: customer ownership on new Shipment" -ForegroundColor Cyan
}
else {
    Write-Host "Already present: shipment customer ownership" -ForegroundColor Yellow
}

if ($Controller -notmatch '\[HttpGet\("my"\)\]') {
    $MyEndpoint = @'

    [HttpGet("my")]
    [Authorize(Roles = "Customer")]
    public async Task<ActionResult<IEnumerable<Shipment>>> GetMyShipments()
    {
        var customerId = GetCurrentUserId();

        if (!customerId.HasValue)
        {
            return Unauthorized(new
            {
                message = "The customer account could not be identified."
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
                    shipment.CustomerEmail.ToLower() == customerEmail
                ))
            .OrderByDescending(shipment => shipment.CreatedAtUtc)
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

    $GetUserRegex = [regex]::new(
        '(?<method>\s*private\s+int\?\s+GetCurrentUserId\s*\(\s*\))',
        [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
    )

    $GetUserMatch = $GetUserRegex.Match($Controller)

    if (-not $GetUserMatch.Success) {
        throw "Could not locate GetCurrentUserId(). Add the My Shipments endpoint manually."
    }

    $Controller = $Controller.Insert(
        $GetUserMatch.Index,
        $MyEndpoint
    )

    Write-Host "Applying: GET /api/shipments/my endpoint" -ForegroundColor Cyan
}
else {
    Write-Host "Already present: GET /api/shipments/my" -ForegroundColor Yellow
}

Save-Utf8File $ControllerPath $Controller

if (-not $SkipBuild) {
    Write-Host ""
    Write-Host "Building backend..." -ForegroundColor Cyan
    dotnet build $ApiProject

    if ($LASTEXITCODE -ne 0) {
        throw "Backend build failed. Backup files are in: $BackupRoot"
    }
}

Write-Host ""
Write-Host "Phase 5B backend completed." -ForegroundColor Green
Write-Host "Backup folder: $BackupRoot" -ForegroundColor DarkGray
Write-Host ""
Write-Host "Next:" -ForegroundColor Cyan
Write-Host "1. Start the API."
Write-Host "2. Sign in as Admin and create a shipment using a registered Customer email."
Write-Host "3. Sign in as that Customer."
Write-Host "4. The Customer Portal should request GET /api/shipments/my."
