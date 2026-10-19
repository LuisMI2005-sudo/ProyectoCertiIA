# Agente de reparación — Fase 6

`AutonomousRepairAgent` orquesta contratos MCP tipados, no ejecuta comandos de shell ni escribe archivos directamente. Un `RepairPlanner` genera un parche; el controlador Git valida las rutas y hashes; el agente exige una baseline fallida y pruebas completas sin regresiones antes de pedir el commit.

## Flujo y garantías

1. Comprueba que el checkout esté limpio, en una rama adjunta y con `HEAD`.
2. Ejecuta baseline antes de crear una rama: si ya pasa, responde `not_needed` sin mutar Git.
3. Vuelve a comprobar que el repositorio no cambió mientras se ejecutaba la baseline.
4. Analiza el código, crea `fix/<slug>` y abre un intento checkpoint.
5. Entrega al planificador solo hasta diez contextos relevantes de archivo con hash, más diagnósticos/ fallos acotados.
6. Aplica el diff mediante `git_apply_patch`, ejecuta candidato y `compare_test_runs`.
7. Solo llama `git_commit_fix` para candidato aprobado y comparación `success`; cualquier otro resultado hace rollback del intento. El controlador verifica además la evidencia y el `diffHash`.

La política tiene límite configurable de 1–10 intentos (predeterminado 3), cancelación cooperativa entre operaciones, rollback verificado y sobre `Result<T>` en `runSafe`. Los IDs de sesión/commit son nulos cuando no se creó sesión o no hubo commit.

`AnthropicRepairPlanner` usa salida estructurada restringida, temperatura cero, límites de contexto, tiempo de espera y clave de API fuera del prompt. El modelo solo propone; nunca recibe herramientas directas de filesystem, ejecución o Git.

`SdkMcpToolClient` valida cada respuesta MCP contra el esquema de salida de las 12 herramientas, tanto en `structuredContent` como en respuestas JSON de texto. Rechaza respuestas malformadas y no convierte un error MCP sin sobre de error en éxito.

## Ejecutar

Crear un JSON de solicitud (no contiene secretos):

```json
{
  "slug": "arreglar-calculo",
  "analysis": { "paths": ["src/calculation.ts"], "checks": ["syntax", "semantic", "lint"] },
  "runner": "jest"
}
```

Configurar `ANTHROPIC_API_KEY`, `DEVGUARDIAN_WORKSPACE` y `DEVGUARDIAN_REPAIR_REQUEST` (ruta al JSON), luego:

```sh
npm run build
npm run start:agent
```

Se puede sustituir el proceso MCP con `DEVGUARDIAN_MCP_COMMAND` y `DEVGUARDIAN_MCP_ARGS` (argumentos como array JSON). El CLI descubre las herramientas requeridas **antes de cualquier operación Git** y falla sin crear ramas si falta alguna.

## Dependencia que bloquea el ciclo completo

El `main` de esta rama todavía no incluye la Fase 4. Su servidor MCP publica diez herramientas, mientras el agente requiere también `run_tests` y `compare_test_runs`. Por eso el CLI por defecto detecta la ausencia y se detiene antes de mutar el repositorio. Para ejecutar el ciclo integral se debe completar/integrar la Fase 4 o configurar un servidor MCP compatible con los 12 contratos. No se simulan pruebas ni se permite commit sin evidencia verificable.

Las pruebas automatizadas del agente usan un `McpToolClient` falso y respuestas estructuradas deterministas; no consumen tokens, red ni API keys. Cubren caso exitoso, baseline verde, reintentos y rollback, planes inválidos, checkout sucio, cancelación, fallos de transporte y preflight CLI con repositorio Git temporal real.
