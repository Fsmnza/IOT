class TrafficLight {
    /**
     *  mqttClient - The active MQTT client instance
     *  junctionId - The ID of the junction
     *  orientation - 'vertical' / 'horizontal'
     */
    constructor(mqttClient, junctionId, orientation) {
        this.client = mqttClient;
        this.junctionId = junctionId;
        this.orientation = orientation.toLowerCase();
        this.state = 'RED'; // Default starting state

        this.initMQTT();
    }

    initMQTT() {
        const topic = `junction/${this.junctionId}/tl/status`;
        
        // Subscribe to the light control topic
        this.client.subscribe(topic, (err) => {
            if (!err) {
                console.log(`[System] ${this.orientation.toUpperCase()} light subscribed to updates.`);
            }
        });

        // Listen for incoming state changes
        this.client.on('message', (receivedTopic, message) => {
            if (receivedTopic !== topic) return;

            try {
                const data = JSON.parse(message.toString());
                
                // 1. Explicit change command for this orientation
                if (data.traffic_light === this.orientation) {
                    const newState = data.lightState.toUpperCase();
                    
                    if (this.state !== newState) {
                        console.log(`\x1b[36m[Light Update]\x1b[0m ${this.orientation.toUpperCase()} changed: ${this.state} -> ${newState}`);
                        this.state = newState;
                    }
                } 
                // 2. Fail-safe logic: If the opposing axis goes green/yellow, this one must handle being red
                else {
                    const opposingState = data.lightState.toUpperCase();
                    if ((opposingState === 'GREEN' || opposingState === 'YELLOW') && this.state !== 'RED') {
                        console.log(`\x1b[31m[Safety Guard]\x1b[0m ${this.orientation.toUpperCase()} forced to RED because opposing axis is active.`);
                        this.state = 'RED';
                    }
                }
            } catch (error) {
                console.error(`[Light Error] Failed to process signal for ${this.orientation}:`, error.message);
            }
        });
    }
}

module.exports = TrafficLight;