# Hooks de Backend y Persistencia

DevGuardian registra eventos de herramientas reales, aplica validaciones automáticas antes de mutar y conserva decisiones `allow`/`block`, razones, duración, fecha y configuración. Son hooks del motor, independientes de los hooks nativos de Git deshabilitados por `core.hooksPath`.

## Arquitectura

- `types.ts`: contratos tipados de eventos, payloads, reglas, decisiones y adaptador de BD.
- `registry.ts`: registro síncrono/asíncrono, prioridad ascendente y orden estable, ejecución secuencial y corte inmediato en `block`. Excepciones o resultados inválidos bloquean. `warn` continúa como `allow`, con `metadata.warning: true`.
- `builtin-hooks.ts`: protección de archivos/secretos, verificación de evidencia de commits y validación/auditoría de persistencia.
- `coordinator.ts`: entradas de análisis, Test Runner y guardado de entidades con eventos antes/después.
- `index.ts`: factories y consultas; `createHookManager()` registra las tres reglas predeterminadas.

`GitController.create({ workspaceRoot, verificationStore, hookManager })` activa los guardrails dentro del bloqueo serializado del repositorio. El parche usa las rutas inspeccionadas por Git, no una lista declarada por el agente. El commit inspecciona el diff real y obtiene evidencia del `VerificationStore` confiable; las verificaciones existentes de hashes, checkpoint y vigencia siguen siendo obligatorias. Sin `hookManager` se conserva el contrato anterior.

El frontend separado podrá consultar logs/estadísticas/configuración mediante futuros handlers API/MCP. La configuración y el adaptador son dependencias confiables de arranque; no deben ser elegibles por el modelo o el frontend.

## Eventos

| Evento | Punto de ejecución |
|---|---|
| `pre:analyze` | Coordinador, antes del analizador |
| `pre:apply_patch` | PatchManager, antes de preparar/aplicar cambios |
| `pre:run_tests` | Coordinador, antes de invocar Test Runner |
| `pre:git_commit` | PatchManager, antes de crear el commit |
| `post:test_run` | Coordinador, tras finalizar pruebas |
| `post:commit` | PatchManager, tras confirmar referencia e índice |
| `db:before_save_run` | Coordinador, antes del callback de BD |
| `db:after_save_run` | Coordinador, después de guardar |
| `db:on_hook_decision` | Automático por cada decisión de los otros eventos |

Los eventos posteriores son notificaciones: no pueden revertir una operación terminada. Sus fallos quedan registrados y no convierten un commit ya realizado en un supuesto fallo de la mutación. El evento de auditoría no se redispara a sí mismo.

## Configuración

```ts
import { createHookManager } from './index.js';
const hooks = createHookManager({
  enabled: true,
  rules: { 'protected-files-and-secrets': true, 'verified-evidence-commit': true, 'database-audit-trail': true },
  protectedFiles: ['.env', '.env.*', '**/.env', '**/.env.*', '.github/workflows/**', 'package-lock.json'],
  allowedBranches: ['fix/*'],
  maxFiles: 200,
  maxPatchCharacters: 1_000_000
});
```

Patrones glob de Node, rutas relativas canónicas con `/`, protección de archivos sin distinguir mayúsculas. Un array vacío de ramas permite cualquier rama. Las listas sustituyen los defaults. Desactivar una regla o todo el motor es una decisión administrativa y queda reflejada en la configuración del log.

Se bloquean secretos reconocibles en líneas añadidas (AWS, `SECRET_KEY=`, asignaciones literales de API keys/tokens/passwords, GitHub y claves `sk-`). El detector es heurístico, no un escáner universal de secretos. No se guardan diffs ni evidencia cruda en los logs predeterminados.

El commit requiere baseline fallido y completo, candidato verde y completo sin skipped/todo, mismas pruebas preservadas, configuración comparable, fallos resueltos y ausencia de regresiones. La huella del candidato debe coincidir con el workspace. La evidencia declarada por un cliente no constituye una verificación confiable.

## Persistencia y consultas

`HookExecutionLogStore` conserva ejecuciones y auditorías en memoria y devuelve copias defensivas. `getHookLogs(hooks)`, `getHookStats(hooks)`, `hooks.getConfig()` y `hooks.logStore.getAuditLogs()` permiten preparar una vista de defensa. Las estadísticas cuentan ejecuciones de hooks, incluidos los eventos de auditoría; no representan cantidad de operaciones de usuario.

Inyectar `HookPersistenceAdapter` como segundo argumento de `createHookManager(config, adapter)` para implementar `appendExecution` y `appendAudit` en la BD. Las escrituras se esperan antes de autorizar la operación; un fallo del adaptador impide avanzar y la ejecución queda en memoria. No hay base de datos ni endpoints instalados por este módulo. La memoria no sobrevive a reinicios y no tiene retención automática: producción necesita almacenamiento durable y política de retención. El adaptador debe manejar transacciones e idempotencia según la BD elegida; la operación de dominio y la auditoría no forman una transacción distribuida.

`HookExecutionCoordinator.saveRun(entity, save)` valida una copia de la entidad antes de invocar `save`: exige `workspaceStateHash` SHA-256 hexadecimal y `timestamp` ISO UTC válido. El audit log exige fecha y decisión; puede registrar bloqueos que ocurren antes de disponer de una huella válida, conservando `workspaceStateHash: null` en metadatos. No debe sustituirse por una huella inventada.

## Demostración reproducible

```sh
npm run build
node --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand tests/hooks/hooks.test.mjs
```

Los casos `ACCEPTED` y `BLOCKED` crean repositorios Git temporales y pasan por `controller.tools.git_apply_patch`: el primero modifica `src/value.ts`; los bloqueados intentan modificar `.env` y `.github/workflows/ci.yml`. Se comprueban el contenido intacto, el índice limpio y HEAD sin cambios. Los casos de secretos bloquean antes de escribir. Los casos de commit verifican tanto bloqueo sin evidencia como commit real con evidencia confiable. Las pruebas de BD demuestran que el callback se invoca solo para entidades válidas.

También puede dispararse una demostración mínima del registro tras compilar:

```js
import { createHookManager } from './dist/hooks/index.js';
const hooks = createHookManager();
const unifiedDiff = '+export const value = 2;\n';
console.log(await hooks.trigger('pre:apply_patch', { files: ['src/value.ts'], unifiedDiff }));
console.log(await hooks.trigger('pre:apply_patch', { files: ['.env'], unifiedDiff }));
console.log(hooks.getHookLogs());
console.log(hooks.getHookStats());
console.log(hooks.getConfig());
```

Este último ejemplo inspecciona decisiones; la suite demuestra las operaciones reales. Ejecutar `npm run check` y `npm test` para la validación completa.

Estos hooks cubren el componente Hook de «Hook + subagente». El subagente y su conexión al orquestador son un requisito separado: este módulo no implementa un subagente ni un transporte API/MCP.
