// Launcher that guarantees Electron starts in GUI mode.
// Some environments export ELECTRON_RUN_AS_NODE=1 globally, which makes the
// electron binary behave like plain Node (app is undefined). We strip it here.
const { spawn } = require('child_process');

delete process.env.ELECTRON_RUN_AS_NODE;

const electronPath = require('electron');
const child = spawn(electronPath, ['.'], {
  stdio: 'inherit',
  env: process.env
});

child.on('close', (code) => process.exit(code));
