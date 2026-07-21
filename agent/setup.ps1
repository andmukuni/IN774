#Requires -Version 5.1
<#
.SYNOPSIS
  Interactive GFL Presence agent setup wizard for Windows.
.DESCRIPTION
  Lists branches, looks up employee by email, reads BIOS serial,
  enrolls/creates the inventory asset, installs and starts the service.
#>

$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProgramDir = 'C:\Program Files\GFLPresence'
$ConfigDir = 'C:\ProgramData\GFLPresence'
$AgentExeName = 'GFLPresence.exe'
$AgentVersion = '1.0.0'
$InstallerVersion = '1.1.0'

function Write-Step([string]$Message) {
  Write-Host ""
  Write-Host ">>> $Message" -ForegroundColor Cyan
}

function Write-Ok([string]$Message) {
  Write-Host "  OK: $Message" -ForegroundColor Green
}

function Write-Warn([string]$Message) {
  Write-Host "  WARN: $Message" -ForegroundColor Yellow
}

function Write-Err([string]$Message) {
  Write-Host "  ERROR: $Message" -ForegroundColor Red
}

function Get-LocalConfigPath {
  $candidates = @(
    (Join-Path $ScriptDir 'config.json'),
    (Join-Path $ConfigDir 'config.json')
  )
  foreach ($path in $candidates) {
    if (Test-Path $path) { return $path }
  }
  return $null
}

function Read-JsonFile([string]$Path) {
  $raw = Get-Content -Path $Path -Raw -Encoding UTF8
  return $raw | ConvertFrom-Json
}

function Save-JsonFile([string]$Path, $Object) {
  $dir = Split-Path -Parent $Path
  if (-not (Test-Path $dir)) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
  }
  ($Object | ConvertTo-Json -Depth 6) | Set-Content -Path $Path -Encoding UTF8
}

function Get-ApiBaseUrl([string]$ApiUrl) {
  $url = $ApiUrl.Trim().TrimEnd('/')
  if ($url -match '/api/v1/presence/heartbeat$') {
    return ($url -replace '/presence/heartbeat$', '')
  }
  if ($url -match '/api/v1$') {
    return $url
  }
  if ($url -match '/api/v1/') {
    return ($url -replace '/api/v1/.*$', '/api/v1')
  }
  # Accept bare origin like https://inv.example.com
  return ($url.TrimEnd('/') + '/api/v1')
}

function Invoke-GflApi {
  param(
    [Parameter(Mandatory = $true)][string]$Method,
    [Parameter(Mandatory = $true)][string]$Url,
    [Parameter(Mandatory = $true)][string]$ApiKey,
    [hashtable]$Body = $null
  )

  $headers = @{
    Authorization = "Bearer $ApiKey"
    'Content-Type' = 'application/json'
    Accept = 'application/json'
  }

  try {
    if ($null -ne $Body) {
      $json = $Body | ConvertTo-Json -Depth 6 -Compress
      return Invoke-RestMethod -Method $Method -Uri $Url -Headers $headers -Body $json -TimeoutSec 45
    }
    return Invoke-RestMethod -Method $Method -Uri $Url -Headers $headers -TimeoutSec 45
  }
  catch {
    $detail = $_.Exception.Message
    if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
      try {
        $parsed = $_.ErrorDetails.Message | ConvertFrom-Json
        if ($parsed.message) { $detail = $parsed.message }
        elseif ($parsed.Message) { $detail = $parsed.Message }
      }
      catch {
        $detail = $_.ErrorDetails.Message
      }
    }
    throw [System.Exception]::new($detail, $_.Exception)
  }
}

function Get-BiosSerial {
  try {
    $serial = (Get-CimInstance -ClassName Win32_BIOS -ErrorAction Stop).SerialNumber
    $serial = [string]$serial
    if ($serial) {
      $serial = $serial.Trim()
      if ($serial -and $serial -notin @('To be filled by O.E.M.', 'Default string', 'None', 'N/A')) {
        return $serial
      }
    }
  }
  catch { }

  try {
    $out = & wmic bios get serialnumber 2>$null
    foreach ($line in $out) {
      $line = ([string]$line).Trim()
      if (-not $line -or $line -eq 'SerialNumber') { continue }
      if ($line -notin @('To be filled by O.E.M.', 'Default string', 'None', 'N/A')) {
        return $line
      }
    }
  }
  catch { }

  return ''
}

function Get-OsCaption {
  try {
    $os = Get-CimInstance -ClassName Win32_OperatingSystem -ErrorAction Stop
    return ("{0} {1}" -f $os.Caption, $os.Version).Trim()
  }
  catch {
    return 'Windows'
  }
}

function Get-LoggedInUser {
  try {
    $user = (Get-CimInstance -ClassName Win32_ComputerSystem -ErrorAction Stop).UserName
    if ($user -and $user -match '\\') {
      return ($user -split '\\')[-1]
    }
    if ($user) { return $user }
  }
  catch { }
  return $env:USERNAME
}

function Get-PrimaryIPv4 {
  try {
    $addrs = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
      Where-Object { $_.IPAddress -notlike '127.*' -and $_.PrefixOrigin -ne 'WellKnown' } |
      Select-Object -ExpandProperty IPAddress
    if ($addrs) { return $addrs[0] }
  }
  catch { }
  return ''
}

function Ensure-MachineId([string]$Dir) {
  $path = Join-Path $Dir 'machine-id.txt'
  if (Test-Path $path) {
    $existing = (Get-Content -Path $path -Raw).Trim()
    if ($existing) { return $existing }
  }
  if (-not (Test-Path $Dir)) {
    New-Item -ItemType Directory -Force -Path $Dir | Out-Null
  }
  $id = [guid]::NewGuid().ToString()
  Set-Content -Path $path -Value $id -Encoding ASCII
  return $id
}

# --- Main -------------------------------------------------------------------

Write-Host ""
Write-Host "GFL Presence Agent - Setup Wizard (installer v$InstallerVersion)" -ForegroundColor White
Write-Host "This will enroll this PC in FormGFL and install the online monitoring service."
Write-Host "If email is new, you can register the employee during setup."
Write-Host ""

# 1) Config / API credentials
Write-Step "API configuration"

$configPath = Get-LocalConfigPath
$config = $null

if ($configPath) {
  Write-Host "  Found config: $configPath"
  $config = Read-JsonFile $configPath
}

$apiUrl = if ($config -and $config.apiUrl) { [string]$config.apiUrl } else { '' }
$apiKey = if ($config -and $config.apiKey) { [string]$config.apiKey } else { '' }
$intervalSeconds = if ($config -and $config.intervalSeconds) { [int]$config.intervalSeconds } else { 300 }

if (-not $apiUrl) {
  $apiUrl = Read-Host "Enter FormGFL API URL (e.g. https://inv.example.com/api/v1/presence/heartbeat)"
}
if (-not $apiKey) {
  $apiKey = Read-Host "Enter API key (gfl_...)"
}

$apiUrl = $apiUrl.Trim()
$apiKey = $apiKey.Trim()
if (-not $apiUrl -or -not $apiKey) {
  Write-Err "apiUrl and apiKey are required."
  exit 1
}
if ($apiKey -notlike 'gfl_*') {
  Write-Warn "API key does not start with gfl_ - continuing anyway."
}

$apiBase = Get-ApiBaseUrl $apiUrl
$heartbeatUrl = if ($apiUrl -match '/presence/heartbeat$') { $apiUrl } else { "$apiBase/presence/heartbeat" }
Write-Ok "API base: $apiBase"

# 2) List branches
Write-Step "Loading branches from FormGFL"
try {
  $branchResponse = Invoke-GflApi -Method GET -Url "$apiBase/presence/setup/branches" -ApiKey $apiKey
}
catch {
  Write-Err "Could not load branches: $($_.Exception.Message)"
  Write-Host "  Check apiUrl, API key, and that the key has the presence.enroll scope."
  exit 1
}

$branches = @($branchResponse.data)
if ($branches.Count -eq 0) {
  Write-Err "No active branches returned by the server."
  exit 1
}

Write-Host ""
Write-Host "  Select your branch:"
for ($i = 0; $i -lt $branches.Count; $i++) {
  $b = $branches[$i]
  $label = "{0}. {1}" -f ($i + 1), $b.name
  if ($b.code) { $label += " [$($b.code)]" }
  if ($b.city) { $label += " - $($b.city)" }
  Write-Host "  $label"
}

$branch = $null
while (-not $branch) {
  $choice = Read-Host "Enter branch number (1-$($branches.Count))"
  $idx = 0
  if ([int]::TryParse($choice, [ref]$idx) -and $idx -ge 1 -and $idx -le $branches.Count) {
    $branch = $branches[$idx - 1]
  }
  else {
    Write-Warn "Invalid selection. Try again."
  }
}
Write-Ok "Branch: $($branch.name)"

# 3) Employee email lookup / register
Write-Step "Employee lookup"
$employee = $null
$newEmployee = $null
while (-not $employee) {
  $email = Read-Host "Enter your work email"
  $email = $email.Trim()
  if (-not $email) {
    Write-Warn "Email is required."
    continue
  }
  try {
    $lookup = Invoke-GflApi -Method POST -Url "$apiBase/presence/setup/lookup" -ApiKey $apiKey -Body @{
      branchId = $branch.id
      email = $email
    }
  }
  catch {
    Write-Err $_.Exception.Message
    continue
  }

  if ($lookup.data.found -and $lookup.data.employee) {
    $employee = $lookup.data.employee
    if ($lookup.data.matchedOtherBranch) {
      Write-Warn ("Found at another branch ({0}). Will move to {1}." -f $employee.branchName, $branch.name)
    }
    Write-Ok ("Found: {0} ({1})" -f $employee.fullName, $employee.employeeCode)
    continue
  }

  Write-Warn ("No employee found for {0}." -f $lookup.data.email)
  $register = Read-Host "Register as a new employee at this branch? (Y/n)"
  if ($register -and $register.Trim().ToLower() -eq 'n') {
    Write-Host "  Enter a different email, or type Ctrl+C to cancel."
    continue
  }

  $firstName = ''
  $lastName = ''
  while (-not $firstName) {
    $firstName = (Read-Host "First name").Trim()
    if (-not $firstName) { Write-Warn "First name is required." }
  }
  while (-not $lastName) {
    $lastName = (Read-Host "Last name").Trim()
    if (-not $lastName) { Write-Warn "Last name is required." }
  }
  $phone = (Read-Host "Phone (optional)").Trim()
  $jobTitle = (Read-Host "Job title (optional)").Trim()

  $newEmployee = @{
    firstName = $firstName
    lastName = $lastName
    phone = $phone
    jobTitle = $jobTitle
  }
  $employee = @{
    email = $lookup.data.email
    fullName = "$firstName $lastName"
    employeeCode = '(new)'
  }
  Write-Ok ("Will register: {0} <{1}>" -f $employee.fullName, $employee.email)
}

# 4) BIOS serial
Write-Step "Detecting device serial number"
$serial = Get-BiosSerial
if (-not $serial) {
  Write-Warn "Could not read BIOS serial automatically."
  $serial = Read-Host "Enter device serial number (S/N) manually"
  $serial = $serial.Trim()
}
else {
  Write-Host "  Detected serial: $serial"
  $confirm = Read-Host "Use this serial? (Y/n)"
  if ($confirm -and $confirm.Trim().ToLower() -eq 'n') {
    $serial = Read-Host "Enter device serial number (S/N)"
    $serial = $serial.Trim()
  }
}
if (-not $serial) {
  Write-Err "Serial number is required."
  exit 1
}
Write-Ok "Serial: $serial"

# 5) Device type (used only when creating)
Write-Step "Device type"
Write-Host "  1. Laptop (default)"
Write-Host "  2. Desktop"
Write-Host "  3. All-in-One"
$typeChoice = Read-Host "Select device type (1-3) or press Enter for Laptop"
switch ($typeChoice.Trim()) {
  '2' { $deviceType = 'Desktop' }
  '3' { $deviceType = 'All-in-One' }
  default { $deviceType = 'Laptop' }
}
Write-Ok "Type: $deviceType"

# 6) Enroll
Write-Step "Enrolling PC in FormGFL"
if (-not (Test-Path $ConfigDir)) {
  New-Item -ItemType Directory -Force -Path $ConfigDir | Out-Null
}
$machineId = Ensure-MachineId $ConfigDir
$hostname = $env:COMPUTERNAME
$osVersion = Get-OsCaption
$loggedInUser = Get-LoggedInUser
$localIp = Get-PrimaryIPv4

try {
  $enrollBody = @{
    branchId = $branch.id
    email = $employee.email
    serialNumber = $serial
    hostname = $hostname
    machineId = $machineId
    osVersion = $osVersion
    loggedInUser = $loggedInUser
    localIp = $localIp
    agentVersion = $AgentVersion
    deviceType = $deviceType
  }
  if ($null -ne $newEmployee) {
    $enrollBody.newEmployee = $newEmployee
  }
  $enroll = Invoke-GflApi -Method POST -Url "$apiBase/presence/setup/enroll" -ApiKey $apiKey -Body $enrollBody
}
catch {
  Write-Err "Enroll failed: $($_.Exception.Message)"
  exit 1
}

if ([bool]$enroll.data.employeeCreated) {
  Write-Ok "Registered new employee: $($enroll.data.employee.fullName)"
}

$created = [bool]$enroll.data.created
$displayName = $enroll.data.employee.fullName
if (-not $displayName) { $displayName = $employee.fullName }
if ($created) {
  Write-Ok "Created new inventory asset and assigned to $displayName"
}
else {
  Write-Ok "Linked existing asset to $displayName"
}
if ($enroll.data.product) {
  Write-Host ("  Product: {0} [{1}]" -f $enroll.data.product.name, $enroll.data.product.sku)
}
Write-Host ("  Presence: {0}" -f $enroll.data.presence.onlineStatus)

# 7) Install files + service
Write-Step "Installing Windows service"
$sourceExe = Join-Path $ScriptDir $AgentExeName
if (-not (Test-Path $sourceExe)) {
  Write-Err "Missing $AgentExeName next to setup.ps1"
  exit 1
}

if (-not (Test-Path $ProgramDir)) {
  New-Item -ItemType Directory -Force -Path $ProgramDir | Out-Null
}

Copy-Item -Path $sourceExe -Destination (Join-Path $ProgramDir $AgentExeName) -Force

$finalConfig = [pscustomobject]@{
  apiUrl = $heartbeatUrl
  apiKey = $apiKey
  intervalSeconds = $intervalSeconds
}
Save-JsonFile (Join-Path $ConfigDir 'config.json') $finalConfig
Write-Ok "Wrote $ConfigDir\config.json"

$exePath = Join-Path $ProgramDir $AgentExeName
Push-Location $ProgramDir
try {
  # Stop/uninstall previous service if present (ignore failures)
  & $exePath -service stop 2>$null | Out-Null
  & $exePath -service uninstall 2>$null | Out-Null

  $installOut = & $exePath -service install 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "Service install failed: $installOut"
  }
  Write-Ok "Service installed"

  $startOut = & $exePath -service start 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "Service start failed: $startOut"
  }
  Write-Ok "Service started"
}
finally {
  Pop-Location
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Setup complete" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Employee : $displayName$(if ([bool]$enroll.data.employeeCreated) { ' (newly registered)' } else { '' })"
Write-Host "  Branch   : $($branch.name)"
Write-Host "  Serial   : $serial"
Write-Host "  Hostname : $hostname"
Write-Host "  Asset    : $(if ($created) { 'Created' } else { 'Linked existing' })"
Write-Host ""
Write-Host "  Open FormGFL Admin -> Devices Online to confirm this PC."
Write-Host ""
exit 0
