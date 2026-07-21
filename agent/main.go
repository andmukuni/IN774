package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/kardianos/service"
)

var logger service.Logger

type program struct {
	cfg       *Config
	machineID string
	stopCh    chan struct{}
}

func (p *program) Start(s service.Service) error {
	p.stopCh = make(chan struct{})
	go p.run()
	return nil
}

func (p *program) Stop(s service.Service) error {
	close(p.stopCh)
	return nil
}

func (p *program) run() {
	logMsg("GFL Presence agent started")

	info := collectMachineInfo()
	sendHeartbeatWithRetry(p.cfg, p.machineID, info)

	ticker := time.NewTicker(time.Duration(p.cfg.IntervalSeconds) * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-p.stopCh:
			logMsg("GFL Presence agent stopping")
			return
		case <-ticker.C:
			info = collectMachineInfo()
			sendHeartbeatWithRetry(p.cfg, p.machineID, info)
		}
	}
}

func logMsg(msg string) {
	if logger != nil {
		_ = logger.Info(msg)
		return
	}
	log.Println(msg)
}

func main() {
	svcFlag := flag.String("service", "", "Control the Windows service: install, uninstall, start, stop, restart")
	flag.Parse()

	cfg, err := loadConfig()
	if err != nil {
		log.Fatalf("config error: %v", err)
	}

	machineID, err := loadOrCreateMachineID(cfg)
	if err != nil {
		log.Fatalf("machine id error: %v", err)
	}

	svcConfig := &service.Config{
		Name:        "GFLPresence",
		DisplayName: "GFL PC Presence Agent",
		Description: "Reports PC online status to FormGFL inventory.",
	}

	prg := &program{cfg: cfg, machineID: machineID}
	s, err := service.New(prg, svcConfig)
	if err != nil {
		log.Fatal(err)
	}

	logger, err = s.Logger(nil)
	if err != nil {
		log.Fatal(err)
	}

	if *svcFlag != "" {
		if err := service.Control(s, *svcFlag); err != nil {
			log.Fatalf("service %s failed: %v", *svcFlag, err)
		}
		fmt.Printf("service %s succeeded\n", *svcFlag)
		return
	}

	if len(os.Args) > 1 && os.Args[1] == "run" {
		prg.stopCh = make(chan struct{})
		prg.run()
		return
	}

	if err := s.Run(); err != nil {
		log.Fatal(err)
	}
}
