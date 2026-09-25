const apiUrl = process.env.SMARTCRATE_API_URL || 'http://localhost:5000/api';
const token = process.env.SMARTCRATE_JWT;
const harvestId = process.argv[2];

if (!token || !harvestId) {
  console.error('Usage: SMARTCRATE_JWT=<farmer-jwt> node hardware/simulate_sensor_reading.js <harvest-id>');
  process.exit(1);
}

const payload = {
  source: 'simulator',
  harvestId,
  temperature: 25.5,
  humidity: 61.2,
  voc: 0.82,
  ethylene: null,
  co2: null,
  currentWeight: 95,
  observedAt: new Date().toISOString(),
};

const response = await fetch(`${apiUrl}/sensors/readings`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(payload),
});

const body = await response.text();
console.log(`SIMULATED SENSOR DATA: HTTP ${response.status}`);
console.log(body);
if (!response.ok) process.exit(1);
