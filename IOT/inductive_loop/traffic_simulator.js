// traffic_simulator.js
// this file places inductive loops and controls traffic flow

const mqtt = require('mqtt');
const readline = require('readline');
const InductiveLoop = require('./InductiveLoop');

const junctionIdArg = process.argv[2] || 'crossroad_1';
const modeArg = process.argv[3] || 'random';

const brokerUrl = 'mqtt://localhost:1883';

// connect
const client = mqtt.connect(brokerUrl);
const CONTROL_TOPIC = `junction/${junctionIdArg}/tl/control`;

let currentLightPhase = 'vertical'; // vertical by default

client.on('connect', () => {
    console.log(`[Simulator Engine] Connected to broker. Listening for light phases on: ${CONTROL_TOPIC}`);
    client.subscribe(CONTROL_TOPIC);
});

client.on('message', (topic, message) => {
    try {
        const payload = JSON.parse(message.toString());
        // light switches
        if (payload.requestPhase) {
            currentLightPhase = payload.requestPhase;
            console.log(`[Simulator Engine] Traffic light shifted! Active flow is now: ${currentLightPhase.toUpperCase()}`);
        }
        // light 
        if (payload.direction && payload.comand === "Switch light") {
            currentLightPhase = payload.direction;
        }
    } catch (e) {
        // ignore non-JSON msg
    }
});

// init IL
const sensors = {
    north: {
        behind: new InductiveLoop({ brokerUrl, junctionId: junctionIdArg, sensorId: 'n_back', place: 'behind' }),
        infrontof: new InductiveLoop({ brokerUrl, junctionId: junctionIdArg, sensorId: 'n_front', place: 'infrontof' })
    },
    south: {
        behind: new InductiveLoop({ brokerUrl, junctionId: junctionIdArg, sensorId: 's_back', place: 'behind' }),
        infrontof: new InductiveLoop({ brokerUrl, junctionId: junctionIdArg, sensorId: 's_front', place: 'infrontof' })
    },
    east: {
        behind: new InductiveLoop({ brokerUrl, junctionId: junctionIdArg, sensorId: 'e_back', place: 'behind' }),
        infrontof: new InductiveLoop({ brokerUrl, junctionId: junctionIdArg, sensorId: 'e_front', place: 'infrontof' })
    },
    west: {
        behind: new InductiveLoop({ brokerUrl, junctionId: junctionIdArg, sensorId: 'w_back', place: 'behind' }),
        infrontof: new InductiveLoop({ brokerUrl, junctionId: junctionIdArg, sensorId: 'w_front', place: 'infrontof' })
    }
};

Object.values(sensors).forEach(dir => {
    dir.behind.connect();
    dir.infrontof.connect();
});

// cars
let activeCars = [
    { id: 'Car_A', direction: 'vertical', position: 10, speed: 5 },
    { id: 'Car_B', direction: 'horizontal', position: 15, speed: 5 }
];

// Update car position once every second
setInterval(() => {
    console.log(`\n--- Clock Tick: Light is green for [${currentLightPhase.toUpperCase()}] ---`);
    
    activeCars.forEach((car) => {
        let nextPosition = car.position + car.speed;
        
        // logic of stopping. if light===RED, she stays at stop-line
        if (currentLightPhase !== car.direction && car.position <= 50 && nextPosition > 50) {
            car.position = 50; 
            car.speed = 0; // Стоим
            console.log(`[Road Physics] ${car.id} is idling at red light on ${car.direction} lane.`);
        } else {
            //if light === greed -> moving forward
            if (car.speed === 0 && currentLightPhase === car.direction) {
                car.speed = 5;
                console.log(`[Road Physics] ${car.id} noticed GREEN light and started accelerating.`);
            }
            car.position = nextPosition;
        }

        console.log(`[Grid] ${car.id} (${car.direction}) line pos: ${car.position}m`);

        // Check if 
        let loopSet;
        if (car.direction === 'vertical') {
            loopSet = sensors.north; // Or sensors.south
        } else if (car.direction === 'horizontal') {
            loopSet = sensors.east;  // Or sensors.west
        } else {
            loopSet = sensors[car.direction];
        }

        // Just in case loopSet is still missing, guard against a crash
        if (!loopSet) {
            console.error(`[Error] No sensor configuration mapping found for direction: ${car.direction}`);
            return; 
        }
        
        // detector behind
        if (car.position >= 40 && car.position - car.speed < 40) {
            console.log(`[Sensor Trigger] ${car.id} entered BEHIND loop on ${car.direction}`);
            loopSet.behind.triggerVehicleEnter();
            setTimeout(() => loopSet.behind.triggerVehicleExit(), 900);
        }

        // detector in front of
        if (car.position >= 49 && car.position - car.speed < 49) {
            console.log(`[Sensor Trigger] ${car.id} reached INFRONTOF stopline on ${car.direction}`);
            loopSet.infrontof.triggerVehicleEnter();
            setTimeout(() => loopSet.infrontof.triggerVehicleExit(), 900);
        }
    });

    // delete cars who have gone too far
    activeCars = activeCars.filter(car => car.position < 100);

    // mode for random new cars (25% chance)
    if (modeArg==='random')
    {
        if (Math.random() < 0.25) {
            const randomDir = Math.random() > 0.5 ? 'vertical' : 'horizontal';
            const newId = `Car_${Math.floor(Math.random() * 900) + 100}`;
            activeCars.push({ id: newId, direction: randomDir, position: 0, speed: 5 });
            console.log(`[Spawn System] Generated ${newId} heading ${randomDir}.`);
        }
    }
    if (modeArg==='traffic_jam') //jam on vertical
    {
        if (Math.random() < 0.4) {
            const randomDir = Math.random() > 0.1 ? 'vertical' : 'horizontal';
            const newId = `Car_${Math.floor(Math.random() * 900) + 100}`;
            activeCars.push({ id: newId, direction: randomDir, position: 0, speed: 5 });
            console.log(`[Spawn System] Generated ${newId} heading ${randomDir}.`);
        }
    }
}, 1000);