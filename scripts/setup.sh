#!/bin/bash
# Initial setup script for RTL-SDR Dashboard project

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
CONFIG_DIR="$PROJECT_DIR/config"

echo "=== RTL-SDR Dashboard Setup ==="
echo "Project directory: $PROJECT_DIR"
echo ""

# Check for root (needed for some operations)
check_root() {
    if [ "$EUID" -ne 0 ]; then
        echo "Some operations require root. Run with sudo for full setup."
        return 1
    fi
    return 0
}

# Install system dependencies
install_deps() {
    echo "=== Installing System Dependencies ==="

    DEPS="cmake build-essential librtlsdr-dev libusb-1.0-0-dev pkg-config python3 python3-pip python3-venv nodejs npm mosquitto mosquitto-clients"

    if check_root; then
        apt update
        apt install -y $DEPS
        echo "Dependencies installed successfully."
    else
        echo "Would install: $DEPS"
        echo "Run: sudo apt install -y $DEPS"
    fi
}

# Setup udev rules
setup_udev() {
    echo ""
    echo "=== Setting up udev rules ==="

    RULES_FILE="$CONFIG_DIR/99-rtl-sdr.rules"
    TARGET="/etc/udev/rules.d/99-rtl-sdr.rules"

    if [ -f "$RULES_FILE" ]; then
        if check_root; then
            cp "$RULES_FILE" "$TARGET"
            udevadm control --reload-rules
            udevadm trigger
            echo "udev rules installed and reloaded."
        else
            echo "Would copy: $RULES_FILE -> $TARGET"
            echo "Run: sudo cp $RULES_FILE $TARGET && sudo udevadm control --reload-rules"
        fi
    else
        echo "ERROR: Rules file not found: $RULES_FILE"
    fi
}

# Blacklist DVB-T kernel modules
blacklist_dvb() {
    echo ""
    echo "=== Blacklisting DVB-T kernel modules ==="

    BLACKLIST="/etc/modprobe.d/rtl-sdr-blacklist.conf"

    if check_root; then
        cat > "$BLACKLIST" << 'EOF'
# Blacklist DVB-T drivers to allow rtl-sdr to claim the device
blacklist dvb_usb_rtl28xxu
blacklist rtl2832
blacklist rtl2830
EOF
        echo "DVB-T modules blacklisted. Reboot may be required."
    else
        echo "Would create: $BLACKLIST"
        echo "Run this script with sudo to blacklist DVB-T modules."
    fi
}

# Build rtl_433
build_rtl433() {
    echo ""
    echo "=== Building rtl_433 ==="

    if [ -x "$SCRIPT_DIR/build_rtl433.sh" ]; then
        bash "$SCRIPT_DIR/build_rtl433.sh"
    else
        echo "ERROR: build_rtl433.sh not found or not executable"
        exit 1
    fi
}

# Setup Python virtual environment
setup_python() {
    echo ""
    echo "=== Setting up Python environment ==="

    BACKEND_DIR="$PROJECT_DIR/backend"
    VENV_DIR="$BACKEND_DIR/venv"

    if [ ! -d "$VENV_DIR" ]; then
        python3 -m venv "$VENV_DIR"
        echo "Virtual environment created at $VENV_DIR"
    fi

    if [ -f "$BACKEND_DIR/requirements.txt" ]; then
        source "$VENV_DIR/bin/activate"
        pip install --upgrade pip
        pip install -r "$BACKEND_DIR/requirements.txt"
        deactivate
        echo "Python dependencies installed."
    else
        echo "requirements.txt not found - skipping pip install"
    fi
}

# Setup Node.js projects
setup_node() {
    echo ""
    echo "=== Setting up Node.js projects ==="

    for project in dashboard signal-analyzer; do
        if [ -f "$PROJECT_DIR/$project/package.json" ]; then
            echo "Installing dependencies for $project..."
            cd "$PROJECT_DIR/$project"
            npm install
        else
            echo "$project/package.json not found - skipping"
        fi
    done
}

# Test hardware
test_hardware() {
    echo ""
    echo "=== Testing RTL-SDR Hardware ==="

    if command -v rtl_test &> /dev/null; then
        echo "Running rtl_test (Ctrl+C to stop)..."
        timeout 5 rtl_test -t 2>&1 || true
    else
        echo "rtl_test not found. Install rtl-sdr package."
    fi
}

# Add user to plugdev group
setup_user() {
    echo ""
    echo "=== Setting up user permissions ==="

    CURRENT_USER="${SUDO_USER:-$USER}"

    if ! groups "$CURRENT_USER" | grep -q plugdev; then
        if check_root; then
            usermod -aG plugdev "$CURRENT_USER"
            echo "Added $CURRENT_USER to plugdev group. Log out and back in for changes to take effect."
        else
            echo "Run: sudo usermod -aG plugdev $CURRENT_USER"
        fi
    else
        echo "User $CURRENT_USER already in plugdev group."
    fi
}

# Main menu
main() {
    case "${1:-all}" in
        deps)
            install_deps
            ;;
        udev)
            setup_udev
            ;;
        blacklist)
            blacklist_dvb
            ;;
        build)
            build_rtl433
            ;;
        python)
            setup_python
            ;;
        node)
            setup_node
            ;;
        test)
            test_hardware
            ;;
        user)
            setup_user
            ;;
        all)
            install_deps
            setup_udev
            blacklist_dvb
            setup_user
            build_rtl433
            setup_python
            setup_node
            test_hardware
            ;;
        *)
            echo "Usage: $0 {all|deps|udev|blacklist|build|python|node|test|user}"
            echo ""
            echo "  all       - Run full setup (default)"
            echo "  deps      - Install system dependencies"
            echo "  udev      - Install udev rules"
            echo "  blacklist - Blacklist DVB-T kernel modules"
            echo "  build     - Build rtl_433 from source"
            echo "  python    - Setup Python virtual environment"
            echo "  node      - Setup Node.js projects"
            echo "  test      - Test RTL-SDR hardware"
            echo "  user      - Add user to plugdev group"
            exit 1
            ;;
    esac
}

main "$@"

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "1. Reboot if DVB-T modules were blacklisted"
echo "2. Run: ./scripts/start.sh"
echo "3. Open dashboard: http://localhost:3000"
echo "4. Open signal analyzer: http://localhost:3001"
