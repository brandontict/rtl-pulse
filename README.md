# RTL-SDR Dashboard & Signal Analysis Platform

A multi-component system for RTL-SDR signal reception, decoding, visualization, and home automation integration.

## Features

- **Real-time Sensor Monitoring** - Live temperature, humidity, and other sensor data
- **React Dashboard** - Modern web interface for sensor visualization and device management
- **Vue Signal Analyzer** - Exploratory tool for signal analysis and protocol discovery
- **Home Assistant Integration** - MQTT auto-discovery for seamless HA integration
- **Python FastAPI Backend** - WebSocket + REST API for data access

## Hardware

- **Supported**: Nooelec NESDR (RTL2832U + R820T) and other RTL-SDR dongles
- **Frequency**: 433.92 MHz (configurable for other frequencies)

## Architecture

```
┌──────────────────┐     ┌──────────────┐     ┌─────────────────┐
│  RTL-SDR Dongle  │────▶│   rtl_433    │────▶│  Python Backend │
└──────────────────┘     └──────────────┘     └────────┬────────┘
                                                       │
                    ┌──────────────────────────────────┼──────────────────────────────────┐
                    │                                  │                                  │
                    ▼                                  ▼                                  ▼
           ┌────────────────┐               ┌─────────────────┐              ┌────────────────────┐
           │ React Dashboard│               │ Vue Analyzer    │              │   Home Assistant   │
           │  (Port 3000)   │               │   (Port 3001)   │              │   (MQTT)           │
           └────────────────┘               └─────────────────┘              └────────────────────┘
```

## Quick Start

### 1. Install System Dependencies

```bash
sudo apt update
sudo apt install -y cmake build-essential librtlsdr-dev libusb-1.0-0-dev \
    pkg-config python3 python3-pip python3-venv nodejs npm mosquitto mosquitto-clients
```

### 2. Run Setup

```bash
cd /home/t3ch/Documents/project-rtl-sdr
sudo ./scripts/setup.sh
```

This will:
- Build rtl_433 from source
- Install udev rules for the RTL-SDR device
- Blacklist DVB-T kernel modules
- Set up Python virtual environment
- Install Node.js dependencies

### 3. Reboot (Required for udev/blacklist changes)

```bash
sudo reboot
```

### 4. Start Services

```bash
./scripts/start.sh
```

### 5. Access the Dashboards

- **React Dashboard**: http://localhost:3000
- **Vue Signal Analyzer**: http://localhost:3001
- **API Documentation**: http://localhost:8000/docs

## Project Structure

```
project-rtl-sdr/
├── rtl_433/                # RTL-433 source code
├── backend/                # Python FastAPI backend
│   ├── app/
│   │   ├── main.py        # Application entry point
│   │   ├── config.py      # Configuration
│   │   ├── database.py    # SQLite database layer
│   │   ├── rtl_manager.py # rtl_433 process control
│   │   ├── mqtt_client.py # MQTT/HA integration
│   │   ├── websocket.py   # WebSocket handler
│   │   └── routers/       # API endpoints
│   └── requirements.txt
├── dashboard/              # React dashboard
│   └── src/
│       ├── components/    # UI components
│       ├── pages/         # Page views
│       ├── hooks/         # React hooks
│       └── services/      # API services
├── signal-analyzer/        # Vue signal analyzer
│   └── src/
│       ├── views/         # Page views
│       └── composables/   # Vue composables
├── config/
│   ├── rtl_433.conf       # RTL-433 configuration
│   ├── mosquitto.conf     # MQTT broker config
│   └── 99-rtl-sdr.rules   # udev rules
├── scripts/
│   ├── setup.sh           # Initial setup
│   ├── start.sh           # Start all services
│   ├── stop.sh            # Stop all services
│   ├── status.sh          # Check service status
│   └── build_rtl433.sh    # Build rtl_433
└── data/                   # Runtime data (logs, database, PIDs)
```

## Configuration

### RTL-433 (`config/rtl_433.conf`)

```
frequency 433.92M
sample_rate 1024k
gain 40
output json
protocol 2    # Rubicson Temperature
protocol 3    # Prologue Temperature/Humidity
protocol 12   # Oregon Scientific
```

### Environment Variables

Create a `.env` file in `backend/` to override defaults:

```
MQTT_BROKER=localhost
MQTT_PORT=1883
DATABASE_URL=sqlite:///./data/sensors.db
```

## Home Assistant Integration

1. Ensure Mosquitto is running and HA is configured to use MQTT
2. Sensors will auto-discover via MQTT discovery protocol
3. Entities will appear as `sensor.rtl_sdr_*` in Home Assistant

### MQTT Topics

- `rtl_433/events` - All sensor events
- `rtl_433/devices/{model}_{id}` - Device-specific readings
- `homeassistant/sensor/*/config` - HA discovery configs

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/sensors/` | GET | Get sensor readings |
| `/api/v1/sensors/latest` | GET | Get latest reading per device |
| `/api/v1/devices/` | GET | List all devices |
| `/api/v1/devices/{id}` | PATCH | Update device settings |
| `/api/v1/system/status` | GET | System status |
| `/api/v1/system/rtl433/start` | POST | Start rtl_433 |
| `/api/v1/system/rtl433/stop` | POST | Stop rtl_433 |
| `/api/v1/signals/analyze` | POST | Run signal analysis |
| `/ws` | WebSocket | Real-time updates |

## Troubleshooting

### RTL-SDR Device Not Detected

```bash
# Check if device is connected
lsusb | grep -i rtl

# Verify udev rules are loaded
udevadm info -a -n /dev/bus/usb/*/

# Ensure user is in plugdev group
groups $USER
sudo usermod -aG plugdev $USER
```

### DVB-T Module Conflict

```bash
# Check if DVB-T module is loaded
lsmod | grep dvb

# Blacklist it
echo "blacklist dvb_usb_rtl28xxu" | sudo tee /etc/modprobe.d/rtl-sdr-blacklist.conf
sudo modprobe -r dvb_usb_rtl28xxu
```

### No Signals Detected

- Ensure sensors are within range
- Try different gain settings: `gain 20`, `gain 40`, `gain 50`
- Check antenna connection
- Verify correct frequency for your region

## Scripts

| Script | Description |
|--------|-------------|
| `./scripts/setup.sh` | Full initial setup |
| `./scripts/setup.sh build` | Build rtl_433 only |
| `./scripts/start.sh` | Start all services |
| `./scripts/stop.sh` | Stop all services |
| `./scripts/status.sh` | Check service status |

## Development

### Backend

```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload
```

### Dashboard

```bash
cd dashboard
npm run dev
```

### Signal Analyzer

```bash
cd signal-analyzer
npm run dev
```

## License

MIT License
