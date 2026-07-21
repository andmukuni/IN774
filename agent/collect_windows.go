//go:build windows

package main

import (
	"net"
	"os"
	"os/exec"
	"strings"
	"syscall"
)

type MachineInfo struct {
	Hostname     string
	SerialNumber string
	OSVersion    string
	LoggedInUser string
	LocalIP      string
}

func collectMachineInfo() MachineInfo {
	info := MachineInfo{
		Hostname:     collectHostname(),
		SerialNumber: collectSerialNumber(),
		OSVersion:    collectOSVersion(),
		LoggedInUser: collectLoggedInUser(),
		LocalIP:      collectLocalIP(),
	}
	return info
}

func collectHostname() string {
	name, err := os.Hostname()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(name)
}

func collectSerialNumber() string {
	queries := []string{
		"(Get-CimInstance Win32_BIOS).SerialNumber",
		"(Get-CimInstance Win32_ComputerSystemProduct).IdentifyingNumber",
		"(Get-CimInstance Win32_BaseBoard).SerialNumber",
		"@((Get-CimInstance Win32_SystemEnclosure).SerialNumber)[0]",
	}

	for _, q := range queries {
		cmd := exec.Command("powershell", "-NoProfile", "-NonInteractive", "-Command", q)
		cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
		out, err := cmd.Output()
		if err != nil {
			continue
		}
		if serial := normalizeSerialCandidate(string(out)); serial != "" {
			return serial
		}
	}

	wmicCmds := [][]string{
		{"bios", "get", "serialnumber"},
		{"csproduct", "get", "identifyingnumber"},
		{"baseboard", "get", "serialnumber"},
	}
	for _, args := range wmicCmds {
		cmd := exec.Command("wmic", args...)
		cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
		out, err := cmd.Output()
		if err != nil {
			continue
		}
		for _, line := range strings.Split(string(out), "\n") {
			line = strings.TrimSpace(line)
			if line == "" || strings.EqualFold(line, "SerialNumber") || strings.EqualFold(line, "IdentifyingNumber") {
				continue
			}
			if serial := normalizeSerialCandidate(line); serial != "" {
				return serial
			}
		}
	}
	return ""
}

func normalizeSerialCandidate(raw string) string {
	serial := strings.TrimSpace(raw)
	if serial == "" {
		return ""
	}
	lower := strings.ToLower(serial)
	invalid := map[string]bool{
		"to be filled by o.e.m.": true,
		"to be filled by oem":    true,
		"default string":         true,
		"system serial number":   true,
		"system product name":    true,
		"chassis serial number":  true,
		"base board serial number": true,
		"none":                   true,
		"n/a":                    true,
		"na":                     true,
		"null":                   true,
		"unknown":                true,
		"not specified":          true,
		"not available":          true,
		"o.e.m":                  true,
		"oem":                    true,
		"0":                      true,
		"0000000":                true,
		"00000000":               true,
		"000000000000":           true,
		"123456789":              true,
		"string":                 true,
	}
	if invalid[lower] {
		return ""
	}
	if len(serial) < 3 {
		return ""
	}
	onlyZeros := true
	for _, r := range serial {
		if r != '0' && r != '-' && r != ' ' {
			onlyZeros = false
			break
		}
	}
	if onlyZeros {
		return ""
	}
	return serial
}

func collectOSVersion() string {
	cmd := exec.Command("powershell", "-NoProfile", "-NonInteractive", "-Command",
		"(Get-CimInstance Win32_OperatingSystem).Caption + ' ' + (Get-CimInstance Win32_OperatingSystem).Version")
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	out, err := cmd.Output()
	if err != nil {
		return "Windows"
	}
	return strings.TrimSpace(string(out))
}

func collectLoggedInUser() string {
	cmd := exec.Command("powershell", "-NoProfile", "-NonInteractive", "-Command",
		"(Get-CimInstance Win32_ComputerSystem).UserName")
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	out, err := cmd.Output()
	if err == nil {
		user := strings.TrimSpace(string(out))
		if user != "" {
			if parts := strings.Split(user, `\`); len(parts) == 2 {
				return parts[1]
			}
			return user
		}
	}

	user := strings.TrimSpace(os.Getenv("USERNAME"))
	if user != "" {
		return user
	}
	return ""
}

func collectLocalIP() string {
	ifaces, err := net.Interfaces()
	if err != nil {
		return ""
	}
	for _, iface := range ifaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, addr := range addrs {
			var ip net.IP
			switch v := addr.(type) {
			case *net.IPNet:
				ip = v.IP
			case *net.IPAddr:
				ip = v.IP
			}
			if ip == nil || ip.IsLoopback() {
				continue
			}
			ip = ip.To4()
			if ip == nil {
				continue
			}
			return ip.String()
		}
	}
	return ""
}
