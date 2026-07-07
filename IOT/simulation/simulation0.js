// simulation of 1 crossroad

const { spawn } = require('child_process');
const path = require('path');

const junctionIdArg = process.argv[2] || 'crossroad_1';

// Array of scripts to run, in the exact order they should start
const scripts = [
    { name: 'TLC', path: 'IOT/IOT/traffic_controller/traffic_controller.js' },
    { name: 'Receiver', path: 'IOT/IOT/traffic_controller/receiver.js' }, //idealy it should be changed to other
    { name: 'IL', path: 'IOT/IOT/inductive_loop/traffic_simulator.js' }, //cars are driving in the script

];

const runningProcesses = [];

function startScript(script) {
    const scriptPath = path.resolve(script.path);
    console.log(`[Orchestrator] Starting ${script.name}...`);

    // Spawn the process using node
    const process = spawn('node', [scriptPath, junctionIdArg]);

    // Forward standard output to the master terminal
    process.stdout.on('data', (data) => {
        console.log(`[${script.name}] ${data.toString().trim()}`);
    });

    // Forward error output
    process.stderr.on('data', (data) => {
        console.error(`\x1b[31m[${script.name} ERROR] ${data.toString().trim()}\x1b[0m`);
    });

    process.on('close', (code) => {
        console.log(`[Orchestrator] ${script.name} exited with code ${code}`);
    });

    runningProcesses.push(process);
}

process.on('SIGINT', () => {
    console.log('\n[Orchestrator] Shutting down all simulation processes...');
    runningProcesses.forEach((proc) => proc.kill('SIGINT'));
    process.exit();
});

// 2. Start the scripts with a tiny delay between them to let the MQTT broker spin up first
scripts.forEach((script, index) => {
    setTimeout(() => {
        startScript(script);
    }, index * 1500); // 1.5-second gap between startups
});