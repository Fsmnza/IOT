const mqtt = require('mqtt');
const client = mqtt.connect('mqtt://localhost:1883');

const JUNCTION_ID = process.argv[2] || 'crossroad_1';

client.on('connect', () => {
    console.log(`[TLC] Smart controller started for ${JUNCTION_ID}. Listening to sensors...`);
    client.subscribe(`junction/${JUNCTION_ID}/il/#`);
});

client.on('message', (topic, message) => {
    try {
        const carData = JSON.parse(message.toString());
        console.log(`[TLC] Smart controller started for ${JUNCTION_ID}. Listening to sensors...`);

        if (carData.direction === 'horizontal') {
            console.log(`[TLC] On the horizontal road, there is a traffic jam! Sending command to switch lights...`);
            
            const command = {
                command: 'Switch light',
                requestPhase: 'horizontal'
            };
            
            client.publish(`junction/${JUNCTION_ID}/tl/control`, JSON.stringify(command));
        }
    } catch (e) {
        console.error('[TLC] Error processing sensor data:', e);
    }
});