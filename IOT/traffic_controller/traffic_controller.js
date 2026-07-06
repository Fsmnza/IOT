//file with a class for controller of traffic lights
const mqtt = require('mqtt');
const { Aedes } = require('aedes');
const net = require('net');


class TrafficControl
{
    
    constructor({
        JUNCTION_ID, 
    }) 
    {
        //INIT
        this.JUNCTION_ID = JUNCTION_ID;
        this.aedes = null;
        this.current_phase = null;
        this.last_passing_time = {vertical: 0, horizontal:0}; //time for the inductive loops far from t.l.
        this.traffic_jam_direction = {
                                        vertical: { count: 0 },
                                        horizontal: { count: 0 }
                                    };

        //Start the broker        
        this.#startBroker();
        

    }

    // method 
    // starts the broker
    async #startBroker() {
        // Call the static async method to initialize the broker instance
        this.aedes = await Aedes.createBroker();
        const aedes = this.aedes;
        const PORT = 1883;
        
        const server = net.createServer(aedes.handle);

        server.listen(PORT, function () {
            console.log(`[MQTT Broker] Local broker started and listening on port ${PORT}`);
        });

        // Log when clients (like your sensors) connect
        aedes.on('client', function (client) {
            console.log(`[MQTT Broker] Client Connected: ${client ? client.id : 'UNKNOWN'}`);
        });

        // Log when messages are published
        aedes.on('publish', (packet, client) => {
            if (client) {
                const topic = packet.topic;
                const payloadString = packet.payload.toString();
                //console.log(`[MQTT Broker] Message on topic [${topic}] from ${client.id}: ${payloadString}`);

                this.#routeIncomingMessage(topic, payloadString);
            }
        });
    }


    // method
    // calls different methods based on the topic
    // different devices use different topics
    #routeIncomingMessage(topic, payload) {
        // Expected topic structures: 
        // "junction/+/il/+" (e.g., junction/J12/il/sensor_01)
        // "junction/+/tl/+" (e.g., junction/J12/tl/light_north)
        const parts = topic.split('/');

        // Quick guard clause to ensure the message belongs to this specific junction
        if (parts[0] !== 'junction' || parts[1] !== this.JUNCTION_ID) return;

        const deviceType = parts[2]; // 'il' or 'tl'


        if (deviceType === 'il') {
            this.#processInductiveLoopInput(topic, payload);
        } else if (deviceType === 'sensors') { //TODO change to tl
            this.#processTrafficLightInput(topic, payload);
        }
    }

    // method
    // sends a data to traffic light
    #sendLoadToTL(topic, payload) {
        if (!this.aedes) {
            console.log(`[Local Broker] Notification: Skipping publish on topic [${topic}]. Broker is not initialized yet.`);
            return;
        }
        // Construct the packet format that Aedes expects internally
        const packet = {
            topic: topic,
            payload: Buffer.from(JSON.stringify(payload)),
            qos: 1, // Quality of Service 1 (At least once delivery)
            retain: false
        };

        // Broadcast the message directly to all subscribed clients via the local broker
        this.aedes.publish(packet, (err) => {
            if (err) {
                console.error(`[Local Broker] Failed to publish data to topic [${topic}]:`, err);
            } else {
                console.log(`[Local Broker] Successfully broadcasted data to topic [${topic}]`);
            }
        });
    }

    // method
    // processes input from inductive loops
    // method
    // processes input from inductive loops
    #processInductiveLoopInput(topic, payload)
    {
        //add cars on vertical-horizontal
        try {
            // 1. Parse the incoming JSON string
            const data = JSON.parse(payload);

            // Normalize direction from sensorId (e.g., 'vertical1' -> 'vertical')
            const direction = data.sensorId.startsWith('vertical') ? 'vertical' : 'horizontal';
            const otherDirection = direction === 'vertical' ? 'horizontal' : 'vertical';
            
            const isVehiclePresent = data.vehicleDetected; // true = Enter, false = Exit
            const place = data.place;                     // 'infrontof' or 'behind'
            const currentTimestamp = data.timestamp;       // Unix timestamp

            // Safeguard in case of error
            const currentPhaseDir = this.current_phase ? this.current_phase.direction : null;
            const currentPhaseState = this.current_phase ? this.current_phase.state : 'UNKNOWN';
            const isThisDirectionStopped = (currentPhaseDir !== direction) || (currentPhaseState === 'RED' || currentPhaseState === 'YELLOW');
            console.log(`[TrafficControl] Loop event: ${direction} (${place}) - ${isVehiclePresent ? 'ENTER' : 'EXIT'}`);



            // 2. if there are cars on the behind inductive loop of red light, we increase the traffic jam value
            // if someone is entering the front IL, we check the value of back IL. if the difference in time more then a second, we decrease the traffic jam value
            // when someone's entering the behind loop on the red light, we increase the traffic jam value of corresponding direction

            if (place === 'behind') {
                // If someone is entering the behind loop on the red light, increase the jam value
                if (isVehiclePresent && (currentPhaseDir !== direction || currentPhaseState === 'RED')) {
                    this.traffic_jam_direction[direction].count++;
                    console.log(`[TrafficControl] Jam increasing on ${direction}. Count: ${this.traffic_jam_direction[direction].count}`);
                }
                
                // 3. If someone is leaving the behind loop - save the timestamp
                if (!isVehiclePresent) {
                    this.last_passing_time[direction] = currentTimestamp;
                    console.log(`[TrafficControl] Car left 'behind' loop on ${direction}. Registered timestamp: ${this.last_passing_time[direction]}`);
                }
            }

            if (place === 'infrontof' && isVehiclePresent) {
                
                // 2 (cont). If someone is entering front IL, check back IL gap to potentially decrease jam
                const lastBackTime = this.last_passing_time[direction] || 0;
                if (currentTimestamp - lastBackTime > 1) {
                    if (this.traffic_jam_direction[direction].count > 0) {
                        this.traffic_jam_direction[direction].count--;
                        console.log(`[TrafficControl] Gap detected. Jam decreasing on ${direction}. Count: ${this.traffic_jam_direction[direction].count}`);
                    }
                }
                
            
            // 4. If someone is entering the front loop on the red light - check the last timestamp;
                // if the last car on other direction passed more then 7 sec ago - call a method to switch light (will be defined later) (parameters: new direction)
                // if the last ca r passed less then 7 sec ago - set a timer for the time remaining for seven seconds and check after the timer
                if (isThisDirectionStopped) {
                    const lastOtherDirectionPassing = this.last_passing_time[otherDirection] || 0;
                    const elapsedSinceLastOtherCar = currentTimestamp - lastOtherDirectionPassing;

                    if (elapsedSinceLastOtherCar > 7) {
                        console.log(`[TrafficControl] Clear path on ${otherDirection} (>7s). Initiating switch to ${direction}.`);
                        this.#switchLight(direction); 
                    } else {
                        const remainingTimeMs = (7 - elapsedSinceLastOtherCar) * 1000;
                        console.log(`[TrafficControl] Traffic active on ${otherDirection}. Scheduling check in ${remainingTimeMs / 1000}s.`);
                        
                        setTimeout(() => {
                            const freshNow = Math.floor(Date.now() / 1000);
                            if (freshNow - this.last_passing_time[otherDirection] >= 7) {
                                console.log(`[TrafficControl] Scheduled check passed. Switching to ${direction}.`);
                                this.#switchLight(direction);
                            }
                        }, remainingTimeMs);
                    }
                }
            }
             // 5. based on the traffic jam value, we call a method to set time for directions (will be defined later) (parameters: vertical green time, horizontal green time)
             // Calculate hypothetical green windows using your dynamic traffic jam metric
            this.#calculateGreenTimes(this.traffic_jam_direction.vertical.count, this.traffic_jam_direction.horizontal.count);
        } catch (error) {
            console.error(`[TrafficControl] Failed to process inductive loop payload:`, error);
        }            
    }
    #switchLight(direction)
    {
        const topic = `junction/${this.JUNCTION_ID}/tl/control`;
        const payload = {
            junctionId: this.JUNCTION_ID,
            requestPhase: direction, // 'vertical' or 'horizontal'
            timestamp: Math.floor(Date.now() / 1000),
            comand: "Switch light"
        };

        console.log(`[TrafficControl] Requesting light switch to ${direction}...`);
        this.#sendLoadToTL(topic, payload);
    }
    #calculateGreenTimes(vertical_count, horizontal_count)
    {
        //TODO
        const topic = `junction/${this.JUNCTION_ID}/tl/control`;
        let direction = "vertical";
        const payload = {
            junctionId: this.JUNCTION_ID,
            lightTime: -5, // TODO calculate time or 
            direction: direction,
            timestamp: Math.floor(Date.now() / 1000), 
            comand: "Change time remaining"
        };

        console.log(`[TrafficControl] Calculating green windows. V-Jam: ${vertical_count}, H-Jam: ${horizontal_count}`);
        this.#sendLoadToTL(topic, payload);
        
    }

    // method
    // processes input from traffic lights
    #processTrafficLightInput(topic, payload)
    {
        try {
        // Parse the incoming JSON string from the MQTT payload
        const data = JSON.parse(payload);

        // Update the current phase structure based on the incoming signal
        this.current_phase = {
            direction: data.traffic_light, // 'vertical' or 'horizontal'
            state: data.lightState, // 'GREEN', 'YELLOW', or 'RED'
            countdown: data.countdown, // number
            updatedAt: data.timestamp
        };

        //console.log(`[TrafficControl] Phase updated: ${this.current_phase.direction} is now ${this.current_phase.state} (${this.current_phase.countdown}s remaining)`);

        // TODO 
        // If a light turns GREEN, we might want to clear or reduce the waiting cars for that direction
        if (data.lightState === 'GREEN') {
            // Depending on your logic, you might want to reset the count or let inductive loops handle it
            // this.cars_waiting[data.traffic_light] = 0; 
        }

        } catch (error) {
            console.error(`[TrafficControl] Failed to parse traffic light payload:`, error);
        }

    }

    
}


const junctionIdArg = process.argv[2] || 'crossroad_1';

const tc = new TrafficControl({ JUNCTION_ID: junctionIdArg });

console.log(`[System] Initialized controller for Junction ID: ${tc.JUNCTION_ID}`);