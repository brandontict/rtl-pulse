#!/bin/bash
# Start all RTL-SDR Dashboard services

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PID_DIR="$PROJECT_DIR/data/pids"
LOG_DIR="$PROJECT_DIR/data/logs"

# Create directories
mkdir -p "$PID_DIR" "$LOG_DIR"

# RTL-433 binary path
RTL433_BIN="$PROJECT_DIR/rtl_433/build/src/rtl_433"
RTL433_CONF="$PROJECT_DIR/config/rtl_433.conf"

echo "=== Starting RTL-SDR Dashboard Services ==="

# Start Mosquitto (if not running as system service)
start_mosquitto() {
    if ! pgrep -x mosquitto > /dev/null; then
        echo "Starting Mosquitto MQTT broker..."
        mosquitto -d -c "$PROJECT_DIR/config/mosquitto.conf" 2>/dev/null || mosquitto -d
        echo "Mosquitto started."
    else
        echo "Mosquitto already running."
    fi
}

# Start rtl_433
start_rtl433() {
    if [ -f "$PID_DIR/rtl_433.pid" ] && kill -0 "$(cat "$PID_DIR/rtl_433.pid")" 2>/dev/null; then
        echo "rtl_433 already running (PID: $(cat "$PID_DIR/rtl_433.pid"))"
        return
    fi

    if [ ! -x "$RTL433_BIN" ]; then
        echo "ERROR: rtl_433 binary not found. Run: ./scripts/build_rtl433.sh"
        return 1
    fi

    echo "Starting rtl_433..."

    # Start rtl_433 with config file, output to both file and MQTT
    "$RTL433_BIN" -c "$RTL433_CONF" \
        -F json \
        -F "mqtt://localhost:1883,events=rtl_433/events,devices=rtl_433/devices[/model][/id]" \
        > "$LOG_DIR/rtl_433.log" 2>&1 &

    echo $! > "$PID_DIR/rtl_433.pid"
    echo "rtl_433 started (PID: $!)"
}

# Start Python backend
start_backend() {
    if [ -f "$PID_DIR/backend.pid" ] && kill -0 "$(cat "$PID_DIR/backend.pid")" 2>/dev/null; then
        echo "Backend already running (PID: $(cat "$PID_DIR/backend.pid"))"
        return
    fi

    BACKEND_DIR="$PROJECT_DIR/backend"
    VENV="$BACKEND_DIR/venv/bin/activate"

    if [ ! -f "$VENV" ]; then
        echo "Backend virtual environment not found. Run: ./scripts/setup.sh python"
        return 1
    fi

    if [ ! -f "$BACKEND_DIR/app/main.py" ]; then
        echo "Backend not yet implemented - skipping"
        return 0
    fi

    echo "Starting Python backend..."
    cd "$BACKEND_DIR"
    source "$VENV"
    uvicorn app.main:app --host 0.0.0.0 --port 8000 > "$LOG_DIR/backend.log" 2>&1 &
    echo $! > "$PID_DIR/backend.pid"
    deactivate
    echo "Backend started (PID: $!) - http://localhost:8000"
}

# Start React dashboard
start_dashboard() {
    if [ -f "$PID_DIR/dashboard.pid" ] && kill -0 "$(cat "$PID_DIR/dashboard.pid")" 2>/dev/null; then
        echo "Dashboard already running (PID: $(cat "$PID_DIR/dashboard.pid"))"
        return
    fi

    DASHBOARD_DIR="$PROJECT_DIR/dashboard"

    if [ ! -f "$DASHBOARD_DIR/package.json" ]; then
        echo "Dashboard not yet implemented - skipping"
        return 0
    fi

    echo "Starting React dashboard..."
    cd "$DASHBOARD_DIR"
    npm run dev > "$LOG_DIR/dashboard.log" 2>&1 &
    echo $! > "$PID_DIR/dashboard.pid"
    echo "Dashboard started (PID: $!) - http://localhost:3000"
}

# Start Vue signal analyzer
start_analyzer() {
    if [ -f "$PID_DIR/analyzer.pid" ] && kill -0 "$(cat "$PID_DIR/analyzer.pid")" 2>/dev/null; then
        echo "Signal analyzer already running (PID: $(cat "$PID_DIR/analyzer.pid"))"
        return
    fi

    ANALYZER_DIR="$PROJECT_DIR/signal-analyzer"

    if [ ! -f "$ANALYZER_DIR/package.json" ]; then
        echo "Signal analyzer not yet implemented - skipping"
        return 0
    fi

    echo "Starting Vue signal analyzer..."
    cd "$ANALYZER_DIR"
    npm run dev -- --port 3001 > "$LOG_DIR/analyzer.log" 2>&1 &
    echo $! > "$PID_DIR/analyzer.pid"
    echo "Signal analyzer started (PID: $!) - http://localhost:3001"
}

# Main
case "${1:-all}" in
    mosquitto)
        start_mosquitto
        ;;
    rtl433)
        start_rtl433
        ;;
    backend)
        start_backend
        ;;
    dashboard)
        start_dashboard
        ;;
    analyzer)
        start_analyzer
        ;;
    all)
        start_mosquitto
        sleep 1
        # Note: rtl_433 is managed by the backend (auto-starts on demand)
        # Use './scripts/start.sh rtl433' for manual control
        start_backend
        start_dashboard
        start_analyzer
        ;;
    *)
        echo "Usage: $0 {all|mosquitto|rtl433|backend|dashboard|analyzer}"
        exit 1
        ;;
esac

echo ""
echo "=== Services Status ==="
"$SCRIPT_DIR/status.sh" 2>/dev/null || echo "Run ./scripts/status.sh to check status"
