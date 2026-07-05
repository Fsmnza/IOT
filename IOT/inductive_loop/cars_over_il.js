//File to test Inductive loops class
//Also it's an example of how to use the class in the code

const InductiveLoop = require('./InductiveLoop');

const junctionIdArg = process.argv[2] || 'crossroad_1';


let sensors = [];
let directions = ['vertical', 'horizontal']
let places = ['infrontof', 'behind'];
let c = 0;
for (let i of directions)
{
    for (let j of places)
    {
        for (let q = 0; q<2; q+=1)
        {
            let direction = i.concat(c);
            let sensor = new InductiveLoop({
                brokerUrl: 'mqtt://localhost:1883',
                junctionId: junctionIdArg,
                sensorId: direction, 
                place: j 
                });
            c+=1;
            sensors.push(sensor)
            console.log(sensor);
        }

    }
    c = 0;
}

for (let i of sensors)
{
    i.connect();
}

sensors.forEach((sensor, index) => {
    const mqttClient = sensor.client; 

    mqttClient.on('connect', () => {
        setTimeout(() => {
            console.log(`\n--- [Simulating] Car Arrival on ${sensor.sensorId} (${sensor.place}) ---`);
            sensor.triggerVehicleEnter();
        }, 2000 + (index * 1500)); //index * 1500 so the different sensors get triggered at different times

        setTimeout(() => {
            console.log(`\n--- [Simulating] Car Departure on ${sensor.sensorId} (${sensor.place}) ---`);
            sensor.triggerVehicleExit();
        }, 5000 + (index * 1500));
    });
});
