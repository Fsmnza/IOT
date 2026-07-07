const mqtt = require('mqtt');
const client = mqtt.connect('mqtt://localhost:1883');

const JUNCTION_ID = process.argv[2] || 'crossroad_1';

let counts = {
    horizontal: 0,
    vertical: 0
};

client.on('connect', () => {
    console.log(`[TLC] Smart controller started for ${JUNCTION_ID}. Listening to sensors...`);
    client.subscribe(`junction/${JUNCTION_ID}/il/#`);
});

client.on('message', (topic, message) => {
    try {
        const carData = JSON.parse(message.toString());
        
        let direction = carData.sensorId.includes('horizontal') ? 'horizontal' : 'vertical';

        if (carData.vehicleDetected === true) {
            counts[direction]++;
            console.log(`[TLC] New car on ${direction}. Current demand: H=${counts.horizontal}, V=${counts.vertical}`);
            
            const diff = counts.horizontal - counts.vertical;
            const VEHICLE_DIFF_THRESHOLD = 5;

            if (diff >= VEHICLE_DIFF_THRESHOLD) {
                console.log(`[TLC] !!! Demand gap reached !!! Horizontal has ${diff} more cars. Requesting Switch!`);
                client.publish(`junction/${JUNCTION_ID}/tl/control`, JSON.stringify({ 
                    command: 'Switch light', 
                    requestPhase: 'horizontal' 
                }));
                counts.horizontal = 0;
                counts.vertical = 0;
            } else if (-diff >= VEHICLE_DIFF_THRESHOLD) {
                console.log(`[TLC] !!! Demand gap reached !!! Vertical has ${-diff} more cars. Requesting Switch!`);
                client.publish(`junction/${JUNCTION_ID}/tl/control`, JSON.stringify({ 
                    command: 'Switch light', 
                    requestPhase: 'vertical' 
                }));
                counts.horizontal = 0;
                counts.vertical = 0;
            }
        }
    } catch (e) {
        console.error('[TLC] Error processing sensor data:', e);
    }
});