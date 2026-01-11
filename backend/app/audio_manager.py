"""Audio streaming manager using rtl_fm."""

from __future__ import annotations

import asyncio
import subprocess
import shutil
from typing import Optional, AsyncGenerator
from dataclasses import dataclass
from enum import Enum

from .config import settings


class Modulation(str, Enum):
    FM = "fm"
    AM = "am"
    WFM = "wbfm"  # Wideband FM (broadcast)
    NFM = "fm"    # Narrow FM (same as FM with lower sample rate)
    USB = "usb"   # Upper sideband
    LSB = "lsb"   # Lower sideband
    RAW = "raw"


@dataclass
class AudioConfig:
    frequency: str = "101.5M"
    modulation: Modulation = Modulation.WFM
    sample_rate: int = 200000
    output_rate: int = 48000
    gain: int = 40
    squelch: int = 0
    ppm: int = 0


class AudioManager:
    """Manages rtl_fm process for audio streaming."""

    def __init__(self):
        self.process: Optional[subprocess.Popen] = None
        self.config: Optional[AudioConfig] = None
        self._lock = asyncio.Lock()

    @property
    def is_running(self) -> bool:
        return self.process is not None and self.process.poll() is None

    @property
    def rtl_fm_path(self) -> str:
        """Find rtl_fm binary."""
        path = shutil.which("rtl_fm")
        if path:
            return path
        return "/usr/bin/rtl_fm"

    def _build_command(self, config: AudioConfig) -> list[str]:
        """Build rtl_fm command with config."""
        cmd = [
            self.rtl_fm_path,
            "-f", config.frequency,
            "-M", config.modulation.value,
            "-s", str(config.sample_rate),
            "-r", str(config.output_rate),
            "-g", str(config.gain),
        ]

        if config.squelch > 0:
            cmd.extend(["-l", str(config.squelch)])

        if config.ppm != 0:
            cmd.extend(["-p", str(config.ppm)])

        # Output raw audio to stdout
        cmd.append("-")

        return cmd

    async def start(self, config: AudioConfig) -> bool:
        """Start rtl_fm with the given configuration."""
        async with self._lock:
            if self.is_running:
                await self.stop()

            cmd = self._build_command(config)

            try:
                self.process = subprocess.Popen(
                    cmd,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    bufsize=0,
                )
                self.config = config

                # Wait briefly to check if process started successfully
                await asyncio.sleep(0.2)

                if self.process.poll() is not None:
                    stderr = self.process.stderr.read().decode() if self.process.stderr else ""
                    raise RuntimeError(f"rtl_fm failed to start: {stderr}")

                return True

            except FileNotFoundError:
                raise RuntimeError(f"rtl_fm not found at {self.rtl_fm_path}")
            except Exception as e:
                self.process = None
                self.config = None
                raise RuntimeError(f"Failed to start rtl_fm: {e}")

    async def stop(self) -> bool:
        """Stop the rtl_fm process."""
        async with self._lock:
            if self.process:
                self.process.terminate()
                try:
                    self.process.wait(timeout=2)
                except subprocess.TimeoutExpired:
                    self.process.kill()
                    self.process.wait()
                self.process = None
                self.config = None
            return True

    async def stream_audio(self, chunk_size: int = 4096) -> AsyncGenerator[bytes, None]:
        """Stream audio data from rtl_fm."""
        if not self.is_running or not self.process or not self.process.stdout:
            return

        loop = asyncio.get_event_loop()

        while self.is_running:
            try:
                # Read audio data in a thread to avoid blocking
                data = await loop.run_in_executor(
                    None,
                    self.process.stdout.read,
                    chunk_size
                )

                if not data:
                    break

                yield data

            except Exception:
                break

    def get_status(self) -> dict:
        """Get current audio streaming status."""
        return {
            "running": self.is_running,
            "frequency": self.config.frequency if self.config else None,
            "modulation": self.config.modulation.value if self.config else None,
            "sample_rate": self.config.sample_rate if self.config else None,
            "output_rate": self.config.output_rate if self.config else None,
            "gain": self.config.gain if self.config else None,
        }


# Global audio manager instance
audio_manager = AudioManager()


# Common frequency presets
FREQUENCY_PRESETS = [
    {"name": "FM Broadcast Band", "start": "87.5M", "end": "108M", "mode": "wbfm", "step": "100k"},
    {"name": "Air Band", "start": "118M", "end": "137M", "mode": "am", "step": "25k"},
    {"name": "Weather Radio (US)", "frequencies": ["162.400M", "162.425M", "162.450M", "162.475M", "162.500M", "162.525M", "162.550M"], "mode": "fm"},
    {"name": "Marine VHF", "start": "156M", "end": "162M", "mode": "fm", "step": "25k"},
    {"name": "2m Amateur", "start": "144M", "end": "148M", "mode": "fm", "step": "5k"},
    {"name": "70cm Amateur", "start": "420M", "end": "450M", "mode": "fm", "step": "25k"},
    {"name": "433 MHz ISM", "frequency": "433.92M", "mode": "am"},
    {"name": "315 MHz (US)", "frequency": "315M", "mode": "am"},
    {"name": "868 MHz (EU)", "frequency": "868M", "mode": "am"},
    {"name": "915 MHz (US)", "frequency": "915M", "mode": "am"},
    {"name": "FRS/GMRS Ch1", "frequency": "462.5625M", "mode": "fm"},
    {"name": "FRS/GMRS Ch8", "frequency": "467.5625M", "mode": "fm"},
    {"name": "PMR446 Ch1", "frequency": "446.00625M", "mode": "fm"},
]
