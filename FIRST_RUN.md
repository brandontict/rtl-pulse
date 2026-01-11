● Here's the first-time setup guide:

  1. System Dependencies

  sudo apt update
  sudo apt install -y cmake build-essential librtlsdr-dev libusb-1.0-0-dev \
      pkg-config python3 python3-pip python3-venv nodejs npm mosquitto mosquitto-clients

  2. Run Setup Script

  cd /home/t3ch/Documents/project-rtl-sdr
  sudo ./scripts/setup.sh

  This will:
  - Build rtl_433 from source
  - Install udev rules for RTL-SDR device
  - Blacklist DVB-T kernel modules
  - Create Python virtual environment
  - Install Python dependencies
  - Install Node.js dependencies for both dashboard and signal-analyzer

  3. Reboot (Required)

  sudo reboot

  Needed for udev rules and kernel module blacklist to take effect.

  4. Start Services

  ./scripts/start.sh

  5. Access

  | Service             | URL                        |
  |---------------------|----------------------------|
  | React Dashboard     | http://localhost:3000      |
  | Vue Signal Analyzer | http://localhost:3001      |
  | API Docs            | http://localhost:8000/docs |

  ---
  Quick manual install if setup.sh isn't working:

  # Backend
  cd backend
  python3 -m venv venv
  source venv/bin/activate
  pip install -r requirements.txt

  # Dashboard
  cd ../dashboard
  npm install

  # Signal Analyzer
  cd ../signal-analyzer
  npm install

+_+_+_+__+_+
 Yes, but that's a different use case from rtl_433 (which decodes digital sensor data).

  For audio playback, you need:

  Quick Option: rtl_fm (already included with rtl-sdr)

  # Listen to FM radio (e.g., 101.5 MHz)
  rtl_fm -f 101.5M -M fm -s 200000 -r 48000 - | aplay -r 48000 -f S16_LE

  # Listen to 433 MHz signals as audio (AM mode)
  rtl_fm -f 433.92M -M am -s 48000 - | aplay -r 48000 -f S16_LE

  # Narrow FM (walkie-talkies, weather radio)
  rtl_fm -f 162.55M -M fm -s 12000 -r 12000 - | aplay -r 12000 -f S16_LE

  GUI Options (more user-friendly)

  # GQRX - popular SDR with waterfall display
  sudo apt install gqrx-sdr

  # SDR++ - modern, feature-rich
  sudo apt install sdrpp

  # CubicSDR
  sudo apt install cubicsdr

  Add Audio Feature to Dashboard?

  I can add a simple audio streaming page to the Vue signal-analyzer that uses rtl_fm on the backend. Would include:
  - Frequency selector
  - Modulation mode (AM/FM/WFM)
  - Volume control
  - Waterfall visualization

  Want me to add this feature?
