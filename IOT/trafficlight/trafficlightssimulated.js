const mqtt = require('mqtt');
const TrafficLight = require('./TrafficLight.js'); // Assumes your class is in TrafficLight.js

// 1. Configuration
const MQTT_BROKER = 'mqtt://localhost:1883';
const junctionIdArg = process.argv[2] || 'crossroad_1';
const JUNCTION_ID = junctionIdArg;

// 2. Connect to the MQTT Broker
const client = mqtt.connect(MQTT_BROKER);

client.on('connect', () => {
    console.log(`Intersection Monitor Active: ${JUNCTION_ID}`);
    // 3. Instantiate the 4 Traffic Lights
    // They listen to the same actuator signals but filter by their axis orientation
    const trafficLights = [
        new TrafficLight(client, JUNCTION_ID, 'vertical', 'Northbound'),
        new TrafficLight(client, JUNCTION_ID, 'vertical', 'Southbound'),
        new TrafficLight(client, JUNCTION_ID, 'horizontal', 'Eastbound'),
        new TrafficLight(client, JUNCTION_ID, 'horizontal', 'Westbound')
    ];

    console.log(`[System] 4 Traffic Lights successfully provisioned.`);
});

client.on('error', (err) => {
    console.error('[MQTT Error] Connection failed:', err);
});