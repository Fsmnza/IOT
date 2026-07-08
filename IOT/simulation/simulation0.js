const { spawn } = require('child_process');
const path = require('path');

const junctionIdArg = process.argv[2] || 'crossroad_1';

const scripts = [
    { name: 'TLC', path: 'traffic_controller/traffic_controller.js' },
    { name: 'Crossroad', path: 'crossroad_1.js' },
    { name: 'DBLogger', path: 'db_logger/db_logger.js' },
    { name: 'IL', path: 'inductive_loop/cars_over_il.js' },
];

const runningProcesses = [];

function startScript(script) {
    const scriptPath = path.resolve(script.path);
    console.log(`[Orchestrator] Starting ${script.name}...`);
    const proc = spawn('node', [scriptPath, junctionIdArg]);
    proc.stdout.on('data', (data) => {
        console.log(`[${script.name}] ${data.toString().trim()}`);
    });

    proc.stderr.on('data', (data) => {
        console.error(`\x1b[31m[${script.name} ERROR] ${data.toString().trim()}\x1b[0m`);
    });

    proc.on('close', (code) => {
        console.log(`[Orchestrator] ${script.name} exited with code ${code}`);
    });
    runningProcesses.push(proc);
}

process.on('SIGINT', () => {
    console.log('\n[Orchestrator] Shutting down all simulation processes...');
    runningProcesses.forEach((proc) => proc.kill('SIGINT'));
    process.exit();
});

scripts.forEach((script, index) => {
    setTimeout(() => {
        startScript(script);
    }, index * 1500);
});