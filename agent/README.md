# GFL Presence Agent

Lightweight Windows Service that reports PC online status to FormGFL. Each heartbeat includes hostname, BIOS serial number, OS version, logged-in user, and local IP.

## What it does

- Starts automatically when Windows boots (Windows Service)
- Sends `POST /api/v1/presence/heartbeat` immediately, then every 5 minutes (configurable)
- Generates a stable `machineId` on first run
- Matches the PC to inventory when the BIOS serial matches a product SKU in FormGFL

## Requirements

- Windows 10 or later
- Outbound HTTPS access to your FormGFL server
- A FormGFL API key with the **`presence.report`** scope

## Server setup (FormGFL admin)

1. Sign in to FormGFL admin → **Developer → API Integrations**
2. Create a new API key with scope **`presence.report`**
3. Leave the IP whitelist **empty** (office PCs use dynamic/private IPs)
4. Copy the generated key (`gfl_...`)

View reported devices under **System → Devices Online** in the admin panel.

## Install on a Windows PC

### 1. Build the agent (on a dev machine)

```powershell
cd agent
go mod tidy
$env:GOOS="windows"
$env:GOARCH="amd64"
go build -o GFLPresence.exe .
```

On macOS/Linux for cross-compile:

```bash
cd agent
go mod tidy
GOOS=windows GOARCH=amd64 go build -o GFLPresence.exe .
```

### 2. Copy files to the PC

Create the config directory and copy files:

```powershell
New-Item -ItemType Directory -Force -Path "C:\Program Files\GFLPresence"
Copy-Item GFLPresence.exe "C:\Program Files\GFLPresence\"
New-Item -ItemType Directory -Force -Path "C:\ProgramData\GFLPresence"
Copy-Item config.json "C:\ProgramData\GFLPresence\config.json"
```

Use [`config.example.json`](config.example.json) as a template:

```json
{
  "apiUrl": "https://your-formgfl-domain.com/api/v1/presence/heartbeat",
  "apiKey": "gfl_your_api_key_here",
  "intervalSeconds": 300
}
```

### 3. Install and start the service (run as Administrator)

```powershell
cd "C:\Program Files\GFLPresence"
.\GFLPresence.exe -service install
.\GFLPresence.exe -service start
```

### 4. Verify

- Check **Windows Event Viewer → Windows Logs → Application** for `GFL PC Presence Agent` entries
- Open FormGFL admin → **Devices Online** — the PC should appear within a minute

## Service commands

Run from an elevated PowerShell or CMD in the install folder:

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

When the agent reports a BIOS serial number that matches a product **SKU** in FormGFL, the device is automatically linked to that asset, employee, and branch.

Ensure laptop/desktop serial numbers in inventory match the BIOS serial reported by the agent.

## Offline detection

FormGFL marks a device **offline** if no heartbeat is received for **15 minutes** (configurable via `PRESENCE_OFFLINE_THRESHOLD_MINUTES` on the server).

## Rollout to many PCs

For organization-wide deployment:

- **Group Policy (GPO)** — deploy `GFLPresence.exe`, `config.json`, and a startup script that runs `-service install` once
- **Microsoft Intune** — package as a Win32 app with install/uninstall commands
- **SCCM / MECM** — standard software deployment package

Recommended install path: `C:\Program Files\GFLPresence\`  
Recommended config path: `C:\ProgramData\GFLPresence\config.json`

## Security notes

- Store the API key only in `config.json` on each PC; use a dedicated key scoped to `presence.report`
- Use HTTPS in production (`apiUrl` must start with `https://`)
- The agent sends hostname, serial, OS, username, and LAN IP only — no files or process data
- Rotate the API key from FormGFL admin if a machine is decommissioned

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Service won't start | Run `GFLPresence.exe run` in CMD to see errors; check config path and JSON syntax |
| 401 Unauthorized | Verify API key and `presence.report` scope |
| 403 IP not whitelisted | Clear IP whitelist on the API key in Admin → Developer |
| Device not linked to employee | Ensure product SKU in FormGFL matches BIOS serial from the agent |
| PC shows offline | Check network/firewall allows outbound HTTPS; default interval is 5 min, offline threshold is 15 min |

## API reference

**Endpoint:** `POST /api/v1/presence/heartbeat`

**Headers:**
```
Authorization: Bearer gfl_...
Content-Type: application/json
```

**Body:**
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

**Response:**
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
