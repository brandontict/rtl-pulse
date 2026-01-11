#!/bin/bash
# Build rtl_433 from source for Nooelec NESDR (RTL2832U + R820T)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
RTL433_DIR="$PROJECT_DIR/rtl_433"
BUILD_DIR="$RTL433_DIR/build"

echo "=== RTL-433 Build Script ==="
echo "Project directory: $PROJECT_DIR"
echo "RTL-433 source: $RTL433_DIR"

# Check for required dependencies
echo ""
echo "Checking dependencies..."

MISSING=""

# Check for build tools
for cmd in cmake make gcc pkg-config; do
    if ! command -v "$cmd" &> /dev/null; then
        MISSING="$MISSING $cmd"
    fi
done

# Check for rtl-sdr header (can be from librtlsdr-dev OR newer librtlsdr)
if [ ! -f "/usr/include/rtl-sdr.h" ]; then
    MISSING="$MISSING librtlsdr-dev"
fi

# Check for libusb
if [ ! -f "/usr/include/libusb-1.0/libusb.h" ]; then
    MISSING="$MISSING libusb-1.0-0-dev"
fi

if [ -n "$MISSING" ]; then
    echo "Missing dependencies:$MISSING"
    echo ""
    echo "Install with:"
    echo "  sudo apt install -y$MISSING"
    exit 1
fi

echo "All dependencies found."

# Check if source exists
if [ ! -d "$RTL433_DIR" ]; then
    echo "ERROR: rtl_433 source not found at $RTL433_DIR"
    exit 1
fi

# Create build directory
echo ""
echo "Creating build directory..."
mkdir -p "$BUILD_DIR"
cd "$BUILD_DIR"

# Configure with CMake
echo ""
echo "Configuring with CMake..."
cmake ..

# Build
echo ""
echo "Building rtl_433..."
make -j$(nproc)

# Verify binary
if [ -f "$BUILD_DIR/src/rtl_433" ]; then
    echo ""
    echo "=== Build Successful ==="
    echo "Binary location: $BUILD_DIR/src/rtl_433"
    echo ""
    echo "Version info:"
    "$BUILD_DIR/src/rtl_433" -V 2>&1 | head -5
    echo ""
    echo "To install system-wide (optional):"
    echo "  cd $BUILD_DIR && sudo make install"
else
    echo "ERROR: Build failed - binary not found"
    exit 1
fi
