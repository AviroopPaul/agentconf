// agentconf: a read-only UI over your coding agents' config directories.
//
//	agentconf            serve the UI on localhost and open a browser
//	agentconf scan       print the inventory as JSON
//	agentconf doctor     print diagnostics
//	agentconf version    print the version
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"os/exec"
	"os/signal"
	"runtime"
	"syscall"

	"github.com/AviroopPaul/agentconf/app/internal/doctor"
	"github.com/AviroopPaul/agentconf/app/internal/scan"
	"github.com/AviroopPaul/agentconf/app/internal/server"
	"github.com/AviroopPaul/agentconf/app/web"
)

// version is set at build time via -ldflags "-X main.version=...".
var version = "dev"

func main() {
	if len(os.Args) > 1 {
		switch os.Args[1] {
		case "scan":
			runScan(os.Args[2:])
			return
		case "doctor":
			runDoctor()
			return
		case "version", "--version", "-v":
			fmt.Println("agentconf " + version)
			return
		case "help", "--help", "-h":
			usage()
			return
		case "serve":
			os.Args = append(os.Args[:1], os.Args[2:]...)
		}
	}
	runServe()
}

func usage() {
	fmt.Fprint(os.Stderr, `agentconf `+version+`

Read-only UI over ~/.claude, ~/.codex, ~/.cursor and friends.

Usage:
  agentconf [serve] [--port N] [--no-open]   start the UI (default)
  agentconf scan [--pretty]                  print the inventory as JSON
  agentconf doctor                           print diagnostics
  agentconf version

Nothing is ever written to your config. Credential files are never opened.
`)
}

func runServe() {
	fs := flag.NewFlagSet("serve", flag.ExitOnError)
	port := fs.Int("port", 4242, "port to listen on (0 picks a free one)")
	noOpen := fs.Bool("no-open", false, "do not open a browser")
	fs.Usage = usage
	_ = fs.Parse(os.Args[1:])

	srv := server.New(version, web.Dist())
	url, err := srv.Listen(*port)
	if err != nil {
		fmt.Fprintln(os.Stderr, "agentconf:", err)
		os.Exit(1)
	}
	fmt.Printf("agentconf %s\n  %s\n  read-only. press ctrl+c to stop.\n", version, url)
	if !*noOpen {
		openBrowser(url)
	}
	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
	<-sig
	fmt.Println()
}

func runScan(args []string) {
	fs := flag.NewFlagSet("scan", flag.ExitOnError)
	pretty := fs.Bool("pretty", false, "indent the JSON")
	noUsage := fs.Bool("no-usage", false, "skip usage and disk statistics")
	_ = fs.Parse(args)
	inv, err := scan.Run(scan.Options{WithUsage: !*noUsage, Probe: true})
	if err != nil {
		fmt.Fprintln(os.Stderr, "agentconf:", err)
		os.Exit(1)
	}
	findings, summary := doctor.Run(inv)
	out := map[string]any{"inventory": inv, "doctor": findings, "doctorSummary": summary, "appVersion": version}
	enc := json.NewEncoder(os.Stdout)
	enc.SetEscapeHTML(false)
	if *pretty {
		enc.SetIndent("", "  ")
	}
	_ = enc.Encode(out)
}

func runDoctor() {
	inv, err := scan.Run(scan.Options{WithUsage: false, Probe: true})
	if err != nil {
		fmt.Fprintln(os.Stderr, "agentconf:", err)
		os.Exit(1)
	}
	findings, summary := doctor.Run(inv)
	installed := 0
	for _, a := range inv.Agents {
		if a.Installed {
			installed++
		}
	}
	fmt.Printf("agentconf doctor: %d agents, %d errors, %d warnings, %d notes\n\n", installed, summary.Errors, summary.Warns, summary.Infos)
	for _, f := range findings {
		tag := map[string]string{"error": "ERR ", "warn": "WARN", "info": "info"}[f.Severity]
		fmt.Printf("[%s] %s\n", tag, f.Title)
		if f.Detail != "" {
			fmt.Printf("       %s\n", f.Detail)
		}
		if f.Path != "" {
			fmt.Printf("       %s\n", f.Path)
		}
		fmt.Println()
	}
	if summary.Errors > 0 {
		os.Exit(1)
	}
}

func openBrowser(url string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", url)
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	_ = cmd.Start()
}
