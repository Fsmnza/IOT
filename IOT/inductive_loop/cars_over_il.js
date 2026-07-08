const InductiveLoop = require('./InductiveLoop');
const junctionIdArg = process.argv[2] || 'crossroad_1';

let sensors = {
    horizontal: [],
    vertical: []
};

['horizontal', 'vertical'].forEach(dir => {
    ['infrontof', 'behind'].forEach(place => {
        for (let q = 0; q < 2; q++) {
            let sensorId = `${dir}_${place}_${q}`;
            let sensor = new InductiveLoop({
                brokerUrl: 'mqtt://localhost:1883',
                junctionId: junctionIdArg,
                sensorId: sensorId,
                place: place
            });
            sensor.connect();
            sensors[dir].push(sensor);
        }
    });
});

function simulateTraffic(direction, targetCarCount) {
    console.log(`\n=== [Simulation] Group of ${targetCarCount} cars arrived on ${direction} ===`);
    
    for (let i = 0; i < targetCarCount; i++) {
        const sensorList = sensors[direction];
        const sensor = sensorList[i % sensorList.length];
        setTimeout(() => {
            sensor.triggerVehicleEnter();
        }, i * 50); 
        setTimeout(() => {
            sensor.triggerVehicleExit();
        }, 12000 + (i * 100));
    }
}

setTimeout(() => {
    simulateTraffic('horizontal', 8);
    simulateTraffic('vertical', 2);
}, 2000);

setTimeout(() => {
    simulateTraffic('horizontal', 1);
    simulateTraffic('vertical', 10);
}, 22000);

setTimeout(() => {
    simulateTraffic('horizontal', 7);
    simulateTraffic('vertical', 7);
}, 45000);