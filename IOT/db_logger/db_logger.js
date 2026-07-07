// db_logger.js
// Отдельный сервис: слушает ВСЕ сообщения по всем перекресткам и складывает их
// в InfluxDB, чтобы потом смотреть в Grafana. Специально сделан отдельным
// процессом, чтобы не мешать логику управления светофором с логикой хранения данных.

const mqtt = require('mqtt');
const { InfluxDB, Point } = require('@influxdata/influxdb-client');

const JUNCTION_FILTER = process.argv[2] || '+'; // конкретный ID перекрестка или '+' для всех

const INFLUX_URL = process.env.INFLUX_URL || 'http://localhost:8086';
const INFLUX_TOKEN = process.env.INFLUX_TOKEN || 'DTQ-hCreawYwIhNo7HL7WExixP8Ha961PIVWgGu95CyQ8iphyHbC9BaYMM5_XYg7x1Mwy7ebG8AAqW4qa9GzBA==';
const INFLUX_ORG = process.env.INFLUX_ORG || 'traffic';
const INFLUX_BUCKET = process.env.INFLUX_BUCKET || 'traffic_data';

const influxDB = new InfluxDB({ url: INFLUX_URL, token: INFLUX_TOKEN });
const writeApi = influxDB.getWriteApi(INFLUX_ORG, INFLUX_BUCKET, 'ms');

const client = mqtt.connect('mqtt://localhost:1883');

client.on('connect', () => {
    const topicPattern = `junction/${JUNCTION_FILTER}/#`;
    client.subscribe(topicPattern, (err) => {
        if (err) {
            console.error('[DBLogger] Subscribe error:', err);
        } else {
            console.log(`[DBLogger] Subscribed to ${topicPattern}. Writing into bucket "${INFLUX_BUCKET}" @ ${INFLUX_URL}`);
        }
    });
});

client.on('error', (err) => {
    console.error('[DBLogger] MQTT Client Error:', err);
});

client.on('message', (topic, message) => {
    try {
        const data = JSON.parse(message.toString());
        const segments = topic.split('/'); // junction / {id} / ...
        const junctionId = segments[1] || 'unknown';

        if (topic.includes('/sensors/')) {
            writeSensorEvent(junctionId, data);
        } else if (topic.includes('/tl/status')) {
            writeLightState(junctionId, data);
        } else if (topic.includes('/tl/control')) {
            writeControlCommand(junctionId, data);
        }
    } catch (err) {
        console.error('[DBLogger] Failed to process message on topic', topic, err);
    }
});

function toInfluxTimestamp(unixSeconds) {
    return new Date((unixSeconds || Math.floor(Date.now() / 1000)) * 1000);
}

function writeSensorEvent(junctionId, data) {
    const direction = (data.sensorId || '').startsWith('vertical') ? 'vertical' : 'horizontal';
    const point = new Point('sensor_event')
        .tag('junctionId', junctionId)
        .tag('sensorId', data.sensorId || 'unknown')
        .tag('direction', direction)
        .tag('place', data.place || 'unknown')
        .booleanField('vehicleDetected', !!data.vehicleDetected)
        .timestamp(toInfluxTimestamp(data.timestamp));
    writeApi.writePoint(point);
}

function writeLightState(junctionId, data) {
    const point = new Point('light_state')
        .tag('junctionId', junctionId)
        .tag('direction', data.traffic_light || 'unknown')
        .stringField('state', data.lightState || 'UNKNOWN')
        .intField('countdown', Number.isFinite(data.countdown) ? data.countdown : 0)
        .timestamp(toInfluxTimestamp(data.timestamp));
    writeApi.writePoint(point);
}

function writeControlCommand(junctionId, data) {
    const point = new Point('control_command')
        .tag('junctionId', junctionId)
        .tag('direction', data.direction || data.requestPhase || 'unknown')
        .stringField('command', data.comand || 'unknown')
        .floatField('lightTime', typeof data.lightTime === 'number' ? data.lightTime : -1)
        .timestamp(toInfluxTimestamp(data.timestamp));
    writeApi.writePoint(point);
}

setInterval(() => {
    writeApi.flush().catch((err) => console.error('[DBLogger] Flush error:', err));
}, 2000);

process.on('SIGINT', () => {
    writeApi.close()
        .then(() => console.log('[DBLogger] Write API closed, remaining points flushed.'))
        .catch((err) => console.error('[DBLogger] Error closing write API:', err))
        .finally(() => process.exit());
});