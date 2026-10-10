import { spawn } from 'node:child_process';
const action = process.argv[2];
if (!['build', 'start'].includes(action)) throw new Error('Indica build o start.');
let child;
let stopping = false;
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  stopping = true;
  child?.kill(signal);
});
const commands = action === 'build'
  ? [['node_modules/vite/bin/vite.js', 'build', '--mode', 'teacher'], ['node_modules/vite/bin/vite.js', 'build', '--mode', 'student']]
  : [['--import', 'tsx', 'server.ts']];
for (const args of commands) {
  if (stopping) break;
  const status = await new Promise(resolve => {
    child = spawn(process.execPath, args, { stdio: 'inherit', env: { ...process.env, HOSTED_WEB: '1' } });
    child.on('error', error => { console.error(error.message); resolve(1); });
    child.on('exit', code => resolve(code ?? (stopping ? 0 : 1)));
  });
  if (status !== 0) { process.exitCode = status; break; }
}
