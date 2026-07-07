const mqtt = require('mqtt');
const client = mqtt.connect('mqtt://localhost:1883');

const junctionIdArg = process.argv[2] || 'crossroad_1';
const JUNCTION_ID = junctionIdArg;

const DEFAULT_GREEN_MS = 10000;
const YELLOW_MS = 3000;
const ALL_RED_MS = 1000;

const VEHICLE_DIFF_THRESHOLD = 5; 
let vehicleCounts = { horizontal: 0, vertical: 0 };

let activeDirection = 'vertical';
let phase = 'GREEN';
let phaseStart = Date.now();
let currentGreenDurationMs = DEFAULT_GREEN_MS;
let pendingSwitchTo = null;
let lastLoggedCountdown = null;

const CONTROL_TOPIC = `junction/${JUNCTION_ID}/tl/control`;
const TRAFFIC_COUNT_TOPIC = `junction/${JUNCTION_ID}/traffic/count`;

client.on('connect', () => {
    console.log(`[Actuator] Connected. Managing physical lights for ${JUNCTION_ID}`);
    client.subscribe(CONTROL_TOPIC, (err) => {
        if (err) console.error('[Actuator] Subscribe error:', err);
    });
    client.subscribe(TRAFFIC_COUNT_TOPIC, (err) => {
        if (err) console.error('[Actuator] Subscribe error (traffic count):', err);
    });
    setInterval(tick, 500);
    publishStatus();
});

client.on('error', (err) => {
    console.error('[Actuator] MQTT Client Error:', err);
});

client.on('message', (topic, message) => {
    try {
        const data = JSON.parse(message.toString());

        if (topic === CONTROL_TOPIC) {
            // ИСПРАВЛЕНО: data.command вместо data.comand
            if (data.command === 'Switch light') { 
                handleSwitchRequest(data.requestPhase);
            } else if (data.command === 'Change time remaining') {
                handleTimeChange(data.direction, data.lightTime);
            }
        } else if (topic === TRAFFIC_COUNT_TOPIC) {
            handleVehicleCount(data);
        }
    } catch (e) {
        console.error('[Actuator] Bad payload:', e);
    }
});

function handleSwitchRequest(requestedDirection) {
    if (!requestedDirection || requestedDirection === activeDirection) return;

    pendingSwitchTo = requestedDirection;
    if (phase === 'GREEN') {
        startYellow();
    }
}

function handleTimeChange(direction, lightTime) {
    if (direction === activeDirection && phase === 'GREEN' && typeof lightTime === 'number' && lightTime > 0) {
        const elapsed = Date.now() - phaseStart;
        currentGreenDurationMs = Math.max(elapsed, lightTime * 1000);
        console.log(`[Actuator] Adjusted green duration for ${direction} to ${lightTime}s`);
    }
}

function handleVehicleCount(data) {
    if (typeof data.horizontal === 'number') vehicleCounts.horizontal = data.horizontal;
    if (typeof data.vertical === 'number') vehicleCounts.vertical = data.vertical;
    evaluateTrafficDemand();
}

function evaluateTrafficDemand() {
    const { horizontal, vertical } = vehicleCounts;
    const diff = horizontal - vertical;

    if (diff > VEHICLE_DIFF_THRESHOLD && activeDirection !== 'horizontal') {
        console.log(`[Actuator] Traffic demand: horizontal=${horizontal}, vertical=${vertical} -> switching to horizontal`);
        handleSwitchRequest('horizontal');
    } else if (-diff > VEHICLE_DIFF_THRESHOLD && activeDirection !== 'vertical') {
        console.log(`[Actuator] Traffic demand: horizontal=${horizontal}, vertical=${vertical} -> switching to vertical`);
        handleSwitchRequest('vertical');
    }
}

function startYellow() {
    phase = 'YELLOW';
    phaseStart = Date.now();
    publishStatus();
}

function startAllRed() {
    phase = 'ALL_RED';
    phaseStart = Date.now();
    publishStatus();
}

function startGreen(direction) {
    activeDirection = direction;
    phase = 'GREEN';
    phaseStart = Date.now();
    currentGreenDurationMs = DEFAULT_GREEN_MS;
    pendingSwitchTo = null;
    publishStatus();
}

function tick() {
    const elapsed = Date.now() - phaseStart;

    if (phase === 'GREEN') {
        if ((pendingSwitchTo && pendingSwitchTo !== activeDirection) || elapsed >= currentGreenDurationMs) {
            startYellow();
        } else {
            publishStatus();
        }
    } else if (phase === 'YELLOW') {
        if (elapsed >= YELLOW_MS) {
            startAllRed();
        } else {
            publishStatus();
        }
    } else if (phase === 'ALL_RED') {
        if (elapsed >= ALL_RED_MS) {
            const nextDirection = pendingSwitchTo || (activeDirection === 'vertical' ? 'horizontal' : 'vertical');
            startGreen(nextDirection);
        } else {
            publishStatus();
        }
    }
}

function publishStatus() {
    const elapsed = Date.now() - phaseStart;
    let countdown = 0;
    let lightState = 'RED';

    if (phase === 'GREEN') {
        lightState = 'GREEN';
        countdown = Math.max(0, Math.ceil((currentGreenDurationMs - elapsed) / 1000));
    } else if (phase === 'YELLOW') {
        lightState = 'YELLOW';
        countdown = Math.max(0, Math.ceil((YELLOW_MS - elapsed) / 1000));
    } else if (phase === 'ALL_RED') {
        lightState = 'RED';
        countdown = Math.max(0, Math.ceil((ALL_RED_MS - elapsed) / 1000));
    }

    if (countdown !== lastLoggedCountdown) {
        lastLoggedCountdown = countdown;

        const statusPayload = {
            junctionId: JUNCTION_ID,
            traffic_light: activeDirection,
            lightState,
            countdown,
            timestamp: Math.floor(Date.now() / 1000)
        };

        client.publish(`junction/${JUNCTION_ID}/tl/status`, JSON.stringify(statusPayload));
        console.log(`[Actuator] phase=${phase} active=${activeDirection} state=${lightState} countdown=${countdown}s`);
    }
}
process.on('SIGINT', () => {
    client.end();
    process.exit();
});