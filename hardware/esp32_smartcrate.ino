/*
  SmartCrate ESP32 sensor example.

  This is a documented firmware example, not a claim of tested physical hardware.
  Replace the sensor read functions with the libraries and wiring for the selected
  DHT22/VOC/CO2/weight hardware before deployment.
*/

#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <NTPClient.h>
#include <WiFi.h>
#include <WiFiUdp.h>

const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* API_URL = "http://YOUR_BACKEND_HOST:5000/api/sensors/readings";
const char* DEVICE_ID = "SC-ESP32-001";
const char* DEVICE_API_KEY = "STORE_DEVICE_SECRET_HERE";
const char* HARVEST_ID = "REAL_HARVEST_ID";

const unsigned long READING_INTERVAL_MS = 15UL * 60UL * 1000UL;
unsigned long lastReadingAt = 0;
WiFiUDP ntpUdp;
NTPClient ntpClient(ntpUdp, "pool.ntp.org", 0, 60UL * 60UL * 1000UL);

float readTemperature() {
  // Replace with the calibrated DHT22 read.
  return NAN;
}

float readHumidity() {
  // Replace with the calibrated DHT22 read.
  return NAN;
}

float readVoc() {
  // Replace with a documented VOC/gas index read.
  return NAN;
}

float readEthylene() {
  // Return NAN unless a calibrated ethylene sensor is installed.
  return NAN;
}

float readCo2() {
  // Replace with the calibrated CO2 read, or return NAN.
  return NAN;
}

float readCurrentWeight() {
  // Replace with the calibrated scale read, or return NAN.
  return NAN;
}

String isoTimestamp() {
  time_t epoch = ntpClient.getEpochTime();
  struct tm* utc = gmtime(&epoch);
  char buffer[25];
  strftime(buffer, sizeof(buffer), "%Y-%m-%dT%H:%M:%S.000Z", utc);
  return String(buffer);
}

void connectWifi() {
  if (WiFi.status() == WL_CONNECTED) return;
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  unsigned long startedAt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startedAt < 15000) {
    delay(250);
  }
}

void sendReading() {
  if (WiFi.status() != WL_CONNECTED) return;

  float temperature = readTemperature();
  float humidity = readHumidity();
  if (isnan(temperature) || isnan(humidity)) return;

  StaticJsonDocument<512> payload;
  payload["deviceId"] = DEVICE_ID;
  payload["harvestId"] = HARVEST_ID;
  payload["temperature"] = temperature;
  payload["humidity"] = humidity;
  payload["observedAt"] = isoTimestamp();

  float voc = readVoc();
  float ethylene = readEthylene();
  float co2 = readCo2();
  float currentWeight = readCurrentWeight();
  if (!isnan(voc)) payload["voc"] = voc;
  if (!isnan(ethylene)) payload["ethylene"] = ethylene;
  if (!isnan(co2)) payload["co2"] = co2;
  if (!isnan(currentWeight)) payload["currentWeight"] = currentWeight;

  String body;
  serializeJson(payload, body);

  HTTPClient http;
  http.begin(API_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Api-Key", DEVICE_API_KEY);
  int status = http.POST(body);
  if (status >= 500 || status < 0) {
    // The next scheduled interval retries without an unbounded tight loop.
    Serial.printf("Sensor POST failed: %d\n", status);
  } else {
    Serial.printf("Sensor POST status: %d\n", status);
  }
  http.end();
}

void setup() {
  Serial.begin(115200);
  connectWifi();
  ntpClient.begin();
  ntpClient.update();
}

void loop() {
  connectWifi();
  ntpClient.update();
  if (millis() - lastReadingAt >= READING_INTERVAL_MS) {
    lastReadingAt = millis();
    sendReading();
  }
  delay(1000);
}
