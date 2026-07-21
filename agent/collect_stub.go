//go:build !windows

package main

import (
	"net"
	"os"
	"runtime"
	"strings"
)

type MachineInfo struct {
	Hostname     string
	SerialNumber string
	OSVersion    string
	LoggedInUser string
	LocalIP      string
}

func collectMachineInfo() MachineInfo {
	hostname, _ := os.Hostname()
	user := os.Getenv("USER")
	if user == "" {
		user = os.Getenv("USERNAME")
	}
	return MachineInfo{
		Hostname:     strings.TrimSpace(hostname),
		SerialNumber: "DEV-NON-WINDOWS",
		OSVersion:    runtime.GOOS + " " + runtime.GOARCH,
		LoggedInUser: user,
		LocalIP:      collectLocalIP(),
	}
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
