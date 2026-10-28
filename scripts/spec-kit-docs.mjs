import { readdir, readFile, mkdir, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.argv[2];
if (!['sync', 'check'].includes(mode)) throw new Error('Uso: node scripts/spec-kit-docs.mjs sync|check');
const templates = path.join(root, '.specify/templates');
const mappings = [['.specify/memory/constitution.md', 'specs/constitution.md']];
for (const file of await readdir(templates)) {
  if (file.endsWith('.md')) mappings.push([`.specify/templates/${file}`, `specs/templates/${file}`]);
}
const failures = [];
for (const [source, target] of mappings) {
  const text = await readFile(path.join(root, source), 'utf8');
  if (mode === 'sync') {
    await mkdir(path.dirname(path.join(root, target)), { recursive: true });
    await writeFile(path.join(root, target), text);
  } else {
    const copy = await readFile(path.join(root, target), 'utf8').catch(() => null);
    if (copy !== text) failures.push(`${target}: copia desactualizada; ejecutar npm run sdd:sync`);
  }
}
if (mode === 'sync') {
  console.log(`SDD: ${mappings.length} copias visibles sincronizadas.`);
} else {
  const walk = async (dir) => {
    const files = [];
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) files.push(...await walk(full));
      else if (entry.name.endsWith('.md')) files.push(full);
    }
    return files;
  };
  let diagrams = 0;
  const files = await walk(path.join(root, 'specs'));
  for (const file of files) {
    const text = await readFile(file, 'utf8');
    const label = path.relative(root, file);
    let language = null, body = [];
    for (const line of text.split(/\r?\n/)) {
      if (language === null && /^```/.test(line)) {
        language = line.slice(3).trim(); body = [];
        if (['text', 'plantuml', 'dot', 'graphviz'].includes(language)) failures.push(`${label}: diagrama no Mermaid`);
      } else if (language !== null && line.trim() === '```') {
        if (language === 'mermaid') {
          diagrams++;
          if (!/^(flowchart (LR|TD|TB|RL|BT)|sequenceDiagram|erDiagram|stateDiagram-v2)\s*$/m.test(body.join('\n')))
            failures.push(`${label}: tipo Mermaid no admitido`);
          if (/%%\{|<script|^\s*click\s/m.test(body.join('\n'))) failures.push(`${label}: directiva Mermaid no portable`);
        }
        language = null;
      } else if (language !== null) body.push(line);
      else if (/^\s+```mermaid/.test(line)) failures.push(`${label}: bloque Mermaid con sangría`);
    }
    if (language !== null) failures.push(`${label}: bloque de código sin cerrar`);
    for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const link = match[1].split('#')[0];
      if (!link || /^[a-z]+:/i.test(link)) continue;
      const target = path.resolve(path.dirname(file), decodeURIComponent(link));
      const relative = path.relative(root, target);
      if (relative.startsWith('..') || path.isAbsolute(relative) || !(await stat(target).catch(() => null)))
        failures.push(`${label}: enlace local inexistente o fuera del repositorio: ${link}`);
    }
  }
  for (const name of ['spec', 'plan', 'architecture', 'data-model', 'processes', 'tasks']) {
    const text = await readFile(path.join(root, `specs/001-sdd-foundation/${name}.md`), 'utf8');
    if (['architecture', 'data-model', 'processes'].includes(name) && !text.includes('```mermaid\n'))
      failures.push(`${name}: falta diagrama Mermaid`);
  }
  if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
  else console.log(`SDD: ${files.length} documentos, ${diagrams} diagramas y ${mappings.length} copias comprobados. Validación estructural; revisar el render en Obsidian.`);
}
