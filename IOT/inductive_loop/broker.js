//broker for testing inductive loops
const net = require('net');
const { Aedes } = require('aedes'); // Destructure the main Aedes class

async function startBroker() {
    // Call the static async method to initialize the broker instance
    const aedes = await Aedes.createBroker();
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
    aedes.on('publish', function (packet, client) {
        if (client) {
            console.log(`[MQTT Broker] Message from ${client.id} on ${packet.topic}: ${packet.payload.toString()}`);
        }
    });
}

// Execute the async startup function
startBroker().catch(err => {
    console.error('[MQTT Broker] Failed to initialize:', err);
});