"""RTL-433 process manager for subprocess control and data parsing."""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import AsyncGenerator, Callable

from .config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class RTL433Manager:
    """Manages the rtl_433 subprocess and parses its output."""

    def __init__(self):
        self.process: asyncio.subprocess.Process | None = None
        self.running = False
        self._callbacks: list[Callable] = []
        self._task: asyncio.Task | None = None

    @property
    def is_running(self) -> bool:
        """Check if rtl_433 process is running."""
        return self.process is not None and self.process.returncode is None

    def add_callback(self, callback: Callable):
        """Add a callback for new readings."""
        self._callbacks.append(callback)

    def remove_callback(self, callback: Callable):
        """Remove a callback."""
        if callback in self._callbacks:
            self._callbacks.remove(callback)

    async def start(self) -> bool:
        """Start the rtl_433 process."""
        if self.is_running:
            logger.warning("rtl_433 already running")
            return True

        rtl433_bin = settings.rtl433_bin
        rtl433_conf = settings.rtl433_conf

        if not rtl433_bin.exists():
            logger.error(f"rtl_433 binary not found: {rtl433_bin}")
            return False

        cmd = [str(rtl433_bin)]

        # Use config file if it exists
        if rtl433_conf.exists():
            cmd.extend(["-c", str(rtl433_conf)])
        else:
            # Default arguments
            cmd.extend([
                "-f", settings.rtl433_frequency,
                "-s", settings.rtl433_sample_rate,
                "-g", str(settings.rtl433_gain),
            ])

        # Always output JSON
        cmd.extend(["-F", "json"])

        logger.info(f"Starting rtl_433: {' '.join(cmd)}")

        try:
            self.process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            self.running = True

            # Start reading task
            self._task = asyncio.create_task(self._read_output())

            logger.info(f"rtl_433 started with PID {self.process.pid}")
            return True

        except Exception as e:
            logger.error(f"Failed to start rtl_433: {e}")
            return False

    async def stop(self):
        """Stop the rtl_433 process."""
        self.running = False

        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

        if self.process:
            logger.info("Stopping rtl_433...")
            self.process.terminate()
            try:
                await asyncio.wait_for(self.process.wait(), timeout=5.0)
            except asyncio.TimeoutError:
                logger.warning("rtl_433 did not terminate, killing...")
                self.process.kill()
                await self.process.wait()

            logger.info("rtl_433 stopped")
            self.process = None

    async def restart(self) -> bool:
        """Restart the rtl_433 process."""
        await self.stop()
        await asyncio.sleep(1)
        return await self.start()

    async def _read_output(self):
        """Read and parse rtl_433 JSON output."""
        if not self.process or not self.process.stdout:
            return

        logger.info("Starting rtl_433 output reader")

        try:
            async for line in self.process.stdout:
                if not self.running:
                    break

                try:
                    line_str = line.decode("utf-8").strip()
                    if not line_str:
                        continue

                    # Parse JSON
                    data = json.loads(line_str)

                    # Parse time if present
                    if "time" in data:
                        try:
                            data["time"] = datetime.fromisoformat(
                                data["time"].replace("Z", "+00:00")
                            )
                        except (ValueError, TypeError):
                            data["time"] = datetime.utcnow()
                    else:
                        data["time"] = datetime.utcnow()

                    # Notify callbacks
                    for callback in self._callbacks:
                        try:
                            if asyncio.iscoroutinefunction(callback):
                                await callback(data)
                            else:
                                callback(data)
                        except Exception as e:
                            logger.error(f"Callback error: {e}")

                except json.JSONDecodeError:
                    # Not JSON, might be status message
                    logger.debug(f"Non-JSON output: {line_str[:100]}")
                except Exception as e:
                    logger.error(f"Error processing line: {e}")

        except asyncio.CancelledError:
            logger.info("rtl_433 output reader cancelled")
        except Exception as e:
            logger.error(f"rtl_433 output reader error: {e}")
        finally:
            logger.info("rtl_433 output reader stopped")

    async def analyze_signal(self, duration: int = 10) -> list[dict]:
        """Run rtl_433 in analyze mode for signal exploration."""
        rtl433_bin = settings.rtl433_bin

        if not rtl433_bin.exists():
            logger.error(f"rtl_433 binary not found: {rtl433_bin}")
            return []

        cmd = [
            str(rtl433_bin),
            "-f", settings.rtl433_frequency,
            "-A",  # Analyze mode
            "-F", "json",
        ]

        logger.info(f"Running signal analysis for {duration}s")

        results = []
        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            # Run for specified duration
            try:
                stdout, _ = await asyncio.wait_for(
                    process.communicate(),
                    timeout=duration
                )
            except asyncio.TimeoutError:
                process.terminate()
                stdout, _ = await process.communicate()

            # Parse results
            for line in stdout.decode("utf-8").split("\n"):
                line = line.strip()
                if line:
                    try:
                        results.append(json.loads(line))
                    except json.JSONDecodeError:
                        pass

        except Exception as e:
            logger.error(f"Signal analysis error: {e}")

        return results


# Global manager instance
rtl_manager = RTL433Manager()
