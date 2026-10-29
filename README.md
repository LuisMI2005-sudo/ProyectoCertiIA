# DevGuardian — Sistema de Auditoría y Rectificación Autónoma de Código Asistido por IA

> **Entrega docente SDD y Obsidian:** la documentación se publica en el repositorio independiente [DevGuardian-SDD-Obsidian](https://github.com/LuisMI2005-sudo/DevGuardian-SDD-Obsidian). Incluye constituciones, especificaciones, planes, tareas, diagramas Mermaid y la bóveda con grafos por colores. Este repositorio conserva el código del backend y sus copias operativas de Spec Kit; la separación no reescribe el historial ni modifica el despliegue.

## Arquitectura objetivo: microservicios y microfrontends

Objetivo solicitado: PostgreSQL relacional multitenant por servicio, principios SOLID explícitos, backend con 7 servicios de dominio y Gateway BFF/MCP, y frontend con Shell y 6 microfrontends. [Diseño completo](specs/segundo-cerebro/arquitectura-objetivo/00-Arquitectura-Objetivo.md). Cada módulo tiene nota y relaciones, con frontend azul, backend naranja y datos verde. **Estado actualizado: perfil local multitenant implementado y en validación, con siete servicios, gateway y seis microfrontends.** El despliegue productivo y la migración de datos históricos siguen pendientes; consultar la sección de plataforma local y su evidencia.

## Grafo nativo de Obsidian

Para entrega usar la bóveda independiente **DevGuardian-SDD-Obsidian** y su README. La copia histórica del backend permite abrir **Graph view** en la bóveda `ProyectoCertiIA`: el filtro `path:"specs/segundo-cerebro"` muestra conceptos y módulos con colores por categoría, sin incluir dependencias ni archivos generados. Ver el [mapa de módulos](specs/segundo-cerebro/arquitectura/00-Arquitectura-modulos.md). GameZone mantiene su grafo separado en `practica`. El Canvas no sustituye esta vista nativa.

## Segundo cerebro y contexto del asistente

`AGENTS.md` contiene instrucciones del repositorio y `CODEX.md` registra contexto documental. [Segundo cerebro de DevGuardian](specs/segundo-cerebro/00-Segundo-cerebro.md). Organiza la lectura crítica del PDF, arquitectura, seguridad, IA y verificación. GameZone se mantiene separado. En Obsidian, seleccionar la bóveda `ProyectoCertiIA` y abrir `specs/segundo-cerebro/00-Segundo-cerebro`. La entrega documental canónica reside en el repositorio independiente; esta carpeta conserva una copia histórica/operativa; GameZone permanece en `practica`. Los grafos distinguen categorías con colores y etiquetas.

## Desarrollo guiado por especificaciones (SDD)

Esta carpeta ya está registrada como bóveda local de Obsidian. Si aparece **Display Mermaid diagrams in this vault?**, pulsa **Allow** tú mismo para permitir el render nativo. Abre `specs/README.md` como índice.

Spec Kit 0.8.9 está inicializado con integración Codex y scripts PowerShell. Ver el [índice SDD para Obsidian](specs/README.md), la [Constitución](specs/constitution.md) y el [Plan técnico](specs/001-sdd-foundation/plan.md). Las plantillas operativas están en `.specify/templates/`; las habilidades instaladas en `.agents/skills/`. Las copias visibles en `specs/` permiten abrir esta raíz como bóveda de Obsidian y renderizar los bloques Mermaid nativamente en Vista de lectura o Live Preview, sin plugins.

Ejecutar `npm run sdd:sync` después de cambiar las fuentes y `npm run sdd:check` para comprobar copias, enlaces y estructura Mermaid. Los futuros diagramas técnicos, de datos y de procesos deben seguir estas plantillas. Esta adopción documental no cambia la aplicación ni sustituye sus pruebas.

La importación por enlace público de GitHub, con progreso SSE, validación de compatibilidad y transición a Auditoría, se documenta en [Importación de proyectos](src/server/PROJECT_IMPORT.md). Esta funcionalidad prepara análisis estático sin instalar dependencias ni ejecutar código de terceros.

## Integración con el asistente de IA del entorno de desarrollo

La adaptación para Codex se registra en [`.codex/hooks.json`](.codex/hooks.json), con cuatro perfiles en [`.codex/agents/`](.codex/agents/). Protege ediciones y comandos del asistente, verifica cambios TypeScript y audita eventos de herramientas/subagentes mediante [`src/ide-integration/`](src/ide-integration/README.md). Su cobertura está en tests/ide-integration/; consultar la cabecera para métricas actuales por SHA, sin sumar conteos históricos al CI vigente.

Esta integración local requiere compilar y revisar las definiciones en `/hooks` antes de activarlas en Codex. Sus perfiles generativos y su auditoría local son distintos de los workers deterministas de `src/subagents/`, de los hooks del motor de `src/hooks/` y del dashboard de Render. Ver [preparación, activación, pruebas y límites](src/ide-integration/README.md).

## Estado y trazabilidad de la entrega final

**Incrementos finales definidos:** INC-01 Gestión segura de organizaciones y accesos (HU-44), e INC-02 Espacio de trabajo modular con microfrontends (HU-46). Ver [criterios y diferencia frente al 20/10](https://github.com/LuisMI2005-sudo/DevGuardian-SDD-Obsidian/blob/main/specs/006-final-increments/spec.md) y [guion de demostración local](https://github.com/LuisMI2005-sudo/DevGuardian-SDD-Obsidian/blob/main/specs/006-final-increments/demo.md). La implementación está disponible en el perfil platform; la aceptación del docente y la demo final aún no se acreditan. No se afirma que el despliegue legacy de Render tenga estos incrementos activos.

**Corte: 29/10/2026.** Consultar el [backlog vigente](backlog.md), la [matriz por HU e issue](reports/TRAZABILIDAD_FINAL.md) y la [especificación documental](https://github.com/LuisMI2005-sudo/DevGuardian-SDD-Obsidian/blob/main/specs/005-final-traceability/spec.md).

| Entorno | Evidencia del corte | Límite |
|---|---|---|
| Integración backend 39cb46a | [CI aprobado](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/actions/runs/40942257149): 19 suites, 375 aprobadas y 5 omitidas en el job general; job Docker con 7 aprobadas | Los 5 casos se cubren en Docker; sus 2 pruebas de configuración también aparecen en el job general. No sumar ambos como pruebas únicas |
| Integración frontend 3b06f56 | [CI aprobado](https://github.com/SebhastianCampero-Collab/Frontend/actions/runs/40942339109): 125 aprobadas en 14 archivos, tipos, lint y builds normal/plataforma | [PR backend #5](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/5) y [PR frontend #1](https://github.com/SebhastianCampero-Collab/Frontend/pull/1) siguen abiertos; no se acredita su despliegue |
| Render existente | [Frontend](https://proyecto-certificacion-ai-frontend.onrender.com) y [health](https://proyecto-certificacion-ai-backend.onrender.com/api/health): HTTP 200; PostgreSQL conectado y cinco tablas en comprobación del 29/10 | El health no informa SHA; Jest disponible y pytest no disponible. No acredita plataforma multitenant publicada ni reparación de repositorios externos con sandbox cloud |

### Recorrido de la interfaz actual

1. **Mis proyectos → Registrar proyecto:** importar un enlace de GitHub y observar preparación y compatibilidad. No se instalan dependencias ni scripts externos.
2. **Revisar código:** seleccionar un archivo real, elegir comprobaciones y pulsar **Revisar código**. **Consultar archivo** lee el intervalo elegido sin modificarlo.
3. **Resultados e historial:** consultar resumen, hallazgos y evidencia. Un diagnóstico no realiza reparación ni necesariamente registra baseline/candidato; cero hallazgos no garantiza corrección funcional.
4. Si falta el checkout y existe sourceUrl, **Reclonar Workspace** recupera el mismo proyecto. No habilita reparación sin sandbox.
5. **Opciones avanzadas:** **Hooks y guardrails** consulta políticas e intercepciones; **Trazas de subagentes** filtra/exporta eventos reales; **MCP y edición JSON** permite peticiones explícitas bajo las políticas del backend.

El dashboard de seguridad actual es de lectura: no contiene los antiguos botones de ejemplos ALLOW/BLOCK. Actualizar trazas consulta registros, no los crea. Los endpoints y fixtures de demo se conservan para compatibilidad/pruebas, pero no constituyen el recorrido de navegación actual. Para una reparación segura controlada, consultar [sandbox local/CI](sandbox/README.md); no se acreditó generación real con Anthropic ni ejecutor cloud operativo. El historial persiste en PostgreSQL; los checkouts de Render son efímeros.

Los secretos se configuran fuera de Git. No publicar DATABASE_URL ni claves en variables VITE_*. Ignorar .env no sustituye la auditoría integral de secretos pendiente en HU-40.

## Hooks de Backend y Base de Datos

El motor `src/hooks/` conecta guardrails reales al parcheador y al commit mediante `hookManager` opcional, con bloqueo previo a la mutación, aprobación registrada y auditoría consultable. Incluye protección de archivos/secretos, evidencia de pruebas para commits y validación de registros antes de persistir. La configuración se conserva en los logs y el adaptador de persistencia permite conectar una BD desde el backend separado del frontend.

**Defensa:** [arquitectura, configuración, eventos y ejemplos reproducibles](src/hooks/README.md). La suite `tests/hooks/hooks.test.mjs` demuestra un parche **ACEPTADO**, parches **BLOQUEADOS** sin modificar archivos ni HEAD, y escrituras de BD válidas/corruptas. Son hooks del motor, independientes de los hooks nativos de Git. La delegación a subagentes está integrada mediante `pre:delegate` y `post:delegate`.

```sh
npm run check
npm test
```

## Subagentes: «Hook + subagente»

`src/subagents/` implementa delegación real mediante **un worker independiente por tarea**, contexto acotado, whitelist por rol, presupuesto y contratos de salida validados. El coordinador delega diagnóstico AST/lint y verificación con Test Runner; consume sus reportes para aplicar un parche propuesto, hacer commit con evidencia confiable o ejecutar rollback por regresión. El rol adicional `patch-safety` permite delegar un preflight de hooks sin conceder escritura Git.

`DelegationStore` conserva quién delegó, objetivo, contexto, herramientas efectivas, identidad del worker, resultado y decisión tomada con ese resultado. Su adaptador DB conserva las trazas, disponibles mediante REST y MCP. Los especialistas son deterministas y no requieren un LLM. La propuesta generativa está disponible en src/agent-client/ mediante un ejecutor MCP separado del coordinador REST.

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

El ciclo autónomo previsto combina análisis AST y lint, contexto acotado para el modelo, ramas `fix/...`, comprobaciones de integridad, comparación de pruebas y commit o rollback por intento. El backend HTTP y el servidor MCP ya conectan los módulos, hooks, workers y persistencia. El flujo coordinado ejecuta diagnóstico → baseline → parche propuesto por el cliente → verificación → commit o rollback. La Fase 6 añade un cliente generativo asistido con estado determinista sobre MCP; el dashboard y los tres servicios están publicados en Render.

El estado de las **43 historias de usuario**, su evidencia y sus bloqueos se mantiene en [`backlog.md`](backlog.md); la UI y los despliegues tienen evidencia cloud; el worker remoto hacia la computadora del usuario y el endurecimiento adicional conservan su estado propio.

## 2. Estado Actual del Proyecto y Métricas de Calidad

La evidencia de calidad vigente está en la cabecera y en el backlog. Se conserva el changelog de fases como historia, sin atribuir sus conteos antiguos al código actual. Los módulos incluyen shared, Git, analyzer, Test Runner, MCP/HTTP, agente, hooks, workers, persistencia e integración IDE; el perfil platform y los microfrontends se validan localmente/en CI.

**Validación integral del backend:**

- CI de integración: 375 pruebas aprobadas en el job general y casos Docker en su job separado; ver desglose y SHAs en la cabecera. Pytest real es obligatorio en el job general de CI.
- Compilación TypeScript estricta correcta y comprobación de tipos mediante `tsc -p tsconfig.json --noEmit` sin errores.
- ESLint sin errores en el código fuente.
- Integración Git comprobada con repositorios temporales reales: ramas, parches, diffs, commits verificados, concurrencia y rollback.
- Pruebas del analizador sobre símbolos, referencias, imports, diagnósticos, límites, almacenamiento y seguridad de rutas.
- Ejecutor de pruebas verificado con ejecutables Jest y pytest: estados, límites de tiempo, cancelación, huellas, comparaciones, evidencia y cierre real del ciclo analizar → parchear → ejecutar → verificar → confirmar.
- HTTP verificado con puertos efímeros, `fetch`, reparaciones reales, regresiones, hooks bloqueados y recuperación del historial al reiniciar. MCP comprobado con clientes oficiales del SDK por HTTP JSON y stdio.

Las pruebas de Git realizan commits exclusivamente dentro de sus repositorios temporales. Los fixtures con errores sintácticos, semánticos o de lint son casos deliberados de prueba, excluidos de la compilación de producción.

## 3. Arquitectura y Árbol de Directorios Actual

El sistema separa servidor MCP, API HTTP, analizador, ejecutor de pruebas, controlador Git y coordinación. `shared/` reúne contratos, errores y seguridad comunes; `db/` conserva auditorías, runs, hooks y delegaciones. Los módulos de dominio no dependen de una conexión con un modelo para ejecutar sus operaciones.

El siguiente diagrama muestra el ciclo disponible desde REST y las herramientas MCP. El cliente generativo propone el parche y un ejecutor TypeScript controla el ciclo MCP. El recorrido REST usa DevGuardianCoordinator y workers; el cliente generativo utiliza las herramientas primitivas y no inicia automáticamente esos workers.

```mermaid
flowchart TD
    A[Cliente HTTP REST o MCP] --> B[Diagnóstico AST y lint]
    B --> C[Contexto de símbolos y pruebas iniciales]
    C --> D[Árbol limpio y validación de HEAD]
    D --> E[Crear rama fix/... y checkpoint del intento]
    E --> F[Recibir parche propuesto y validar rutas y hashes]
    F --> G[Comprobar aplicabilidad y aplicar parche]
    G --> H[Ejecutar pruebas y comparar con baseline]
    H --> I{¿Fallo resuelto sin regresiones?}
    I -->|Sí| J[Validar evidencia y diffHash]
    J --> K[Commit del intento]
    I -->|No| L[Rollback limitado a archivos del intento]
    K --> N[Persistir resultado, tests, hooks y delegaciones]
    L --> N
```

Estructura existente del proyecto; los comentarios describen el propósito de cada archivo:

```text
ProyectoCertiIA/
├── README.md                         # Identificación, arquitectura y avances
├── package.json                      # Dependencias exactas y scripts npm
├── package-lock.json                 # Resolución de dependencias reproducible
├── tsconfig.json                     # TypeScript estricto y salida en dist/
├── .gitignore                        # Exclusiones de compilación, secretos y temporales
├── .env.example                      # Configuración de BD con valores ficticios
├── scripts/
│   ├── copy-db-schema.mjs             # Incluye schema.sql en dist/ al compilar
│   └── verify-database.mjs            # Demo de escritura y recuperación tras reapertura
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
│   ├── test-runner/
│   │   ├── types.ts                  # Ejecuciones, casos, comparación y evidencia
│   │   ├── process.ts                # Ejecución de procesos con timeout y salida acotada
│   │   ├── reports.ts                # Adaptadores de reportes Jest y pytest
│   │   ├── index.ts                  # Fachada, dos handlers y VerificationStore
│   │   └── README.md                 # Ejecución, huellas, comparación y límites detallados
│   ├── hooks/                        # Registro, guardrails, coordinador y documentación
│   ├── subagents/                    # Workers, RPC, especialistas, trazas y coordinador
│   ├── agent-client/
│   │   ├── types.ts                  # Configuración, estados y propuesta Zod
│   │   ├── mcp-bridge.ts             # SDK Client HTTP/stdio, IDs y auditoría
│   │   ├── planner.ts                # ChatAnthropic estructurado y MockChatModel
│   │   ├── orchestrator.ts           # Estado, presupuestos, diff, commit/rollback
│   │   ├── main.ts                   # CLI con configuración JSON y modo mock
│   │   ├── index.ts                  # Exportaciones y factories
│   │   └── README.md                 # Arquitectura, ejecución y límites
│   ├── mcp-server/                   # MCP de compatibilidad aportado por Eduardo, con recurso de análisis
│   ├── mcp/
│   │   ├── server.ts                 # 19 tools, SDK y transporte HTTP JSON sin sesión
│   │   └── index.ts                  # Entrada stdio y exportaciones MCP
│   ├── server/
│   │   ├── contracts.ts              # Esquemas REST, filtros y errores HTTP
│   │   ├── application.ts            # Coordinación, persistencia y runtimes MCP
│   │   ├── http.ts                   # Rutas, CORS, autenticación opcional y límites
│   │   ├── main.ts                   # Arranque HTTP y cierre ordenado
│   │   ├── index.ts                  # Fachada pública del backend
│   │   └── README.md                 # Endpoints, ejemplos curl, MCP y límites
│   └── db/
│       ├── types.ts                  # Contratos de persistencia y esquemas Zod
│       ├── repository.ts             # Integridad y transiciones comunes
│       ├── schema.sql                # Cinco tablas, constraints e índices PostgreSQL
│       ├── migrations.ts             # Migración transaccional con versión y checksum
│       ├── local-adapter.ts          # JSON durable, lock y reemplazo atómico
│       ├── postgres-adapter.ts       # Pool pg y consultas parametrizadas
│       ├── bridges.ts                # Hooks/delegaciones y AuditPersistenceService
│       ├── index.ts                  # Factory local/PostgreSQL y exportaciones
│       └── README.md                 # Modelo ER, integración y evidencia de persistencia
├── tests/
│   ├── shared.test.mjs                # Pruebas de seguridad y contratos
│   ├── git-controller/
│   │   └── controller.test.mjs        # Pruebas con repositorios Git reales
│   ├── analyzer/
│   │   └── analyzer.test.mjs          # Pruebas del analizador y sus recursos
│   ├── test-runner/
│   │   └── runner.test.mjs            # Pruebas, incluidos Jest/pytest reales
│   ├── hooks/hooks.test.mjs           # Pruebas de hooks y auditoría
│   ├── subagents/subagents.test.mjs   # Pruebas de delegación y reparación real
│   ├── db/db.test.mjs                 # Pruebas de persistencia y reinicio
│   ├── mcp-server/server.test.mjs     # Pruebas de discovery, validación y recurso MCP
│   ├── agent-client/agent.test.mjs   # Pruebas de agente, MCP real y proveedor simulado
│   └── server/server.test.mjs         # Pruebas HTTP/MCP con motores y BD reales
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

`dist/` se genera al compilar y `node_modules/` al instalar dependencias; ambos están excluidos de Git. La Fase 5 utiliza `src/mcp/`; el cliente generativo de Fase 6 está en src/agent-client/. El servidor de compatibilidad `src/mcp-server/` aporta el recurso `devguardian://analysis/{analysisId}`; su exposición en el servidor principal de 19 herramientas queda pendiente.

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
- **`index.ts`:** fachada de dominio y siete handlers Git con sobre `Result<T>`. La evidencia se obtiene del `VerificationStore` confiable inyectado por el Test Runner, integrado desde la Fase 4.
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
- **`process.ts`:** ejecución sin shell con lista blanca de variables de entorno, cwd fija en el workspace, timeout por proceso, cancelación explícita y terminación del árbol de procesos (grupo de proceso en POSIX, `taskkill` en Windows). stdout y stderr se capturan por separado con presupuesto `min(maxOutputBytes, 100000)` bytes por flujo y marca `truncated`; un fallo de arranque no produce código de salida.
- **`reports.ts`:** adaptadores de reporte para Jest (`--json --outputFile=`) y pytest (`--json-report --json-report-file=`), que el módulo agrega a la línea de comandos por sí mismo. Las rutas de suite se normalizan a rutas relativas POSIX del workspace; rutas fuera del workspace, inválidas o identificadores duplicados rechazan el reporte.
- **Estados:** `passed` solo para una ejecución completa con código 0, al menos un test aprobado y ningún fallo; `failed` para el resto; `timeout`, `cancelled` o `error` para ejecuciones terminadas, canceladas o sin reporte válido. `complete: false` indica que el resultado no sirve como evidencia.
- **`index.ts`:** fachada con `run_tests` y `compare_test_runs` sobre `Result<T>`, ejecuciones serializadas por instancia, y almacenamiento en memoria de ejecuciones y evidencia con límites de entradas, bytes y TTL. La misma instancia actúa como `VerificationStore` confiable que inyecta `git_commit_fix`.
- **Huellas:** `workspaceStateHash` se captura del proveedor confiable justo antes de la ejecución; `configurationHash` es SHA-256 de la configuración confiable resuelta del runner. Solo se comparan ejecuciones completas con el mismo hash de configuración.
- **Integridad de reportes:** Jest exige numTotalTests igual al número de casos; pytest contrasta total y collected menos deselected. Los reportes parciales y errores de suite/colección no sirven como evidencia.
- **Comparación y ciclo completo:** `compareTestRuns` informa fallos resueltos, fallos nuevos, tests ausentes y veredicto (`regression`, `success`, `inconclusive`). `verify(baselineRunId, candidateRunId)` registra `VerificationEvidence` por `candidateRunId`, lo que permite cerrar el ciclo real analizar → parchear → ejecutar → verificar → confirmar con `git_commit_fix`.
- **Verificación:** 43 pruebas: 41 casos con ejecutables controlados y repositorios temporales, más dos smoke tests que invocan Jest real y pytest real y validan sus reportes JSON mediante el Test Runner. El caso de integración Git utiliza un ejecutor simulado; los smoke tests verifican los adaptadores con procesos reales.

El ejecutor no es un sandbox del sistema operativo: los tests son código arbitrario que se ejecuta con el entorno permitido y conviene correrlos en un checkout dedicado. pytest requiere el plugin `pytest-json-report`. Detalles de ejecución, huellas y límites: [documentación técnica del Test Runner](src/test-runner/README.md).

### Fase 5: API HTTP y Servidor MCP (`src/server/`, `src/mcp/`)

- **REST nativo:** salud, proyectos, ejecución y consulta de auditorías, configuración/logs/evaluación de hooks y trazas de subagentes. CORS configurable, errores tipados, logs sin cuerpos ni credenciales, límites de peticiones y autenticación bearer opcional.
- **Flujo completo:** `POST /api/audits/run` conecta el coordinador real con persistencia; conserva baseline/candidato, hallazgos, checkpoint, decisiones de hooks y delegaciones. La suite comprueba commit, rollback, bloqueo y recuperación tras reiniciar.
- **MCP:** SDK oficial, negociación y descubrimiento de 19 herramientas, esquemas Zod y auditoría durable de llamadas. Transporte stdio y HTTP JSON sin sesión, con clientes oficiales; no incluye SSE ni reanudación de eventos.
- **Compatibilidad estricta:** la biblioteca `DOM` aporta los tipos web que utiliza el SDK; se mantienen `strict`, `exactOptionalPropertyTypes` y `skipLibCheck: false`.
- **Verificación:** 28 pruebas adicionales; 285 en total y diez suites.

### Fase 6: Agent Client generativo asistido (src/agent-client/)

- ChatAnthropic con salida estructurada validada y MockChatModel inyectable; modelo configurable, predeterminado claude-sonnet-4-6. El LLM propone código/diff; no elige IDs, hashes, comandos o decisiones de commit.
- Máquina de estados con baseline fallido obligatorio, máximo de intentos, targets idénticos, verificación, rollback y replanteamiento después de un bloqueo. Las mutaciones de resultado desconocido requieren reconciliación y no se repiten automáticamente.
- SDK MCP HTTP/stdio sobre las 19 herramientas existentes; metadatos aditivos auditId permiten consultar la decisión exacta de hooks. No se introduce una herramienta adicional ni se sustituye el coordinador determinista de REST.
- 28 pruebas nuevas con MCP/Jest/Git reales, mock sin API key, CLI y una llamada de ChatAnthropic con HTTP simulado. La API comercial de Anthropic no se invocó con credenciales reales.
- Guía completa: [Agent Client](src/agent-client/README.md). Inicio compilado: npm run start:agent -- --config agent-config.json; mock: añadir --mock mock-proposals.json. Desarrollo: npm run dev:agent con tsx 4.23.15.

## 5. Contratos de Herramientas MCP Implementadas

Las siguientes **12 herramientas de dominio están publicadas mediante MCP**, con un `projectId` UUID adicional obligatorio en cada llamada. El servidor añade el alias `git_rollback` y seis consultas de hooks, subagentes y BD: **19 herramientas** en total. `tools/list` devuelve los esquemas efectivos.

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
| `run_tests` | `runner: "jest" \| "pytest"`, `targets?: string[]`, `timeoutMs?: number` | `{ runId, runner, status, exitCode, durationMs, summary, cases, stdout, stderr, truncated, complete, startedAt, finishedAt, workspaceStateHash, configurationHash }` | Runners confiables, timeout y salida limitados, rutas confinadas. Solo reportes con totales coherentes pueden ser completos. |
| `compare_test_runs` | `baselineRunId: string`, `candidateRunId: string` | `{ resolvedFailures, newFailures, missingTests, comparable, verdict }` | Compara runs completos y configuraciones idénticas. `newFailures` incluye pruebas antes aprobadas que pasan a skipped/todo; estas transiciones producen `regression`, nunca `success`. |

Los esquemas y tipos completos están definidos en [`src/shared/contracts.ts`](src/shared/contracts.ts). Los métodos de dominio retornan datos tipados y lanzan errores de dominio; las fachadas `.tools` los convierten al sobre `Result<T>`, expuesto en `structuredContent` y texto por MCP. Las raíces, límites y proveedores de evidencia se configuran al inicializar los servicios y no son argumentos elegibles por el modelo. Las seis consultas y el alias están documentados en [el servidor](src/server/README.md#mcp-herramientas-y-transportes).

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
| Ejecutar la suite completa | `npm test` | Compilación previa y suites descubiertas según el commit; ver métricas actuales en la cabecera. El smoke test de pytest requiere Python y su plugin JSON. |
| Iniciar HTTP compilado | `npm start` | Backend en `http://127.0.0.1:3001` por defecto. |
| Compilar e iniciar HTTP | `npm run dev:server` | Compilación inicial y servidor HTTP; reiniciar para incorporar cambios. |
| Iniciar MCP stdio compilado | `node dist/mcp/index.js` | Transporte stdio con stdout reservado al protocolo. |

Para reproducir la validación completa:

```sh
npm run typecheck
npm run lint
npm run build
npm test
```

`npm test` compila de nuevo antes de ejecutar Jest y utiliza el soporte ESM de Node mediante `--experimental-vm-modules`. Esto puede mostrar un aviso de característica experimental sin implicar un fallo de las pruebas. Su timeout base es de 10 segundos por prueba; las suites de integración ajustan sus tiempos para los escenarios correspondientes.

Los scripts `start`, `start:server`, `dev:server` y `start:mcp` ya son funcionales. `start:agent` inicia el cliente generativo de src/agent-client/ y `dev:agent` lo ejecuta con tsx. La validación no requiere una clave de Anthropic: el planificador y el HTTP del proveedor se simulan en CI. Además de los ejecutables controlados de `fixtures/runner/`, la suite incluye smoke tests con Jest y pytest reales y reparaciones HTTP con Jest real. pytest debe estar en el PATH junto con el plugin `pytest-json-report`; si el binario existe pero falta el plugin, la prueba falla.

## API HTTP REST y MCP

El backend admite `PORT` (3001 por defecto), `HOST`, CORS mediante `ALLOWED_ORIGIN` o `CORS_ORIGIN`, raíz de workspace confiable y token bearer opcional. La configuración se pasa al entorno del proceso; Node no carga `.env` automáticamente. Para una copia local del ejemplo: `node --env-file=.env dist/server/main.js` después de compilar.

| Rutas | Función |
|---|---|
| GET `/health`, GET `/api/health` | BD conectada, modo local/PostgreSQL, cinco tablas, versión, uptime y runners. |
| GET/POST `/api/projects` | Consultar y registrar raíces Git permitidas. |
| GET `/api/audits`, GET `/api/audits/:id`, POST `/api/audits/run` | Historial durable y ejecución real del coordinador en modo diagnóstico o reparación con parche explícito. |
| GET `/api/hooks/logs`, GET `/api/hooks/config`, POST `/api/hooks/evaluate` | Decisiones persistidas y demostración de bloqueo sin modificar archivos. |
| GET `/api/subagents/delegations` | Trazas de herramientas, resultados y consumo de cada delegación. |
| POST `/api/mcp` | JSON-RPC MCP: inicialización, `tools/list` y `tools/call`. |

```sh
npm run dev:server
```

Desde otra terminal:

```sh
curl http://127.0.0.1:3001/api/health
curl http://127.0.0.1:3001/api/projects
curl -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' http://127.0.0.1:3001/api/mcp
```

Ejemplos completos de registro, diagnóstico, reparación, hooks bloqueados y llamadas MCP: [documentación de la API](src/server/README.md). En PowerShell usar `curl.exe` o `Invoke-RestMethod`. El historial se recupera después de reiniciar; las sesiones Git activas y análisis por ID continúan en memoria. El estado DB `blocked` se usa también para diagnósticos y herramientas aisladas que no autorizan una reparación completa; `summaryJson.mode` y `outcome` distinguen estos casos.

## Integración Continua (CI)

El workflow [CI](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/actions/workflows/ci.yml), definido en [`.github/workflows/ci.yml`](.github/workflows/ci.yml), se ejecuta con cada push a `main`, `Dev` o `QA` y cada pull request dirigido a esas ramas. Utiliza Ubuntu, Node.js 24.x, caché de npm y Python 3.11. Instala Node con `npm ci` y versiones fijadas de pytest y `pytest-json-report`, configura una identidad Git para los repositorios temporales y ejecuta:

1. `npm run check`: TypeScript estricto sin emitir y ESLint.
2. `npm test`: compilación y las suites del commit, incluidos los smoke tests con Jest y pytest reales, los flujos delegados de commit/rollback, la persistencia con reinicio real de Node y el backend HTTP/MCP y el Agent Client. Los smoke tests invocan `TestRunner`, procesan el JSON real con `reports.ts` y exigen `complete: true`, `status: passed`, código de salida 0 y un caso aprobado.
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

## Base de Datos y Persistencia

`src/db/` implementa cinco tablas de dominio: proyectos, auditorías, ejecuciones de pruebas, decisiones de hooks y delegaciones. Los hallazgos y checkpoints de intentos se conservan en el resumen de la auditoría. Los adaptadores reales `HookPersistenceAdapter` y `DelegationPersistenceAdapter` escriben en el repositorio común; `AuditPersistenceService.repairProject()` conecta el coordinador con ese almacenamiento y guarda baseline, candidato, commit o rollback.

Sin `DATABASE_URL` se utiliza un JSON durable en `./data/devguardian-db.json`, con bloqueo entre procesos y reemplazo atómico. Con `DATABASE_URL` y modo distinto de `local`, la factory usa PostgreSQL con `pg`, consultas parametrizadas, transacciones y migraciones versionadas. `DEVGUARDIAN_DB_MODE=local` permite forzar el modo de desarrollo; para cloud debe cambiarse a `postgres` o eliminarse. Las variables de ejemplo están en [`.env.example`](.env.example), sin credenciales reales; `.env` y los archivos locales documentados están ignorados por Git.

```sh
npm run db:verify
```

El comando crea datos de demostración, cierra y reabre la conexión y muestra sus IDs y recuperación. Se pueden consultar desde otro proceso con `npm run db:verify -- UUID_DE_LA_AUDITORIA`. Las pruebas de DB comprueban además una reparación real con Jest, auditorías de hooks y delegaciones que permanecen intactas al arrancar otro proceso Node.

**Estado de entrega:** PostgreSQL PCAI, API y frontend están publicados. El corte de versión, su CI, el recorrido actual y los límites de reparación están en la cabecera y el backlog. Las pruebas de CI son independientes de credenciales cloud; los ejemplos históricos no acreditan la publicación de los últimos PRs.

Modelo entidad-relación, límites, seguridad, integración y pasos para Render/Supabase/Neon: [documentación de persistencia](src/db/README.md).

## Historial de consolidación de ramas y regresiones

El corte histórico anterior integró origin/main en Dev mediante merge conservando hashes y autoría: MCP de compatibilidad, corrección de rutas Git antes de evaluar árbol sucio, aserciones CRLF exactas y validación CI en QA. El workflow conserva Node/Python, los smoke tests reales y ejecución manual. Tras la consolidación había 257 pruebas en nueve suites: 254 de las ocho originales y tres MCP recibidas de main. La Fase 6 añade 28 casos: 285 en diez suites. El servidor principal sigue siendo src/mcp/ (19 herramientas auditadas y API HTTP); [src/mcp-server/](src/mcp-server/README.md) conserva la interfaz de workspace fijo y el recurso de análisis aportados desde main. El cliente de otras ramas remotas no se incorporó en ese merge. La Fase 6 actual se implementa en src/agent-client/ sobre los contratos MCP con projectId.


### Colores del grafo de arquitectura

En Graph view de la bóveda ProyectoCertiIA se conservan los grupos del cerebro conceptual y se añaden los de arquitectura objetivo: frontend azul, backend naranja, bases de datos verde, infraestructura gris, arquitectura violeta y seguridad roja. Se comprobó visualmente la vista completa después de reiniciar Obsidian. El preset versionable completo está en `specs/segundo-cerebro/grafo-nativo.json`; las preferencias locales de `.obsidian/` no se publican.


## Evaluación integral para la entrega docente

[Informe de auditoría técnica, arquitectura y propuesta comercial](specs/segundo-cerebro/auditoria-integral/00-Informe-Integral.md). Incluye evidencia local, hallazgos abiertos, comparación actual/objetivo, mercado, venta, costos, marketing y protocolo de validación. La documentación no acredita por sí sola comercialización ni migración implementadas.

## Plataforma multitenant local (migración en validación)

### Reparación con ejecución aislada

La consolidación con la recuperación de proyectos conserva `sourceUrl`, el reclonado sin duplicar registros y la invalidación del runtime anterior. Recuperar un workspace no autoriza por sí solo ejecutar pruebas: en servidores públicos sigue siendo obligatorio un sandbox operativo. Las pruebas de reclonado comprueban esta combinación. La integración se prepara en `validate-isolated-repair`; su presencia en esta rama no acredita despliegue en Render.

Se incorporó un [runner Docker opcional](sandbox/README.md) que ejecuta Jest/pytest sobre un snapshot de solo lectura, sin red ni credenciales del host, con límites y reportes estructurados. La imagen se fija por ID SHA-256. En servidores públicos de Render y en el perfil multitenant se exige aislamiento antes de ejecutar pruebas o iniciar reparaciones; la UI consulta `capabilities.isolatedTests` y `requiresIsolation` y mantiene el bloqueo cuando el entorno no está operativo. La integración incluye un job CI separado para verificar commit, rollback, timeout y aislamiento con contenedores reales. Esto no acredita todavía una reparación generativa con Anthropic ni la disponibilidad de un ejecutor Docker en Render.

Se añadió un perfil ejecutable en `src/platform/`: identidad y membresías, gateway autenticado, siete procesos de dominio con bases privadas, RLS en ejecución y agregados, credenciales de servicio firmadas, comandos idempotentes y proyecciones de eventos mediante outbox/inbox. El motor existente conserva la autoridad de Git, pruebas y guardrails. El Agent Client admite tenant y puede usar `createPlatformAgent` con un planificador remoto; la generación real requiere configurar el proveedor.

Para probarlo: `npm run platform:init` una sola vez y `npm run platform:start`. El gateway utiliza `http://127.0.0.1:4107`; el frontend requiere `npm run build:platform` y `npm run preview:platform`. El arranque `npm start` sigue siendo el modo anterior; no migra automáticamente los datos ni activa la nueva arquitectura en Render.

Consultar [instrucciones locales](specs/002-platform-migration/local-development.md), [arquitectura implementada y límites](specs/002-platform-migration/architecture.md) y [validación de la migración](specs/002-platform-migration/validation.md). Las claves y credenciales generadas están en carpetas ignoradas por Git. La migración productiva de datos y el despliegue distribuido permanecen pendientes.
