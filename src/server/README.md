# Backend HTTP REST y servidor MCP

La API conecta proyectos Git registrados con el analizador, los workers de diagnóstico/verificación, los hooks, el ejecutor de pruebas y la persistencia local o PostgreSQL. Utiliza `node:http`, contratos Zod y el SDK MCP instalado, sin añadir dependencias.

## Arranque y configuración

Requisitos: Node.js 24, Git, `npm ci`; Python 3.11+ con `pytest` y `pytest-json-report` para proyectos pytest. Jest se obtiene de las dependencias del backend.

```sh
npm run build
npm start
# Alternativa que compila antes de iniciar:
npm run dev:server
```

`dev:server` compila al arrancar; para incorporar cambios posteriores hay que reiniciarlo. `npm run start:server` inicia la compilación existente. El proceso carga la configuración de BD mediante su factory y escucha por defecto en `http://127.0.0.1:3001`.

Node no lee `.env` automáticamente. Configurar variables en la terminal o usar `node --env-file=.env dist/server/main.js` con una copia local del ejemplo, ignorada por Git.

| Variable | Valor predeterminado / función |
|---|---|
| `PORT` | `3001`; `startHttpServer({ port: 0 })` asigna un puerto efímero en pruebas. |
| `HOST` | `127.0.0.1`; `0.0.0.0` permite escuchar en todas las interfaces cuando se configure el alojamiento. |
| `ALLOWED_ORIGIN` | Origen o lista separada por comas; tiene prioridad sobre `CORS_ORIGIN`. |
| `CORS_ORIGIN` | `*` si no se define ninguno de los dos nombres. |
| `DEVGUARDIAN_WORKSPACE_ROOT` | Directorio actual; raíz confiable dentro de la cual se pueden registrar repositorios. |
| `DEVGUARDIAN_API_TOKEN` | Opcional: exige `Authorization: Bearer …` en todas las rutas salvo health y preflight. |
| `DEVGUARDIAN_DB_MODE` | Selección de adaptador; `local` fuerza JSON durable. |
| `DEVGUARDIAN_DB_PATH` | Ruta del JSON local; véase [configuración de persistencia](../db/README.md). |
| `DATABASE_URL` | Selecciona PostgreSQL cuando el modo no fuerza `local`. No se devuelve en las respuestas. |

Los proyectos deben identificar la **raíz canónica de un repositorio Git existente**, dentro de una raíz confiable. El arranque programático admite varias `workspaceRoots` y runners de confianza; sus comandos y ejecutables no se pueden establecer desde HTTP/MCP. Los parches exigen el árbol limpio y la identidad Git configurada en el repositorio objetivo.

CORS limita orígenes del navegador; la autenticación se activa mediante el token. Para uso fuera del equipo deben configurarse explícitamente acceso, origen y alojamiento. El backend está desplegado en Render; el flujo REST no requiere claves de Anthropic. Ver URLs y demo en el README raíz.

## Contrato REST

Éxito: `{ "ok": true, "data": ... }`. Error: `{ "ok": false, "error": { "code", "message", "retryable", "details"? }, "requestId" }`. Una evaluación de hook bloqueada devuelve HTTP 403 con `{ ok: false, data: { decision: "block", ... } }`, conservando la evidencia consultable.

| Método y ruta | Entrada | Resultado en `data` |
|---|---|---|
| GET `/health`, `/api/health` | Ninguna | Estado, `database: { connected, mode, tables: 5 }`, versión, uptime y disponibilidad de runners. HTTP 503 si la BD no responde. |
| GET `/api/projects` | Ninguna | Proyectos dentro de las raíces permitidas. |
| POST `/api/projects` | `{ name, repoPath, defaultBranch, runnerType: "jest" \| "pytest" }` | Proyecto persistido con UUID; HTTP 201. `repoPath` es absoluto. |
| GET `/api/audits` | Filtros de consulta | Lista de detalles completos: `{ project, audit, testRuns, hookLogs, delegations }`. |
| GET `/api/audits/:id` | UUID de auditoría | Los mismos detalles recuperados de la BD. |
| POST `/api/audits/run` | Solicitud `diagnose` o `repair` descrita abajo | Detalles persistidos, modo, estado y diagnóstico o resultado del coordinador. |
| GET `/api/hooks/logs` | Filtros de consulta | Decisiones de hooks persistidas. |
| GET `/api/hooks/config` | Ninguna | Configuración efectiva de guardrails, de solo lectura. |
| POST `/api/hooks/evaluate` | `{ projectId, files: string[], unifiedDiff: string }` | `{ auditId, decision, project, audit, testRuns, hookLogs, delegations }`. Evalúa `pre:apply_patch` sin modificar archivos. |
| GET `/api/subagents/delegations` | Filtros de consulta | Trazas persistidas con `taskId`, `role`, `toolCallsJson`, `outputJson`, `consumptionStatus` y snapshots. |
| POST `/api/mcp` | Mensaje JSON-RPC 2.0 MCP | Respuesta MCP, descrita en la sección siguiente. |

Filtros de las tres listas de auditorías/logs/delegaciones: `projectId?`, `auditId?`, `limit?` (1–200, defecto 100), `offset?` (0–100000, defecto 0). Los identificadores deben ser UUID; se rechazan parámetros desconocidos o repetidos. La API usa camelCase aunque las columnas SQL utilicen snake_case. Los nombres completos se definen en [contratos DB](../db/types.ts).

### Ejemplos curl: consultas, diagnóstico y hooks

Ejemplos para Bash/Git Bash, ejecutados desde la raíz del backend con Node disponible. Iniciar el servidor en otra terminal. Si se configura un token, añadir `-H "Authorization: Bearer $DEVGUARDIAN_API_TOKEN"` a las llamadas protegidas.

```bash
BASE=http://127.0.0.1:3001
curl -fsS "$BASE/health"
curl -fsS "$BASE/api/health"

# Registra el repositorio actual, sin modificar su código ni su HEAD.
node --input-type=module -e 'console.log(JSON.stringify({name:"DevGuardian",repoPath:process.cwd(),defaultBranch:"Dev",runnerType:"jest"}))' > project-request.json
PROJECT_ID=$(curl -fsS "$BASE/api/projects" -H 'Content-Type: application/json' --data-binary @project-request.json | node --input-type=module -e 'let s="";for await(const c of process.stdin)s+=c;console.log(JSON.parse(s).data.id)')
curl -fsS "$BASE/api/projects"

curl -fsS "$BASE/api/audits/run" -H 'Content-Type: application/json' \
  -d "{\"projectId\":\"$PROJECT_ID\",\"mode\":\"diagnose\",\"path\":\"src/server/contracts.ts\"}" > diagnosis-response.json
AUDIT_ID=$(node -e 'console.log(JSON.parse(require("node:fs").readFileSync("diagnosis-response.json","utf8")).data.audit.id)')
curl -fsS "$BASE/api/audits?projectId=$PROJECT_ID&limit=10&offset=0"
curl -fsS "$BASE/api/audits/$AUDIT_ID"
curl -fsS "$BASE/api/hooks/config"
curl -fsS "$BASE/api/hooks/logs?auditId=$AUDIT_ID"
curl -fsS "$BASE/api/subagents/delegations?auditId=$AUDIT_ID"

# Preflight permitido: no aplica el texto recibido.
curl -fsS "$BASE/api/hooks/evaluate" -H 'Content-Type: application/json' \
  -d "{\"projectId\":\"$PROJECT_ID\",\"files\":[\"src/server/contracts.ts\"],\"unifiedDiff\":\"+export const value = 1;\"}"

# Preflight bloqueado: HTTP 403, decisión y auditoría en el cuerpo.
curl -sS "$BASE/api/hooks/evaluate" -H 'Content-Type: application/json' \
  -d "{\"projectId\":\"$PROJECT_ID\",\"files\":[\".env\"],\"unifiedDiff\":\"+example\"}"
curl -fsS "$BASE/api/hooks/logs?projectId=$PROJECT_ID"
```

En Windows PowerShell usar `curl.exe` o `Invoke-RestMethod`; los ejemplos anteriores utilizan la sintaxis de variables y comillas de Bash. Guardar las solicitudes de demostración fuera del repositorio que se vaya a reparar: un archivo no rastreado impide comenzar una rama de reparación con árbol limpio.

### Reparación completa

La API recibe un **parche propuesto explícitamente**. No genera código con un LLM. `mode: "repair"` ejecuta diagnóstico, baseline, rama aislada, checkpoint, preflight de seguridad, aplicación del parche, candidato, comparación y commit o rollback. El diagnóstico debe identificar un defecto accionable y el baseline debe contener un fallo que el candidato resuelva sin regresiones.

Contrato de la solicitud:

```ts
{
  projectId: string; // UUID del proyecto registrado
  mode: "repair";
  repair: {
    path: string; slug: string; message: string;
    unifiedDiff: string;
    expectedFileHashes: Record<string, string>; // SHA-256; exactamente el archivo diagnosticado
    runner: "jest" | "pytest";
    targets: string[];
    budget?: { maxToolCalls: number; timeoutMs: number };
  };
}
```

Para invocar un caso propio, preparar `repair-request.json` conforme al contrato y ejecutarlo contra el proyecto registrado:

```bash
curl -fsS "$BASE/api/audits/run" -H 'Content-Type: application/json' \
  --data-binary @repair-request.json
```

Para demostrar el commit por curl sobre un repositorio independiente, este bloque prepara un caso mínimo dentro de la raíz confiable predeterminada. Ejecutarlo desde la raíz del backend, con el servidor ya iniciado. Crea una carpeta `.http-demo-*`; todos los commits siguientes pertenecen únicamente a su subdirectorio `workspace`.

```bash
DEMO_DIR=$(node --input-type=module <<'NODE'
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
const require = createRequire(import.meta.url);
const root = fs.mkdtempSync(path.join(process.cwd(), '.http-demo-'));
const repo = path.join(root, 'workspace');
fs.mkdirSync(path.join(repo, 'src'), {recursive:true});
fs.mkdirSync(path.join(repo, 'tests'));
const before = 'export const add = (a: number, b: number): number => String(a - b);\n';
const after = 'export const add = (a: number, b: number): number => a + b;\n';
fs.writeFileSync(path.join(repo, 'src/bug.ts'), before);
fs.writeFileSync(path.join(repo, 'tsconfig.json'), JSON.stringify({compilerOptions:{strict:true,noEmit:true},include:['src/**/*.ts']}));
fs.writeFileSync(path.join(repo, 'jest.config.cjs'), "module.exports={testEnvironment:'node',testMatch:['**/bug.test.cjs'],transform:{},cache:false};\n");
fs.writeFileSync(path.join(repo, 'tests/bug.test.cjs'), [
  "const fs=require('node:fs'),vm=require('node:vm');",
  `const ts=require(${JSON.stringify(require.resolve('typescript'))});`,
  "const code=ts.transpileModule(fs.readFileSync('src/bug.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;",
  "const loaded={exports:{}};vm.runInNewContext(code,{module:loaded,exports:loaded.exports});",
  "test('addition',()=>expect(loaded.exports.add(2,1)).toBe(3));",
  "test('preserves existing',()=>expect(Number(loaded.exports.add(2,0))).toBe(2));"
].join('\n'));
fs.writeFileSync(path.join(root, 'project.json'), JSON.stringify({name:'Demo HTTP',repoPath:repo,defaultBranch:'main',runnerType:'jest'}));
fs.writeFileSync(path.join(root, 'repair.json'), JSON.stringify({path:'src/bug.ts',slug:'demo-http',message:'Fix verified through HTTP',runner:'jest',targets:['tests/bug.test.cjs'],expectedFileHashes:{'src/bug.ts':createHash('sha256').update(before).digest('hex')},unifiedDiff:['diff --git a/src/bug.ts b/src/bug.ts','--- a/src/bug.ts','+++ b/src/bug.ts','@@ -1 +1 @@','-'+before.trimEnd(),'+'+after.trimEnd(),''].join('\n')}));
console.log(root);
NODE
)
git -C "$DEMO_DIR/workspace" init -b main
git -C "$DEMO_DIR/workspace" config user.name 'Demo HTTP'
git -C "$DEMO_DIR/workspace" config user.email 'demo@devguardian.invalid'
git -C "$DEMO_DIR/workspace" config core.autocrlf false
git -C "$DEMO_DIR/workspace" config commit.gpgsign false
git -C "$DEMO_DIR/workspace" add .
git -C "$DEMO_DIR/workspace" -c core.hooksPath=.disabled-hooks commit -m 'Demo baseline'
curl -fsS "$BASE/api/projects" -H 'Content-Type: application/json' --data-binary @"$DEMO_DIR/project.json" > "$DEMO_DIR/registered.json"
node --input-type=module - "$DEMO_DIR" <<'NODE'
import fs from 'node:fs';
import path from 'node:path';
const root=process.argv[2];
const projectId=JSON.parse(fs.readFileSync(path.join(root,'registered.json'),'utf8')).data.id;
const repair=JSON.parse(fs.readFileSync(path.join(root,'repair.json'),'utf8'));
fs.writeFileSync(path.join(root,'request.json'),JSON.stringify({projectId,mode:'repair',repair}));
NODE
curl -fsS "$BASE/api/audits/run" -H 'Content-Type: application/json' --data-binary @"$DEMO_DIR/request.json"
git -C "$DEMO_DIR/workspace" log -2 --oneline
```

El resultado esperado es `data.status: "committed"`, baseline fallido, candidato aprobado, tres delegaciones y decisiones de hooks persistidas. El JSON devuelve `data.audit.id` para consultar `/api/audits/:id` después de reiniciar el backend. La carpeta de demostración queda para inspección y no debe agregarse al repositorio principal.

Una demostración **completa y reproducible sin preparar parches manualmente**, con fuentes defectuosas, hashes correctos, Jest real y peticiones `fetch`, está en [la prueba de integración](../../tests/server/server.test.mjs). Ejecutarla así:

```sh
npm run build
node --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand tests/server/server.test.mjs
```

La suite crea únicamente repositorios y BD temporales; prueba reparación con commit, regresión con rollback, bloqueo de secretos y reapertura del servidor recuperando el mismo historial. No hace commits en el repositorio del proyecto.

### Estados e historial

- Reparación: `data.status` informa `committed`, `rolled_back`, `blocked` o el estado de fallo persistido; `data.result` conserva el resultado detallado del coordinador. Si un hook bloquea el parche y el coordinador revierte el intento, `data.status` es `blocked` y `data.audit.status` es `rolled_back`: ambos hechos son visibles.
- Diagnóstico: usa el estado terminal `blocked` del contrato DB existente, con `audit.summaryJson.mode: "diagnose"` y `outcome: "diagnosed"` cuando termina correctamente. Esto indica que no se autorizó una reparación; no significa que el análisis haya fallado. La delegación se registra como `diagnosis_only`.
- Preflight y llamadas MCP individuales: también finalizan como `blocked` en DB; consultar `summaryJson.mode`, `decision` u `outcome` para distinguir evaluación, herramienta completada y rechazo. No se inventa una reparación completa por haber ejecutado una herramienta aislada.

Los hooks y las delegaciones se escriben durante el flujo, junto con los runs y los checkpoints de la auditoría. Los runs persistidos excluyen stdout/stderr. Reiniciar conserva el historial; no reanuda automáticamente sesiones Git ni comparaciones activas en memoria.

## MCP: herramientas y transportes

El SDK se encarga de negociación `initialize`, validación de mensajes, despacho y errores de protocolo. Se registran **19 herramientas**:

| Grupo | Herramientas y argumentos adicionales |
|---|---|
| Análisis | `read_file_context`, `analyze_code`, `get_symbol_context`: los contratos [shared](../shared/contracts.ts) más `projectId`. |
| Git | `git_status`, `git_create_fix_branch`, `git_begin_attempt`, `git_apply_patch`, `git_diff`, `git_commit_fix`, `git_rollback_attempt`: contratos shared más `projectId`. |
| Alias Git | `git_rollback`: mismos argumentos y comportamiento que `git_rollback_attempt`. |
| Pruebas | `run_tests`, `compare_test_runs`: contratos shared más `projectId`. La comparación registra evidencia confiable para el commit. |
| Hooks | `hooks_get_config({ projectId })`; `hooks_get_logs({ projectId, auditId?, limit?, offset? })`. |
| Subagentes | `subagents_get_delegations({ projectId, auditId?, limit?, offset? })`. |
| BD | `db_list_projects({})`; `db_list_audits({ projectId, auditId?, limit?, offset? })`; `db_get_audit({ projectId, auditId })`. |

`tools/list` devuelve los JSON Schemas efectivos. Cada `tools/call` despachado pasa por `pre:tool_call` y `post:tool_call`, además de los hooks específicos de dominio, y crea una auditoría durable, incluso cuando rechaza argumentos o nombres de herramientas desconocidos. Mensajes que no cumplen el sobre MCP reciben un error de protocolo antes del handler. Las consultas sin proyecto y los rechazos de ámbito se asocian a un proyecto interno, excluido de la lista de proyectos visible. No se persisten los cuerpos de solicitudes ni los diffs en esos logs.

Las respuestas de herramientas usan `content` textual y `structuredContent` con el mismo `Result<T>`; `isError` indica fallo de dominio. Los errores JSON-RPC se mantienen en su formato de protocolo.

### HTTP JSON sin sesión

`POST /api/mcp` soporta mensajes JSON-RPC individuales y notificaciones (HTTP 202). Es un transporte de respuesta JSON **sin sesión HTTP, SSE ni reanudación de eventos**. Se verifica su interoperabilidad con `Client` y `StreamableHTTPClientTransport` oficiales; no se afirma implementar el streaming SSE completo. Las sesiones Git de dominio sobreviven entre peticiones dentro del mismo proceso, independientemente del transporte HTTP.

```bash
curl -fsS "$BASE/api/mcp" -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"defensa","version":"1.0.0"}}}'
curl -fsS "$BASE/api/mcp" -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
curl -fsS "$BASE/api/mcp" -H 'Content-Type: application/json' \
  -d "{\"jsonrpc\":\"2.0\",\"id\":3,\"method\":\"tools/call\",\"params\":{\"name\":\"analyze_code\",\"arguments\":{\"projectId\":\"$PROJECT_ID\",\"paths\":[\"src/server/contracts.ts\"],\"checks\":[\"syntax\",\"semantic\",\"lint\"]}}}"
```

### Stdio

```sh
npm run build
node dist/mcp/index.js
```

El cliente debe lanzar directamente `node dist/mcp/index.js` desde la raíz del backend, con las variables de BD/workspace correspondientes. Stdout contiene únicamente mensajes MCP; los errores van a stderr. `npm run start:mcp` es un acceso manual equivalente, pero para clientes stdio se recomienda el comando `node` directo para evitar el encabezado de npm. Los proyectos registrados mediante HTTP quedan disponibles por stdio si ambos procesos apuntan al mismo almacenamiento durable.

El análisis guardado por `analysisId` continúa en memoria; la publicación como recurso `devguardian://analysis/{analysisId}` y el agente generativo son trabajos posteriores.

## Seguridad, concurrencia y límites

- Contratos estrictos, rutas canónicas y políticas existentes de `.git`, traversal, symlinks y hashes. MCP bloquea lectura directa de archivos `.env*`; el motor de hooks conserva las protecciones de parches y evidencia de pruebas.
- Las operaciones coordinadas REST y las llamadas MCP se serializan por raíz canónica dentro del proceso. El controlador Git conserva sus locks cooperativos entre procesos; no existe una transacción distribuida Git/BD ni aislamiento frente a editores externos. Un fallo persistente de almacenamiento exige inspeccionar HEAD y auditoría antes de reintentar.
- Máximo predeterminado de 32 peticiones activas y 2 MB por cuerpo; recepción de cuerpo limitada a 10 s. Son configurables mediante `startHttpServer`. Los runners tienen presupuesto predeterminado de 30 s y 100000 bytes por flujo; los workers usan sus propios presupuestos.
- Máximo predeterminado de 16 runtimes MCP de proyecto (configurable hasta 64). Al alcanzar el límite se rechazan nuevos runtimes, conservando las sesiones existentes. Reiniciar libera runtimes; no reconstruye intentos Git activos.
- Logs JSON con `requestId`, método, ruta sin query, estado y duración; no registran headers, tokens, cuerpos ni cadenas de conexión. Los errores internos desconocidos se sanitizan. El servidor cierra conexiones inactivas y espera el trabajo en curso al recibir SIGINT/SIGTERM.
- Los tests ejecutan código del proyecto con los permisos del proceso. La separación por workers y los guardrails no constituyen un sandbox del sistema operativo.

## Verificación

```sh
npm run check
npm test
```

La suite HTTP/MCP añade **28 pruebas**. Total del proyecto: **257 pruebas en 9 suites** con pytest y su plugin instalados; en CI `DEVGUARDIAN_REQUIRE_PYTEST=1` hace obligatoria esa integración. El workflow existente descubre automáticamente la nueva suite y no incluye despliegue. La ejecución remota en Actions solo se acredita cuando los cambios se suban y GitHub termine el run.

## Demo cloud controlada

POST `/api/demo/prepare` acepta solo `{}` y devuelve `{ project, repair }`. Se habilita en Render (`RENDER=true`) o con `DEVGUARDIAN_ENABLE_DEMO=1`. Crea un checkout Git independiente bajo `.devguardian-demo/`, con identidad propia y dos pruebas Jest reales, y lo registra en la BD. Está serializado y limitado a 20 sesiones por proceso; no resetea ni elimina checkouts previos. Usa la misma autenticación, límites y CORS de las demás rutas. Las fuentes defectuosas están fuera de `src/` y no rompen el build. Los comandos/rutas de la demo están fijados en el servidor. El diagnóstico exitoso conserva el estado DB `blocked` por el contrato existente y `outcome=diagnosed`; el frontend lo presenta como DIAGNOSED.
