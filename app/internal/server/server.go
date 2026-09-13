// Package server serves the embedded UI and a small read-only JSON API on
// localhost. There are no write endpoints by design.
package server

import (
	"encoding/json"
	"io/fs"
	"log"
	"net"
	"net/http"
	"path"
	"strings"
	"sync"
	"time"

	"github.com/AviroopPaul/agentconf/app/internal/doctor"
	"github.com/AviroopPaul/agentconf/app/internal/scan"
)

// Server holds a cached inventory and refreshes on demand.
type Server struct {
	version string
	dist    fs.FS
	mu      sync.RWMutex
	inv     *scan.Inventory
	find    []doctor.Finding
	sum     doctor.Summary
	scanErr error
	probing bool
}

// New creates a server and performs the first scan.
func New(version string, dist fs.FS) *Server {
	s := &Server{version: version, dist: dist}
	s.refresh()
	return s
}

func (s *Server) refresh() {
	// Phase 1: fast. No directory sizes, no version probes. Serves in tens
	// of milliseconds so the UI paints immediately.
	inv, err := scan.Run(scan.Options{WithUsage: false, Probe: false})
	s.mu.Lock()
	s.scanErr = err
	if err == nil {
		s.inv = inv
		s.find, s.sum = doctor.Run(inv)
		s.probing = true
	}
	s.mu.Unlock()
	if err != nil {
		return
	}
	// Phase 2: complete. Walks every agent directory for sizes and spawns
	// `--version` probes (Electron and Node binaries take ~0.5 s each).
	go func() {
		full, err := scan.Run(scan.Options{WithUsage: true, Probe: true})
		s.mu.Lock()
		defer s.mu.Unlock()
		if err != nil || s.inv != inv {
			// A newer refresh has started; let it win.
			return
		}
		full.FullScanMillis = full.ScanMillis
		full.ScanMillis = inv.ScanMillis
		s.inv = full
		s.find, s.sum = doctor.Run(full)
		s.probing = false
	}()
}

// Handler returns the HTTP mux.
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", s.health)
	mux.HandleFunc("GET /api/inventory", s.inventory)
	mux.HandleFunc("POST /api/refresh", s.doRefresh)
	mux.HandleFunc("GET /api/doctor", s.doctorHandler)
	mux.Handle("/", s.static())
	return noCache(mux)
}

func noCache(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") {
			w.Header().Set("Cache-Control", "no-store")
		}
		next.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(code)
	enc := json.NewEncoder(w)
	enc.SetEscapeHTML(false)
	_ = enc.Encode(v)
}

func (s *Server) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, 200, map[string]any{"ok": true, "version": s.version, "time": time.Now()})
}

type inventoryResponse struct {
	*scan.Inventory
	Doctor        []doctor.Finding `json:"doctor"`
	DoctorSummary doctor.Summary   `json:"doctorSummary"`
	Version       string           `json:"appVersion"`
	ReadOnly      bool             `json:"readOnly"`
	Probing       bool             `json:"probing"`
}

func (s *Server) inventory(w http.ResponseWriter, r *http.Request) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if s.scanErr != nil {
		writeJSON(w, 500, map[string]string{"error": s.scanErr.Error()})
		return
	}
	writeJSON(w, 200, inventoryResponse{Inventory: s.inv, Doctor: s.find, DoctorSummary: s.sum, Version: s.version, ReadOnly: true, Probing: s.probing})
}

func (s *Server) doRefresh(w http.ResponseWriter, r *http.Request) {
	s.refresh()
	s.inventory(w, r)
}

func (s *Server) doctorHandler(w http.ResponseWriter, _ *http.Request) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	writeJSON(w, 200, map[string]any{"findings": s.find, "summary": s.sum})
}

// static serves the SPA with index.html fallback.
func (s *Server) static() http.Handler {
	fileServer := http.FileServer(http.FS(s.dist))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := strings.TrimPrefix(path.Clean(r.URL.Path), "/")
		if p == "" {
			p = "index.html"
		}
		if f, err := s.dist.Open(p); err == nil {
			f.Close()
			if strings.HasPrefix(p, "assets/") {
				w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
			}
			fileServer.ServeHTTP(w, r)
			return
		}
		r.URL.Path = "/"
		fileServer.ServeHTTP(w, r)
	})
}

// Listen binds to localhost only and serves until the process exits.
func (s *Server) Listen(port int) (string, error) {
	addr := net.JoinHostPort("127.0.0.1", itoa(port))
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		return "", err
	}
	url := "http://" + ln.Addr().String()
	go func() {
		srv := &http.Server{Handler: s.Handler(), ReadHeaderTimeout: 5 * time.Second}
		if err := srv.Serve(ln); err != nil && err != http.ErrServerClosed {
			log.Fatal(err)
		}
	}()
	return url, nil
}

func itoa(i int) string {
	if i == 0 {
		return "0"
	}
	neg := i < 0
	if neg {
		i = -i
	}
	var b [20]byte
	pos := len(b)
	for i > 0 {
		pos--
		b[pos] = byte('0' + i%10)
		i /= 10
	}
	if neg {
		pos--
		b[pos] = '-'
	}
	return string(b[pos:])
}
