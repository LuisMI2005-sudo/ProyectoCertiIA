import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { provision } from '../dist/platform/provision.js';
const execute = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const directory = path.join(root, '.platform-local', 'development');
const pgDirectory = path.join(root, '.platform-pg');
const command = process.argv[2];
const services = ['identity', 'projects', 'audits', 'execution', 'policies', 'telemetry', 'planner', 'gateway'];
const pgBin = process.env.DEVGUARDIAN_PG_BIN || (process.platform === 'win32' ? path.join(process.env.USERPROFILE || '', 'scoop/apps/postgresql/current/bin') : undefined);
const binary = name => pgBin ? path.join(pgBin, name + (process.platform === 'win32' ? '.exe' : '')) : name;
async function ensureDatabaseRunning() {
  try { await execute(binary('pg_ctl'), ['-D', pgDirectory, 'status'], { timeout: 10000, windowsHide: true }); }
  catch { await execute(binary('pg_ctl'), ['-D', pgDirectory, '-l', path.join(root, '.platform-local', 'postgres.log'), '-o', '-p 55433 -h 127.0.0.1', '-w', 'start'], { timeout: 90000, windowsHide: true }); }
}
if (command === 'init') {
  await mkdir(path.join(root, '.platform-local'), { recursive: true });
  try { await access(path.join(directory, 'gateway.json')); throw new Error('La plataforma ya existe; no se reemplazará.'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  try { await access(path.join(pgDirectory, 'PG_VERSION')); }
  catch { await execute(binary('initdb'), ['-D', pgDirectory, '-U', 'dg_local_admin', '-A', 'trust', '--no-locale', '-E', 'UTF8', '-c', 'max_connections=100', '-c', 'shared_buffers=32MB'], { timeout: 180000, windowsHide: true }); }
  await ensureDatabaseRunning();
  const credentials = { email: 'admin@devguardian.local', password: randomBytes(24).toString('base64url'), name: 'Six seven' };
  const result = await provision('postgresql://dg_local_admin@127.0.0.1:55433/postgres', directory, credentials);
  await writeFile(path.join(directory, 'local-login.json'), JSON.stringify(credentials, null, 2), { flag: 'wx', mode: 0o600 });
  console.log(`Entorno local preparado. Gateway: ${result.gateway}\nCredenciales locales privadas: ${path.join(directory, 'local-login.json')}`);
} else if (command === 'start') {
  await access(path.join(directory, 'gateway.json'));
  await ensureDatabaseRunning();
  const children = [];
  let closing = false;
  function close() { if (closing) return; closing = true; for (const child of children) child.kill(); }
  for (const service of services) {
    await access(path.join(directory, `${service}.json`));
    const environment = {};
    for (const key of ['PATH', 'Path', 'SystemRoot', 'WINDIR', 'COMSPEC', 'TEMP', 'TMP', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA']) if (process.env[key]) environment[key] = process.env[key];
    environment.NODE_ENV = 'production';
    if (service === 'planner' && process.env.ANTHROPIC_API_KEY) environment.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    if (service === 'execution') for (const key of ['DEVGUARDIAN_SANDBOX_IMAGE_ID', 'DEVGUARDIAN_DOCKER_BINARY']) if (process.env[key]) environment[key] = process.env[key];
    const child = spawn(process.execPath, [path.join(root, 'dist/platform/main.js'), path.join(directory, `${service}.json`)], { cwd: root, env: environment, stdio: ['ignore', 'inherit', 'inherit'], windowsHide: true });
    children.push(child);
    child.once('error', () => { console.error(`No se pudo iniciar ${service}.`); process.exitCode = 1; close(); });
    child.once('exit', code => { if (!closing) { console.error(`${service} terminó (${code}). Se detiene la plataforma.`); process.exitCode = 1; close(); } });
  }
  process.once('SIGINT', close); process.once('SIGTERM', close);
} else if (command === 'status') {
  const config = JSON.parse(await readFile(path.join(directory, 'gateway.json'), 'utf8'));
  const response = await fetch(`http://127.0.0.1:${config.gatewayPort}/api/platform`, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error('Gateway no disponible.');
  console.log(await response.json());
} else throw new Error('Uso: npm run platform:init | platform:start | platform:status');
