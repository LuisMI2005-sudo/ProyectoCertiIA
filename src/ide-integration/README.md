# Hooks y subagentes del asistente de IA

Esta integracion aplica controles al asistente **Codex dentro del entorno de desarrollo**. Sigue el enfoque de la referencia local `C:\Users\HP\hooks\hooks`, adaptado a TypeScript y Node.js 24. No instala los scripts Python de ese ejemplo ni modifica la configuracion global del usuario.

## Tres conceptos diferentes

| Capa | Ubicacion | Ejecucion |
|---|---|---|
| Hooks del motor DevGuardian | `src/hooks/` | Reglas en operaciones REST/MCP de analisis, parches y commits. |
| Workers deterministas | `src/subagents/` | Diagnostico, verificacion y preflight opcional coordinados por el backend. |
| Hooks y perfiles del asistente | `.codex/hooks.json`, `.codex/agents/` | Interceptan acciones del asistente y definen especialistas de IA del proyecto. |

Los hooks React del frontend gestionan estado y consultas; no pertenecen a ninguna de estas politicas del backend.

## Direcciones y responsabilidades

```text
ProyectoCertiIA/
  .codex/
    hooks.json                    Registro de eventos y comandos nativos
    agents/
      revisor-codigo.toml          Revisa codigo y riesgos sin editar
      depurador.toml               Propone/corrige un defecto autorizado
      verificador.toml             Ejecuta verificaciones y reporta evidencia
      documentador.toml            Documenta comportamiento comprobado
  scripts/ide-hooks.mjs            Entrada stdin/stdout y codigos 0/2
  src/ide-integration/
    types.ts                      Payloads, resultados y opciones tipadas
    policy.ts                     Rutas, ediciones y comandos
    index.ts                      Entorno, verificaciones y auditoria
  tests/ide-integration/           Casos automatizados del adaptador
  .devguardian/ide-audit.jsonl      Log local generado e ignorado por Git
```

Cada TOML es **un perfil del asistente**, no un worker Node ni una nueva herramienta MCP. No fija modelo, proveedor ni credenciales. Hereda la configuracion del asistente padre. Las instrucciones de no editar delimitan su tarea, pero no crean un sandbox independiente de solo lectura.

El verificador sustituye al generador de pruebas del ejemplo: las pruebas existentes estan protegidas y las pruebas nuevas se presentan como propuesta para revision humana. Asi no se le ordena simultaneamente escribir tests y saltarse el protector.

## Controles del adaptador

| Modo | Evento | Comportamiento |
|---|---|---|
| `session` | `SessionStart` | Comprueba Node 24, raiz y manifiesto; presenta especialistas. |
| `files` | `PreToolUse` de edicion | Revisa rutas y enlaces, destinos de rename, archivos protegidos y secretos añadidos. |
| `commands` | `PreToolUse` de `Bash` | Bloquea patrones de reset destructivo, force push, borrados, SQL destructivo y otros casos definidos. |
| `verify` | `PostToolUse` de edicion | Compila, revisa lint y ejecuta pruebas relacionadas con el modulo. |
| `audit` | `PostToolUse`, `SubagentStart`, `SubagentStop` | Registra evento, correlacion y decision sin guardar comandos ni parches. |

El archivo de configuracion tiene siete registros de handlers distribuidos en cinco eventos. Esas cantidades no sustituyen las tres reglas existentes del motor ni los tres roles de workers deterministas. Hay cuatro perfiles de IA nuevos.

El protector reutiliza `WorkspacePathGuard` y `createHookManager`. Añade proteccion para tests existentes y para su propia configuracion/codigo de politica. Las rutas se resuelven respecto al directorio del evento, siempre dentro de la raiz fija del launcher, incluso al iniciar desde una subcarpeta.

Las entradas invalidas, errores de politica o fallos de auditoria impiden que el adaptador declare autorizacion. Una respuesta previa rechazada devuelve codigo 2 y razon al asistente. El hook posterior informa fallos **despues de editar**: no revierte archivos automaticamente y no constituye evidencia del VerificationStore para autorizar un commit del motor.

## Verificacion automatica despues de una edicion

Para cambios JavaScript/TypeScript se ejecutan comandos fijos del proyecto mediante subprocesos sin shell:

1. TypeScript con el `tsconfig.json` del backend.
2. Copia del esquema de BD al build.
3. ESLint con las reglas de `npm run lint`.
4. Jest real, dirigido al modulo afectado cuando existe un mapeo; cambios compartidos o fuera del mapeo ejecutan toda la suite.

El presupuesto total es de cinco minutos y la salida esta acotada. Una salida truncada no se declara exitosa. Para cambios solo documentales no se requieren pruebas automaticas. No se acepta desde stdin un comando, ejecutable o target alternativo de verificacion.

Un fallo devuelve feedback al modelo para corregir la causa. No debe arreglarse cambiando una prueba, desactivando la politica ni afirmando que se hizo rollback. Los cambios del hook o su configuracion requieren revision humana y recompilacion; el asistente no se puede autorizar a modificar su propio control.

## Preparacion y activacion por el usuario

Desde la raiz del backend:

```powershell
npm.cmd ci
npm.cmd run build
codex -C C:\Users\HP\ProyectocertiIA\ProyectoCertiIA
```

1. Abrir **ProyectoCertiIA**, no solamente su carpeta padre. La configuracion es de ese proyecto.
2. En el CLI ejecutar `/hooks`, leer las definiciones y revisar/confiar en las que se quieran activar. Cambios posteriores pueden exigir nueva revision.
3. Verificar los perfiles en `/subagents` segun la interfaz disponible y pedir explicitamente el rol, por ejemplo `Usa revisor-codigo para revisar src/analyzer/index.ts sin editar`.
4. Usar `git status` como primera accion de consulta y comprobar una entrada nueva de sesion en `.devguardian/ide-audit.jsonl`.

La activacion automatica depende del host Codex, confianza del proyecto y revision de hooks. No se elude la confianza ni se activa una opcion global desde el instalador. La inspeccion local encontro Codex CLI 0.162.1 con hooks y multi_agent habilitados; esto no prueba por si solo que estos hooks nuevos hayan sido autorizados o ejecutados por una sesion real.

## Demostracion segura

1. Pedir una revision con `revisor-codigo` y comprobar el evento de subagente y su informe real.
2. Pedir un cambio pequeño y autorizado en un archivo de `src/`; observar el feedback automatico de verificacion.
3. Solicitar que cambie una prueba existente para esconder un fallo. Debe bloquearse antes de editar; comprobar que la prueba permanezca intacta.
4. Para mostrar el bloqueador de comandos, se puede pedir al asistente `node -e "console.log('DROP DATABASE ejemplo')"`. Es una cadena inofensiva que la politica conservadora rechaza por su patron. Explicar el falso positivo; no solicitar borrados reales.
5. Revisar el log sin mostrar secretos. Los comandos ingresados directamente por una persona en una terminal no pasan por estos hooks del asistente.

Para verificar los scripts sin activar una sesion de IA:

```powershell
npm.cmd run build
node --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand tests/ide-integration/ide-hooks.test.mjs
```

Los 35 casos incluyen entrada CLI real por stdin, allow/deny, secretos, rutas absolutas/relativas, traversal, renombrado, enlaces y resultados posteriores de verificacion. Los escenarios se producen en carpetas temporales, sin ejecutar los comandos destructivos enviados como texto. Los tests de verificacion de feedback inyectan un checker controlado; no se presentan como una sesion generativa real.

Adicionalmente se ejecuto `checkIdeChanges` con el modulo `src/hooks/`: la compilacion, ESLint y las pruebas reales de `tests/hooks` terminaron correctamente. Esto verifica el ejecutor automatico, pero no sustituye la autorizacion de `/hooks` ni una demostracion con un subagente generativo real.

Validacion local final del 27 de octubre de 2026: `npm run check` y `npm run build` sin errores; `npm test` con 11 suites aprobadas, 321 pruebas aprobadas y 1 omitida de 322 registradas. La omitida corresponde al smoke test opcional de pytest, no disponible en el PATH local. No se presenta este resultado como evidencia de un nuevo pipeline publicado en GitHub.

## Auditoria y limites

La bitacora local almacena fecha, evento, modo, herramienta, tipo de agente, decision y razon. Los IDs de sesion/trabajador se correlacionan con hashes. No almacena prompts, transcripciones, entrada cruda de herramientas, parches ni sus respuestas completas. Se aplican permisos de archivo y un limite de tamaño; si el log requiere archivo manual el adaptador falla sin declarar exito. No se borra la auditoria automaticamente.

Esta bitacora es distinta de las tablas de PostgreSQL y del historial del dashboard. No se ha añadido un endpoint para mezclar ambas evidencias ni se presentan eventos del IDE como delegaciones del backend.

El bloqueador de comandos busca patrones, no interpreta todos los lenguajes de shell. Puede generar falsos positivos y no cubre cualquier comando equivalente, herramienta de escritura o proceso externo. Los hooks son una capa adicional, no aislamiento del sistema operativo ni sustituto de permisos/sandbox. Las comprobaciones de rutas son snapshots y requieren un workspace confiable sin escritores hostiles concurrentes.

El adaptador esta integrado para Codex. Las configuraciones de Claude Code y OpenCode de la referencia no se copian ni se declaran verificadas aqui. La pagina Render y el Agent Client Anthropic mantienen sus flujos anteriores.

Referencias oficiales consultadas el 27 de octubre de 2026: [hooks de Codex](https://learn.chatgpt.com/docs/hooks) y [perfiles de subagentes](https://learn.chatgpt.com/docs/agent-configuration/subagents).
