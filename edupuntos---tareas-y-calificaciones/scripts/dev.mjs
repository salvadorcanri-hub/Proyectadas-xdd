import { spawn } from 'node:child_process';
const commands = [ ['--import', 'tsx', 'server.ts'], ['node_modules/vite/bin/vite.js', '--mode', 'teacher'], ['node_modules/vite/bin/vite.js', '--mode', 'student'] ];
const children = commands.map(args => spawn(process.execPath, args, { stdio: 'inherit' }));
let stopping = false;
let remaining = children.length;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) child.kill('SIGTERM');
  setTimeout(() => { for (const child of children) if (child.exitCode === null) child.kill('SIGKILL'); }, 5000).unref();
}
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => stop());
for (const child of children) {
  child.on('error', () => stop(1));
  child.on('exit', code => { remaining--; if (!stopping) stop(code || 1); if (!remaining) process.exit(process.exitCode || 0); });
}
