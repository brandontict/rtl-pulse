#!/bin/bash
# Check status of RTL-SDR Dashboard services

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PID_DIR="$PROJECT_DIR/data/pids"

echo "=== RTL-SDR Dashboard Services Status ==="
echo ""

check_service() {
    local name="$1"
    local port="$2"
    local pid_file="$PID_DIR/$name.pid"

    printf "%-20s" "$name:"

    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            if [ -n "$port" ]; then
                echo -e "\e[32mRUNNING\e[0m (PID: $pid, Port: $port)"
            else
                echo -e "\e[32mRUNNING\e[0m (PID: $pid)"
            fi
            return 0
        else
            echo -e "\e[31mSTOPPED\e[0m (stale PID file)"
            return 1
        fi
    else
        echo -e "\e[33mNOT STARTED\e[0m"
        return 1
    fi
}

check_external() {
    local name="$1"
    local process="$2"
    local port="$3"

    printf "%-20s" "$name:"

    if pgrep -x "$process" > /dev/null; then
        echo -e "\e[32mRUNNING\e[0m (Port: $port)"
        return 0
    else
        echo -e "\e[33mNOT RUNNING\e[0m"
        return 1
    fi
}

# Check external services
check_external "Mosquitto" "mosquitto" "1883"

# Check project services
check_service "rtl_433" ""
check_service "backend" "8000"
check_service "dashboard" "3000"
check_service "analyzer" "3001"

echo ""
echo "=== Hardware Status ==="

# Check for RTL-SDR device
if lsusb | grep -qi "rtl"; then
    echo -e "RTL-SDR Device:     \e[32mDETECTED\e[0m"
    lsusb | grep -i rtl | sed 's/^/  /'
else
    echo -e "RTL-SDR Device:     \e[31mNOT FOUND\e[0m"
fi

echo ""
echo "=== Log Files ==="
ls -la "$PROJECT_DIR/data/logs/" 2>/dev/null || echo "No log files yet"
