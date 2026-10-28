import { spawn } from 'node:child_process';
const [runner, ...targets] = process.argv.slice(2);
if (runner === 'idle') {
  setInterval(() => {}, 60000);
} else {
  if (!['jest', 'pytest'].includes(runner) || targets.length > 200 || targets.some(value => !value || value.startsWith('-') || value.startsWith('/') || value.split(/[\\/]/).includes('..'))) process.exit(64);
  const command = runner === 'jest' ? process.execPath : '/opt/pytest/bin/python';
  const args = runner === 'jest'
    ? ['/opt/runner/node_modules/jest/bin/jest.js', '--runInBand', '--json', '--outputFile=/reports/report.json', '--cacheDirectory=/tmp/jest', '--transform', JSON.stringify({ '^.+\\.tsx?$': '/opt/runner/typescript-transform.cjs' }), '--', ...targets]
    : ['-m', 'pytest', '-q', '-p', 'no:cacheprovider', '--json-report', '--json-report-file=/reports/report.json', '--', ...targets];
  const child = spawn(command, args, { cwd: '/workspace', env: { PATH: '/opt/pytest/bin:/usr/local/bin:/usr/bin:/bin', HOME: '/tmp', NODE_PATH: '/opt/runner/node_modules', NODE_ENV: 'test', PYTHONDONTWRITEBYTECODE: '1' }, stdio: 'inherit', shell: false });
  child.on('error', () => process.exit(70));
  child.on('exit', (code, signal) => process.exit(signal ? 71 : code ?? 70));
}
