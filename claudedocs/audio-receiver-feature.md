# Audio Receiver Feature

## Overview
Added an audio streaming feature to the signal-analyzer that allows listening to radio frequencies using rtl_fm.

## Backend Components

### AudioManager (`backend/app/audio_manager.py`)
Manages the rtl_fm subprocess for audio streaming.

**Features:**
- Start/stop rtl_fm process with configuration
- Async audio data streaming
- Modulation support: FM, AM, WFM, USB, LSB, RAW
- Configurable frequency, gain, squelch, PPM correction
- Frequency presets for common bands

**Modulations:**
| Mode | Description | Use Case |
|------|-------------|----------|
| wbfm | Wideband FM | FM broadcast (87.5-108 MHz) |
| fm | Narrow FM | Two-way radio, amateur, FRS |
| am | AM | Aircraft, CB radio, shortwave |
| usb | Upper Sideband | Amateur radio SSB |
| lsb | Lower Sideband | Amateur radio SSB |
| raw | Raw I/Q | Unprocessed samples |

### Audio Router (`backend/app/routers/audio.py`)
REST API endpoints for audio control.

**Endpoints:**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/audio/status` | GET | Current streaming status |
| `/api/v1/audio/start` | POST | Start audio with config |
| `/api/v1/audio/stop` | POST | Stop audio streaming |
| `/api/v1/audio/stream` | GET | Raw PCM audio stream |
| `/api/v1/audio/presets` | GET | Frequency presets |
| `/api/v1/audio/modulations` | GET | Available modulations |
| `/api/v1/audio/tune` | POST | Quick frequency change |

**Audio Stream Format:**
- Sample Rate: 48000 Hz
- Channels: 1 (Mono)
- Bit Depth: 16-bit
- Format: Signed integer, little-endian

## Frontend Component

### AudioPlayer (`signal-analyzer/src/views/AudioPlayer.vue`)
Vue 3 component for audio playback and visualization.

**Features:**
- Frequency input with presets
- Modulation selector
- Gain and squelch controls
- Volume control
- Real-time visualization (spectrum/waveform)
- Quick-tune buttons
- Preset frequency bands

**Visualization Modes:**
- **Spectrum**: Frequency domain visualization using FFT
- **Waveform**: Time domain audio waveform

**Preset Categories:**
- FM Broadcast Band (87.5-108 MHz)
- Air Band (118-137 MHz)
- Weather Radio US (162.4-162.55 MHz)
- Marine VHF (156-162 MHz)
- 2m Amateur (144-148 MHz)
- 70cm Amateur (420-450 MHz)
- 433 MHz ISM
- 315/868/915 MHz bands

## Usage

1. Navigate to Signal Analyzer → Audio tab
2. Enter frequency or select a preset
3. Choose modulation mode
4. Adjust gain (0-50 dB)
5. Click "Start Listening"
6. Adjust volume as needed

## Technical Notes

**Conflict Handling:**
- Cannot run audio and rtl_433 simultaneously (same SDR hardware)
- API returns 409 if rtl_433 is already running

**Audio Pipeline:**
```
rtl_fm (subprocess) → stdout → FastAPI stream → fetch → Web Audio API → speakers
```

**Web Audio Processing:**
1. Fetch raw PCM stream
2. Buffer 1 second of audio
3. Convert 16-bit signed to Float32
4. Create AudioBuffer
5. Play through AudioBufferSourceNode
6. Connect to GainNode for volume
7. Connect to AnalyserNode for visualization

## File Locations
```
backend/app/
├── audio_manager.py      # rtl_fm process manager
└── routers/
    └── audio.py          # Audio API endpoints

signal-analyzer/src/
├── views/
│   └── AudioPlayer.vue   # Audio player component
├── main.ts               # Updated with audio route
└── App.vue               # Updated with audio nav item
```

## Dependencies

**Backend:**
- rtl_fm binary (from rtl-sdr package)
- FastAPI StreamingResponse

**Frontend:**
- Web Audio API (browser native)
- Vue 3 Composition API
