import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const modes = new Set(['session', 'files', 'commands', 'verify', 'audit']);
try {
  const mode = process.argv[2];
  if (!modes.has(mode)) throw new Error('Invalid hook mode');
  let bytes = 0;
  const chunks = [];
  for await (const chunk of process.stdin) {
    bytes += Buffer.byteLength(chunk);
    if (bytes > 2_000_000) throw new Error('Hook input too large');
    chunks.push(chunk);
  }
  const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  const { runIdeHook } = await import('../dist/ide-integration/index.js');
  const result = await runIdeHook(mode, payload, { workspaceRoot: root });
  if (!result.ok) throw new Error('Hook validation failed');
  process.stdout.write(JSON.stringify(result.data.output) + '\n');
  if (result.data.exitCode !== 0) process.stderr.write(`BLOQUEADO por hook DevGuardian: ${result.data.reason}\n`);
  process.exitCode = result.data.exitCode;
} catch {
  process.stderr.write('El hook no pudo validarse. Revisa la entrada y ejecuta npm run build antes de activar los hooks.\n');
  process.exitCode = 2;
}
