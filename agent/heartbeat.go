package main

import (
	"bytes"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type HeartbeatPayload struct {
	MachineID     string `json:"machineId"`
	Hostname      string `json:"hostname"`
	SerialNumber  string `json:"serialNumber"`
	OSVersion     string `json:"osVersion"`
	LoggedInUser  string `json:"loggedInUser"`
	LocalIP       string `json:"localIp"`
	AgentVersion  string `json:"agentVersion"`
}

func sendHeartbeat(cfg *Config, machineID string, info MachineInfo) error {
	payload := HeartbeatPayload{
		MachineID:    machineID,
		Hostname:     info.Hostname,
		SerialNumber: info.SerialNumber,
		OSVersion:    info.OSVersion,
		LoggedInUser: info.LoggedInUser,
		LocalIP:      info.LocalIP,
		AgentVersion: agentVersion,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	client := &http.Client{Timeout: 30 * time.Second}
	req, err := http.NewRequest(http.MethodPost, cfg.APIURL, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+cfg.APIKey)
	req.Header.Set("User-Agent", "GFLPresence/"+agentVersion)

	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("heartbeat failed (%d): %s", resp.StatusCode, string(respBody))
	}
	return nil
}

func sendHeartbeatWithRetry(cfg *Config, machineID string, info MachineInfo) {
	delays := []time.Duration{0, 5 * time.Second, 15 * time.Second, 45 * time.Second}
	for i, delay := range delays {
		if delay > 0 {
			time.Sleep(delay)
		}
		if err := sendHeartbeat(cfg, machineID, info); err != nil {
			logMsg(fmt.Sprintf("heartbeat attempt %d failed: %v", i+1, err))
			continue
		}
		logMsg("heartbeat sent successfully")
		return
	}
	logMsg("heartbeat failed after retries")
}

func newUUID() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16]), nil
}
