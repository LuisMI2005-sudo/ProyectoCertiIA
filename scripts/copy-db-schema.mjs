import { copyFile } from 'node:fs/promises';

// tsc emits TypeScript artifacts; retain the migration source beside migrations.js.
await copyFile(new URL('../src/db/schema.sql', import.meta.url), new URL('../dist/db/schema.sql', import.meta.url));
