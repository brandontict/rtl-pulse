# RTL-SDR Dashboard

Real-time RF signal monitoring, spectrum analysis, and sensor decoding platform for RTL-SDR devices.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.9+-green.svg)
![Node](https://img.shields.io/badge/node-18+-green.svg)

## Features

| Feature | Description |
|---------|-------------|
| **Live Decoding** | 200+ wireless protocols via rtl_433 |
| **Spectrum Scanner** | Sweep frequency ranges with rtl_power |
| **Live FFT** | Real-time spectrum via WebSocket |
| **Radio Tuner** | Car radio-style dial with scroll-to-tune |
| **Signal Decoder** | Protocol analysis + raw JSON inspection |
| **Home Assistant** | MQTT auto-discovery integration |
| **Dual Frontend** | React dashboard + Vue analyzer |

## Quick Start

```bash
git clone https://github.com/yourusername/rtl-sdr-dashboard.git
cd rtl-sdr-dashboard
./scripts/setup.sh
./scripts/start.sh
```

Open http://localhost:3000

## Requirements

| Component | Version |
|-----------|---------|
| RTL-SDR | RTL2832U-based dongle |
| Python | 3.9+ |
| Node.js | 18+ |
| OS | Linux (Debian/Ubuntu/Kali) |

## Installation

```bash
# System dependencies
sudo apt install -y rtl-sdr librtlsdr-dev python3-venv nodejs npm mosquitto

# Build rtl_433
cd rtl_433 && mkdir build && cd build && cmake .. && make -j4

# Backend
cd backend && python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt

# Frontend
cd dashboard && npm install
cd ../signal-analyzer && npm install
```

## Usage

### Services

```bash
./scripts/start.sh   # Start all
./scripts/stop.sh    # Stop all
./scripts/status.sh  # Check status
```

### Access Points

| Service | URL |
|---------|-----|
| Dashboard | http://localhost:3000 |
| Analyzer | http://localhost:3001 |
| API | http://localhost:8000 |
| Docs | http://localhost:8000/docs |

### Dashboard Pages

| Page | Function |
|------|----------|
| Dashboard | Live sensor readings |
| Signals | Protocol/frequency config |
| Spectrum | Scan + Live FFT modes |
| Decode | Real-time signal decoder |
| Devices | Device management |
| Console | System logs |
| Config | rtl_433 editor |

## Spectrum Modes

**Scan** - Sweep frequency range
```
432M → 436M @ 100kHz bins, 5s integration
```

**Live** - Real-time FFT display
```
Center: 433.92MHz, BW: 2.048MHz, FFT: 1024
```

**Tuner** - Scroll like car radio
```
Mouse wheel: ±0.1 MHz
Skip buttons: Jump presets
```

## API Reference

### System
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/system/health` | Health check |
| GET | `/api/v1/system/rtl433/status` | Process status |
| POST | `/api/v1/system/rtl433/start` | Start rtl_433 |
| POST | `/api/v1/system/rtl433/stop` | Stop rtl_433 |

### Spectrum
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/spectrum/live/status` | FFT status |
| POST | `/api/v1/spectrum/live/start` | Start FFT |
| POST | `/api/v1/spectrum/live/stop` | Stop FFT |
| WS | `/api/v1/spectrum/live/ws` | FFT stream |
| POST | `/api/v1/signals/spectrum/scan` | Run scan |

### Sensors
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/sensors/` | List readings |
| WS | `/ws` | Live readings |

## Frequency Presets

| Band | Range | Use Case |
|------|-------|----------|
| ISM 315 | 314-316 MHz | US car fobs |
| ISM 433 | 432-435 MHz | EU sensors |
| ISM 868 | 867-869 MHz | EU car fobs |
| ISM 915 | 902-928 MHz | US LoRa |
| FM | 88-108 MHz | Broadcast |
| Air | 118-137 MHz | Aircraft |
| Marine | 156-162 MHz | VHF |
| Weather | 162-163 MHz | NOAA |

## Configuration

### rtl_433.conf
```
frequency 433.92M
gain 40
output json
output mqtt://localhost:1883
protocol 1-200
```

### Environment
```bash
MQTT_BROKER=localhost
MQTT_PORT=1883
DATABASE_URL=sqlite:///./data/sensors.db
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Device not found | `sudo rmmod dvb_usb_rtl28xxu` |
| Permission denied | `sudo usermod -aG plugdev $USER` |
| Port in use | `./scripts/stop.sh` |
| No signals | Check antenna, try gain 20-50 |

## Project Structure

```
project-rtl-sdr/
├── backend/          # FastAPI + WebSocket
├── dashboard/        # React frontend
├── signal-analyzer/  # Vue frontend
├── rtl_433/          # Signal decoder
├── config/           # Configuration files
├── scripts/          # Management scripts
└── data/             # Runtime data
```

## License

MIT License - See [LICENSE](LICENSE)

## See Also

- [ARCHITECTURE.md](ARCHITECTURE.md) - System design & flow charts
- [rtl_433](https://github.com/merbanan/rtl_433) - Protocol decoder
