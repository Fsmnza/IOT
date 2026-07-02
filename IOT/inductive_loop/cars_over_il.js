//File to test Inductive loops class
//Also it's an example of how to use the class in the code

const InductiveLoop = require('./InductiveLoop');

const northSensor = new InductiveLoop({
    brokerUrl: 'mqtt://localhost:1883',
    junctionId: 'crossroad_1',
    sensorId: 'vertical1',
    place:'infrontof'
});
const southSensor = new InductiveLoop({
    brokerUrl: 'mqtt://localhost:1883',
    junctionId: 'crossroad_1',
    sensorId: 'vertical2',
    place: 'infrontof'
});

northSensor.connect();
southSensor.connect()

northSensor.client.on('connect', () => {
    
    setTimeout(() => {
        console.log("\n--- Simulating Car Arrival ---");
        northSensor.triggerVehicleEnter();
    }, 2000);

    setTimeout(() => {
        console.log("\n--- Simulating Car Departure ---");
        northSensor.triggerVehicleExit();
    }, 5000);
    
});

southSensor.client.on('connect', () => {
    
    setTimeout(() => {
        console.log("\n--- Simulating Car Arrival ---");
        southSensor.triggerVehicleEnter();
    }, 2000);

    setTimeout(() => {
        console.log("\n--- Simulating Car Departure ---");
        southSensor.triggerVehicleExit();
    }, 5000);
    
});