# System Architecture

## Overview

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                         RTL-SDR DASHBOARD PLATFORM                            ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║  RF Reception → Signal Decoding → Data Processing → Visualization → Storage  ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

## System Flow

```
                              ┌─────────────────────┐
                              │    RTL-SDR Dongle   │
                              │  (RTL2832U/R820T)   │
                              │   24MHz - 1.7GHz    │
                              └──────────┬──────────┘
                                         │
                                         │ USB
                                         ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│                              LINUX HOST                                        │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │                         librtlsdr Driver                                 │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                    │                    │                    │                 │
│                    ▼                    ▼                    ▼                 │
│  ┌──────────────────────┐  ┌──────────────────┐  ┌──────────────────────┐     │
│  │      rtl_433         │  │    rtl_power     │  │      rtl_sdr         │     │
│  │  Protocol Decoder    │  │  Spectrum Sweep  │  │    Raw IQ Capture    │     │
│  │  200+ Protocols      │  │  Power Scanning  │  │    FFT Processing    │     │
│  └──────────┬───────────┘  └────────┬─────────┘  └──────────┬───────────┘     │
│             │                       │                       │                  │
│             │ JSON                  │ CSV                   │ IQ Samples       │
│             ▼                       ▼                       ▼                  │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │                      PYTHON BACKEND (FastAPI)                            │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────────────┐  │  │
│  │  │ RTL Manager│  │  Spectrum  │  │  WebSocket │  │    REST API        │  │  │
│  │  │ (Process)  │  │  Manager   │  │   Server   │  │    Endpoints       │  │  │
│  │  └──────┬─────┘  └──────┬─────┘  └──────┬─────┘  └─────────┬──────────┘  │  │
│  │         │               │               │                  │             │  │
│  │         └───────────────┴───────────────┴──────────────────┘             │  │
│  │                                   │                                       │  │
│  │                    ┌──────────────┴──────────────┐                        │  │
│  │                    ▼                             ▼                        │  │
│  │         ┌──────────────────┐          ┌──────────────────┐               │  │
│  │         │   SQLite DB      │          │   MQTT Client    │               │  │
│  │         │  Sensor History  │          │  HA Integration  │               │  │
│  │         └──────────────────┘          └────────┬─────────┘               │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                    │                              │                            │
└────────────────────┼──────────────────────────────┼────────────────────────────┘
                     │                              │
     ┌───────────────┼───────────────┐              │
     │               │               │              │
     ▼               ▼               ▼              ▼
┌─────────┐   ┌─────────────┐   ┌─────────┐   ┌──────────────┐
│  React  │   │    Vue      │   │ Browser │   │    Home      │
│Dashboard│   │  Analyzer   │   │   WS    │   │  Assistant   │
│ :3000   │   │   :3001     │   │ Client  │   │    MQTT      │
└─────────┘   └─────────────┘   └─────────┘   └──────────────┘
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SIGNAL PROCESSING PIPELINE                        │
└─────────────────────────────────────────────────────────────────────────────┘

RF Signal ──► Antenna ──► RTL-SDR ──► IQ Samples ──► Decoder ──► JSON ──► API
    │                                      │
    │                                      ├──► FFT ──► Spectrum Data
    │                                      │
    │                                      └──► Power Scan ──► CSV

┌─────────────────────────────────────────────────────────────────────────────┐
│                              DECODE PIPELINE                                │
└─────────────────────────────────────────────────────────────────────────────┘

rtl_433 ──► JSON ──► RTL Manager ──┬──► WebSocket ──► Browser
                                   │
                                   ├──► Database ──► History API
                                   │
                                   └──► MQTT ──► Home Assistant

┌─────────────────────────────────────────────────────────────────────────────┐
│                           SPECTRUM PIPELINE                                 │
└─────────────────────────────────────────────────────────────────────────────┘

SCAN MODE:
rtl_power ──► CSV ──► Parse ──► JSON ──► REST API ──► Chart

LIVE MODE:
rtl_sdr ──► IQ ──► NumPy FFT ──► Power Array ──► WebSocket ──► Chart
```

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND COMPONENTS                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌────────────┐  │
│  │   main.py   │───►│   routers/   │───►│   models/   │───►│ database/  │  │
│  │  FastAPI    │    │   API Ends   │    │  Pydantic   │    │  SQLite    │  │
│  └─────────────┘    └──────────────┘    └─────────────┘    └────────────┘  │
│         │                  │                                               │
│         │                  │                                               │
│         ▼                  ▼                                               │
│  ┌─────────────┐    ┌──────────────┐                                       │
│  │ websocket.py│    │ spectrum_    │                                       │
│  │  WS Handler │    │ manager.py   │                                       │
│  └─────────────┘    └──────────────┘                                       │
│         │                  │                                               │
│         │                  │                                               │
│         ▼                  ▼                                               │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────┐                    │
│  │rtl_manager  │    │  rtl_sdr     │    │ mqtt_client │                    │
│  │   .py       │    │  subprocess  │    │    .py      │                    │
│  └─────────────┘    └──────────────┘    └─────────────┘                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                            FRONTEND COMPONENTS                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  REACT DASHBOARD (Port 3000)           VUE ANALYZER (Port 3001)             │
│  ┌─────────────────────────┐           ┌─────────────────────────┐          │
│  │  pages/                 │           │  views/                 │          │
│  │  ├── Dashboard.tsx      │           │  ├── Analyzer.vue       │          │
│  │  ├── Signals.tsx        │           │  ├── Decoder.vue        │          │
│  │  ├── SpectrumScanner.tsx│           │  └── Explorer.vue       │          │
│  │  ├── Decoding.tsx       │           │                         │          │
│  │  ├── Devices.tsx        │           │  composables/           │          │
│  │  ├── ConsoleLogs.tsx    │           │  └── useSignalData.ts   │          │
│  │  ├── Configuration.tsx  │           │                         │          │
│  │  └── Settings.tsx       │           │                         │          │
│  │                         │           │                         │          │
│  │  components/            │           │  components/            │          │
│  │  ├── FrequencyTuner.tsx │           │  ├── SpectrumView.vue   │          │
│  │  ├── SensorCard.tsx     │           │  └── SignalDecoder.vue  │          │
│  │  └── LiveChart.tsx      │           │                         │          │
│  └─────────────────────────┘           └─────────────────────────┘          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## WebSocket Connections

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           WEBSOCKET STREAMS                                 │
└─────────────────────────────────────────────────────────────────────────────┘

Browser ◄──────────────────────────────────────────────────────────► Backend
    │                                                                    │
    │  ws://localhost:8000/ws                                            │
    │  ├─► { type: "reading", data: { model, temp, humidity, ... } }     │
    │  └─► { type: "status", data: { rtl433_running, ... } }             │
    │                                                                    │
    │  ws://localhost:8000/api/v1/spectrum/live/ws                       │
    │  ├─► { type: "spectrum", frequencies: [...], power: [...] }        │
    │  └─► { type: "heartbeat" }                                         │
    │                                                                    │
```

## Dependencies

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SYSTEM DEPENDENCIES                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  SYSTEM PACKAGES              PYTHON PACKAGES           NODE PACKAGES       │
│  ─────────────────            ───────────────           ─────────────       │
│  rtl-sdr                      fastapi                   react               │
│  librtlsdr-dev                uvicorn                   react-dom           │
│  libusb-1.0-0-dev             paho-mqtt                 react-router-dom    │
│  cmake                        sqlalchemy                recharts            │
│  build-essential              aiosqlite                 tailwindcss         │
│  mosquitto                    websockets                lucide-react        │
│  python3-venv                 pydantic                  vite                │
│  nodejs                       numpy                     vue                 │
│  npm                          pydantic-settings         @vueuse/core        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Port Allocation

```
┌──────────────────────────────────────────────────────────────────┐
│                        PORT ALLOCATION                           │
├──────────┬───────────────────────────────────────────────────────┤
│   PORT   │                    SERVICE                            │
├──────────┼───────────────────────────────────────────────────────┤
│   1883   │  Mosquitto MQTT Broker                                │
│   3000   │  React Dashboard (Vite)                               │
│   3001   │  Vue Signal Analyzer (Vite)                           │
│   8000   │  Python FastAPI Backend                               │
└──────────┴───────────────────────────────────────────────────────┘
```

## File Structure

```
project-rtl-sdr/
│
├── backend/                          # Python FastAPI Backend
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                   # Application entry point
│   │   ├── config.py                 # Pydantic settings
│   │   ├── database.py               # SQLAlchemy models
│   │   ├── models.py                 # Pydantic schemas
│   │   ├── rtl_manager.py            # rtl_433 process control
│   │   ├── spectrum_manager.py       # Live FFT processing
│   │   ├── mqtt_client.py            # MQTT/HA integration
│   │   ├── websocket.py              # WebSocket handler
│   │   └── routers/
│   │       ├── sensors.py            # Sensor CRUD
│   │       ├── devices.py            # Device management
│   │       ├── signals.py            # Signal analysis
│   │       ├── spectrum.py           # Spectrum endpoints
│   │       ├── system.py             # System control
│   │       └── audio.py              # Audio streaming
│   ├── requirements.txt
│   └── venv/                         # Python virtual environment
│
├── dashboard/                        # React Frontend
│   ├── src/
│   │   ├── App.tsx                   # Main app + routing
│   │   ├── main.tsx                  # Entry point
│   │   ├── pages/                    # Page components
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Signals.tsx
│   │   │   ├── SpectrumScanner.tsx
│   │   │   ├── Decoding.tsx
│   │   │   ├── Devices.tsx
│   │   │   ├── ConsoleLogs.tsx
│   │   │   ├── Configuration.tsx
│   │   │   └── Settings.tsx
│   │   ├── components/               # Reusable components
│   │   │   ├── FrequencyTuner.tsx
│   │   │   ├── SensorCard.tsx
│   │   │   └── ProtocolSelector.tsx
│   │   ├── hooks/                    # Custom hooks
│   │   │   └── useWebSocket.ts
│   │   └── services/                 # API clients
│   │       └── api.ts
│   ├── package.json
│   └── vite.config.ts
│
├── signal-analyzer/                  # Vue Frontend
│   ├── src/
│   │   ├── App.vue
│   │   ├── views/
│   │   └── composables/
│   └── package.json
│
├── rtl_433/                          # rtl_433 source (submodule)
│   └── build/
│       └── src/
│           └── rtl_433              # Compiled binary
│
├── config/
│   ├── rtl_433.conf                  # rtl_433 configuration
│   ├── mosquitto.conf                # MQTT broker config
│   └── 99-rtl-sdr.rules              # udev rules
│
├── scripts/
│   ├── setup.sh                      # Initial setup
│   ├── start.sh                      # Start services
│   ├── stop.sh                       # Stop services
│   ├── status.sh                     # Check status
│   └── build_rtl433.sh               # Build rtl_433
│
├── data/
│   ├── sensors.db                    # SQLite database
│   ├── logs/                         # Log files
│   └── pids/                         # PID files
│
├── README.md                         # Main documentation
├── ARCHITECTURE.md                   # This file
└── LICENSE                           # MIT License
```

## SDR Frequency Coverage

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        RTL-SDR FREQUENCY RANGE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  24 MHz ◄──────────────────────────────────────────────────────► 1.7 GHz   │
│     │                                                                │      │
│     │   ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐    │      │
│     │   │ FM  │ │ Air │ │ VHF │ │ ISM │ │ ISM │ │ ISM │ │ GSM │    │      │
│     │   │Radio│ │Band │ │Mar. │ │ 315 │ │ 433 │ │ 868 │ │ 900 │    │      │
│     │   └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘    │      │
│     │    88M    118M    156M    315M    433M    868M    900M       │      │
│     │                                                                │      │
└─────┴────────────────────────────────────────────────────────────────┴──────┘

Common Frequency Bands:
├── FM Broadcast:    88 - 108 MHz
├── Aircraft:        118 - 137 MHz
├── Marine VHF:      156 - 162 MHz
├── Weather Radio:   162 - 163 MHz
├── ISM 315 MHz:     314 - 316 MHz (US car fobs)
├── ISM 433 MHz:     432 - 435 MHz (EU sensors)
├── PMR446:          446 MHz (EU walkie-talkie)
├── ISM 868 MHz:     867 - 869 MHz (EU devices)
├── ISM 915 MHz:     902 - 928 MHz (US LoRa)
└── GSM 900:         925 - 960 MHz (Cell towers)
```

## Process Management

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PROCESS LIFECYCLE                                 │
└─────────────────────────────────────────────────────────────────────────────┘

                    start.sh
                       │
        ┌──────────────┼──────────────┬──────────────┐
        ▼              ▼              ▼              ▼
   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐
   │mosquitto│   │ rtl_433 │   │ backend │   │dashboard│
   │  :1883  │   │ decoder │   │  :8000  │   │  :3000  │
   └─────────┘   └─────────┘   └─────────┘   └─────────┘
        │              │              │              │
        │              │              │              │
        │              ▼              │              │
        │         (SDR BUSY)         │              │
        │              │              │              │
        │    ┌─────────┴─────────┐   │              │
        │    │                   │   │              │
        │    ▼                   ▼   │              │
        │  SCAN               LIVE   │              │
        │  (rtl_power)     (rtl_sdr) │              │
        │    │                   │   │              │
        │    └─────────┬─────────┘   │              │
        │              │              │              │
        │              ▼              │              │
        │        (SDR FREE)          │              │
        │              │              │              │
        └──────────────┼──────────────┴──────────────┘
                       │
                    stop.sh


NOTE: Only ONE of these can use the SDR at a time:
      - rtl_433 (sensor decoding)
      - rtl_power (spectrum scan)
      - rtl_sdr (live FFT)
```

## Security Considerations

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SECURITY NOTES                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  RECEIVE ONLY                                                               │
│  ─────────────                                                              │
│  RTL-SDR devices cannot transmit. This is a passive receiver only.         │
│                                                                             │
│  LEGAL NOTICE                                                               │
│  ────────────                                                               │
│  Receiving radio signals is legal in most jurisdictions.                    │
│  Decrypting encrypted communications may be illegal.                        │
│  Car keyfobs use rolling codes - captured signals cannot replay.            │
│                                                                             │
│  NETWORK SECURITY                                                           │
│  ────────────────                                                           │
│  - Dashboard runs on localhost by default                                   │
│  - No authentication on API endpoints                                       │
│  - Add nginx reverse proxy with auth for remote access                      │
│  - MQTT broker is unauthenticated by default                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Performance Notes

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PERFORMANCE TUNING                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  FFT SETTINGS                                                               │
│  ────────────                                                               │
│  Sample Rate    FFT Size    Update Rate    Frequency Resolution             │
│  ──────────────────────────────────────────────────────────────             │
│  1.024 MHz      1024        ~1000/sec      1 kHz                            │
│  2.048 MHz      1024        ~2000/sec      2 kHz                            │
│  2.048 MHz      2048        ~1000/sec      1 kHz                            │
│  2.048 MHz      4096        ~500/sec       0.5 kHz                          │
│                                                                             │
│  AVERAGING                                                                  │
│  ─────────                                                                  │
│  Higher averaging = smoother display, slower response                       │
│  Lower averaging = noisier display, faster response                         │
│  Recommended: 4-8 for general use                                           │
│                                                                             │
│  GAIN SETTINGS                                                              │
│  ─────────────                                                              │
│  0 = Auto gain (often too high)                                             │
│  20-30 = Good for strong local signals                                      │
│  40 = Good general purpose                                                  │
│  50 = Maximum, may cause clipping                                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```
