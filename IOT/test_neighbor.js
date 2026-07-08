const mqtt = require('mqtt');
const client = mqtt.connect('mqtt://localhost:1883');

client.on('connect', () => {
    console.log("[Test Neighbor] Crossroad 2 started and listening to neighbor...");
    client.subscribe('junction/crossroad_2/neighbor/coordination');
});

client.on('message', (topic, message) => {
    try {
        const payload = JSON.parse(message.toString());
        if (!payload.fromJunction || !payload.direction) {
            console.log("\n[CRITICAL ERROR] Received corrupted message (missing required fields)!");
            console.log("Data:", message.toString());
        } 
        else if (payload.direction !== 'horizontal' && payload.direction !== 'vertical') {
            console.log(`\n[WARNING] Received message with unknown direction: "${payload.direction}"`);
        } 
        else {
            console.log("\n[SUCCESS] Crossroad crossroad_2 received valid coordination from neighbor!");
            console.log(`-> Source: ${payload.fromJunction}`);
            console.log(`-> Direction: ${payload.direction}`);
            console.log(`-> Message: "${payload.message || 'no description'}"`);
            console.log(`[Action] Enabling adaptive priority for lane: ${payload.direction.toUpperCase()}`);
        }

    } catch (error) {
    console.log("\n[CRITICAL ERROR] Failed to parse neighbor's JSON!");
    console.log("Raw data from network:", message.toString());
    }
});