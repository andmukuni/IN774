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
	cmd := exec.Command("powershell", "-NoProfile", "-NonInteractive", "-Command",
		"(Get-CimInstance Win32_BIOS).SerialNumber")
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	out, err := cmd.Output()
	if err == nil {
		serial := strings.TrimSpace(string(out))
		if serial != "" && !strings.EqualFold(serial, "to be filled by o.e.m.") {
			return serial
		}
	}

	cmd = exec.Command("wmic", "bios", "get", "serialnumber")
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	out, err = cmd.Output()
	if err == nil {
		lines := strings.Split(string(out), "\n")
		for _, line := range lines {
			line = strings.TrimSpace(line)
			if line == "" || strings.EqualFold(line, "SerialNumber") {
				continue
			}
			return line
		}
	}
	return ""
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
