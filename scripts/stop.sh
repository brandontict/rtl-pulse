#!/bin/bash
# Stop all RTL-SDR Dashboard services

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PID_DIR="$PROJECT_DIR/data/pids"

echo "=== Stopping RTL-SDR Dashboard Services ==="

stop_service() {
    local name="$1"
    local pid_file="$PID_DIR/$name.pid"

    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            echo "Stopping $name (PID: $pid)..."
            kill "$pid" 2>/dev/null
            sleep 1
            # Force kill if still running
            if kill -0 "$pid" 2>/dev/null; then
                kill -9 "$pid" 2>/dev/null
            fi
            echo "$name stopped."
        else
            echo "$name not running (stale PID file)"
        fi
        rm -f "$pid_file"
    else
        echo "$name not running (no PID file)"
    fi
}

case "${1:-all}" in
    rtl433)
        stop_service "rtl_433"
        ;;
    backend)
        stop_service "backend"
        ;;
    dashboard)
        stop_service "dashboard"
        ;;
    analyzer)
        stop_service "analyzer"
        ;;
    all)
        stop_service "analyzer"
        stop_service "dashboard"
        stop_service "backend"
        stop_service "rtl_433"
        ;;
    *)
        echo "Usage: $0 {all|rtl433|backend|dashboard|analyzer}"
        exit 1
        ;;
esac

echo ""
echo "=== All services stopped ==="
