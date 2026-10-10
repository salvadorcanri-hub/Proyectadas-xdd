import { spawn } from 'node:child_process';
const children = [
  spawn(process.execPath, ['--import','tsx','server.ts'], { stdio:'inherit' }),
  ...['teacher','student'].map(role => spawn(process.execPath, ['--import','tsx','scripts/serve-app.ts',role], { stdio:'inherit', env:{...process.env,APP_PORT:role==='teacher'?'3101':'3102'} })),
];
let stopping = false;
function stop(code=0) { if (stopping) return; stopping=true; process.exitCode=code; for(const child of children) child.kill('SIGTERM'); }
for(const signal of ['SIGTERM','SIGINT']) process.on(signal, () => stop());
for(const child of children) child.on('exit', code => { if(!stopping) stop(code || 1); });
