const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const compiled = ts.transpileModule(fs.readFileSync('src/target-bug.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const loaded = { exports: {} };
vm.runInNewContext(compiled, { module: loaded, exports: loaded.exports });
test('repairs addition', () => expect(loaded.exports.add(2, 1)).toBe(3));
test('preserves existing behavior', () => expect(Number(loaded.exports.add(2, 0))).toBe(2));
