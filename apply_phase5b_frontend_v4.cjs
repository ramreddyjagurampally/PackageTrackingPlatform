const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projectRoot = process.cwd();
const frontendRoot = path.join(projectRoot, 'src', 'package-tracking-web');
const appPath = path.join(frontendRoot, 'src', 'App.tsx');

if (!fs.existsSync(appPath)) {
  throw new Error(`App.tsx was not found at: ${appPath}`);
}

const timestamp = new Date()
  .toISOString()
  .replace(/[-:TZ.]/g, '')
  .slice(0, 14);

const backupPath = `${appPath}.phase5b-backup-${timestamp}`;
fs.copyFileSync(appPath, backupPath);
console.log(`Backup created: ${backupPath}`);

let content = fs.readFileSync(appPath, 'utf8');

function replaceOnce(regex, replacement, description) {
  if (!regex.test(content)) {
    throw new Error(`Could not locate code for: ${description}`);
  }

  content = content.replace(regex, replacement);
  console.log(`Applied: ${description}`);
}

// 1. Add customerEmail state.
if (!/const\s+\[customerEmail,\s*setCustomerEmail\]/.test(content)) {
  replaceOnce(
    /(const\s+\[recipientName,\s*setRecipientName\]\s*=\s*useState\(""\)\s*;)/,
    `$1\n  const [customerEmail, setCustomerEmail] = useState("");`,
    'customer email React state'
  );
} else {
  console.log('Already present: customer email React state');
}

// 2. Detect Customer role.
if (!/const\s+isCustomer\s*=/.test(content)) {
  replaceOnce(
    /(const\s+isDriver\s*=\s*roles\.includes\("Driver"\)\s*;)/,
    `$1\n  const isCustomer = roles.includes("Customer");`,
    'Customer role detection'
  );
} else {
  console.log('Already present: Customer role detection');
}

// 3. Add customer shipment loader.
if (!/async\s+function\s+loadCustomerShipments\s*\(/.test(content)) {
  const loader = `  async function loadCustomerShipments() {
    setIsLoadingDashboard(true);
    setDashboardError("");

    try {
      const response = await fetch(
        \`${'${apiBaseUrl}'}/api/shipments/my\`,
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

      const customerShipments =
        (await response.json()) as Shipment[];

      setShipments(customerShipments);
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

`;

  const marker = '  async function refreshDashboard';
  const index = content.indexOf(marker);

  if (index < 0) {
    throw new Error('Could not locate refreshDashboard() in App.tsx.');
  }

  content = content.slice(0, index) + loader + content.slice(index);
  console.log('Applied: GET /api/shipments/my loader');
} else {
  console.log('Already present: customer shipment loader');
}

// 4. Automatically load customer shipments after login.
if (!content.includes('Customer portal automatic loading')) {
  const effect = `
  // Customer portal automatic loading.
  useEffect(() => {
    if (
      auth &&
      isCustomer &&
      !canManageShipments &&
      !isDriver
    ) {
      void loadCustomerShipments();
    }
  }, [auth]);

`;

  const returnIndex = content.lastIndexOf('\n  return (');

  if (returnIndex < 0) {
    throw new Error('Could not locate the main React return statement.');
  }

  content = content.slice(0, returnIndex) + effect + content.slice(returnIndex);
  console.log('Applied: automatic customer shipment loading');
} else {
  console.log('Already present: automatic customer loading');
}

// 5. Send customerEmail in create-shipment request.
if (!/customerEmail:\s*customerEmail\.trim\(\)/.test(content)) {
  replaceOnce(
    /(recipientName:\s*recipientName\.trim\(\)\s*,)/,
    `$1\n            customerEmail: customerEmail.trim(),`,
    'customer email in create-shipment request'
  );
} else {
  console.log('Already present: customer email request field');
}

// 6. Clear customerEmail after successful creation.
if (!/setCustomerEmail\(""\)/.test(content)) {
  replaceOnce(
    /(setRecipientName\(""\)\s*;)/,
    `$1\n      setCustomerEmail("");`,
    'customer email form reset'
  );
} else {
  console.log('Already present: customer email form reset');
}

// 7. Add Customer account email field to shipment form.
if (!content.includes('Customer account email')) {
  const customerField = `
              <label>
                Customer account email

                <input
                  type="email"
                  value={customerEmail}
                  onChange={(event) =>
                    setCustomerEmail(
                      event.target.value
                    )
                  }
                  placeholder="johncustomer@example.com"
                  required
                />
              </label>
`;

  const originRegex = /(\s*<label>\s*Origin\s*<input\s*type="text"\s*value=\{origin\})/s;

  if (!originRegex.test(content)) {
    throw new Error('Could not locate the Origin field in the Create Shipment form.');
  }

  content = content.replace(originRegex, `${customerField}$1`);
  console.log('Applied: Customer account email form field');
} else {
  console.log('Already present: Customer account email form field');
}

// 8. Allow Customer-only accounts to see the dashboard.
if (!/canManageShipments\s*\|\|\s*isDriver\s*\|\|\s*isCustomer/.test(content)) {
  replaceOnce(
    /\(canManageShipments\s*\|\|\s*isDriver\)/,
    '(canManageShipments || isDriver || isCustomer)',
    'Customer Portal dashboard visibility'
  );
} else {
  console.log('Already present: Customer Portal dashboard visibility');
}

// 9. Customer Portal title.
if (!content.includes('"Customer Portal"')) {
  replaceOnce(
    /\{isDriver\s*&&\s*!canManageShipments\s*\?\s*"Driver Dashboard"\s*:\s*"Operations Dashboard"\}/s,
    `{isCustomer &&
                  !canManageShipments &&
                  !isDriver
                    ? "Customer Portal"
                    : isDriver &&
                      !canManageShipments
                      ? "Driver Dashboard"
                      : "Operations Dashboard"}`,
    'Customer Portal title'
  );
} else {
  console.log('Already present: Customer Portal title');
}

// 10. Customer dashboard heading.
if (!content.includes('"My shipments"')) {
  replaceOnce(
    /\{isDriver\s*&&\s*!canManageShipments\s*\?\s*"My assigned shipments"\s*:\s*"Shipment overview"\}/s,
    `{isCustomer &&
                  !canManageShipments &&
                  !isDriver
                    ? "My shipments"
                    : isDriver &&
                      !canManageShipments
                      ? "My assigned shipments"
                      : "Shipment overview"}`,
    'Customer dashboard heading'
  );
} else {
  console.log('Already present: Customer dashboard heading');
}

// 11. Customer refresh button.
if (!content.includes('loadCustomerShipments()\n                      : refreshDashboard()')) {
  replaceOnce(
    /onClick=\{\(\)\s*=>\s*void\s+refreshDashboard\(\)\s*\}/s,
    `onClick={() =>
                  void (
                    isCustomer &&
                    !canManageShipments &&
                    !isDriver
                      ? loadCustomerShipments()
                      : refreshDashboard()
                  )
                }`,
    'Customer dashboard refresh'
  );
} else {
  console.log('Already present: Customer dashboard refresh');
}

// 12. Customer-specific search placeholder.
if (!content.includes('Search my shipments')) {
  replaceOnce(
    /placeholder="Search shipment, customer, location, or driver"/,
    `placeholder={
                  isCustomer &&
                  !canManageShipments &&
                  !isDriver
                    ? "Search my shipments"
                    : "Search shipment, customer, location, or driver"
                }`,
    'Customer search placeholder'
  );
} else {
  console.log('Already present: Customer search placeholder');
}

fs.writeFileSync(appPath, content, 'utf8');
console.log('Updated App.tsx successfully.');

if (!process.argv.includes('--skip-build')) {
  console.log('Building the React frontend...');
  execSync('npm run build', {
    cwd: frontendRoot,
    stdio: 'inherit',
    shell: true,
  });
}

console.log('Phase 5B frontend completed.');
console.log('Next: npm run dev, sign in as Admin, and create a shipment for johncustomer@example.com.');