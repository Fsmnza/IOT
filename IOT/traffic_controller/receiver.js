//example of receiver who gets info dedicated for traffic light

const mqtt = require('mqtt');

// Connect to the MQTT broker (adjust host/port if yours is different)
const brokerUrl = 'mqtt://localhost:1883'; 
const client = mqtt.connect(brokerUrl);

const TOPIC = 'junction/crossroad_1/tl/control';

client.on('connect', () => {
    console.log(`[Receiver] Connected to MQTT broker at ${brokerUrl}`);
    client.subscribe(TOPIC, (err) => {
        if (!err) {
            console.log(`[Receiver] Subscribed to topic: ${TOPIC}`);
        } else {
            console.error(`[Receiver] Subscription error:`, err);
        }
    });
});

client.on('message', (topic, message) => {
    // 1. Convert the buffer to a string
    const payload = message.toString();
    
    // 2. Log exactly what is received
    console.log(`[Receiver] Received on ${topic}: "${payload}"`);

    // 3. Guard against empty payloads right here at the gateway
    if (!payload || payload.trim() === "") {
        console.log(`[Receiver] Cleaned up empty value. Skipping update to TL Controller.`);
        return;
    }

    try {
        // 4. Forward the valid data to your Traffic Light controller logic
        // (If you invoke your TL controller function here, it will now only get valid data)
        if (typeof processTrafficData === 'function') {
            processTrafficData(payload);
        }
    } catch (error) {
        console.error(`[Receiver] Error routing message:`, error.message);
    }
});

client.on('error', (err) => {
    console.error('[Receiver] MQTT Client Error:', err);
});