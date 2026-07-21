# GFL Presence Agent

Lightweight Windows Service that reports PC online status to FormGFL. Each heartbeat includes hostname, BIOS serial number, OS version, logged-in user, and local IP.

**PDF deployment guide (recommended for IT staff):** [`docs/GFL-Presence-Agent-Guide.pdf`](docs/GFL-Presence-Agent-Guide.pdf)  
Regenerate after edits: `npm run docs:presence-pdf`

## What it does

- Starts automatically when Windows boots (Windows Service)
- Sends `POST /api/v1/presence/heartbeat` immediately, then every 5 minutes (configurable)
- Generates a stable `machineId` on first run
- **CMD installer** lists branches, looks up the employee by email, reads the BIOS serial, creates the inventory asset if missing, assigns the employee, then installs the service
- Ongoing heartbeats match the PC to inventory when the BIOS serial matches a product SKU

## Requirements

- Windows 10 or later
- Outbound HTTPS access to your FormGFL server
- A FormGFL API key with **`presence.report`** and **`presence.enroll`** scopes
- Employee email already exists in FormGFL for the selected branch

## Server setup (FormGFL admin)

**Option A — CLI (from the FormGFL project root):**

```bash
npm run seed:presence-key
```

This creates a key named **GFL Presence Agent** with scopes `presence.report` + `presence.enroll` and whitelist `0.0.0.0/0` (allows all office PCs). The raw key is printed once.

**Option B — Admin UI:**

1. Sign in to FormGFL admin → **Developer → API Integrations**
2. Create a new API key with scopes **`presence.report`** and **`presence.enroll`**
3. Set IP whitelist to **`0.0.0.0/0`** (office PCs use dynamic/private IPs; the app requires at least one whitelist entry)
4. Copy the generated key (`gfl_...`)

View reported devices under **System → Devices Online** in the admin panel.

## Install on a Windows PC (recommended — CMD wizard)

### 1. Build the agent (on a dev machine)

From the FormGFL project root:

```bash
npm run agent:build
```

Output: `agent/GFLPresence.exe`

### 2. Prepare the install folder

Copy these files into one folder (USB stick, network share, etc.):

```
GFLPresence/
  Install-GFLPresence.cmd
  setup.ps1
  GFLPresence.exe
  config.json
```

Create `config.json` from [`config.example.json`](config.example.json):

```json
{
  "apiUrl": "https://your-formgfl-domain.com/api/v1/presence/heartbeat",
  "apiKey": "gfl_your_api_key_here",
  "intervalSeconds": 300
}
```

### 3. Run the installer on the PC

1. Right-click **`Install-GFLPresence.cmd`** → **Run as administrator**
2. Approve the UAC prompt
3. Answer the wizard prompts:
   - Select your **branch** (list loaded from FormGFL)
   - Enter your **employee email** (must exist for that branch)
   - Confirm the detected **BIOS serial** (or type it manually)
   - Choose device type if creating a new asset (`Laptop` / `Desktop` / `All-in-One`)
4. The script will:
   - Look up the employee
   - Create the inventory asset if the serial is new, or reassign it if it already exists
   - Write `C:\ProgramData\GFLPresence\config.json`
   - Install and start the **GFL PC Presence Agent** Windows Service

### 4. Verify

- Open FormGFL admin → **Devices Online** — the PC should appear as **Online**
- The asset should be assigned to the employee under inventory
- Optional: **Services** (`services.msc`) → **GFL PC Presence Agent** = Running

## Manual install (advanced)

### Build

```powershell
cd agent
go mod tidy
$env:GOOS="windows"
$env:GOARCH="amd64"
go build -ldflags="-s -w" -o GFLPresence.exe .
```

On macOS/Linux:

```bash
cd agent
bash build.sh
```

### Copy files and start service

```powershell
New-Item -ItemType Directory -Force -Path "C:\Program Files\GFLPresence"
Copy-Item GFLPresence.exe "C:\Program Files\GFLPresence\"
New-Item -ItemType Directory -Force -Path "C:\ProgramData\GFLPresence"
Copy-Item config.json "C:\ProgramData\GFLPresence\config.json"
cd "C:\Program Files\GFLPresence"
.\GFLPresence.exe -service install
.\GFLPresence.exe -service start
```

Manual install does **not** run the enroll/link wizard — use the CMD installer for employee assignment.

## Service commands

Run from an elevated PowerShell or CMD in `C:\Program Files\GFLPresence\`:

| Command | Description |
|---------|-------------|
| `GFLPresence.exe -service install` | Register as auto-start Windows Service |
| `GFLPresence.exe -service start` | Start the service |
| `GFLPresence.exe -service stop` | Stop the service |
| `GFLPresence.exe -service restart` | Restart the service |
| `GFLPresence.exe -service uninstall` | Remove the service |
| `GFLPresence.exe run` | Run in foreground (testing) |

## Config location

Default: `C:\ProgramData\GFLPresence\config.json`

Override with environment variable:

```powershell
setx GFL_PRESENCE_CONFIG_DIR "D:\GFLPresence"
```

Machine ID is stored at `C:\ProgramData\GFLPresence\machine-id.txt` and reused across restarts.

## Linking PCs to inventory

The **CMD installer** creates the product if the BIOS serial is not in inventory, then assigns the looked-up employee.

Ongoing heartbeats also match BIOS serial → product **SKU**. Ensure serial numbers stay consistent.

## Offline detection

FormGFL marks a device **offline** if no heartbeat is received for **15 minutes** (configurable via `PRESENCE_OFFLINE_THRESHOLD_MINUTES` on the server).

## Rollout to many PCs

For organization-wide deployment:

- Copy the install folder (with pre-filled `config.json`) to each PC and run `Install-GFLPresence.cmd` as Administrator
- **Group Policy (GPO)** / **Intune** / **SCCM** can distribute the folder; users still answer branch + email prompts once

Recommended install path: `C:\Program Files\GFLPresence\`  
Recommended config path: `C:\ProgramData\GFLPresence\config.json`

## Security notes

- Store the API key only in `config.json` on each PC; use a dedicated key scoped to `presence.report` + `presence.enroll`
- Use HTTPS in production (`apiUrl` must start with `https://`)
- The agent sends hostname, serial, OS, username, and LAN IP only — no files or process data
- Rotate the API key from FormGFL admin if a machine is decommissioned

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Service won't start | Run `GFLPresence.exe run` in CMD to see errors; check config path and JSON syntax |
| 401 Unauthorized | Verify API key has `presence.report` and (for installer) `presence.enroll` |
| 403 IP not whitelisted | Set API key whitelist to `0.0.0.0/0` in Admin → Developer |
| Employee not found | Email must exist for the selected branch in FormGFL |
| Device not linked | Re-run the CMD installer, or ensure product SKU matches BIOS serial |
| PC shows offline | Check network/firewall allows outbound HTTPS; default interval is 5 min, offline threshold is 15 min |

## API reference

### Heartbeat

**Endpoint:** `POST /api/v1/presence/heartbeat`  
**Scope:** `presence.report`

### Setup wizard (used by CMD installer)

| Method | Path | Scope |
|--------|------|-------|
| `GET` | `/api/v1/presence/setup/branches` | `presence.enroll` |
| `POST` | `/api/v1/presence/setup/lookup` | `presence.enroll` |
| `POST` | `/api/v1/presence/setup/enroll` | `presence.enroll` |

**Enroll body:**
```json
{
  "branchId": "brn-…",
  "email": "jane@goodfellow.co.zm",
  "serialNumber": "ABC123XYZ",
  "hostname": "DESK-042",
  "machineId": "uuid-from-agent",
  "osVersion": "Microsoft Windows 11 Pro",
  "loggedInUser": "jdoe",
  "localIp": "192.168.1.42",
  "agentVersion": "1.0.0",
  "deviceType": "Laptop"
}
```

**Enroll behavior:** if no product has `sku = serialNumber`, create one and assign the employee; if it exists, reassign to that employee; then mark presence online.
