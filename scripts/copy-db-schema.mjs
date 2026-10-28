import { copyFile, mkdir } from 'node:fs/promises';

// tsc emits TypeScript artifacts; retain the migration source beside migrations.js.
await copyFile(new URL('../src/db/schema.sql', import.meta.url), new URL('../dist/db/schema.sql', import.meta.url));
await mkdir(new URL('../dist/platform/sql/', import.meta.url), { recursive: true });
for (const name of ['identity', 'execution', 'domain']) {
  await copyFile(new URL(`../src/platform/sql/${name}.sql`, import.meta.url), new URL(`../dist/platform/sql/${name}.sql`, import.meta.url));
}
