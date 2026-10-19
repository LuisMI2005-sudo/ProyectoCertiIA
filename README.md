# DevGuardian — Sistema de Auditoría y Rectificación Autónoma de Código Asistido por IA

## Hooks de Backend y Base de Datos

El motor `src/hooks/` conecta guardrails reales al parcheador y al commit mediante `hookManager` opcional, con bloqueo previo a la mutación, aprobación registrada y auditoría consultable. Incluye protección de archivos/secretos, evidencia de pruebas para commits y validación de registros antes de persistir. La configuración se conserva en los logs y el adaptador de persistencia permite conectar una BD desde el backend separado del frontend.

**Defensa:** [arquitectura, configuración, eventos y ejemplos reproducibles](src/hooks/README.md). La suite `tests/hooks/hooks.test.mjs` demuestra un parche **ACEPTADO**, parches **BLOQUEADOS** sin modificar archivos ni HEAD, y escrituras de BD válidas/corruptas. Son hooks del motor, independientes de los hooks nativos de Git. La delegación a subagentes está integrada mediante `pre:delegate` y `post:delegate`.

```sh
npm run check
npm test
```

## Subagentes: «Hook + subagente»

`src/subagents/` implementa delegación real mediante **un worker independiente por tarea**, contexto acotado, whitelist por rol, presupuesto y contratos de salida validados. El coordinador delega diagnóstico AST/lint y verificación con Test Runner; consume sus reportes para aplicar un parche propuesto, hacer commit con evidencia confiable o ejecutar rollback por regresión. El rol adicional `patch-safety` permite delegar un preflight de hooks sin conceder escritura Git.

`DelegationStore` conserva quién delegó, objetivo, contexto, herramientas efectivas, identidad del worker, resultado y decisión tomada con ese resultado. Dispone de adaptador para BD y consultas para futuras APIs. Los especialistas son deterministas y no requieren un LLM; la generación de parches y el transporte MCP siguen siendo integraciones separadas.

**Defensa:** [protocolo, aislamiento y demostración reproducible](src/subagents/README.md). Las 22 pruebas de `tests/subagents/subagents.test.mjs` incluyen commit y rollback en repositorios temporales con el analizador y Jest reales. Para producir logs visibles con configuración de hooks:

```sh
npm run build
node scripts/demo-subagents.mjs
```

La demo guarda [éxito con commit](artifacts/subagents/success.json) y [regresión con rollback](artifacts/subagents/regression.json): revisar `delegationLogs`, `consumption`, `hookLogs` y los hashes de HEAD. Cada artefacto conserva las tres delegaciones y sus cinco llamadas reales a herramientas.

[![CI](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/actions/workflows/ci.yml/badge.svg)](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/actions/workflows/ci.yml)

**Grupo:** Six seven  
**Integrantes:** Eduardo Quinteros, Sebhastian Campero, Luis Miguel Gonzales

DevGuardian es una plataforma para diagnosticar errores de software, generar parches en ramas de reparación y verificar sus resultados mediante pruebas antes de confirmar cambios. Su diseño utiliza **Model Context Protocol (MCP)** para conectar un agente de inteligencia artificial con herramientas locales de análisis de código, ejecución de pruebas y control de versiones, mediante entradas y respuestas estructuradas y validadas.

El ciclo autónomo previsto combina análisis AST y lint, contexto acotado para el modelo, ramas `fix/...`, comprobaciones de integridad, comparación de pruebas y commit o rollback por intento. Las fases completadas proporcionan la base transversal, el controlador Git, el analizador, el ejecutor de pruebas, hooks y la orquestación backend con subagentes aislados. El flujo coordinado ya ejecuta diagnóstico → baseline → parche propuesto → verificación → commit o rollback. El servidor MCP y el agente generativo conectado a un modelo siguen pendientes.

## 2. Estado Actual del Proyecto y Métricas de Calidad

| Fase | Módulo | Estado | Pruebas aprobadas |
|---|---|---|---:|
| Fase 1 | `src/shared/` | Completada | 30 |
| Fase 2 | `src/git-controller/` | Completada | 35 |
| Fase 3 | `src/analyzer/` | Completada | 44 |
| Fase 4 | `src/test-runner/` | Completada | 25 |
| Fase 5 | `src/mcp-server/` | Pendiente | — |
| Fase 6 | `src/agent/` | Pendiente | — |
| Hooks | `src/hooks/` | Implementado | 20 |
| Subagentes | `src/subagents/` | Implementado | 22 |
| **Total implementado** | **Fases 1–4 + Hooks + Subagentes** | **6 suites** | **176** |

**Validación integral de las fases 1–4 con los smoke tests de CI:**

- **176 pruebas unitarias y de integración** al instalar también pytest y `pytest-json-report`; sin pytest en el PATH, el smoke test de Python se omite localmente. En CI ambos runners son obligatorios.
- Compilación TypeScript estricta correcta y comprobación de tipos mediante `tsc -p tsconfig.json --noEmit` sin errores.
- ESLint sin errores en el código fuente.
- Integración Git comprobada con repositorios temporales reales: ramas, parches, diffs, commits verificados, concurrencia y rollback.
- Pruebas del analizador sobre símbolos, referencias, imports, diagnósticos, límites, almacenamiento y seguridad de rutas.
- Ejecutor de pruebas verificado con ejecutables Jest y pytest: estados, límites de tiempo, cancelación, huellas, comparaciones, evidencia y cierre real del ciclo analizar → parchear → ejecutar → verificar → confirmar.

Las pruebas de Git realizan commits exclusivamente dentro de sus repositorios temporales. Los fixtures con errores sintácticos, semánticos o de lint son casos deliberados de prueba, excluidos de la compilación de producción.

## 3. Arquitectura y Árbol de Directorios Actual

El sistema separa cinco responsabilidades: servidor MCP, analizador, ejecutor de pruebas, controlador Git y agente. `shared/` reúne contratos, errores y seguridad comunes. Los módulos de dominio no dependen de una conexión con un modelo para ejecutar sus operaciones.

El siguiente diagrama representa el **flujo objetivo** del agente conectado a MCP. La orquestación backend de diagnóstico, pruebas, parche propuesto y commit/rollback ya existe en `src/subagents/`; la generación de parches con un modelo y el transporte MCP requieren las fases pendientes.

```mermaid
flowchart TD
    A[Agente conectado al servidor MCP] --> B[Diagnóstico AST y lint]
    B --> C[Contexto de símbolos y pruebas iniciales]
    C --> D[Árbol limpio y validación de HEAD]
    D --> E[Crear rama fix/... y checkpoint del intento]
    E --> F[Generar parche y validar rutas y hashes]
    F --> G[Comprobar aplicabilidad y aplicar parche]
    G --> H[Ejecutar pruebas y comparar con baseline]
    H --> I{¿Fallo resuelto sin regresiones?}
    I -->|Sí| J[Validar evidencia y diffHash]
    J --> K[Commit del intento]
    I -->|No| L[Rollback limitado a archivos del intento]
    L --> M{¿Quedan intentos?}
    M -->|Sí| E
    M -->|No| N[Finalizar y conservar diagnóstico]
```

Estructura existente del proyecto; los comentarios describen el propósito de cada archivo:

```text
ProyectoCertiIA/
├── README.md                         # Identificación, arquitectura y avances
├── package.json                      # Dependencias exactas y scripts npm
├── package-lock.json                 # Resolución de dependencias reproducible
├── tsconfig.json                     # TypeScript estricto y salida en dist/
├── .gitignore                        # Exclusiones de compilación, secretos y temporales
├── src/
│   ├── shared/
│   │   ├── errors.ts                 # Errores tipados y sobre Result<T>
│   │   ├── path-security.ts          # Validación y confinamiento de rutas
│   │   └── contracts.ts              # Interfaces y esquemas Zod compartidos
│   ├── git-controller/
│   │   ├── types.ts                  # Sesiones, intentos, checkpoints y cola
│   │   ├── repository.ts             # Operaciones Git, ramas y serialización
│   │   ├── patch-manager.ts          # Parches, hashes, diffs, commits y rollback
│   │   ├── index.ts                  # Fachada pública y siete handlers Git
│   │   └── README.md                 # Operación, evidencia y recuperación detalladas
│   ├── analyzer/
│   │   ├── types.ts                  # Snapshots, símbolos, límites y análisis guardados
│   │   ├── ast-analyzer.ts           # Lectura y análisis con TypeScript Compiler API
│   │   ├── eslint-analyzer.ts        # ESLint programático y diagnósticos normalizados
│   │   ├── index.ts                  # Tres handlers y almacenamiento por analysisId
│   │   └── README.md                 # Semántica, configuración y límites detallados
│   └── test-runner/
│       ├── types.ts                  # Ejecuciones, casos, comparación y evidencia
│       ├── process-runner.ts         # Ejecución de procesos con timeout y salida acotada
│       ├── reports.ts                # Adaptadores de reportes Jest y pytest
│       ├── index.ts                  # Fachada, dos handlers y VerificationStore
│       └── README.md                 # Ejecución, huellas, comparación y límites detallados
├── tests/
│   ├── shared.test.mjs                # 30 pruebas de seguridad y contratos
│   ├── git-controller/
│   │   └── controller.test.mjs        # 35 pruebas con repositorios Git reales
│   ├── analyzer/
│   │   └── analyzer.test.mjs          # 44 pruebas del analizador y sus recursos
│   └── test-runner/
│       └── runner.test.mjs            # 23 pruebas del ejecutor y su evidencia
└── fixtures/
    ├── typescript/
    │   ├── domain.ts                 # Tipos y funciones importadas por otros casos
    │   ├── symbols.ts                # Clases, métodos, funciones y nombres sombreados
    │   ├── imports.ts                # Imports, reexports y dependencias de tipos
    │   ├── syntax-error.ts           # Error sintáctico controlado
    │   ├── semantic-error.ts         # Incompatibilidad de tipos controlada
    │   └── lint-error.ts             # Infracciones de reglas ESLint controladas
    └── runner/
        ├── fake-jest.mjs             # Ejecutable Jest falso para pruebas deterministas
        └── fake-pytest.mjs           # Ejecutable pytest falso para pruebas deterministas
```

`dist/` se genera al compilar y `node_modules/` al instalar dependencias; ambos están excluidos de Git. Las carpetas de las fases 5–6 aún no forman parte de la implementación.

## 4. Registro Detallado de Cambios e Implementación por Fase (Changelog Técnico)

### Fase 1: Configuración Base y Módulo Transversal (`src/shared/`)

- **Entorno:** Node.js 24, ES Modules y TypeScript **6.0.3**. La configuración utiliza `NodeNext`, `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, comprobación de variables/parámetros sin uso y bloqueo de emisión ante errores. La compilación genera declaraciones y mapas de código.
- **Dependencias:** versiones directas exactas para MCP SDK, Zod, `simple-git`, TypeScript, ESLint, parser/plugin TypeScript, LangChain y Anthropic. Jest ejecuta las pruebas del proyecto.
- **`errors.ts`:** clases y códigos de error de dominio; sobre discriminado `Result<T>` con éxito `{ ok: true, data }` o fallo `{ ok: false, error }`; captura de excepciones y sanitización de errores internos desconocidos.
- **`path-security.ts`:** validación de rutas relativas y canónicas, prevención de *path traversal*, protección de `.git` y rechazo de objetos especiales del filesystem. Los enlaces simbólicos internos pueden leerse, pero los externos se rechazan. Las escrituras rechazan enlaces simbólicos y archivos con múltiples hard links.
- **`contracts.ts`:** interfaces y esquemas Zod estrictos para las **12 herramientas MCP previstas**, además de diagnósticos, símbolos, dependencias, resultados de procesos/pruebas y evidencia de verificación. Los contratos de `run_tests` y `compare_test_runs` existen, pero sus implementaciones corresponden a la Fase 4.
- **Verificación:** 30 pruebas aprobadas de contratos, errores, límites y seguridad de rutas.

### Fase 2: Controlador de Versiones y Parches (`src/git-controller/`)

- **`types.ts`:** representación interna de sesiones `sessionId`, intentos `attemptId`, huellas de archivos, checkpoints e información de serialización.
- **`repository.ts`:** integración con `simple-git`; exigencia de árbol limpio y coincidencia de `expectedHead` antes de crear una rama `fix/...`; registro del commit y del estado de archivos/índice al iniciar un intento.
- **Serialización:** cola FIFO compartida por instancias que operan sobre el mismo checkout canónico y lock exclusivo en el directorio común de Git para coordinar procesos cooperantes. Los comandos tienen timeout y salida acotada. Los hooks del repositorio y fsmonitor están deshabilitados para las operaciones del controlador.
- **`patch-manager.ts`:** comprobación exacta del conjunto de `expectedFileHashes`, hashes SHA-256 y rutas antes de aplicar cambios; validación con `git apply --check` e índices temporales que preservan el staging real. Un hash esperado `null` exige que el archivo no exista.
- **Diffs y commits:** cálculo del diff completo del intento, `diffHash`, archivos afectados e inserciones/eliminaciones. El commit exige `expectedDiffHash` y evidencia confiable asociada a `verificationRunId`: baseline y candidato completos, configuración comparable, fallos resueltos, ausencia de regresiones y huellas compatibles con el checkpoint y el workspace actual.
- **Confirmación:** creación del commit con índice privado, bloqueo nativo del índice y actualización condicional de la referencia mediante `update-ref` con el HEAD anterior esperado. Hay compensación ante fallos controlados de instalación del índice.
- **Rollback quirúrgico:** aplicación del diff inverso del intento en la misma rama `fix/...`, con HEAD y archivos verificados. Conserva archivos y staging ajenos, recrea padres necesarios de forma validada y rechaza sobrescribir cambios externos en archivos gestionados. No revierte intentos ya confirmados ni ejecuta un reset global.
- **`index.ts`:** fachada de dominio y siete handlers Git con sobre `Result<T>`. La evidencia se obtiene de un `VerificationStore` confiable inyectado; la integración con un ejecutor real queda pendiente de la Fase 4.
- **Verificación:** 35 pruebas aprobadas sobre repositorios temporales reales.

El bloqueo coordina escritores que respetan el protocolo; no impide modificaciones de editores o procesos externos que lo ignoren. Las sesiones se conservan en memoria y los locks abandonados tras una interrupción requieren revisión manual. Detalles de operación y recuperación: [documentación técnica de Git Controller](src/git-controller/README.md).

### Fase 3: Motor de Análisis Estático y AST (`src/analyzer/`)

- **`types.ts`:** snapshots de fuente, nodos y tabla de símbolos, resultados AST, metadatos de análisis y opciones de límites de recursos.
- **`ast-analyzer.ts` — lectura:** `read_file_context` devuelve intervalos inclusivos de líneas, preserva UTF-8/BOM y saltos de línea, calcula SHA-256 del archivo completo y señala recortes con `truncated`. La lectura de contexto calcula posiciones sin necesitar un parseo AST.
- **`ast-analyzer.ts` — símbolos:** `get_symbol_context` selecciona el símbolo envolvente más específico y extrae nombre, firma, rango, fuente exacta del nodo, imports y referencias locales. El Type Checker distingue identidades de símbolos y evita confundir nombres sombreados. Las líneas/columnas empiezan en 1 y el extremo final de los rangos es exclusivo.
- **`ast-analyzer.ts` — diagnóstico:** `analyze_code` utiliza TypeScript Compiler API para diagnósticos sintácticos y semánticos, símbolos afectados y dependencias directas. Reconoce imports de tipos, reexports, imports dinámicos y llamadas `require` con argumento literal, además de aliases y condiciones de resolución NodeNext ESM/CommonJS.
- **Confinamiento:** el CompilerHost restringe lecturas al workspace y a las declaraciones estándar de TypeScript instaladas; no ejecuta las dependencias analizadas ni emite archivos. Cada solicitud crea un Program nuevo para evitar reutilizar información semántica obsoleta.
- **`eslint-analyzer.ts`:** integración con la clase `ESLint`, Flat Config y `lintText` sobre el mismo snapshot del AST. Normaliza regla, severidad, mensaje y ubicación, incluidos errores fatales de parseo. No aplica fixes ni carga configuración JavaScript del workspace por defecto; los overrides son configuración confiable de inicialización.
- **`index.ts`:** tres handlers MCP con `Result<T>` y almacenamiento en memoria por `analysisId`, con límites de capacidad y bytes, expulsión LRU y TTL fijo. `getAnalysis` y `getAnalysisMetadata` devuelven copias defensivas para el futuro recurso `devguardian://analysis/{analysisId}`.
- **Verificación:** 44 pruebas aprobadas y seis fixtures TypeScript controlados.

El analizador aplica límites de archivos, programa, nodos AST, texto, diagnósticos y referencias. Su ejecución es en proceso: estos límites no constituyen un timeout estricto de CPU ni un sandbox del sistema operativo. Detalles de configuración y semántica: [documentación técnica del analizador](src/analyzer/README.md).

### Fase 4: Ejecutor de Pruebas y Verificación (`src/test-runner/`)

- **`types.ts`:** opciones del ejecutor, configuración confiable de runners (Jest/pytest), ejecuciones, casos de prueba, resultados de comparación y evidencia de verificación.
- **`process-runner.ts`:** ejecución sin shell con lista blanca de variables de entorno, cwd fija en el workspace, timeout por proceso, cancelación explícita y terminación del árbol de procesos (grupo de proceso en POSIX, `taskkill` en Windows). stdout y stderr se capturan por separado con presupuesto `min(maxOutputBytes, 100000)` bytes por flujo y marca `truncated`; un fallo de arranque no produce código de salida.
- **`reports.ts`:** adaptadores de reporte para Jest (`--json --outputFile=`) y pytest (`--json-report --json-report-file=`), que el módulo agrega a la línea de comandos por sí mismo. Las rutas de suite se normalizan a rutas relativas POSIX del workspace; rutas fuera del workspace, inválidas o identificadores duplicados rechazan el reporte.
- **Estados:** `passed` solo para una ejecución completa con código 0, al menos un test aprobado y ningún fallo; `failed` para el resto; `timeout`, `cancelled` o `error` para ejecuciones terminadas, canceladas o sin reporte válido. `complete: false` indica que el resultado no sirve como evidencia.
- **`index.ts`:** fachada con `run_tests` y `compare_test_runs` sobre `Result<T>`, ejecuciones serializadas por instancia, y almacenamiento en memoria de ejecuciones y evidencia con límites de entradas, bytes y TTL. La misma instancia actúa como `VerificationStore` confiable que inyecta `git_commit_fix`.
- **Huellas:** `workspaceStateHash` se captura del proveedor confiable justo antes de la ejecución; `configurationHash` es SHA-256 de la configuración confiable resuelta del runner. Solo se comparan ejecuciones completas con el mismo hash de configuración.
- **Comparación y ciclo completo:** `compareTestRuns` informa fallos resueltos, fallos nuevos, tests ausentes y veredicto (`regression`, `success`, `inconclusive`). `verify(baselineRunId, candidateRunId)` registra `VerificationEvidence` por `candidateRunId`, lo que permite cerrar el ciclo real analizar → parchear → ejecutar → verificar → confirmar con `git_commit_fix`.
- **Verificación:** 25 pruebas: 23 casos con ejecutables controlados y repositorios temporales, más dos smoke tests que invocan Jest real y pytest real y validan sus reportes JSON mediante el Test Runner. El caso de integración Git utiliza un ejecutor simulado; los smoke tests verifican los adaptadores con procesos reales.

El ejecutor no es un sandbox del sistema operativo: los tests son código arbitrario que se ejecuta con el entorno permitido y conviene correrlos en un checkout dedicado. pytest requiere el plugin `pytest-json-report`. Detalles de ejecución, huellas y límites: [documentación técnica del Test Runner](src/test-runner/README.md).

## 5. Contratos de Herramientas MCP Implementadas (Hasta Fase 4)

Las siguientes **12 herramientas están operativas como handlers de los módulos de dominio**. Todavía no están publicadas mediante transporte MCP: su registro en el servidor corresponde a la Fase 5.

Todas las salidas exitosas de la tabla corresponden a `data` dentro de `Result<T>`. Los fallos usan `{ ok: false, error: { code, message, retryable, details? } }`. `?` indica un parámetro opcional; los IDs son UUID, las huellas de archivo/diff son SHA-256 hexadecimales y todas las rutas de herramientas son relativas al workspace configurado.

| Herramienta | Entradas | Salida exitosa (`data`) | Garantías y condiciones de seguridad |
|---|---|---|---|
| `read_file_context` | `path: string`, `startLine?: number`, `endLine?: number` | `{ path, content, startLine, endLine, fileHash, truncated }` | Ruta validada, archivo regular UTF-8, lectura acotada y hash del archivo completo; rechaza lecturas fuera del workspace. |
| `analyze_code` | `paths: string[]`, `checks: Array<"syntax" \| "semantic" \| "lint">` | `{ analysisId, diagnostics, affectedSymbols, dependencies, analyzedFiles, truncated }` | Esquemas estrictos, sin rutas/identidades duplicadas, CompilerHost restringido y límites de recursos; no modifica ni ejecuta el código objetivo. |
| `get_symbol_context` | `path: string`, `line: number` | `{ symbol, signature, range, source, imports, references, fileHash, truncated }` | Símbolo más específico, referencias por identidad del checker y contexto acotado; errores explícitos para líneas inválidas o sin símbolo compatible. |
| `git_status` | `{}` | `{ branch, headCommit, clean, staged, modified, untracked, conflicted }` | Consulta serializada; informa HEAD separado o repositorio sin commit mediante campos nulos cuando corresponde; no modifica archivos del usuario. |
| `git_create_fix_branch` | `slug: string`, `expectedHead: string` | `{ sessionId, branch, baseBranch, baseCommit }` | Exige árbol limpio, rama adjunta, HEAD esperado y nombre validado; crea `fix/...` sin sobrescribir ramas existentes. |
| `git_begin_attempt` | `sessionId: string` | `{ attemptId, checkpointCommit }` | Valida sesión y rama, exige árbol limpio y un único intento activo por sesión; registra checkpoint y huellas. |
| `git_apply_patch` | `sessionId: string`, `attemptId: string`, `unifiedDiff: string`, `expectedFileHashes: Record<string, string \| null>` | `{ applied: true, changedFiles, diffHash }` | Verifica rutas y hashes exactos, estado del intento y aplicabilidad antes de escribir; admite parches de texto y rechaza binarios, symlinks y modos especiales. Preserva el staging real. |
| `git_diff` | `sessionId: string`, `attemptId: string` | `{ diff, diffHash, changedFiles, insertions, deletions }` | Diff acotado del intento contra su checkpoint; incluye altas y bajas mediante un índice temporal y detecta modificaciones externas en archivos gestionados. |
| `git_commit_fix` | `sessionId: string`, `attemptId: string`, `message: string`, `expectedDiffHash: string`, `verificationRunId: string` | `{ commit, branch, files }` | Exige parche no vacío, diff esperado, evidencia vigente y estado compatible; usa locks de índice y actualización condicional del HEAD. No confirma trabajo ajeno. |
| `git_rollback_attempt` | `sessionId: string`, `attemptId: string` | `{ restoredCommit, revertedFiles, branch, clean }` | Revierte solo cambios del intento activo con rama/HEAD intactos; conserva trabajo externo y rechaza conflictos de propiedad. `clean` puede ser `false` si queda trabajo ajeno. |
| `run_tests` | `runner: string`, `targets?: string[]`, `timeoutMs?: number` | `{ runId, runner, status, complete, exitCode, signal, durationMs, summary, cases, stdout, stderr, outputTruncated, fingerprint, configurationHash, createdAt }` | Solo acepta runners configurados en arranque; ejecución sin shell, timeout acotado al presupuesto configurado y salida limitada; rutas y reportes confinados al workspace; la huella se captura antes de ejecutar. |
| `compare_test_runs` | `baselineRunId: string`, `candidateRunId: string` | `{ baselineRunId, candidateRunId, comparable, verdict, resolvedFailures, newFailures, missingTests, message }` | Compara solo ejecuciones completas con hash de configuración idéntico; veredictos `regression`, `success` e `inconclusive` según el contraste de fallos resueltos, nuevos y ausentes. |

Los esquemas y tipos completos están definidos en [`src/shared/contracts.ts`](src/shared/contracts.ts). Los métodos de dominio retornan datos tipados y lanzan errores de dominio; las fachadas `.tools` los convierten al sobre `Result<T>` para el futuro servidor MCP. Las raíces, límites y proveedores de evidencia se configuran al inicializar los servicios y no son argumentos elegibles por el modelo.

## 6. Requisitos, Instalación y Comandos de Verificación

Requisitos actuales:

- **Node.js 24.x**, conforme a `engines.node: >=24.0.0 <25`.
- **npm**, disponible con Node.js.
- **Git** accesible mediante `PATH`. Las pruebas Git configuran identidad local en sus fixtures; para commits de reparación sobre otro repositorio debe existir una identidad Git válida allí.
- Permisos de lectura/escritura en el workspace y soporte de enlaces de directorio para ejecutar las pruebas de seguridad; en Windows se utilizan junctions.

Desde PowerShell, ubicar la terminal en la raíz del proyecto:

```powershell
Set-Location 'C:\Users\HP\ProyectocertiIA\ProyectoCertiIA'
```

Instalar las dependencias:

```sh
npm install
```

El repositorio incluye `package-lock.json`; `npm ci` es la alternativa para instalaciones reproducibles desde ese archivo.

Comandos de compilación y verificación:

| Objetivo | Comando exacto | Resultado esperado |
|---|---|---|
| Compilar | `npm run build` | JavaScript ESM, declaraciones y mapas en `dist/`. |
| Verificar tipos sin emitir | `npm run typecheck` | `tsc -p tsconfig.json --noEmit` sin errores. |
| Verificar estilo y reglas | `npm run lint` | ESLint sin errores en `src/`. |
| Verificar tipos y lint juntos | `npm run check` | Ejecución secuencial de ambas comprobaciones. |
| Ejecutar la suite completa | `npm test` | Compilación previa y 176 pruebas en seis suites Jest; el smoke test de pytest requiere Python y su plugin JSON. |

Para reproducir la validación completa:

```sh
npm run typecheck
npm run lint
npm run build
npm test
```

`npm test` compila de nuevo antes de ejecutar Jest y utiliza el soporte ESM de Node mediante `--experimental-vm-modules`. Esto puede mostrar un aviso de característica experimental sin implicar un fallo de las pruebas. Su timeout base es de 10 segundos por prueba; las suites de integración ajustan sus tiempos para los escenarios correspondientes.

Los scripts `start:server` y `start:agent` ya están declarados, pero sus archivos de entrada corresponden a fases pendientes y todavía no pueden utilizarse para iniciar el sistema completo. La validación no requiere una clave de Anthropic. Además de los ejecutables controlados de `fixtures/runner/`, la suite incluye dos smoke tests con Jest y pytest reales. pytest debe estar en el PATH junto con el plugin `pytest-json-report`; si el binario existe pero falta el plugin, la prueba falla.

## Integración Continua (CI)

El workflow [CI](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/actions/workflows/ci.yml), definido en [`.github/workflows/ci.yml`](.github/workflows/ci.yml), se ejecuta con cada push a `main` o `Dev` y cada pull request dirigido a esas ramas. Utiliza Ubuntu, Node.js 24.x, caché de npm y Python 3.11. Instala Node con `npm ci` y versiones fijadas de pytest y `pytest-json-report`, configura una identidad Git para los repositorios temporales y ejecuta:

1. `npm run check`: TypeScript estricto sin emitir y ESLint.
2. `npm test`: compilación y las seis suites, incluidos los smoke tests con Jest y pytest reales y los flujos delegados de commit/rollback. Los smoke tests invocan `TestRunner`, procesan el JSON real con `reports.ts` y exigen `complete: true`, `status: passed`, código de salida 0 y un caso aprobado.
3. Una tabla de resultados en el resumen de Actions, que también informa fallos o pasos no ejecutados.

El workflow solo dispone de `contents: read`, cancela ejecuciones anteriores de la misma rama y tiene un límite de 15 minutos. No incluye despliegues ni requiere secretos o archivos `.env`. `DEVGUARDIAN_REQUIRE_PYTEST=1` hace fallar la suite si falta pytest en CI.

Para reproducirlo localmente, con Node.js 24.x, Git y Python 3.11 o superior:

```sh
npm ci
python -m venv .venv-ci
```

Activar el entorno virtual con `source .venv-ci/bin/activate` en Bash o `.\.venv-ci\Scripts\Activate.ps1` en PowerShell. Después:

```sh
python -m pip install pytest==8.4.2 pytest-json-report==1.5.0
npm run check
npm test
```

Para exigir pytest también localmente, usar `DEVGUARDIAN_REQUIRE_PYTEST=1 npm test` en Bash o `$env:DEVGUARDIAN_REQUIRE_PYTEST = '1'; npm test` en PowerShell.

Para la defensa, abrir **Actions → CI → Run workflow**, seleccionar `Dev` y ejecutar manualmente. GitHub habilita este botón cuando el workflow está presente en la rama predeterminada; si esta es `main`, primero debe integrarse allí el archivo mediante el flujo habitual de revisión. Mientras solo exista en `Dev`, un push a `Dev` activa automáticamente la validación.
