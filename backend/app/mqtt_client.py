"""MQTT client for Home Assistant integration with auto-discovery."""

import asyncio
import json
import logging
from datetime import datetime

import paho.mqtt.client as mqtt

from .config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class MQTTClient:
    """MQTT client with Home Assistant discovery support."""

    def __init__(self):
        self.client = mqtt.Client(
            client_id=settings.mqtt_client_id,
            protocol=mqtt.MQTTv5,
        )
        self.connected = False
        self._device_configs_sent: set[str] = set()

        # Set callbacks
        self.client.on_connect = self._on_connect
        self.client.on_disconnect = self._on_disconnect
        self.client.on_message = self._on_message

        # Set credentials if provided
        if settings.mqtt_username and settings.mqtt_password:
            self.client.username_pw_set(
                settings.mqtt_username,
                settings.mqtt_password
            )

    def _on_connect(self, client, userdata, flags, rc, properties=None):
        """Handle connection callback."""
        if rc == 0:
            self.connected = True
            logger.info("Connected to MQTT broker")
            # Subscribe to rtl_433 events
            self.client.subscribe(f"{settings.mqtt_topic_prefix}/#")
        else:
            logger.error(f"MQTT connection failed with code {rc}")

    def _on_disconnect(self, client, userdata, rc, properties=None):
        """Handle disconnection callback."""
        self.connected = False
        logger.warning(f"Disconnected from MQTT broker (rc={rc})")

    def _on_message(self, client, userdata, message):
        """Handle incoming MQTT messages."""
        logger.debug(f"MQTT message: {message.topic} -> {message.payload[:100]}")

    async def connect(self) -> bool:
        """Connect to MQTT broker."""
        try:
            self.client.connect_async(
                settings.mqtt_broker,
                settings.mqtt_port,
                keepalive=60
            )
            self.client.loop_start()

            # Wait for connection
            for _ in range(50):  # 5 seconds timeout
                if self.connected:
                    return True
                await asyncio.sleep(0.1)

            logger.error("MQTT connection timeout")
            return False

        except Exception as e:
            logger.error(f"MQTT connection error: {e}")
            return False

    async def disconnect(self):
        """Disconnect from MQTT broker."""
        self.client.loop_stop()
        self.client.disconnect()
        self.connected = False
        logger.info("Disconnected from MQTT broker")

    def publish(self, topic: str, payload: dict | str, retain: bool = False):
        """Publish a message to MQTT."""
        if not self.connected:
            logger.warning("MQTT not connected, message not sent")
            return

        if isinstance(payload, dict):
            payload = json.dumps(payload)

        self.client.publish(topic, payload, retain=retain)

    async def publish_reading(self, reading: dict):
        """Publish a sensor reading to MQTT."""
        device_id = self._generate_device_id(reading)
        topic = f"{settings.mqtt_topic_prefix}/devices/{device_id}"

        # Ensure HA discovery is sent for this device
        await self._ensure_ha_discovery(reading, device_id)

        # Publish reading
        self.publish(topic, reading)

    async def _ensure_ha_discovery(self, reading: dict, device_id: str):
        """Send Home Assistant MQTT discovery config if not already sent."""
        if device_id in self._device_configs_sent:
            return

        model = reading.get("model", "Unknown")

        # Device info (shared across all entities)
        device_info = {
            "identifiers": [device_id],
            "name": f"{model} {reading.get('id', '')}",
            "model": model,
            "manufacturer": "RTL-SDR",
            "via_device": settings.ha_device_name,
        }

        # Create entities based on available data
        entities = []

        if "temperature_C" in reading:
            entities.append({
                "type": "sensor",
                "name": "Temperature",
                "device_class": "temperature",
                "unit_of_measurement": "°C",
                "value_template": "{{ value_json.temperature_C }}",
                "state_class": "measurement",
            })

        if "humidity" in reading:
            entities.append({
                "type": "sensor",
                "name": "Humidity",
                "device_class": "humidity",
                "unit_of_measurement": "%",
                "value_template": "{{ value_json.humidity }}",
                "state_class": "measurement",
            })

        if "battery_ok" in reading:
            entities.append({
                "type": "binary_sensor",
                "name": "Battery",
                "device_class": "battery",
                "payload_on": "0",
                "payload_off": "1",
                "value_template": "{{ value_json.battery_ok }}",
            })

        if "pressure_hPa" in reading:
            entities.append({
                "type": "sensor",
                "name": "Pressure",
                "device_class": "pressure",
                "unit_of_measurement": "hPa",
                "value_template": "{{ value_json.pressure_hPa }}",
                "state_class": "measurement",
            })

        # Publish discovery configs
        for entity in entities:
            entity_id = f"{device_id}_{entity['name'].lower().replace(' ', '_')}"
            discovery_topic = (
                f"{settings.ha_discovery_prefix}/{entity['type']}/{device_id}/"
                f"{entity['name'].lower().replace(' ', '_')}/config"
            )

            config = {
                "name": entity["name"],
                "unique_id": entity_id,
                "state_topic": f"{settings.mqtt_topic_prefix}/devices/{device_id}",
                "device": device_info,
            }

            # Add entity-specific fields
            for key in ["device_class", "unit_of_measurement", "value_template",
                        "state_class", "payload_on", "payload_off"]:
                if key in entity:
                    config[key] = entity[key]

            self.publish(discovery_topic, config, retain=True)
            logger.info(f"Published HA discovery for {entity_id}")

        self._device_configs_sent.add(device_id)

    def _generate_device_id(self, data: dict) -> str:
        """Generate a unique device ID from reading data."""
        model = data.get("model", "Unknown")
        sensor_id = data.get("id", "0")
        channel = data.get("channel", "")

        # Sanitize for MQTT topic
        model = model.replace(" ", "_").replace("/", "_")

        if channel:
            return f"{model}_{sensor_id}_{channel}"
        return f"{model}_{sensor_id}"

    async def remove_device(self, device_id: str):
        """Remove a device from Home Assistant by publishing empty configs."""
        if device_id not in self._device_configs_sent:
            return

        # Publish empty configs to remove entities
        for entity_type in ["sensor", "binary_sensor"]:
            for entity_name in ["temperature", "humidity", "battery", "pressure"]:
                discovery_topic = (
                    f"{settings.ha_discovery_prefix}/{entity_type}/{device_id}/"
                    f"{entity_name}/config"
                )
                self.publish(discovery_topic, "", retain=True)

        self._device_configs_sent.discard(device_id)
        logger.info(f"Removed HA discovery for {device_id}")


# Global MQTT client instance
mqtt_client = MQTTClient()
