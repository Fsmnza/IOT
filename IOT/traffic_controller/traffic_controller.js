const mqtt = require('mqtt');
const client = mqtt.connect('mqtt://localhost:1883');

const JUNCTION_ID = process.argv[2] || 'crossroad_1';

const NEIGHBOR_MAP = { 'crossroad_1': 'crossroad_2', 'crossroad_2': 'crossroad_3' };
const NEIGHBOR_ID = NEIGHBOR_MAP[JUNCTION_ID] || null;

let counts = { horizontal: 0, vertical: 0 };
let neighborPriorityDirection = null;

let currentLightPhase = 'vertical'; 

client.on('connect', () => {
    console.log(`[TLC] Smart controller started for ${JUNCTION_ID}. Listening to sensors...`);
    client.subscribe(`junction/${JUNCTION_ID}/il/#`);
    client.subscribe(`junction/${JUNCTION_ID}/neighbor/coordination`);
    client.subscribe(`junction/${JUNCTION_ID}/tl/status`);
});

client.on('message', (topic, message) => {
    try {
        const payload = JSON.parse(message.toString());
                if (topic.endsWith('/tl/status')) {
            currentLightPhase = payload.traffic_light; 
            return;
        }

        if (topic.endsWith('/neighbor/coordination')) {
            console.log(`[TLC] Received coordination message from ${payload.fromJunction}: Incoming wave on ${payload.direction} lane!`);            
            neighborPriorityDirection = payload.direction;
            client.publish(`junction/${JUNCTION_ID}/tl/control`, JSON.stringify({ 
                command: 'Change time remaining', 
                direction: payload.direction,
                lightTime: 20 
            }));            
            setTimeout(() => {
                if (neighborPriorityDirection === payload.direction) neighborPriorityDirection = null;
            }, 15000);
            return;
        }

        let direction = payload.sensorId.includes('horizontal') ? 'horizontal' : 'vertical';

        if (payload.vehicleDetected === true) {
            counts[direction]++;            
            let effectiveHorizontal = counts.horizontal;
            let effectiveVertical = counts.vertical;           
            
            if (neighborPriorityDirection === 'horizontal') effectiveHorizontal += 3;
            if (neighborPriorityDirection === 'vertical') effectiveVertical += 3;

            console.log(`[TLC] New car on ${direction}. Demand (H/V): ${counts.horizontal}/${counts.vertical}. Effective Demand: ${effectiveHorizontal}/${effectiveVertical}`);
        
            const diff = effectiveHorizontal - effectiveVertical;
            const VEHICLE_DIFF_THRESHOLD = 5;

            if (diff >= VEHICLE_DIFF_THRESHOLD) {
                const extraTime = Math.floor(diff); 

                if (currentLightPhase === 'horizontal') {
                    console.log(`[TLC] !!! The horizontal is already green. Adding +${extraTime} sec. to the current phase !!!`);
                    client.publish(`junction/${JUNCTION_ID}/tl/control`, JSON.stringify({ 
                        command: 'Extend phase', 
                        direction: 'horizontal',
                        additionalTime: extraTime
                    }));
                } else {
                    console.log(`[TLC] !!! The horizontal is already green. Adding +${extraTime} sec. to the current phase !!!`);
                    client.publish(`junction/${JUNCTION_ID}/tl/control`, JSON.stringify({ 
                        command: 'Switch light', 
                        requestPhase: 'horizontal' 
                    }));
                }

                if (NEIGHBOR_ID) sendCoordinationSignal(NEIGHBOR_ID, 'horizontal');
                counts.horizontal = 0; counts.vertical = 0;

            } else if (-diff >= VEHICLE_DIFF_THRESHOLD) {
                const extraTime = Math.floor(-diff);

                if (currentLightPhase === 'vertical') {
                    console.log(`[TLC] !!! The vertical is already green. Adding +${extraTime} sec. to the current phase !!!`);
                    client.publish(`junction/${JUNCTION_ID}/tl/control`, JSON.stringify({ 
                        command: 'Extend phase', 
                        direction: 'vertical',
                        additionalTime: extraTime
                    }));
                } else {
                    console.log(`[TLC] !!! The vertical is already green. Adding +${extraTime} sec. to the current phase !!!`);
                    client.publish(`junction/${JUNCTION_ID}/tl/control`, JSON.stringify({ 
                        command: 'Switch light', 
                        requestPhase: 'vertical' 
                    }));
                }

                if (NEIGHBOR_ID) sendCoordinationSignal(NEIGHBOR_ID, 'vertical');
                counts.horizontal = 0; counts.vertical = 0;
            }
        }
    } catch (e) {
        console.error('[TLC] Error processing data:', e);
    }
});

function sendCoordinationSignal(targetJunction, direction) {
    const coordinationPayload = {
        fromJunction: JUNCTION_ID,
        direction: direction,
        timestamp: Math.floor(Date.now() / 1000),
        message: "Incoming vehicle flow wave"
    };
    const topic = `junction/${targetJunction}/neighbor/coordination`;
    client.publish(topic, JSON.stringify(coordinationPayload));
}