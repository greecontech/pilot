# Soil moisture station (ESP32)

This is the pilot station for Greecon Platform. Every 10 minutes it measures soil moisture (two sensors) and soil temperature. Optionally it also measures air temperature and humidity. It sends the readings to the platform over Wi-Fi, then goes back into deep sleep between measurements.

> **Status:** the firmware **compiles** with `esp32` core 3.3.12 and the libraries OneWire 2.3.8, DallasTemperature 4.0.6 and Adafruit SHT31 Library 2.2.2 (81% of flash, 15% of RAM; checked on 12 October 2026 with `arduino-cli compile --fqbn esp32:esp32:esp32`). It has **not yet run on hardware**. The data it sends has been tested against the platform with `devices/emulator/send_test_readings.py`, which uses exactly the same metrics and JSON format. The first bench test (step 6 below) is where the firmware itself gets verified on a real board.

## Shopping list (one station)

Prices are approximate.

| Part | Qty | ≈ Price |
|---|---|---|
| ESP32 DevKitC (ESP32-WROOM-32) | 1 | €6–10 |
| Capacitive soil moisture sensor v1.2, or DFRobot SEN0193 for better quality | 2 (buy 4) | €2–7 each |
| DS18B20 waterproof temperature probe, plus a 4.7 kΩ resistor | 1 | €3 |
| SHT31 air temperature/humidity breakout (optional, for greenhouses) | 1 | €5 |
| IP65 junction box, about 150×110×70 mm, with 3–4 cable glands | 1 | €10 |
| 5 V USB power adapter and cable, if mains power is available | 1 | €5 |
| **Or** a solar kit: 6 V 3–6 W panel, 18650 battery holder and charger board (e.g. TP4056 or CN3065) | 1 | €20–30 |
| Breadboard or perfboard, jumper wires, heat-shrink tubing | – | €5 |

**Connectivity.** The station uses Wi-Fi. If the field has no Wi-Fi, add a small 4G router with a data SIM, such as a TP-Link M7200 or Teltonika RUT241 (€40–150). The station sends less than 1 MB per day.

**Total:** about €40–80 per station, plus a 4G router if needed.

Buy spare soil sensors. Cheap v1.2 boards vary in quality, and some have a faulty voltage regulator. Also seal the electronics at the top of each sensor with heat-shrink or conformal coating; only the white line marks how deep the sensor may go into the soil.

## Wiring

| From | To (ESP32) |
|---|---|
| Soil sensor 1: VCC / GND / AOUT | GPIO25 / GND / **GPIO34** |
| Soil sensor 2: VCC / GND / AOUT | GPIO25 / GND / **GPIO35** |
| DS18B20: red / black / yellow (data) | GPIO25 / GND / **GPIO4**, with the 4.7 kΩ resistor between data and 3.3 V |
| SHT31 (optional): VIN / GND / SDA / SCL | 3.3 V / GND / GPIO21 / GPIO22 |

GPIO25 powers the soil sensors only while the station measures. This saves energy and slows sensor corrosion.

The soil sensors must use GPIO34 or GPIO35, because those are ADC1 pins. ADC2 pins stop working while Wi-Fi is on.

## Flashing

1. **Install the tools.** Install the [Arduino IDE](https://www.arduino.cc/en/software). Under **Boards Manager**, install **esp32 by Espressif Systems**.
2. **Install the libraries.** Under **Library Manager**, install **OneWire**, **DallasTemperature** and **Adafruit SHT31 Library**.
3. **Get an API key.** On the platform, go to **Sites & sources** and add the pilot site. Then add a source of type **Device** and copy the API key. It is shown only once.
4. **Configure the station.** Copy `config.example.h` to `config.h`. Fill in the Wi-Fi name and password, `API_URL` (your Railway address followed by `/api/ingest`) and `API_KEY`. Set the `USE_…` switches to match the sensors you connected.
5. **Upload.** Select board **ESP32 Dev Module** and the right port, then upload.
6. **Bench test.** Open **Serial Monitor** at 115200 baud. You should see the JSON being sent, followed by `POST 201`. The readings then appear under **Data** on the platform.

## Calibration (do this once per sensor)

1. Hold the sensor in open air. On the platform, note the value of `soil_moisture_1_raw`; this is the **DRY** value.
2. Put the sensor in a glass of water, up to the white line. Note the raw value again; this is the **WET** value.
3. Enter both numbers as `SOIL_1_DRY` and `SOIL_1_WET` in `config.h`, do the same for sensor 2, and upload again.

Once the station is installed, check the percentage against the soil's feel or a reference meter. For irrigation decisions, the **trend** matters more than the absolute value.

## Limits and alerts

Under **Sites & sources → Edit**, set a **lower limit** on `Soil moisture 1` and `Soil moisture 2`. The platform raises an alert when the soil dries below that limit. Start at around 25–30%, then adjust it with the farmer or agronomist for the crop and soil type.

## Troubleshooting

| Symptom | Cause |
|---|---|
| `Wi-Fi not available` | Wrong SSID or password, or weak signal. Check the `wifi_rssi` metric: below −80 dBm is too weak. |
| `POST 401` | Wrong API key, or the key was regenerated. |
| `POST 403` | The source is deactivated on the platform. |
| Moisture stuck at 0% or 100% | Calibration values are swapped or wrong, or the sensor is faulty. Compare the raw values. |
| Soil temperature missing | The 4.7 kΩ pull-up resistor is missing, or the probe is wired wrongly. |
