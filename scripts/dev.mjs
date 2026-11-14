import { spawn } from 'node:child_process';
import http from 'node:http';

const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js'], { stdio: 'inherit' });
let electron;
let attempts = 0;
const timer = setInterval(() => {
  const request = http.get('http://127.0.0.1:5173', (response) => {
    response.resume();
    clearInterval(timer);
    electron = spawn(process.execPath, ['node_modules/electron/cli.js', '.'], {
      stdio: 'inherit',
      env: { ...process.env, STUDYREPO_DEV_URL: 'http://127.0.0.1:5173' }
    });
    electron.on('exit', (code) => { vite.kill(); process.exit(code ?? 1); });
  });
  request.on('error', () => {
    if (++attempts > 100) { clearInterval(timer); vite.kill(); process.exit(1); }
  });
}, 200);
vite.on('exit', (code) => { clearInterval(timer); electron?.kill(); process.exit(code ?? 1); });
process.on('SIGINT', () => { vite.kill(); electron?.kill(); process.exit(); });
