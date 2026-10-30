# Backlog de DevGuardian

**Equipo:** Six seven — Eduardo Quinteros, Sebhastian Campero y Luis Miguel Gonzales.
**Corte:** 29 de octubre de 2026. Se conservan HU-01 a HU-43 y se añaden HU-44 a HU-51 para los incrementos recientes.

## Estado de versiones y calidad

| Entorno | Versión y evidencia | Qué acredita |
|---|---|---|
| Backend integrado local / PR #5 abierto | [39cb46a](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/commit/39cb46a93b3c750100e09aab93950607aff357da), [CI](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/actions/runs/40942257149) | 19 suites; 375 aprobadas y 5 omitidas en job general. Job Docker: 7 aprobadas, incluidos esos 5 casos y 2 de configuración también presentes en la suite general. No sumar ambos conteos como pruebas únicas |
| Frontend integrado local / PR #1 abierto | [3b06f56](https://github.com/SebhastianCampero-Collab/Frontend/commit/3b06f56e3bf2a213155865760649218c8d3b16d6), [CI](https://github.com/SebhastianCampero-Collab/Frontend/actions/runs/40942339109) | 125 aprobadas en 14 archivos; tipos, lint y builds normal/plataforma |
| Ramas remotas anteriores a la integración | Backend a1ef8fd / frontend b7bd553 | 372 pruebas backend y 123 frontend en sus CI anteriores; no confundir con los PRs nuevos |
| Render existente | [Web](https://proyecto-certificacion-ai-frontend.onrender.com), [health](https://proyecto-certificacion-ai-backend.onrender.com/api/health) | Comprobación 29/10: HTTP 200, PostgreSQL conectado y 5 tablas; Jest disponible y pytest no disponible. El health no informa SHA. No acredita los PRs publicados ni la plataforma distribuida |

Los PRs [backend #5](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/pull/5) y [frontend #1](https://github.com/SebhastianCampero-Collab/Frontend/pull/1) están abiertos y con CI aprobado en este corte. La fusión remota y publicación están pendientes por decisión del usuario. Docker local/CI no implica un ejecutor operativo en Render. No se acreditó generación real con Anthropic; las pruebas de reparación usan propuestas controladas. Los checkouts importados en Render son efímeros; el historial persistido no restaura automáticamente los archivos.

## Estados y seguimiento

- **Completada técnica:** aceptación de implementación cubierta en el entorno indicado; no implica aprobación humana ni despliegue de los últimos cambios.
- **Parcial:** hay implementación/evidencia, pero faltan criterios explícitos.
- **Pendiente:** no se acredita la capacidad o validación requerida.
- Los issues documentan el corte actual o una reconstrucción retrospectiva; no alteran fechas ni autorías originales. Los revisores, responsables y estimaciones se acuerdan con el equipo.

| Estado | Cantidad | HU |
|---|---:|---|
| Completada técnica | 33 | HU-01, HU-02, HU-03, HU-04, HU-05, HU-06, HU-07, HU-08, HU-09, HU-10, HU-11, HU-13, HU-14, HU-15, HU-16, HU-17, HU-20, HU-21, HU-23, HU-25, HU-26, HU-27, HU-28, HU-29, HU-30, HU-31, HU-33, HU-34, HU-35, HU-44, HU-45, HU-46, HU-49 |
| Parcial | 12 | HU-12, HU-18, HU-19, HU-22, HU-24, HU-36, HU-37, HU-38, HU-47, HU-48, HU-50, HU-51 |
| Pendiente | 6 | HU-32, HU-39, HU-40, HU-41, HU-42, HU-43 |
| **Total** | **51** | Conteo de historias; no es porcentaje de esfuerzo ni nota |

HU-36, HU-37 y HU-38 se mantienen parciales para la entrega final: un despliegue histórico no acredita el SHA final ni una nueva demostración punta a punta. HU-25/HU-26 conservan cierre técnico con proveedor simulado; su demostración generativa real permanece explícitamente sin acreditar. No se cambia aceptación solo para aumentar el porcentaje.

La [matriz de trazabilidad](reports/TRAZABILIDAD_FINAL.md) enlaza las 51 historias con código, pruebas, issues y límites. El [registro SDD de esta actualización](https://github.com/LuisMI2005-sudo/DevGuardian-SDD-Obsidian/blob/main/specs/005-final-traceability/spec.md) es retrospectivo para las historias anteriores a Spec Kit. La [bóveda independiente](https://github.com/LuisMI2005-sudo/DevGuardian-SDD-Obsidian) es el segundo cerebro de entrega.

## Dos incrementos finales seleccionados

La selección para la entrega queda definida el 29/10/2026; no implica aceptación del docente ni publicación en Render.

| Incremento | HU principal | Utilidad y diferencia respecto al 20/10 |
|---|---|---|
| INC-01 Gestión segura de organizaciones y accesos | [HU-44 / #49](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/49) | Sesión, membresía, roles y proyectos/auditorías aislados por organización; el modo anterior no tenía el perfil platform con RLS |
| INC-02 Espacio de trabajo modular con microfrontends | [HU-46 / #51](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/issues/51) | Shell y seis remotos con manifiesto y contrato de montaje; el dashboard anterior no tenía src/microfrontends/ |

HU-45 es infraestructura de soporte de INC-01 y HU-31 aporta los paneles de INC-02; no se cuentan como incrementos adicionales. Los seis remotos tampoco se cuentan como seis módulos extra. [Definición y criterios](https://github.com/LuisMI2005-sudo/DevGuardian-SDD-Obsidian/blob/main/specs/006-final-increments/spec.md), [evidencia de antes/después](https://github.com/LuisMI2005-sudo/DevGuardian-SDD-Obsidian/blob/main/specs/006-final-increments/evidence.md) y [guion de demo local](https://github.com/LuisMI2005-sudo/DevGuardian-SDD-Obsidian/blob/main/specs/006-final-increments/demo.md). La base técnica es backend f9438ef y frontend f83d928, ambos del 20/10; si el docente usa otro corte, revisar el contraste.

La implementación y su CI están disponibles. El ensayo manual final y la conformidad académica siguen pendientes; no se cierran por esta definición HU-37, HU-39 ni la revisión humana de HU-47/HU-48.

## Recorrido vigente para demostración

1. **Mis proyectos → Registrar proyecto:** pegar un enlace público de GitHub. Observar eventos reales de importación y compatibilidad. No se instalan scripts ni dependencias del repositorio importado.
2. Seleccionar el proyecto y entrar en **Revisar código**. Elegir un archivo real del selector y las comprobaciones de sintaxis, tipos o calidad; pulsar **Revisar código**. **Consultar archivo** permite elegir un intervalo de líneas sin modificarlo.
3. Consultar **Resultados e historial**: resumen, hallazgos y evidencia. Cero hallazgos significa que las comprobaciones ejecutadas no detectaron defectos; no garantiza corrección funcional. Un diagnóstico no crea commit ni registra necesariamente baseline/candidato.
4. Si la carpeta desapareció, usar **Reclonar Workspace** cuando exista sourceUrl. Conserva el ID del proyecto; recuperar archivos no autoriza reparaciones sin sandbox.
5. Activar **Opciones avanzadas** para consultar **Hooks y guardrails**: políticas activas y Registro de Intercepciones. Es un panel de lectura, no un formulario de ejemplos; actualizar no crea bloqueos ni trazas.
6. En **Trazas de subagentes**, consultar eventos existentes, filtrar por rol y **Exportar traza**. El diagnóstico/repair debe haber generado delegaciones reales. El rol patch-safety existe, pero no todos los flujos REST delegan ese worker.
7. En **MCP y edición JSON**, elegir herramienta, revisar parámetros y usar **Ejecutar petición** solo con intención explícita. Los guardrails del backend continúan activos; las herramientas Git y de pruebas pueden operar realmente. Para enseñar un bloqueo usar un caso controlado/autorizado que no contenga secretos reales.
8. La reparación verificada requiere un sandbox operativo informado por el servidor; no se promete reparación cloud de cualquier repositorio. La [guía Docker](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/blob/39cb46a93b3c750100e09aab93950607aff357da/sandbox/README.md) permite demostrar el flujo controlado local/CI. La activación del asistente IDE es una demostración distinta (HU-51).

No utilizar las instrucciones antiguas «Cargar Demo» o «Probar ALLOW/BLOCK» como recorrido de la UI actual. Que existan componentes o endpoints de compatibilidad no implica que sean controles expuestos en la navegación principal. No se generan barras de progreso ficticias ni eventos simulados para la defensa.

## A. Historias completadas y capacidades existentes

### HU-01 Entorno de desarrollo reproducible

**Como** integrante del equipo, **quiero** instalar y compilar el proyecto con una configuración común **para** trabajar con el mismo entorno y detectar errores temprano.
**Estado:** Completada técnica · **Corte:** 29/10/2026 · **Trazabilidad:** [HU-01](reports/TRAZABILIDAD_FINAL.md#hu-01).

- Node.js 24, ES Modules y TypeScript 6.0.3 con tipado estricto configurados.
- Los scripts de compilación, tipos, lint y pruebas funcionan en el entorno revisado.

### HU-02 Contratos y errores consistentes

**Como** consumidor de las herramientas, **quiero** entradas y respuestas validadas **para** integrar los módulos sin ambigüedades.
**Estado:** Completada técnica · **Corte:** 29/10/2026 · **Trazabilidad:** [HU-02](reports/TRAZABILIDAD_FINAL.md#hu-02).

- Existen contratos Zod para las 12 herramientas previstas.
- Los handlers utilizan `Result<T>` y los errores desconocidos no exponen información interna en la respuesta pública.

### HU-03 Acceso seguro a archivos

**Como** propietario del repositorio, **quiero** restringir el acceso al workspace **para** proteger archivos ajenos y metadatos Git.
**Estado:** Completada técnica · **Corte:** 29/10/2026 · **Trazabilidad:** [HU-03](reports/TRAZABILIDAD_FINAL.md#hu-03).

- Se rechazan traversal, rutas externas y acceso directo a `.git`.
- Se permiten lecturas por symlinks internos; las escrituras rechazan symlinks y múltiples hard links.
- La validación no se presenta como un bloqueo contra procesos externos que ignoren el protocolo.

### HU-04 Lectura acotada de código

**Como** agente auditor, **quiero** leer un intervalo de líneas y su huella **para** obtener contexto preciso y validar futuras modificaciones.
**Estado:** Completada técnica · **Corte:** 29/10/2026 · **Trazabilidad:** [HU-04](reports/TRAZABILIDAD_FINAL.md#hu-04).

- Devuelve texto exacto, rango, SHA-256 del archivo completo y flag `truncated`.
- Controla tamaño y codificación y preserva BOM y saltos de línea.

### HU-05 Contexto de símbolos

**Como** agente auditor, **quiero** localizar el símbolo envolvente de una línea **para** reparar una unidad de código sin enviar el archivo completo al modelo.
**Estado:** Completada técnica · **Corte:** 29/10/2026 · **Trazabilidad:** [HU-05](reports/TRAZABILIDAD_FINAL.md#hu-05).

- Devuelve nombre, firma, rango, fuente, imports y referencias locales del símbolo más específico.
- Las referencias distinguen identidades y nombres sombreados mediante el Type Checker.

### HU-06 Diagnóstico estático

**Como** desarrollador, **quiero** combinar diagnósticos sintácticos, semánticos y de lint **para** identificar errores y su contexto antes de generar un parche.
**Estado:** Completada técnica · **Corte:** 29/10/2026 · **Trazabilidad:** [HU-06](reports/TRAZABILIDAD_FINAL.md#hu-06).

- Produce diagnósticos normalizados, símbolos afectados y dependencias directas.
- La resolución contempla aliases y condiciones ESM/CommonJS sin ejecutar el código analizado.
- Aplica límites y señala recortes; no carga configuración JavaScript de ESLint del proyecto por defecto.

### HU-07 Consulta de análisis guardados

**Como** consumidor del analizador, **quiero** recuperar resultados por `analysisId` **para** consultar un análisis sin recalcularlo.
**Estado:** Completada técnica · **Corte:** 29/10/2026 · **Trazabilidad:** [HU-07](reports/TRAZABILIDAD_FINAL.md#hu-07).

- Existen consultas de resultados y metadatos con copias defensivas.
- Se aplican límites de bytes/entradas, TTL fijo y expulsión LRU. La publicación como recurso MCP corresponde a HU-24.

### HU-08 Rama y checkpoint de reparación

**Como** propietario del código, **quiero** iniciar reparaciones en una rama `fix/...` **para** mantener una referencia verificable del estado original.
**Estado:** Completada técnica · **Corte:** 29/10/2026 · **Trazabilidad:** [HU-08](reports/TRAZABILIDAD_FINAL.md#hu-08).

- Exige árbol limpio y coincidencia de `expectedHead`.
- Registra sesión, intento y checkpoint; coordina operaciones mediante cola y lock para escritores cooperantes.

### HU-09 Aplicación y revisión de parches

**Como** agente reparador, **quiero** aplicar un diff con precondiciones de integridad **para** modificar únicamente los archivos esperados.
**Estado:** Completada técnica · **Corte:** 29/10/2026 · **Trazabilidad:** [HU-09](reports/TRAZABILIDAD_FINAL.md#hu-09).

- Valida rutas, conjunto de hashes esperados y aplicabilidad con `git apply --check`.
- Calcula diff, `diffHash`, archivos e inserciones/eliminaciones sin alterar el staging real durante la preparación.

### HU-10 Rollback limitado al intento

**Como** propietario del repositorio, **quiero** revertir una reparación fallida **para** recuperar el checkpoint conservando trabajo ajeno.
**Estado:** Completada técnica · **Corte:** 29/10/2026 · **Trazabilidad:** [HU-10](reports/TRAZABILIDAD_FINAL.md#hu-10).

- Revierte solo los cambios del intento activo sobre la rama y HEAD verificados.
- Rechaza sobrescribir archivos gestionados que hayan cambiado externamente y conserva archivos y staging ajenos.

### HU-11 Commit condicionado a evidencia

**Como** propietario del código, **quiero** confirmar únicamente una reparación verificada **para** evitar guardar cambios sin pruebas válidas.
**Estado:** Completada técnica · **Corte:** 29/10/2026 · **Trazabilidad:** [HU-11](reports/TRAZABILIDAD_FINAL.md#hu-11).

- Verifica diff esperado, ejecución candidata, baseline, configuración y huellas.
- Comprueba conservación de casos/estados y actualiza la referencia con el HEAD anterior esperado.
- El comparador ya rechaza regresiones passed → skipped/todo y reportes parciales. La integración real añade baseline/candidato y evidencia de Git en repositorios controlados.

### HU-12 Ejecutar pruebas reales de manera controlada

**Como** agente verificador, **quiero** ejecutar Jest y pytest configurados **para** determinar si una reparación funciona bajo límites definidos.
**Estado:** Parcial · **Corte:** 29/10/2026 · **Trazabilidad:** [HU-12](reports/TRAZABILIDAD_FINAL.md#hu-12).

- **Implementado:** ejecución sin shell, timeout, cancelación, salida acotada, adapters y handlers.
- **Verificado:** reportes reales de Jest y pytest, comparación y evidencia Git; el job Docker añade aislamiento y rollback. Los escenarios todavía no cubiertos se conservan en HU-18/HU-19.
- **Para cerrar:** cumplir HU-18 y HU-19. HU-17 ya está cerrada. El éxito real con pytest ya está demostrado; faltan sus escenarios de error y terminación ; la integridad de totales declarados ya tiene regresiones específicas.


**Límite actual:** Faltan criterios integrales de HU-18/HU-19 y endurecimiento; ejecutar no equivale a aislamiento universal.

### HU-13 Comparar ejecuciones sin ocultar regresiones

**Como** agente verificador, **quiero** comparar baseline y candidato **para** distinguir una reparación válida de una regresión o resultado inconcluso.
**Estado:** Completada técnica · **Corte:** 29/10/2026 · **Trazabilidad:** [HU-13](reports/TRAZABILIDAD_FINAL.md#hu-13).

- **Implementado:** detección de fallos resueltos, fallos nuevos, casos ausentes y configuraciones distintas.
- **Cerrado:** HU-16/HU-17 impiden success al omitir una prueba antes aprobada o recibir un reporte parcial.
- **Política:** newFailures incluye pérdida de cobertura aprobada (skipped/todo, incluido pending normalizado); verdict es regression. Los hooks mantienen su protección adicional.

### HU-14 Guardar y recuperar ejecuciones y evidencia

**Como** consumidor del Test Runner, **quiero** recuperar resultados y registrar evidencia por identificador **para** conectar la verificación con Git Controller.
**Estado:** Completada técnica · **Corte:** 29/10/2026 · **Trazabilidad:** [HU-14](reports/TRAZABILIDAD_FINAL.md#hu-14).

- Hay almacenamiento en memoria de runs/evidencia, consulta por ID y caducidad.
- Git Controller puede consumir la instancia como `VerificationStore`.
- El cierre de los presupuestos globales e inmutabilidad adicional queda expresamente en HU-42.

### HU-15 Validar automáticamente los módulos existentes

**Como** integrante del equipo, **quiero** ejecutar las comprobaciones de calidad localmente **para** detectar regresiones antes de integrar cambios.
**Estado:** Completada técnica · **Corte:** 29/10/2026 · **Trazabilidad:** [HU-15](reports/TRAZABILIDAD_FINAL.md#hu-15).

- El corte de calidad actual y sus SHAs están en la cabecera. Los conteos antiguos se consultan en Git; no son el estado de esta entrega.
- Los commits de prueba se limitan a repositorios temporales. HU-21 ya acredita la ejecución automática en GitHub.

## B. Estabilización y seguimiento de Fase 4

### HU-16 Rechazar pruebas aprobadas que pasan a omitidas

**Como** agente verificador, **quiero** detectar que un caso aprobado pasa a `skipped` o `todo` **para** no declarar una reparación exitosa al dejar de ejecutar pruebas.
**Estado:** Completada técnica · **Corte:** 29/10/2026 · **Trazabilidad:** [HU-16](reports/TRAZABILIDAD_FINAL.md#hu-16).

- Agregar el caso reproducido: baseline A fallida/B aprobada; candidato A aprobada/B omitida.
- El comparador no devuelve `success`; el resultado comunica regresión o inconclusión según una política documentada.
- Probar transiciones a `skipped`, `todo`, ausencia y fallo, manteniendo la protección adicional de Git Controller.
- **Evidencia:** tests parametrizados de skipped/todo/pending y casos existentes de ausencia/fallo; compareRuns registra los IDs en newFailures.

### HU-17 Rechazar reportes incompletos o inconsistentes

**Como** consumidor de resultados, **quiero** comprobar la integridad del reporte **para** no aceptar como completa una ejecución parcial.
**Estado:** Completada técnica · **Corte:** 29/10/2026 · **Trazabilidad:** [HU-17](reports/TRAZABILIDAD_FINAL.md#hu-17).

- Un reporte Jest que declara dos tests y entrega una assertion no queda con `complete: true`.
- Validar contadores, estructura y errores de ejecución; definir y probar las invariantes equivalentes de pytest.
- Ningún reporte inconsistente permite registrar evidencia de reparación exitosa.
- **Evidencia:** parsers contrastan numTotalTests de Jest y summary.total/collected-deselected de pytest; tests de discrepancias, datos inválidos, errores de suite/colección y reportes parciales no verificables.

### HU-18 Verificar un flujo de reparación con Jest real

**Como** evaluador, **quiero** observar un fallo real que desaparezca después del parche **para** verificar que el sistema repara código y no solo cambia estados simulados.
**Estado:** Parcial · **Corte:** 29/10/2026 · **Trazabilidad:** [HU-18](reports/TRAZABILIDAD_FINAL.md#hu-18).

- Agregar una integración permanente: Analyzer → Jest real fallido → parche → Jest real aprobado → comparación → evidencia → commit.
- La prueba real lee el archivo modificado; no depende de cambiar `FAKE_MODE`.
- Incluir un caso de regresión real que impida el commit y permita rollback conservando trabajo ajeno.
- **Implementado:** `tests/subagents/subagents.test.mjs` verifica el analizador real, Jest leyendo y ejecutando el archivo TypeScript parcheado, baseline fallido, candidato aprobado, evidencia y commit. Su caso de regresión verifica rollback, contenido restaurado, HEAD preservado y ausencia de commit.
- **Para cerrar:** introducir trabajo ajeno durante ese flujo real y comprobar su conservación tras rollback; actualmente esa garantía tiene pruebas separadas en Git Controller. HU-16/HU-17 ya están cerradas; permanece el criterio de conservación de trabajo ajeno dentro de esa integración real. Evidencia visible: `artifacts/subagents/success.json` y `regression.json`.


**Límite actual:** Falta introducir trabajo ajeno dentro del flujo real de rollback y comprobar su conservación.

### HU-19 Verificar pytest real

**Como** desarrollador de proyectos Python, **quiero** ejecutar pytest con su reporte real **para** utilizar el runner fuera de los fixtures simulados.
**Estado:** Parcial · **Corte:** 29/10/2026 · **Trazabilidad:** [HU-19](reports/TRAZABILIDAD_FINAL.md#hu-19).

- Documentar e instalar en el entorno de pruebas pytest y `pytest-json-report` de forma reproducible.
- Mantener integraciones de éxito, fallo y error de colección con reportes reales y rutas normalizadas.
- Verificar timeout y cancelación sin procesos huérfanos; ejecutar estas integraciones en CI.
- **Implementado:** Python 3.11, `pytest==8.4.2` y `pytest-json-report==1.5.0` en CI; smoke test que invoca pytest real y exige reporte completo y un test aprobado. `DEVGUARDIAN_REQUIRE_PYTEST=1` impide omitirlo en Actions.
- **Para cerrar:** pruebas reales de fallo, colección, timeout y cancelación. Los casos equivalentes con `fake-pytest.mjs` no sustituyen esa cobertura.


**Límite actual:** Faltan fallo, colección, timeout y cancelación con pytest real; los fixtures no sustituyen esos escenarios.

### HU-20 Corregir la documentación de Fase 4

- **Evidencia de cierre:** README raíz, src/db/README.md y src/test-runner/README.md alineados con contratos e inicialización actuales.

**Como** integrante o evaluador, **quiero** instrucciones y contratos que coincidan con el código **para** reproducir el sistema sin adivinar su inicialización.
**Estado:** Completada técnica · **Corte:** 29/10/2026 · **Trazabilidad:** [HU-20](reports/TRAZABILIDAD_FINAL.md#hu-20).

- Sustituir las referencias incorrectas a `process-runner.ts` por `process.ts`.
- Alinear las salidas de `run_tests` y `compare_test_runs` con `src/shared/contracts.ts`.
- Corregir el ejemplo que confunde `Result<T>` con una instancia y conectar Runner/Git Controller con variables válidas.
- Actualizar frases de integración pendiente que quedaron obsoletas y distinguir integración simulada de integración real.

## C. Colaboración e integración continua

### HU-21 Ejecutar validaciones en GitHub Actions

**Como** revisor de un PR, **quiero** comprobaciones automáticas en GitHub **para** integrar cambios con evidencia reproducible.
**Estado:** Completada técnica · **Corte:** 29/10/2026 · **Trazabilidad:** [HU-21](reports/TRAZABILIDAD_FINAL.md#hu-21).

- Agregar workflow en PR/push a las ramas de trabajo/entrega con Node.js 24 e instalación mediante lockfile.
- Ejecutar tipos, lint, compilación y pruebas; preparar Python y su plugin para las integraciones reales correspondientes.
- Mostrar una ejecución verde enlazable y una prueba de que un fallo detiene el pipeline.
- **Evidencia:** los runs actuales de integración están en la cabecera; el historial de Actions conserva fallos y correcciones anteriores.
- Incluye push/PR hacia `main`, `Dev` y `QA`, dispatch, permisos de lectura, caché npm, cancelación de ejecuciones previas, instalación por lockfile, Python/pytest y resumen. `npm test` descubre las suites integradas según el commit; Actions conserva el resultado y SHA del commit entregado.
- HU-36 conserva pendiente el vínculo entre CI y versión final desplegada; HU-38 conserva pendiente la integración autorizada de los PRs y su entrega en main.

### HU-22 Acreditar colaboración y contribuciones del equipo

**Como** docente, **quiero** acceder al repositorio y reconocer el aporte de los tres integrantes **para** evaluar el trabajo grupal e individual.
**Estado:** Parcial · **Corte:** 29/10/2026 · **Trazabilidad:** [HU-22](reports/TRAZABILIDAD_FINAL.md#hu-22).

- Confirmar invitación aceptada del docente y acceso al repositorio correcto.
- Mostrar contribuciones reales de Eduardo, Sebhastian y Luis Miguel con identidad atribuible y PRs o revisiones.
- Vincular las historias a sus entregas y evitar commits vacíos creados solo para aparentar participación.

- **Verificado:** merge `e3c6b8e` con padres `2468ec7` y `b5b2698`; los commits originales de Eduardo se conservan. `git shortlog -sn Dev` muestra a LM, SebhastianCampero-Collab, Eduardo Quinteros y su alias eduardoquinteross. Falta acreditar acceso del docente y las revisiones/entregas del resto de criterios.

## D. Servidor MCP y agente autónomo


**Límite actual:** Autorías acreditadas; falta revisión/acceso del docente y matriz de defensa por integrante.

### HU-23 Publicar las herramientas mediante un servidor MCP

**Como** cliente MCP, **quiero** descubrir e invocar las doce herramientas **para** operar sobre el motor usando el protocolo previsto.
**Estado:** Completada técnica · **Corte:** 29/10/2026 · **Trazabilidad:** [HU-23](reports/TRAZABILIDAD_FINAL.md#hu-23).

- Implementado en `src/mcp/` con SDK, stdio y HTTP JSON sin sesión; esquemas Zod.
- Registrados los doce handlers, alias git_rollback y seis consultas (19 tools); raíz/proveedores confiables y stdout reservado al protocolo.
- Discovery, invocación real, validación, cierre y auditoría probados en tests/server/server.test.mjs con clientes oficiales.

### HU-24 Consultar recursos MCP de proyecto y análisis

**Como** agente conectado, **quiero** consultar configuración, estructura y análisis guardados **para** reutilizar contexto sin repetir herramientas.
**Estado:** Parcial · **Corte:** 29/10/2026 · **Trazabilidad:** [HU-24](reports/TRAZABILIDAD_FINAL.md#hu-24).

- Publicar los recursos previstos de configuración, estructura y `devguardian://analysis/{analysisId}`.
- Validar identificadores y permisos; responder correctamente a análisis desconocidos, expirados o expulsados.
- No exponer secretos ni permitir elegir una raíz externa desde un URI.

- **Integrado desde origin/main:** recurso devguardian://analysis/{analysisId} en src/mcp-server/ y tres pruebas de cliente/recurso. Falta configuración/estructura y exponerlo en src/mcp/ con ámbito de proyecto; no se cierra la HU completa.


**Límite actual:** Recurso de análisis en compatibilidad; faltan recursos completos con ámbito de proyecto en src/mcp/.

### HU-25 Diagnosticar y proponer un parche con IA

**Como** desarrollador, **quiero** que el agente use diagnóstico y contexto acotado **para** proponer una reparación coherente con el error.
**Estado:** Completada técnica · **Corte:** 29/10/2026 · **Trazabilidad:** [HU-25](reports/TRAZABILIDAD_FINAL.md#hu-25).

- Implementar `src/agent-client/` con LangChain y Anthropic, conectado como cliente MCP.
- El agente obtiene diagnóstico/contexto mediante herramientas y genera un parche aplicable con hashes esperados.
- Las credenciales se configuran fuera del repositorio; no se envían archivos completos sin necesidad ni secretos en los prompts/logs.
- **Evidencia de cierre:** `src/agent-client/planner.ts`, `mcp-bridge.ts` y `orchestrator.ts`; pruebas de salida estructurada y llamada Anthropic simulada sin API real. La consulta de los recursos de HU-24 permanece parcialmente pendiente, pero no bloquea la lectura por las herramientas MCP ya publicadas.


**Límite actual:** Implementación probada con proveedor simulado; no se acredita una llamada real a Anthropic.

### HU-26 Orquestar reparación y reintentos acotados

**Como** desarrollador, **quiero** que el agente gestione intentos completos **para** obtener una reparación verificada o una finalización segura.
**Estado:** Completada técnica · **Corte:** 29/10/2026 · **Trazabilidad:** [HU-26](reports/TRAZABILIDAD_FINAL.md#hu-26).

- Ejecutar baseline, rama/checkpoint, parche, pruebas, comparación y commit o rollback mediante MCP.
- Respetar límites de intentos y tratar timeout, cancelación, evidencia inválida y cambios externos sin destruir trabajo ajeno.
- Conservar trazas de decisiones y demostrar tanto éxito como agotamiento seguro de reintentos.
- **Implementado:** `DevGuardianCoordinator.repair()` gestiona diagnóstico delegado, rama/intento, baseline, aplicación del parche, verificación, commit o rollback. Hay trazas y pruebas de regresión, bloqueo y agotamiento del presupuesto de herramientas.
- **Cierre en esta rama:** `src/agent-client/` ejecuta el ciclo mediante el cliente MCP y planificador generativo; `maxAttempts` limita los reintentos de reparación, con rollback comprobado, cancelación, detección de cambios externos y resultados/trazas. Las pruebas cubren éxito, regresión y agotamiento; HU-18 conserva por separado un criterio de integración con trabajo ajeno.


**Límite actual:** Ciclo MCP probado con propuestas controladas; falta demostración generativa real en el entorno elegido.

### HU-27 Ejecutar un hook demostrable

**Como** responsable del entorno, **quiero** una validación disparada por un evento real **para** imponer una política y demostrar su ejecución.
**Estado:** Completada técnica · **Corte:** 29/10/2026 · **Trazabilidad:** [HU-27](reports/TRAZABILIDAD_FINAL.md#hu-27).

- Confirmar qué tipo de hook acepta el docente; no asumir que un pre-commit satisface un criterio orientado a agentes.
- Registrar el hook, su evento y su política, con un caso permitido y otro bloqueado o gestionado.
- Guardar prueba automatizada y log/captura de una invocación real. Deshabilitar hooks Git en el controlador no cumple esta historia.
- **Implementado y probado:** `src/hooks/` registra eventos reales y reglas antes de parchear y confirmar. Las pruebas del motor demuestra cambios permitidos, bloqueo de `.env`, workflows y secretos antes de escribir, commits con evidencia, auditoría, prioridades y fallo cerrado. La integración ocurre dentro de Git Controller y del coordinador; no es solo un hook Git.
- **Evidencia:** `tests/hooks/hooks.test.mjs`, `src/hooks/README.md` y `hookLogs` de los artefactos de subagentes. Existen adaptadores para BD, pero el almacén predeterminado es memoria.
- La demostración técnica está implementada; la interpretación y puntuación final corresponden al docente.


**Límite actual:** Tres reglas del motor; la activación en el asistente se sigue separadamente en HU-51.

### HU-28 Delegar una tarea a un subagente real

**Como** coordinador autónomo, **quiero** delegar diagnóstico o verificación a un subagente **para** separar responsabilidades y utilizar su resultado en la decisión final.
**Estado:** Completada técnica · **Corte:** 29/10/2026 · **Trazabilidad:** [HU-28](reports/TRAZABILIDAD_FINAL.md#hu-28).

- Configurar una delegación con rol, tarea, contexto, herramientas autorizadas y límites propios.
- Demostrar invocación, resultado devuelto y uso efectivo por el coordinador; una función renombrada no basta.
- Conservar trazas y una prueba del tratamiento de fallo o timeout del subagente.
- **Implementado y probado:** `src/subagents/` crea un worker independiente por tarea con rol, objetivo, contexto validado, whitelist, RPC, presupuesto de llamadas y tiempo y reporte propio. El coordinador consume sus resultados para decidir commit, parada o rollback.
- **Evidencia:** Pruebas en `tests/subagents/subagents.test.mjs`, incluida terminación por deadline y limpieza de herramientas, rechazo por permisos/presupuesto, fallo de persistencia, diagnóstico real y reparación/regresión con Jest real. `artifacts/subagents/success.json` y `regression.json` guardan las tres delegaciones, identidades de worker, cinco llamadas efectivas y decisiones de consumo por escenario.
- La demostración técnica está implementada; la interpretación y puntuación final corresponden al docente.

## E. Aplicación web y persistencia

Las historias siguientes agregan adaptadores de aplicación y presentación. Deben conservar separados `shared`, Analyzer, Test Runner, Git Controller, MCP Server y Agent; no introducir interfaz web ni acceso a BD dentro de los analizadores.


**Límite actual:** Tres roles deterministas; el flujo REST no garantiza una delegación patch-safety específica.

### HU-29 Persistir auditorías y resultados

**Como** usuario, **quiero** guardar proyectos, ejecuciones, hallazgos, intentos y resultados de tests **para** consultar el historial después de reiniciar la aplicación.
**Estado:** Completada técnica · **Corte:** 29/10/2026 · **Trazabilidad:** [HU-29](reports/TRAZABILIDAD_FINAL.md#hu-29).

- Definir modelo de datos y migraciones para las entidades mínimas de una auditoría.
- Relacionar identificadores de dominio con registros persistidos sin guardar secretos.
- Probar creación/consulta y conservación del historial tras reinicio; diferenciar el historial de las sesiones Git actualmente en memoria.
- **Implementado:** src/db/ conecta JSON durable/PostgreSQL, cinco entidades, migraciones, hooks y delegaciones; conserva runs, hallazgos y checkpoints.
- **Evidencia:** Las pruebas DB y los flujos HTTP recuperan el mismo historial después de reiniciar. El despliegue cloud corresponde a HU-33; no se reanudan sesiones Git en memoria.

### HU-30 Ofrecer una API de aplicación

- **Evidencia:** src/server/, pruebas HTTP/MCP, importación y recuperación; ver enlaces por HU en la matriz.

**Como** frontend, **quiero** registrar auditorías y consultar su estado/resultados **para** operar con el motor a través de un contrato HTTP definido.
**Estado:** Completada técnica · **Corte:** 29/10/2026 · **Trazabilidad:** [HU-30](reports/TRAZABILIDAD_FINAL.md#hu-30).

- Implementar healthcheck y endpoints de registro, consulta de estado e historial con validación y autenticación/autorización.
- Utilizar proyectos/workspaces registrados, sin aceptar comandos o rutas arbitrarias del navegador.
- Publicar contrato de API, errores y pruebas de integración con persistencia real.

### HU-31 Operar desde un dashboard

**Como** usuario, **quiero** seleccionar un proyecto e iniciar y revisar una auditoría **para** utilizar DevGuardian sin depender de comandos de consola.
**Estado:** Completada técnica · **Corte:** 29/10/2026 · **Trazabilidad:** [HU-31](reports/TRAZABILIDAD_FINAL.md#hu-31).

- Mostrar lista de proyectos/ejecuciones, diagnósticos, estado de tests y cambios propuestos.
- Utilizar la API real y tratar estados pendientes, error y desconexión; no basar la entrega en JSON fijo.
- Mantener la información persistida al recargar y mostrar errores comprensibles sin exponer datos internos.


**Límite actual:** Interfaz real con formularios, paneles y sandbox; no habilita reparación cloud sin ejecutor.

### HU-32 Conectar un worker autorizado con el workspace

**Como** propietario de un repositorio local, **quiero** que un worker autorizado ejecute las tareas solicitadas **para** conectar la aplicación desplegada con el entorno de desarrollo controlado.
**Estado:** Pendiente · **Corte:** 29/10/2026 · **Trazabilidad:** [HU-32](reports/TRAZABILIDAD_FINAL.md#hu-32).

- Definir el canal autenticado entre aplicación y worker y el registro de workspaces permitidos.
- Ejecutar las operaciones del motor mediante MCP y reportar estados/resultados al backend.
- Manejar desconexiones y reintentos sin duplicar commits ni exponer ejecución arbitraria pública en la máquina del usuario.

## F. Despliegue y entrega evaluable


**Límite actual:** Falta worker remoto autenticado; Docker local no conecta por sí solo con la laptop del usuario.

### HU-33 Desplegar la base de datos

**Como** evaluador, **quiero** observar datos persistidos en una base desplegada **para** comprobar que la aplicación utiliza almacenamiento real fuera del entorno de desarrollo.
**Estado:** Completada técnica · **Corte:** 29/10/2026 · **Trazabilidad:** [HU-33](reports/TRAZABILIDAD_FINAL.md#hu-33).

- Aplicar migraciones y conectar el backend mediante secretos de entorno.
- Mostrar un registro creado desde la aplicación y recuperado en otra consulta.
- Documentar la evidencia de conexión sin publicar credenciales ni abrir acceso innecesario a la BD.


**Límite actual:** Health cloud confirmó conexión PostgreSQL y cinco tablas; no acredita la migración multitenant productiva.

### HU-34 Desplegar el backend

**Como** usuario del dashboard, **quiero** una API accesible en un entorno de entrega **para** utilizar las operaciones sin ejecutar el backend en mi computadora.
**Estado:** Completada técnica · **Corte:** 29/10/2026 · **Trazabilidad:** [HU-34](reports/TRAZABILIDAD_FINAL.md#hu-34).

- Publicar URL HTTPS, healthcheck y configuración de entorno segura.
- Comprobar una operación con BD y el manejo de errores y logs en ese entorno.
- Documentar cómo el worker local se conecta; no confundir backend web desplegado con servidor MCP stdio local.


**Límite actual:** API publicada; health no informa el SHA desplegado.

### HU-35 Desplegar el frontend

**Como** usuario, **quiero** abrir el dashboard mediante una URL pública de entrega **para** utilizar el sistema desde un navegador.
**Estado:** Completada técnica · **Corte:** 29/10/2026 · **Trazabilidad:** [HU-35](reports/TRAZABILIDAD_FINAL.md#hu-35).

- Publicar URL HTTPS y configurar el endpoint real del backend sin secretos de servidor en el cliente.
- Verificar navegación, carga de datos, autenticación y mensajes de error en el entorno desplegado.
- Enlazar la URL y las instrucciones de acceso para el docente.


**Límite actual:** Web accesible; el último PR todavía no acredita publicación.

### HU-36 Desplegar desde el pipeline

**Como** responsable de entrega, **quiero** desplegar automáticamente una versión validada **para** demostrar CI/CD y reducir errores manuales.
**Estado:** Parcial · **Corte:** 29/10/2026 · **Trazabilidad:** [HU-36](reports/TRAZABILIDAD_FINAL.md#hu-36).

- Desplegar desde la rama de entrega solo tras validaciones satisfactorias, utilizando secretos del entorno de CI.
- Ejecutar un smoke test contra los servicios desplegados y conservar enlace al run y versión entregada.
- Documentar recuperación de una entrega fallida y demostrar que pruebas fallidas impiden desplegar.


**Límite actual:** Falta vincular SHA de la entrega final con Render y comprobar bloqueo del deploy por CI fallido.

### HU-37 Demostrar conexión de punta a punta

**Como** docente, **quiero** iniciar una operación desde frontend y ver su resultado persistido **para** comprobar la integración de las tres partes con el motor.
**Estado:** Parcial · **Corte:** 29/10/2026 · **Trazabilidad:** [HU-37](reports/TRAZABILIDAD_FINAL.md#hu-37).

- Mostrar frontend → backend → worker/motor → BD → resultado actualizado en frontend, con identificador trazable.
- Recuperar el historial tras recargar la página y demostrar una respuesta de error real.
- Para afirmar reparación autónoma completa, incluir además HU-26; no presentar una llamada directa de dominio como una conexión MCP.


**Límite actual:** Existe evidencia histórica; falta repetir punta a punta sobre la versión final y registrar identificadores.

### HU-38 Consolidar y documentar la versión de entrega

**Como** docente, **quiero** encontrar en `main` una versión coherente y reproducible **para** revisar el avance sin buscar commits en otras ramas.
**Estado:** Parcial · **Corte:** 29/10/2026 · **Trazabilidad:** [HU-38](reports/TRAZABILIDAD_FINAL.md#hu-38).

- Integrar `Dev` en `main` mediante merge preservando autoría, según autorización del equipo, manteniendo pruebas en verde y resolviendo diferencias de nombres de ramas.
- Actualizar README con URLs, versiones, variables de ejemplo sin secretos, comandos y demo verificable.
- Enlazar commits/PRs, runs y evidencia de cada criterio; no declarar completas historias que sigan sin demostración.


**Límite actual:** PRs de integración abiertos; falta fusión autorizada y versión final en main, conforme al criterio de la HU.

### HU-39 Preparar la defensa grupal e individual

**Como** integrante del equipo, **quiero** explicar y demostrar mi aporte **para** defender el proyecto y mi evaluación individual.
**Estado:** Pendiente · **Corte:** 29/10/2026 · **Trazabilidad:** [HU-39](reports/TRAZABILIDAD_FINAL.md#hu-39).

- Cada integrante explica un módulo, una decisión de seguridad y un fallo con su solución o límite.
- Reproducir demo de éxito y de regresión/rollback, más hook, subagente, pipeline y persistencia.
- Preparar evidencia según la planilla final: no establece aquí una fórmula 60/40 ni un tope automático de 50. La escala y calificación corresponden al docente.


**Límite actual:** Ensayo y defensa individuales no ejecutados; no se infiere nota por commits.

### HU-40 Revisar secretos y permisos de entrega

**Como** propietario del proyecto, **quiero** comprobar que código y despliegues no exponen secretos **para** entregar el sistema sin filtrar credenciales ni permisos de ejecución.
**Estado:** Pendiente · **Corte:** 29/10/2026 · **Trazabilidad:** [HU-40](reports/TRAZABILIDAD_FINAL.md#hu-40).

- Revisar archivos versionados, historial y logs con herramientas apropiadas; ignorar `.env` no basta para demostrar ausencia de secretos previos.
- Mantener solo ejemplos sin valores reales, secretos en el hosting/CI y permisos mínimos del worker.
- Si se encuentra una credencial expuesta, revocarla/rotarla y resolver su exposición antes de la entrega.

## G. Endurecimiento adicional del Test Runner


**Límite actual:** Pendiente auditoría de historial, artefactos, logs y permisos; .gitignore no prueba ausencia integral de secretos.

### HU-41 Validar el estado y configuración efectivos de una ejecución

**Como** consumidor de evidencia, **quiero** identificar el estado y parámetros realmente utilizados **para** comparar pruebas reproducibles.
**Estado:** Pendiente · **Corte:** 29/10/2026 · **Trazabilidad:** [HU-41](reports/TRAZABILIDAD_FINAL.md#hu-41).

- Comprobar la huella antes y después de ejecutar y definir la coordinación con escritores Git durante el run.
- Definir qué targets, argumentos y variables relevantes integran la huella de configuración, sin exponer sus valores sensibles.
- Cubrir cambios de workspace/configuración y demostrar que no producen evidencia aceptada indebidamente.


**Límite actual:** Hay hashes y fingerprint de imagen; faltan todas las invariantes de estado/configuración durante el run.

### HU-42 Respetar el presupuesto total y proteger la evidencia

**Como** operador del servicio, **quiero** almacenar resultados y evidencia dentro de un presupuesto global **para** mantener el proceso estable y evitar mutaciones externas.
**Estado:** Pendiente · **Corte:** 29/10/2026 · **Trazabilidad:** [HU-42](reports/TRAZABILIDAD_FINAL.md#hu-42).

- Contabilizar también las copias de evidencia dentro de los límites de bytes y probar TTL/expulsión de ambos almacenes.
- Mutar el objeto devuelto por `verify()` no cambia el registro que luego devuelve `getEvidence()`.
- Leer reportes con límite antes de cargar todo su contenido y limpiar temporales en todos los caminos de error.


**Límite actual:** Hay límite de reporte; faltan presupuesto global de evidencia y todos los caminos de limpieza/inmutabilidad.

### HU-43 Garantizar terminación ante timeout y cancelación

**Como** operador, **quiero** que un runner y sus descendientes terminen bajo una cancelación **para** recuperar los recursos incluso cuando falla el mecanismo principal de cierre.
**Estado:** Pendiente · **Corte:** 29/10/2026 · **Trazabilidad:** [HU-43](reports/TRAZABILIDAD_FINAL.md#hu-43).

- En Windows, acotar `taskkill`, verificar su código de salida y probar el fallback; probar grupos de procesos en POSIX.
- Cubrir procesos descendientes y fallos del mecanismo de terminación sin que la promesa quede pendiente indefinidamente.
- Preservar los estados `timeout`/`cancelled` y la recuperación de la cola para la siguiente ejecución.


**Límite actual:** Docker prueba timeout y destrucción; falta toda la cobertura de taskkill/fallback y descendientes del host.


## H. Incrementos incorporados después del backlog original

Estas HU se registran el 29/10/2026. Describen implementación o aceptación pendiente; no acreditan que fueran planificadas con esos IDs antes del código.

### HU-44 Aislar usuarios y proyectos por organización

**Como** usuario de una organización, **quiero** trabajar con una sesión y membresía verificadas **para** impedir acceso a proyectos y evidencias de otra organización.
**Estado:** Completada técnica · **Corte:** 29/10/2026 · **Trazabilidad:** [HU-44](reports/TRAZABILIDAD_FINAL.md#hu-44).

- **Aceptación:** Autenticación, RLS y roles runtime sin bypass comprobados con dos tenants en PostgreSQL real. El alcance de cierre es local/CI.
- **Límite actual:** Aceptación local/CI; no se acredita migración de datos ni multitenancy en producción.

### HU-45 Ejecutar servicios de dominio con bases privadas

**Como** operador, **quiero** separar identidad, proyectos, auditorías, ejecución, políticas, telemetría y planificador **para** respetar límites y contratos entre dominios.
**Estado:** Completada técnica · **Corte:** 29/10/2026 · **Trazabilidad:** [HU-45](reports/TRAZABILIDAD_FINAL.md#hu-45).

- **Aceptación:** Siete procesos y gateway con configuración validada, firmas por audiencia, idempotencia y proyecciones outbox/inbox. No incluye despliegue distribuido ni administración de políticas por organización.
- **Límite actual:** Procesos, bases privadas y contratos locales; despliegue distribuido pendiente, políticas por tenant no incluidas.

### HU-46 Componer Shell y seis microfrontends

**Como** usuario, **quiero** navegar entre módulos con una sesión coherente **para** usar funcionalidades separadas sin perder contexto de organización.
**Estado:** Completada técnica · **Corte:** 29/10/2026 · **Trazabilidad:** [HU-46](reports/TRAZABILIDAD_FINAL.md#hu-46).

- **Aceptación:** Contratos mount/update/unmount, limpieza al cambiar contexto y builds de Shell/remotos comprobados. El alcance de cierre es local/CI, no hosting independiente de cada remoto.
- **Límite actual:** Shell y seis remotos con build local/CI; no se acreditan seis despliegues productivos independientes.

### HU-47 Mantener especificaciones y trazabilidad SDD

**Como** integrante del equipo, **quiero** utilizar constitución, especificación, plan y tareas **para** relacionar requisitos con cambios y evidencia.
**Estado:** Parcial · **Corte:** 29/10/2026 · **Trazabilidad:** [HU-47](reports/TRAZABILIDAD_FINAL.md#hu-47).

- **Aceptación:** Spec Kit, plantillas y verificadores configurados. Regularizar trazabilidad anterior como retrospectiva y obtener revisión humana de la constitución.
- **Límite actual:** Configuración y verificadores listos; falta revisión de constitución y aceptación por el equipo.

### HU-48 Navegar el segundo cerebro independiente en Obsidian

**Como** evaluador, **quiero** consultar notas enlazadas, Mermaid, Canvas y grafos por categoría **para** entender arquitectura, decisiones y evidencia.
**Estado:** Parcial · **Corte:** 29/10/2026 · **Trazabilidad:** [HU-48](reports/TRAZABILIDAD_FINAL.md#hu-48).

- **Aceptación:** Repositorio público separado y verificador de enlaces/configuración. Falta revisión visual del equipo y demostración del recorrido.
- **Límite actual:** Estructura y enlaces comprobados; falta revisión visual del equipo y ensayo de navegación para defensa.

### HU-49 Importar y recuperar un repositorio GitHub

**Como** usuario, **quiero** importar un enlace y recuperar un workspace desaparecido sin duplicar el proyecto **para** continuar la revisión con archivos reales.
**Estado:** Completada técnica · **Corte:** 29/10/2026 · **Trazabilidad:** [HU-49](reports/TRAZABILIDAD_FINAL.md#hu-49).

- **Aceptación:** Importación con eventos SSE y validación estructural sin instalar scripts externos. Reclonado desde sourceUrl, ID conservado y runtime invalidado; recuperación no autoriza reparación sin sandbox.
- **Límite actual:** Importa sin instalar dependencias; reclona conservando ID. El checkout cloud sigue siendo efímero.

### HU-50 Verificar reparaciones de proyectos externos en sandbox

**Como** propietario de código, **quiero** ejecutar baseline y candidato en un contenedor restringido **para** evitar acceso del código externo al host y a credenciales.
**Estado:** Parcial · **Corte:** 29/10/2026 · **Trazabilidad:** [HU-50](reports/TRAZABILIDAD_FINAL.md#hu-50).

- **Aceptación:** Imagen por SHA-256, snapshot de solo lectura, red deshabilitada, usuario sin privilegios, límites, commit y rollback probados con Jest/pytest reales. Falta infraestructura cloud autorizada.
- **Límite actual:** Siete pruebas Docker aprobadas en CI; falta ejecutor cloud y publicación de los PRs. No es una reparación generativa real.

### HU-51 Aplicar hooks y especialistas al asistente de desarrollo

**Como** desarrollador, **quiero** interceptar ediciones y comandos del asistente **para** aplicar políticas y conservar evidencia de verificaciones.
**Estado:** Parcial · **Corte:** 29/10/2026 · **Trazabilidad:** [HU-51](reports/TRAZABILIDAD_FINAL.md#hu-51).

- **Aceptación:** Adaptador IDE, siete registros de handlers y cuatro perfiles configurados. Probar activación nativa y flujo real; los perfiles no son los tres workers deterministas del motor.
- **Límite actual:** Adaptador y cuatro perfiles probados; falta evidencia de activación y una sesión real del asistente.


## Prioridades del cierre

1. Revisar y aceptar esta trazabilidad con el equipo; asignar responsables en los issues sin inventar participación.
2. Autorizar la integración/publicación final de HU-38 cuando corresponda; identificar el SHA realmente desplegado y repetir HU-36/HU-37.
3. Decidir el entorno de demostración de HU-50 y de generación real HU-25/HU-26 sin desactivar seguridad.
4. Completar revisiones humanas SDD/Obsidian (HU-47/HU-48), defensa HU-39 y auditoría integral HU-40.
5. Mantener visibles los criterios abiertos de recursos MCP y robustez de pruebas; Docker no cierra automáticamente HU-19 ni HU-41 a HU-43.

## Definición de terminado

Una HU se cierra técnicamente cuando cumple su aceptación en el entorno especificado, tiene evidencia aplicable y límites documentados. Las HU de entrega exigen evidencia de la versión publicada. Un issue cerrado no acredita aprobación del docente ni una revisión humana. No se infieren ventas ni activación de perfiles del asistente por tener archivos de configuración. La planilla final no establece una fórmula 60/40 ni un tope automático de 50.

## Fuentes y evidencia

- [Matriz completa](reports/TRAZABILIDAD_FINAL.md).
- [Especificación](https://github.com/LuisMI2005-sudo/DevGuardian-SDD-Obsidian/blob/main/specs/005-final-traceability/spec.md), [plan](https://github.com/LuisMI2005-sudo/DevGuardian-SDD-Obsidian/blob/main/specs/005-final-traceability/plan.md) y [tareas](https://github.com/LuisMI2005-sudo/DevGuardian-SDD-Obsidian/blob/main/specs/005-final-traceability/tasks.md) de esta actualización.
- [CI backend integrado](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/actions/runs/40942257149) y [CI frontend integrado](https://github.com/SebhastianCampero-Collab/Frontend/actions/runs/40942339109).
- [Consolidación y límites](https://github.com/LuisMI2005-sudo/DevGuardian-SDD-Obsidian/blob/main/specs/004-safe-repair-deployment/consolidation.md).
- [Código y comandos del backend](README.md), [Test Runner](src/test-runner/README.md), [hooks](src/hooks/README.md), [workers](src/subagents/README.md) e [integración IDE](src/ide-integration/README.md).

Los resultados históricos se conservan en Git y en sus documentos fechados; esta cabecera y sus SHAs constituyen el corte vigente. El backlog canónico está en el repositorio backend; la bóveda documental contiene una copia identificada para navegación del docente.
