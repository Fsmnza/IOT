//This file contains a class with functionality of inductive loop

const mqtt = require('mqtt');

class InductiveLoop {
    /*
     * config has: 
     * config.brokerUrl - string - MQTT broker URL ('mqtt://localhost:1883' by default)
     * config.junctionId - string - ID of the intersection (like the name of the street, or whatever distingusih this section)
     * config.sensorId - string - ID of the specific lane sensor (e.g., 'lane_1')
     * config.place - string - Location of the inductive loop: either 'infrontof' (meaning it catches cars right in front of the traffic light) or 'behind' (meaning it's placed ~25 meters before the traffic light and catches the traffic jam)
     */
    constructor(config) {
        this.brokerUrl = config.brokerUrl || 'mqtt://localhost:1883';
        this.junctionId = config.junctionId || 'crossroad_1';
        this.sensorId = config.sensorId || 'lane_1';
        this.place = config.place || 'infrontof'; //either in front of or 
        this.topic = `junction/${this.junctionId}/il/${this.sensorId}/${this.place}`;
        this.client = null;
        this.isVehiclePresent = false;
    }

        connect() {
        this.client = mqtt.connect(this.brokerUrl);

        this.client.on('connect', () => {
            console.log(`[Sensor ${this.sensorId}] Connected to broker. Ready to detect.`);
        });

        this.client.on('error', (err) => {
            console.error(`[Sensor ${this.sensorId}] Connection error:`, err);
        });
    }

    /**
     * Call this method when an external car simulation forces a car onto this loop.
     */
    triggerVehicleEnter() {        
        this.isVehiclePresent = true;
        this.publishPayload(true);
    }

    
    triggerVehicleExit() {
        this.isVehiclePresent = false;
        this.publishPayload(false);
    }

    /*
      Internal method to construct and publish the JSON payload
     */
    publishPayload(isDetected) {
        const payload = {
            sensorId: this.sensorId,
            place: this.place,
            timestamp: Math.floor(Date.now() / 1000),
            vehicleDetected: isDetected
        };

        if (this.client && this.client.connected) {
            this.client.publish(this.topic, JSON.stringify(payload), { qos: 1 }, (err) => {
                if (err) {
                    console.error(`[Sensor ${this.sensorId}] Error publishing message:`, err);
                } else {
                    console.log(`[Sensor ${this.sensorId}] Published:`, JSON.stringify(payload));
                }
            });
        } else {
            console.warn(`[Sensor ${this.sensorId}] Cannot publish payload. MQTT client not connected.`);
        }
    }

    /**
     * Disconnects the sensor safely.
     */
    disconnect() {
        if (this.client) {
            this.client.end();
        }
    }
}

module.exports = InductiveLoop;