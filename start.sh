#!/usr/bin/env bash
# PlotPlanner — demo startup / stop
# Brug: ./start.sh       (start alt)
#       ./start.sh stop  (stop alt der blev startet)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$SCRIPT_DIR/.demo-pids"
LOG_DIR="$SCRIPT_DIR/logs"

GRN='\033[0;32m'; RED='\033[0;31m'; YLW='\033[1;33m'; BLD='\033[1m'; NC='\033[0m'

ok()   { echo -e "  ${GRN}✓${NC}  $*"; }
err()  { echo -e "  ${RED}✗${NC}  $*"; }
info() { echo -e "  ${YLW}→${NC}  $*"; }

port_open() { nc -z 127.0.0.1 "$1" 2>/dev/null; }

stop_all() {
  if [[ ! -f "$PID_FILE" ]]; then
    echo "Ingen kørende demo-processer at stoppe."
    return
  fi
  echo "Stopper demo-tjenester..."
  while IFS=' ' read -r pid name; do
    if kill "$pid" 2>/dev/null; then
      ok "$name stoppet (PID $pid)"
    fi
  done < "$PID_FILE"
  rm -f "$PID_FILE"
}

# ── Stop ──────────────────────────────────────────────────────────────────────
if [[ "${1:-}" == "stop" ]]; then
  stop_all
  exit 0
fi

# ── Start ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BLD}PlotPlanner — Demo Startup${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Ryd gamle PIDs og lav log-mappe
stop_all 2>/dev/null || true
: > "$PID_FILE"
mkdir -p "$LOG_DIR"

# ── Neo4j Desktop ─────────────────────────────────────────────────────────────
if port_open 7687; then
  ok "Neo4j database kører (port 7687)"
else
  info "Åbner Neo4j Desktop — klik 'Start' på din database"
  open -a "Neo4j Desktop" 2>/dev/null || true
  printf "  Venter på Neo4j"
  until port_open 7687; do printf '.'; sleep 2; done
  echo ""
  ok "Neo4j klar"
fi

# ── n8n ───────────────────────────────────────────────────────────────────────
if port_open 5678; then
  ok "n8n kører allerede (port 5678)"
else
  info "Starter n8n..."
  bash ~/scripts/n8n-launcher/start.sh > "$LOG_DIR/n8n.log" 2>&1 &
  echo "$! n8n" >> "$PID_FILE"
fi

# ── MCP server ────────────────────────────────────────────────────────────────
if port_open 3000; then
  ok "MCP server kører allerede (port 3000)"
else
  info "Starter MCP server..."
  (cd "$SCRIPT_DIR/mcp-server" && node index.js) > "$LOG_DIR/mcp.log" 2>&1 &
  echo "$! MCP-server" >> "$PID_FILE"
fi

# ── Dashboard ─────────────────────────────────────────────────────────────────
if port_open 3001; then
  ok "Dashboard kører allerede (port 3001)"
else
  info "Starter dashboard..."
  (cd "$SCRIPT_DIR/dashboard" && node server.js) > "$LOG_DIR/dashboard.log" 2>&1 &
  echo "$! Dashboard" >> "$PID_FILE"
fi

# ── Hermes gateway ────────────────────────────────────────────────────────────
if pgrep -f "hermes" > /dev/null 2>&1; then
  ok "Hermes gateway kører allerede"
else
  info "Starter Hermes gateway..."
  hermes gateway start > "$LOG_DIR/hermes.log" 2>&1 &
  echo "$! Hermes-gateway" >> "$PID_FILE"
fi

# ── Vent og vis status ────────────────────────────────────────────────────────
echo ""
printf "Venter på tjenester"
for i in 1 2 3 4 5; do printf '.'; sleep 1; done
echo ""
echo ""

echo "Status:"
port_open 7687 && ok "Neo4j          localhost:7687" || err "Neo4j          ikke klar — start database i Neo4j Desktop"
port_open 5678 && ok "n8n            localhost:5678" || err "n8n            ikke tilgængelig (se logs/n8n.log)"
port_open 3000 && ok "MCP server     localhost:3000" || err "MCP server     ikke tilgængelig (se logs/mcp.log)"
port_open 3001 && ok "Dashboard      localhost:3001" || err "Dashboard      ikke tilgængelig (se logs/dashboard.log)"
pgrep -f "hermes" > /dev/null 2>&1 && ok "Hermes gateway kørende" || err "Hermes gateway ikke fundet (se logs/hermes.log)"

echo ""
echo -e "${BLD}Dashboard:${NC} http://localhost:3001"
echo ""
open "http://localhost:3001" 2>/dev/null || true

echo -e "Stop alt:  ${BLD}./start.sh stop${NC}"
echo ""
