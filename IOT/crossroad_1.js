const mqtt = require('mqtt');
const client = mqtt.connect('mqtt://localhost:1883');

// take the value from terminal 
const junctionIdArg = process.argv[2] || 'crossroad_1';

const JUNCTION_ID = junctionIdArg;

const CONGESTION_THRESHOLD = 5;   
const MIN_GREEN_MS = 10000;       
const MAX_WAIT_MS = 90000;        
const YELLOW_MS = 5000;
const RED_CLEAR_MS = 0;          
let phase = 'GREEN';              
let activeAxis = 'vertical';      
let phaseStart = Date.now();
let waitStart = { vertical: null, horizontal: Date.now() }; 

const vehicleCounts = { vertical: 0, horizontal: 0 };

client.on('connect', () => {
    console.log(`Connected. Managing ${JUNCTION_ID}...`);
    client.subscribe(`junction/${JUNCTION_ID}/sensors/#`);
    startSensorSimulation();
    setInterval(tick, 1000); 
});

function startSensorSimulation() {
    setInterval(() => {
        const payload = {
            sensorId: 'lane_north_1',
            timestamp: Math.floor(Date.now() / 1000),
            vehicleDetected: Math.random() > 0.4
        };
        client.publish(`junction/${JUNCTION_ID}/sensors/lane_north_1`, JSON.stringify(payload));
    }, 5000);
}

client.on('message', (topic, message) => {
    try {
        const payload = JSON.parse(message.toString());
        if (!topic.includes('sensors')) return;

        const axis = topic.includes('north') || topic.includes('south') ? 'vertical' : 'horizontal';
        if (payload.vehicleDetected) {
            vehicleCounts[axis] += 1;
        }
    } catch (e) {
        console.error('Bad sensor payload:', e);
    }
});

function decideNextAxis() {
    const vBusy = vehicleCounts.vertical >= CONGESTION_THRESHOLD;
    const hBusy = vehicleCounts.horizontal >= CONGESTION_THRESHOLD;

    if (vBusy && !hBusy) return 'vertical';
    if (hBusy && !vBusy) return 'horizontal';

    return activeAxis === 'vertical' ? 'horizontal' : 'vertical';
}

function tick() {
    const now = Date.now();
    const elapsed = now - phaseStart;

    if (phase === 'GREEN') {
        const minGreenPassed = elapsed >= MIN_GREEN_MS;
        const otherAxis = activeAxis === 'vertical' ? 'horizontal' : 'vertical';
        const starved = waitStart[otherAxis] && (now - waitStart[otherAxis] >= MAX_WAIT_MS);

        const nextAxis = decideNextAxis();
        const shouldSwitch = nextAxis !== activeAxis && (minGreenPassed || starved);

        if (shouldSwitch) {
            startYellow();
        } else {
            sendLightState(activeAxis, 'GREEN', remaining(MIN_GREEN_MS, elapsed));
        }
    } else if (phase === 'YELLOW') {
        if (elapsed >= YELLOW_MS) {
            startRed();
        } else {
            sendLightState(activeAxis, 'YELLOW', remaining(YELLOW_MS, elapsed));
        }
    } else if (phase === 'RED') {
        if (elapsed >= RED_CLEAR_MS) {
            switchAxisAndStartGreen();
        }
    }
}

function startYellow() {
    phase = 'YELLOW';
    phaseStart = Date.now();
    changeTrafficLight(activeAxis, 'YELLOW', YELLOW_MS / 1000);
}

function startRed() {
    phase = 'RED';
    phaseStart = Date.now();
    changeTrafficLight(activeAxis, 'RED', 0);
}

function switchAxisAndStartGreen() {
    const oldAxis = activeAxis;
    const newAxis = oldAxis === 'vertical' ? 'horizontal' : 'vertical';

    waitStart[oldAxis] = Date.now();
    waitStart[newAxis] = null;

    vehicleCounts[newAxis] = 0;

    activeAxis = newAxis;
    phase = 'GREEN';
    phaseStart = Date.now();

    changeTrafficLight(newAxis, 'GREEN', MIN_GREEN_MS / 1000);
}

function remaining(total, elapsed) {
    return Math.max(0, Math.ceil((total - elapsed) / 1000));
}

function sendLightState(axis, state, countdown) {
    changeTrafficLight(axis, state, countdown);
}

function changeTrafficLight(direction, state, countdown) {
    const actuatorPayload = {
        junctionId: JUNCTION_ID,
        traffic_light: direction,
        lightState: state,
        countdown: countdown,
        timestamp: Math.floor(Date.now() / 1000)
    };
    client.publish(`junction/${JUNCTION_ID}/actuators/lights`, JSON.stringify(actuatorPayload));
    console.log('[Actuator]', actuatorPayload);
}