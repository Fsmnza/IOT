const mqtt = require('mqtt');

const junctionIdArg = process.argv[2] || 'crossroad_1';
const JUNCTION_ID = junctionIdArg;

const TIMINGS = {
    DEFAULT_GREEN: 10000,
    YELLOW: 3000,
    ALL_RED_DELAY: 1000
};

const client = mqtt.connect('mqtt://localhost:1883');

const STATES = {
    VERTICAL_GREEN: {
        dir: 'vertical', state: 'GREEN', next: 'VERTICAL_YELLOW',
        getDuration: () => currentGreenDurationMs
    },
    VERTICAL_YELLOW: {
        dir: 'vertical', state: 'YELLOW', next: 'HORIZONTAL_GREEN',
        getDuration: () => TIMINGS.YELLOW
    },
    HORIZONTAL_GREEN: {
        dir: 'horizontal', state: 'GREEN', next: 'HORIZONTAL_YELLOW',
        getDuration: () => currentGreenDurationMs
    },
    HORIZONTAL_YELLOW: {
        dir: 'horizontal', state: 'YELLOW', next: 'VERTICAL_GREEN',
        getDuration: () => TIMINGS.YELLOW
    }
};

// Текущее состояние системы
let currentState = 'VERTICAL_GREEN';
let phaseStart = Date.now();
let currentGreenDurationMs = TIMINGS.DEFAULT_GREEN;
let pendingSwitch = false; // Флаг принудительной смены фазы от TLC

client.on('connect', () => {
    console.log(`[Actuator] Connected. Managing FSM Traffic Lights for ${JUNCTION_ID}`);
    client.subscribe(`junction/${JUNCTION_ID}/tl/control`, (err) => {
        if (err) console.error('[Actuator] Subscription error:', err);
    });
    
    setInterval(tick, 100);
});

client.on('message', (topic, message) => {
    try {
        const data = JSON.parse(message.toString());
        
        if (data.comand === 'Switch light') {
            handleSwitchRequest(data.requestPhase);
        } else if (data.comand === 'Change time remaining') {
            handleTimeChange(data.direction, data.lightTime);
        }
    } catch (e) {
        console.error('[Actuator] Error processing control payload:', e);
    }
});

function handleSwitchRequest(requestedDirection) {
    const currentConfig = STATES[currentState];
        if (currentConfig.state === 'GREEN' && currentConfig.dir !== requestedDirection) {
        console.log(`[Actuator] Force switch requested to: ${requestedDirection}`);
        pendingSwitch = true;
    }
}

function handleTimeChange(direction, lightTimeSec) {
    const currentConfig = STATES[currentState];
    
    if (currentConfig.state === 'GREEN' && currentConfig.dir === direction) {
        if (typeof lightTimeSec === 'number' && lightTimeSec > 0) {
            const elapsed = Date.now() - phaseStart;
            currentGreenDurationMs = Math.max(elapsed, lightTimeSec * 1000);
            console.log(`[Actuator] Green window adjusted for ${direction} to ${lightTimeSec}s`);
        }
    }
}

function changeState(nextStateName) {
    currentState = nextStateName;
    phaseStart = Date.now();
    currentGreenDurationMs = TIMINGS.DEFAULT_GREEN; 
    pendingSwitch = false;
    
    console.log(`[Actuator FSM] Transitioned to ${currentState}`);
    publishStatus();
}

function tick() {
    const config = STATES[currentState];
    const elapsed = Date.now() - phaseStart;
    const maxDuration = config.getDuration();

    if (config.state === 'GREEN') {
        if (elapsed >= maxDuration || pendingSwitch) {
            changeState(config.next);
        } else {
            publishStatus();
        }
    } 
    else if (config.state === 'YELLOW') {
        if (elapsed >= maxDuration) {
            setTimeout(() => {
                changeState(config.next);
            }, TIMINGS.ALL_RED_DELAY);            
            phaseStart = Infinity; 
        } else {
            publishStatus();
        }
    }
}


function publishStatus() {
    if (phaseStart === Infinity) return; 

    const config = STATES[currentState];
    const elapsed = Date.now() - phaseStart;
    const duration = config.getDuration();
    
    const countdown = Math.max(0, Math.ceil((duration - elapsed) / 1000));

    const statusPayload = {
        junctionId: JUNCTION_ID,
        traffic_light: config.dir, 
        lightState: config.state,    
        countdown: countdown,
        timestamp: Math.floor(Date.now() / 1000)
    };

    client.publish(`junction/${JUNCTION_ID}/tl/status`, JSON.stringify(statusPayload));
    console.log(`[Actuator] FSM_STATE: ${currentState} | Light: ${config.state} on ${config.dir.toUpperCase()} | Ends in: ${countdown}s`);
}

process.on('SIGINT', () => {
    client.end();
    process.exit();
});