const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const appRoot = path.resolve(__dirname, '..');
const logPath = path.join(appRoot, 'ting-test.log');
const electronExe = process.platform === 'win32'
  ? path.join(appRoot, 'node_modules', 'electron', 'dist', 'electron.exe')
  : null;
const electronBin = process.platform === 'win32' && fs.existsSync(electronExe)
  ? electronExe
  : path.join(appRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'electron.cmd' : 'electron');
const useShell = process.platform === 'win32' && electronBin.toLowerCase().endsWith('.cmd');

function appendLog(message) {
  const line = `[${new Date().toISOString()}] runner ${message}\n`;
  process.stdout.write(line);
  try {
    fs.appendFileSync(logPath, line, 'utf8');
  } catch {}
}

function pipeOutput(stream, target, mirrorToLog = false) {
  stream?.on('data', (chunk) => {
    target.write(chunk);
    if (mirrorToLog) {
      try {
        fs.appendFileSync(logPath, chunk);
      } catch {}
    }
  });
}

const env = {
  ...process.env,
  TING_TEST: '1',
};
delete env.ELECTRON_RUN_AS_NODE;

appendLog(`start cwd=${appRoot}`);
appendLog(`electron=${electronBin}`);
appendLog(`shell=${useShell}`);
appendLog('ELECTRON_RUN_AS_NODE cleared');

const child = spawn(electronBin, ['.', '--ting-test'], {
  cwd: appRoot,
  env,
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: useShell,
  windowsHide: false,
});
appendLog(`spawned pid=${child.pid || ''}`);

pipeOutput(child.stdout, process.stdout);
pipeOutput(child.stderr, process.stderr, true);

child.on('error', (error) => {
  appendLog(`spawn error ${error?.stack || error?.message || String(error)}`);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  appendLog(`exit code=${code ?? ''} signal=${signal ?? ''}`);
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
