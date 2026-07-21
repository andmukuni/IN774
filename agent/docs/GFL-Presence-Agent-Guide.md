# GFL Presence Agent — Deployment Guide

**Goodfellow IT Inventory · FormGFL**  
**Document version:** 1.0 · **Agent version:** 1.0.0  
**Purpose:** Monitor which Windows PCs are online across your organization

---

## 1. Overview

The **GFL Presence Agent** is a small Windows program that runs as a background service on each PC. It sends a short “heartbeat” message to your FormGFL server so IT can see which machines are turned on, who is logged in, and whether they match inventory records.

### What the agent does

| Action | Detail |
|--------|--------|
| Starts on boot | Runs automatically as a Windows Service |
| Sends heartbeats | Immediately on start, then every **5 minutes** (configurable) |
| Identifies the PC | Uses a stable machine ID, hostname, and BIOS serial number |
| Links to inventory | CMD installer creates asset if missing, then assigns employee; heartbeats match BIOS serial → SKU |
| Reports status only | Sends hostname, serial, OS, logged-in user, and LAN IP — **no files or process data** |

### How online / offline works

```
PC boots  →  Agent starts  →  POST heartbeat  →  FormGFL marks device ONLINE
PC sleeps / network lost  →  No heartbeat for 15 min  →  FormGFL marks device OFFLINE
```

View all devices in FormGFL admin: **System → Devices Online**

---

## 2. Requirements

### On each Windows PC

- Windows 10 or later
- Outbound **HTTPS** access to your FormGFL server
- Administrator rights for one-time service installation

### On the FormGFL server

- FormGFL deployed with PC presence monitoring enabled
- An API key with scopes **`presence.report`** and **`presence.enroll`**
- Employee email already exists in FormGFL for the selected branch

---

## 3. Architecture (how it fits together)

```
┌─────────────────┐         HTTPS POST          ┌──────────────────────┐
│  Windows PC     │  /api/v1/presence/heartbeat │  FormGFL Server      │
│  GFLPresence    │ ──────────────────────────► │  MySQL database      │
│  (Service)      │   every 5 minutes           │  device_presence     │
└─────────────────┘                             └──────────┬───────────┘
                                                           │
                                                           ▼
                                                ┌──────────────────────┐
                                                │  Admin Dashboard     │
                                                │  Devices Online      │
                                                └──────────────────────┘
```

---

## 4. Phase 1 — Server setup (FormGFL admin)

Complete this **once** before installing agents on PCs.

### Option A — Command line (recommended for IT)

From the FormGFL project folder on a machine with database access:

```bash
npm run seed:presence-key
```

This creates an API key named **GFL Presence Agent** with:

- Scopes: `presence.report` + `presence.enroll`
- IP whitelist: `0.0.0.0/0` (allows all office PCs)

**Important:** Copy the key when it is printed — it is shown only once.

### Option B — Admin web interface

1. Sign in to FormGFL admin
2. Go to **Developer → API Integrations**
3. Click **Create API key**
4. Set scopes to **`presence.report`** and **`presence.enroll`**
5. Set IP whitelist to **`0.0.0.0/0`**
6. Save and copy the key (starts with `gfl_...`)

### Verify server is ready

1. Open FormGFL admin → **Devices Online**
2. The page should load (may show “No devices reporting yet” until agents are installed)

---

## 5. Phase 2 — Build the agent (developer machine)

Build the `.exe` once, then copy it to all PCs.

### Step 2.1 — Install Go (if not installed)

- Download from https://go.dev/dl/
- Or on macOS: `brew install go`

### Step 2.2 — Build the Windows executable

From the FormGFL project root:

```bash
npm run agent:build
```

**Output file:** `agent/GFLPresence.exe` (approx. 6 MB)

### Alternative build commands

**PowerShell (Windows):**

```powershell
cd agent
go mod tidy
$env:GOOS = "windows"
$env:GOARCH = "amd64"
go build -ldflags="-s -w" -o GFLPresence.exe .
```

**macOS / Linux (cross-compile):**

```bash
cd agent
bash build.sh
```

---

## 6. Phase 3 — Prepare configuration

Create `config.json` for each PC (or use the same file for all PCs in your organization).

**File location on PC:** `C:\ProgramData\GFLPresence\config.json`

**Template:**

```json
{
  "apiUrl": "https://your-formgfl-domain.com/api/v1/presence/heartbeat",
  "apiKey": "gfl_your_api_key_here",
  "intervalSeconds": 300
}
```

| Field | Description |
|-------|-------------|
| `apiUrl` | Full URL to your FormGFL heartbeat endpoint. Must use **HTTPS** in production. |
| `apiKey` | The `gfl_...` key from Phase 1 |
| `intervalSeconds` | Seconds between heartbeats. Default: **300** (5 minutes) |

---

## 7. Phase 4 — Install with CMD wizard (recommended)

This path enrolls the PC, creates/links the inventory asset to the employee, and starts the service.

### Step 4.1 — Prepare the install folder

Copy these files to a USB stick or network share:

```
GFLPresence/
  Install-GFLPresence.cmd
  setup.ps1
  GFLPresence.exe
  config.json
```

Pre-fill `config.json` with your production `apiUrl` and API key (from Phase 1 / Phase 3).

### Step 4.2 — Run as Administrator

1. Right-click **`Install-GFLPresence.cmd`** → **Run as administrator**
2. Approve the UAC prompt

### Step 4.3 — Answer the prompts

| Prompt | What happens |
|--------|--------------|
| Select branch | Lists active branches from FormGFL |
| Employee email | Looks up employee for that branch (must already exist) |
| BIOS serial | Auto-detected; confirm or type manually |
| Device type | Laptop / Desktop / All-in-One — used only when creating a new asset |

### Step 4.4 — What the installer does

- Creates the inventory asset if the serial is new, or reassigns an existing asset
- Marks the PC online in **Devices Online**
- Writes `C:\ProgramData\GFLPresence\config.json`
- Installs and starts the **GFL PC Presence Agent** Windows Service

### Step 4.5 — Verify

| Where | What to check |
|-------|---------------|
| FormGFL → Devices Online | PC appears as **Online** with employee + branch |
| Inventory | Asset assigned to the employee |
| Services (`services.msc`) | **GFL PC Presence Agent** — Running, Automatic |

### Manual install (advanced)

Use only if you do not need the enroll/link wizard:

```powershell
New-Item -ItemType Directory -Force -Path "C:\Program Files\GFLPresence"
Copy-Item GFLPresence.exe "C:\Program Files\GFLPresence\"
New-Item -ItemType Directory -Force -Path "C:\ProgramData\GFLPresence"
Copy-Item config.json "C:\ProgramData\GFLPresence\config.json"
cd "C:\Program Files\GFLPresence"
.\GFLPresence.exe -service install
.\GFLPresence.exe -service start
```

---

## 8. Service management commands

Run from an elevated PowerShell in `C:\Program Files\GFLPresence\`:

| Command | What it does |
|---------|--------------|
| `GFLPresence.exe -service install` | Register as auto-start Windows Service |
| `GFLPresence.exe -service start` | Start the service |
| `GFLPresence.exe -service stop` | Stop the service |
| `GFLPresence.exe -service restart` | Restart the service |
| `GFLPresence.exe -service uninstall` | Remove the service |
| `GFLPresence.exe run` | Run in foreground (for testing only) |

---

## 9. Linking PCs to inventory

When the agent sends a BIOS serial number that matches a product **SKU** in FormGFL, the device is automatically linked to:

- The inventory asset (product)
- The assigned employee
- The branch

**Action for IT:** Ensure laptop and desktop serial numbers in FormGFL inventory match the BIOS serial reported by the agent.

To check the serial on a PC:

```powershell
(Get-CimInstance Win32_BIOS).SerialNumber
```

---

## 10. Rollout to many PCs

For organization-wide deployment, use one of these methods:

| Method | Notes |
|--------|-------|
| **Group Policy (GPO)** | Deploy `GFLPresence.exe`, `config.json`, and a one-time install script |
| **Microsoft Intune** | Package as a Win32 app with install/uninstall commands |
| **SCCM / MECM** | Standard software deployment package |

**Recommended paths:**

| Item | Path |
|------|------|
| Program files | `C:\Program Files\GFLPresence\` |
| Configuration | `C:\ProgramData\GFLPresence\config.json` |
| Machine ID (auto-created) | `C:\ProgramData\GFLPresence\machine-id.txt` |

---

## 11. Security notes

- Store the API key **only** in `config.json` on each PC
- Use a dedicated API key scoped to **`presence.report`** + **`presence.enroll`**
- Use **HTTPS** in production — `apiUrl` must start with `https://`
- The agent sends hostname, serial, OS, username, and LAN IP only
- Rotate the API key from FormGFL admin if a machine is decommissioned or compromised

---

## 12. Troubleshooting

| Problem | Solution |
|---------|----------|
| Service won't start | Run `GFLPresence.exe run` in CMD to see errors; check config path and JSON syntax |
| 401 Unauthorized | Verify API key has `presence.report` and `presence.enroll` |
| 403 IP not whitelisted | Set API key whitelist to `0.0.0.0/0` in Admin → Developer |
| Employee not found | Email must exist for the selected branch in FormGFL |
| Device not linked to employee | Re-run `Install-GFLPresence.cmd` as Administrator |
| PC shows offline | Check network/firewall allows outbound HTTPS; heartbeat every 5 min, offline after 15 min |
| PC not appearing at all | Confirm service is running; check Event Viewer for errors |

---

## 13. API reference (for developers)

**Endpoint:** `POST /api/v1/presence/heartbeat`

**Headers:**

```
Authorization: Bearer gfl_...
Content-Type: application/json
```

**Request body:**

```json
{
  "machineId": "uuid-from-agent",
  "hostname": "DESK-042",
  "serialNumber": "ABC123XYZ",
  "osVersion": "Microsoft Windows 11 Pro 10.0.22631",
  "loggedInUser": "jdoe",
  "localIp": "192.168.1.42",
  "agentVersion": "1.0.0"
}
```

**Success response:**

```json
{
  "ok": true,
  "data": {
    "id": "...",
    "machineId": "...",
    "onlineStatus": "online",
    "lastHeartbeatAt": "2026-07-21T15:30:00.000Z"
  }
}
```

---

## 14. Quick checklist

Use this checklist when deploying to a new PC:

- [ ] FormGFL server is live and **Devices Online** page loads
- [ ] API key created with `presence.report` + `presence.enroll` scopes
- [ ] Install folder prepared (`Install-GFLPresence.cmd`, `setup.ps1`, `GFLPresence.exe`, `config.json`)
- [ ] `Install-GFLPresence.cmd` run as Administrator
- [ ] Branch selected and employee email verified
- [ ] BIOS serial confirmed; asset created or linked
- [ ] PC appears in **Devices Online** within 1 minute

---

*Goodfellow IT · FormGFL Presence Agent · Document generated from agent deployment guide*
