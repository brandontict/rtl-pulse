"""Live spectrum analyzer using RTL-SDR with real-time FFT processing."""

from __future__ import annotations

import asyncio
import logging
import struct
from typing import Optional, Callable, List
from dataclasses import dataclass
import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class SpectrumConfig:
    """Configuration for spectrum analyzer."""
    center_freq: int = 433_920_000  # 433.92 MHz
    sample_rate: int = 2_048_000     # 2.048 MHz
    fft_size: int = 1024
    gain: int = 40
    averaging: int = 4  # Number of FFTs to average


class SpectrumManager:
    """Manages live spectrum analysis from RTL-SDR."""

    def __init__(self):
        self.config = SpectrumConfig()
        self._process: Optional[asyncio.subprocess.Process] = None
        self._running = False
        self._clients: List[Callable] = []
        self._task: Optional[asyncio.Task] = None

    @property
    def is_running(self) -> bool:
        return self._running

    def add_client(self, callback: Callable):
        """Add a client callback for spectrum data."""
        if callback not in self._clients:
            self._clients.append(callback)
            logger.info(f"Spectrum client added. Total clients: {len(self._clients)}")

    def remove_client(self, callback: Callable):
        """Remove a client callback."""
        if callback in self._clients:
            self._clients.remove(callback)
            logger.info(f"Spectrum client removed. Total clients: {len(self._clients)}")

    async def _broadcast(self, data: dict):
        """Broadcast spectrum data to all clients."""
        for callback in self._clients[:]:  # Copy list to avoid mutation during iteration
            try:
                await callback(data)
            except Exception as e:
                logger.error(f"Error broadcasting to client: {e}")
                self._clients.remove(callback)

    def configure(
        self,
        center_freq: Optional[int] = None,
        sample_rate: Optional[int] = None,
        fft_size: Optional[int] = None,
        gain: Optional[int] = None,
        averaging: Optional[int] = None,
    ):
        """Update spectrum configuration."""
        if center_freq is not None:
            self.config.center_freq = center_freq
        if sample_rate is not None:
            self.config.sample_rate = sample_rate
        if fft_size is not None:
            # Ensure power of 2
            self.config.fft_size = 2 ** int(np.log2(fft_size))
        if gain is not None:
            self.config.gain = gain
        if averaging is not None:
            self.config.averaging = max(1, averaging)

    async def start(self) -> bool:
        """Start the spectrum analyzer."""
        if self._running:
            logger.warning("Spectrum analyzer already running")
            return True

        try:
            # Start rtl_sdr to capture raw IQ samples
            # -f frequency -s sample_rate -g gain - (output to stdout)
            cmd = [
                "rtl_sdr",
                "-f", str(self.config.center_freq),
                "-s", str(self.config.sample_rate),
                "-g", str(self.config.gain),
                "-"  # Output to stdout
            ]

            logger.info(f"Starting spectrum analyzer: {' '.join(cmd)}")

            self._process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            self._running = True
            self._task = asyncio.create_task(self._process_samples())

            logger.info("Spectrum analyzer started")
            return True

        except FileNotFoundError:
            logger.error("rtl_sdr not found. Install rtl-sdr tools.")
            return False
        except Exception as e:
            logger.error(f"Failed to start spectrum analyzer: {e}")
            return False

    async def stop(self):
        """Stop the spectrum analyzer."""
        if not self._running:
            return

        self._running = False

        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

        if self._process:
            self._process.terminate()
            try:
                await asyncio.wait_for(self._process.wait(), timeout=2.0)
            except asyncio.TimeoutError:
                self._process.kill()
            self._process = None

        logger.info("Spectrum analyzer stopped")

    async def _process_samples(self):
        """Process incoming IQ samples and compute FFT."""
        if not self._process or not self._process.stdout:
            return

        # Buffer for samples
        bytes_per_sample = 2  # RTL-SDR outputs 8-bit I and Q
        samples_needed = self.config.fft_size * bytes_per_sample
        fft_accumulator = []

        try:
            while self._running:
                # Read enough bytes for one FFT
                data = await self._process.stdout.read(samples_needed)
                if not data:
                    break

                if len(data) < samples_needed:
                    continue

                # Convert to complex samples
                # RTL-SDR outputs unsigned 8-bit I/Q pairs
                samples = np.frombuffer(data, dtype=np.uint8)
                # Convert to float and center around 0
                samples = samples.astype(np.float32) - 127.5
                # Interleaved I/Q to complex
                iq = samples[0::2] + 1j * samples[1::2]

                # Apply window function
                window = np.hanning(len(iq))
                iq_windowed = iq * window

                # Compute FFT
                fft_result = np.fft.fftshift(np.fft.fft(iq_windowed))

                # Convert to power (dB)
                power = 20 * np.log10(np.abs(fft_result) + 1e-10)

                # Accumulate for averaging
                fft_accumulator.append(power)

                if len(fft_accumulator) >= self.config.averaging:
                    # Average the accumulated FFTs
                    avg_power = np.mean(fft_accumulator, axis=0)
                    fft_accumulator = []

                    # Calculate frequency axis
                    freq_axis = np.fft.fftshift(
                        np.fft.fftfreq(self.config.fft_size, 1 / self.config.sample_rate)
                    )
                    freq_mhz = (self.config.center_freq + freq_axis) / 1e6

                    # Downsample for transmission (send every 4th point)
                    step = max(1, len(freq_mhz) // 256)
                    freq_downsampled = freq_mhz[::step].tolist()
                    power_downsampled = avg_power[::step].tolist()

                    # Broadcast to clients
                    spectrum_data = {
                        "type": "spectrum",
                        "center_freq_mhz": self.config.center_freq / 1e6,
                        "sample_rate_mhz": self.config.sample_rate / 1e6,
                        "frequencies": freq_downsampled,
                        "power": power_downsampled,
                        "min_power": float(np.min(avg_power)),
                        "max_power": float(np.max(avg_power)),
                        "avg_power": float(np.mean(avg_power)),
                    }

                    await self._broadcast(spectrum_data)

                    # Small delay to prevent overwhelming clients
                    await asyncio.sleep(0.05)

        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Error processing samples: {e}")
        finally:
            self._running = False

    def get_status(self) -> dict:
        """Get current status of spectrum analyzer."""
        return {
            "running": self._running,
            "center_freq_mhz": self.config.center_freq / 1e6,
            "sample_rate_mhz": self.config.sample_rate / 1e6,
            "fft_size": self.config.fft_size,
            "gain": self.config.gain,
            "averaging": self.config.averaging,
            "clients": len(self._clients),
        }


# Global instance
spectrum_manager = SpectrumManager()
