package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

const (
	defaultConfigDir  = `C:\ProgramData\GFLPresence`
	defaultConfigName = "config.json"
	defaultMachineID  = "machine-id.txt"
	agentVersion      = "1.0.0"
)

type Config struct {
	APIURL          string `json:"apiUrl"`
	APIKey          string `json:"apiKey"`
	IntervalSeconds int    `json:"intervalSeconds"`
	ConfigDir       string `json:"configDir"`
}

func (c *Config) normalize() error {
	if c.ConfigDir == "" {
		c.ConfigDir = defaultConfigDir
	}
	if c.IntervalSeconds <= 0 {
		c.IntervalSeconds = 300
	}
	if c.APIURL == "" {
		return fmt.Errorf("apiUrl is required in config.json")
	}
	if c.APIKey == "" {
		return fmt.Errorf("apiKey is required in config.json")
	}
	return nil
}

func (c *Config) configPath() string {
	return filepath.Join(c.ConfigDir, defaultConfigName)
}

func (c *Config) machineIDPath() string {
	return filepath.Join(c.ConfigDir, defaultMachineID)
}

func loadConfig() (*Config, error) {
	dir := os.Getenv("GFL_PRESENCE_CONFIG_DIR")
	if dir == "" {
		dir = defaultConfigDir
	}

	path := filepath.Join(dir, defaultConfigName)
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read config %s: %w", path, err)
	}

	var cfg Config
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return nil, fmt.Errorf("parse config: %w", err)
	}
	cfg.ConfigDir = dir
	if err := cfg.normalize(); err != nil {
		return nil, err
	}
	return &cfg, nil
}

func loadOrCreateMachineID(cfg *Config) (string, error) {
	path := cfg.machineIDPath()
	if raw, err := os.ReadFile(path); err == nil {
		id := string(bytesTrimSpace(raw))
		if id != "" {
			return id, nil
		}
	}

	id, err := newUUID()
	if err != nil {
		return "", err
	}

	if err := os.MkdirAll(cfg.ConfigDir, 0o755); err != nil {
		return "", err
	}
	if err := os.WriteFile(path, []byte(id), 0o644); err != nil {
		return "", err
	}
	return id, nil
}

func bytesTrimSpace(b []byte) string {
	start := 0
	end := len(b)
	for start < end && (b[start] == ' ' || b[start] == '\n' || b[start] == '\r' || b[start] == '\t') {
		start++
	}
	for end > start && (b[end-1] == ' ' || b[end-1] == '\n' || b[end-1] == '\r' || b[end-1] == '\t') {
		end--
	}
	return string(b[start:end])
}
