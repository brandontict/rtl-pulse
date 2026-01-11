#!/bin/bash
#
# RTL-SDR Dashboard - One-Shot Install Script
# Handles all dependencies and setup
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║          RTL-SDR Dashboard - Install Script               ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Helper functions
info() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

check_command() {
    if command -v "$1" &> /dev/null; then
        success "$1 found"
        return 0
    else
        warn "$1 not found"
        return 1
    fi
}

# Step 1: Check if running as root for system changes
info "Checking permissions..."
if [ "$EUID" -eq 0 ]; then
    error "Don't run as root. Script will ask for sudo when needed."
    exit 1
fi

# Step 2: Check basic requirements
echo ""
info "Checking system requirements..."

MISSING_DEPS=""

# Check for essential tools
for cmd in git cmake make gcc g++ python3 node npm; do
    if ! command -v "$cmd" &> /dev/null; then
        MISSING_DEPS="$MISSING_DEPS $cmd"
    fi
done

if [ -n "$MISSING_DEPS" ]; then
    warn "Missing:$MISSING_DEPS"
    info "Installing missing dependencies..."
    sudo apt update
    sudo apt install -y git cmake build-essential python3 python3-pip python3-venv nodejs npm
fi

# Check for rtl-sdr header files (may have newer version without -dev package)
if [ ! -f "/usr/include/rtl-sdr.h" ]; then
    info "Installing librtlsdr-dev..."
    sudo apt install -y librtlsdr-dev 2>/dev/null || warn "librtlsdr-dev had issues, checking if headers exist anyway..."
fi

if [ ! -f "/usr/include/rtl-sdr.h" ]; then
    error "rtl-sdr headers not found. Manual install needed."
    exit 1
fi

# Check rtl_fm exists
if ! check_command rtl_fm; then
    error "rtl_fm not found. Please install rtl-sdr package manually."
    echo "  Try: sudo apt install rtl-sdr"
    exit 1
fi

# Check for libusb
if [ ! -f "/usr/include/libusb-1.0/libusb.h" ]; then
    info "Installing libusb-1.0-0-dev..."
    sudo apt install -y libusb-1.0-0-dev
fi

success "System requirements OK"

# Step 3: Blacklist DVB modules
echo ""
info "Configuring kernel modules..."

BLACKLIST_FILE="/etc/modprobe.d/rtl-sdr-blacklist.conf"
if [ ! -f "$BLACKLIST_FILE" ]; then
    info "Blacklisting DVB-T modules (required for SDR use)..."
    echo -e "# RTL-SDR blacklist\nblacklist dvb_usb_rtl28xxu\nblacklist rtl2832\nblacklist rtl2832_sdr\nblacklist rtl2838" | sudo tee "$BLACKLIST_FILE" > /dev/null
    success "Blacklist created"
    NEED_REBOOT=true
else
    success "Blacklist already configured"
fi

# Unload modules if currently loaded
if lsmod | grep -q dvb_usb_rtl28xxu; then
    info "Unloading DVB modules..."
    sudo rmmod dvb_usb_rtl28xxu 2>/dev/null || true
    sudo rmmod rtl2832_sdr 2>/dev/null || true
    sudo rmmod rtl2832 2>/dev/null || true
    success "Modules unloaded"
fi

# Step 4: Build rtl_433
echo ""
info "Building rtl_433..."

RTL433_DIR="$PROJECT_DIR/rtl_433"
RTL433_BIN="$RTL433_DIR/build/src/rtl_433"

if [ -f "$RTL433_BIN" ]; then
    success "rtl_433 already built"
else
    if [ ! -d "$RTL433_DIR" ]; then
        info "Cloning rtl_433..."
        git clone https://github.com/merbanan/rtl_433.git "$RTL433_DIR"
    fi

    info "Compiling rtl_433 (this may take a few minutes)..."
    mkdir -p "$RTL433_DIR/build"
    cd "$RTL433_DIR/build"
    cmake .. -DCMAKE_BUILD_TYPE=Release
    make -j$(nproc)
    cd "$PROJECT_DIR"

    if [ -f "$RTL433_BIN" ]; then
        success "rtl_433 built successfully"
    else
        error "rtl_433 build failed"
        exit 1
    fi
fi

# Step 5: Setup Python backend
echo ""
info "Setting up Python backend..."

cd "$PROJECT_DIR/backend"

if [ ! -d "venv" ]; then
    info "Creating Python virtual environment..."
    python3 -m venv venv
fi

info "Installing Python dependencies..."
source venv/bin/activate
pip install --upgrade pip -q
pip install -r requirements.txt -q
deactivate

success "Python backend ready"

# Step 6: Setup React dashboard
echo ""
info "Setting up React dashboard..."

cd "$PROJECT_DIR/dashboard"

if [ ! -d "node_modules" ]; then
    info "Installing npm packages (this may take a minute)..."
    npm install --silent 2>/dev/null || npm install
fi

success "React dashboard ready"

# Step 7: Setup Vue signal analyzer
echo ""
info "Setting up Vue signal analyzer..."

cd "$PROJECT_DIR/signal-analyzer"

if [ ! -d "node_modules" ]; then
    info "Installing npm packages..."
    npm install --silent 2>/dev/null || npm install
fi

success "Vue signal analyzer ready"

# Step 8: Create data directory
echo ""
info "Setting up data directories..."

mkdir -p "$PROJECT_DIR/data"
mkdir -p "$PROJECT_DIR/logs"

success "Data directories ready"

# Step 9: Make scripts executable
chmod +x "$PROJECT_DIR/scripts/"*.sh 2>/dev/null || true

# Done!
echo ""
echo -e "${GREEN}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║              Installation Complete!                       ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo ""
echo "To start the dashboard:"
echo -e "  ${BLUE}./scripts/start.sh${NC}"
echo ""
echo "Access:"
echo -e "  Dashboard:       ${GREEN}http://localhost:3000${NC}"
echo -e "  Signal Analyzer: ${GREEN}http://localhost:3001${NC}"
echo -e "  Audio Receiver:  ${GREEN}http://localhost:3001/audio${NC}"
echo -e "  API Docs:        ${GREEN}http://localhost:8000/docs${NC}"
echo ""

if [ "$NEED_REBOOT" = true ]; then
    echo -e "${YELLOW}NOTE: Reboot recommended for kernel module changes.${NC}"
    echo ""
    read -p "Reboot now? [y/N] " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        sudo reboot
    fi
fi

# Test SDR
echo ""
info "Testing RTL-SDR device..."

# Quick test with timeout
SDR_TEST=$(timeout 3 rtl_test -t 2>&1 | head -10 || true)

if echo "$SDR_TEST" | grep -q "Found 1 device"; then
    if echo "$SDR_TEST" | grep -q "usb_claim_interface error"; then
        warn "SDR detected but USB claim error."
        echo ""
        echo -e "${YELLOW}Fix: Unplug the SDR, wait 2 seconds, plug it back in.${NC}"
        echo "Then test with: rtl_test -t"
    else
        success "RTL-SDR device detected and working!"
    fi
else
    warn "RTL-SDR not detected. Make sure it's plugged in."
    echo "After plugging in, test with: rtl_test -t"
fi

echo ""
echo -e "${GREEN}All done!${NC}"
echo ""
echo "Run: ${BLUE}./scripts/start.sh${NC}"
