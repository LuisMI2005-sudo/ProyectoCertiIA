# Backlog de DevGuardian

**Proyecto:** DevGuardian — Sistema de Auditoría y Rectificación Autónoma de Código Asistido por IA  
**Equipo:** Six seven — Eduardo Quinteros, Sebhastian Campero y Luis Miguel Gonzales  
**Rama de trabajo:** `Dev`  
**Fecha de actualización:** 19 de octubre de 2026  
**Base revisada:** commit `27e997a`, implementación de las fases 1–4 y revisión de la planilla del segundo parcial.

Este backlog convierte el avance y las brechas del proyecto en historias de usuario. Incluye tanto el producto autónomo previsto como la aplicación web, persistencia y evidencias que exige la evaluación. No registra implementaciones futuras como terminadas ni asigna responsables o fechas sin acuerdo del equipo.

## Cómo utilizar el backlog

- **Completada:** la capacidad descrita está implementada y tiene evidencia en las pruebas o en la revisión. No implica que todo el producto esté desplegado.
- **Parcial:** existe una implementación, pero quedan defectos o validaciones necesarios para cumplir íntegramente la historia.
- **Pendiente:** no existe evidencia suficiente de implementación o entrega. En accesos y despliegues significa que falta verificarla, no necesariamente que no exista fuera del repositorio.
- **P0:** requisito de defensa, corrección de un resultado incorrecto o entrega directamente necesaria para la rúbrica.
- **P1:** capacidad central del producto o dependencia técnica para una entrega P0.
- **P2:** mejora posterior a la entrega mínima. La prioridad no permite omitir dependencias.

Los criterios de las historias completadas describen el comportamiento existente. Los de las historias parciales y pendientes definen qué demostrar antes de cerrarlas. Las historias **HU-16 en adelante son trabajo pendiente**, aunque una parte tenga una base implementada.

| Estado | Cantidad | Alcance |
|---|---:|---|
| Completada | 13 | Base técnica, análisis, operaciones Git y capacidades acotadas de almacenamiento/calidad. |
| Parcial | 2 | Ejecución e integración real de pruebas y comparación sin regresiones. |
| Pendiente | 28 | Correcciones, MCP, agente, aplicación web, despliegues y evidencias de evaluación. |
| **Total** | **43** | **El número de historias no equivale a porcentaje de nota o avance ponderado.** |

**Calidad comprobada en la revisión previa:** 132 pruebas aprobadas, 0 fallos, compilación TypeScript y lint correctos. Distribución: shared 30, Git Controller 35, Analyzer 44 y Test Runner 23. Los casos adicionales de revisión que revelan brechas todavía deben incorporarse como pruebas permanentes.

## A. Historias completadas y capacidades existentes

### HU-01 Entorno de desarrollo reproducible

**Como** integrante del equipo, **quiero** instalar y compilar el proyecto con una configuración común **para** trabajar con el mismo entorno y detectar errores temprano.  
**Estado:** Completada · **Fase:** 1 · **Evidencia:** `package.json`, `package-lock.json`, `tsconfig.json`.

- Node.js 24, ES Modules y TypeScript 6.0.3 con tipado estricto configurados.
- Los scripts de compilación, tipos, lint y pruebas funcionan en el entorno revisado.

### HU-02 Contratos y errores consistentes

**Como** consumidor de las herramientas, **quiero** entradas y respuestas validadas **para** integrar los módulos sin ambigüedades.  
**Estado:** Completada · **Fase:** 1 · **Evidencia:** `src/shared/contracts.ts`, `src/shared/errors.ts`.

- Existen contratos Zod para las 12 herramientas previstas.
- Los handlers utilizan `Result<T>` y los errores desconocidos no exponen información interna en la respuesta pública.

### HU-03 Acceso seguro a archivos

**Como** propietario del repositorio, **quiero** restringir el acceso al workspace **para** proteger archivos ajenos y metadatos Git.  
**Estado:** Completada · **Fase:** 1 · **Evidencia:** `src/shared/path-security.ts`, `tests/shared.test.mjs`.

- Se rechazan traversal, rutas externas y acceso directo a `.git`.
- Se permiten lecturas por symlinks internos; las escrituras rechazan symlinks y múltiples hard links.
- La validación no se presenta como un bloqueo contra procesos externos que ignoren el protocolo.

### HU-04 Lectura acotada de código

**Como** agente auditor, **quiero** leer un intervalo de líneas y su huella **para** obtener contexto preciso y validar futuras modificaciones.  
**Estado:** Completada · **Fase:** 3 · **Evidencia:** `read_file_context` en `src/analyzer/`.

- Devuelve texto exacto, rango, SHA-256 del archivo completo y flag `truncated`.
- Controla tamaño y codificación y preserva BOM y saltos de línea.

### HU-05 Contexto de símbolos

**Como** agente auditor, **quiero** localizar el símbolo envolvente de una línea **para** reparar una unidad de código sin enviar el archivo completo al modelo.  
**Estado:** Completada · **Fase:** 3 · **Evidencia:** `get_symbol_context` y fixtures de símbolos.

- Devuelve nombre, firma, rango, fuente, imports y referencias locales del símbolo más específico.
- Las referencias distinguen identidades y nombres sombreados mediante el Type Checker.

### HU-06 Diagnóstico estático

**Como** desarrollador, **quiero** combinar diagnósticos sintácticos, semánticos y de lint **para** identificar errores y su contexto antes de generar un parche.  
**Estado:** Completada · **Fase:** 3 · **Evidencia:** `analyze_code`, `ast-analyzer.ts`, `eslint-analyzer.ts`.

- Produce diagnósticos normalizados, símbolos afectados y dependencias directas.
- La resolución contempla aliases y condiciones ESM/CommonJS sin ejecutar el código analizado.
- Aplica límites y señala recortes; no carga configuración JavaScript de ESLint del proyecto por defecto.

### HU-07 Consulta de análisis guardados

**Como** consumidor del analizador, **quiero** recuperar resultados por `analysisId` **para** consultar un análisis sin recalcularlo.  
**Estado:** Completada · **Fase:** 3 · **Evidencia:** almacenamiento de `src/analyzer/index.ts`.

- Existen consultas de resultados y metadatos con copias defensivas.
- Se aplican límites de bytes/entradas, TTL fijo y expulsión LRU. La publicación como recurso MCP corresponde a HU-24.

### HU-08 Rama y checkpoint de reparación

**Como** propietario del código, **quiero** iniciar reparaciones en una rama `fix/...` **para** mantener una referencia verificable del estado original.  
**Estado:** Completada · **Fase:** 2 · **Evidencia:** `src/git-controller/repository.ts`.

- Exige árbol limpio y coincidencia de `expectedHead`.
- Registra sesión, intento y checkpoint; coordina operaciones mediante cola y lock para escritores cooperantes.

### HU-09 Aplicación y revisión de parches

**Como** agente reparador, **quiero** aplicar un diff con precondiciones de integridad **para** modificar únicamente los archivos esperados.  
**Estado:** Completada · **Fase:** 2 · **Evidencia:** `git_apply_patch`, `git_diff`.

- Valida rutas, conjunto de hashes esperados y aplicabilidad con `git apply --check`.
- Calcula diff, `diffHash`, archivos e inserciones/eliminaciones sin alterar el staging real durante la preparación.

### HU-10 Rollback limitado al intento

**Como** propietario del repositorio, **quiero** revertir una reparación fallida **para** recuperar el checkpoint conservando trabajo ajeno.  
**Estado:** Completada · **Fase:** 2 · **Evidencia:** `git_rollback_attempt` y pruebas Git.

- Revierte solo los cambios del intento activo sobre la rama y HEAD verificados.
- Rechaza sobrescribir archivos gestionados que hayan cambiado externamente y conserva archivos y staging ajenos.

### HU-11 Commit condicionado a evidencia

**Como** propietario del código, **quiero** confirmar únicamente una reparación verificada **para** evitar guardar cambios sin pruebas válidas.  
**Estado:** Completada · **Fase:** 2 · **Evidencia:** `git_commit_fix`.

- Verifica diff esperado, ejecución candidata, baseline, configuración y huellas.
- Comprueba conservación de casos/estados y actualiza la referencia con el HEAD anterior esperado.
- La aceptación de evidencia del controlador no sustituye las correcciones pendientes del comparador ni la integración real del producto.

### HU-12 Ejecutar pruebas reales de manera controlada

**Como** agente verificador, **quiero** ejecutar Jest y pytest configurados **para** determinar si una reparación funciona bajo límites definidos.  
**Estado:** Parcial · **Fase:** 4 · **Evidencia:** `src/test-runner/process.ts`, `reports.ts`, `index.ts`.

- **Implementado:** ejecución sin shell, timeout, cancelación, salida acotada, adapters y handlers.
- **Verificado:** 23 pruebas con ejecutables simulados; smoke test adicional satisfactorio con Jest real.
- **Para cerrar:** cumplir HU-17, HU-18 y HU-19; demostrar también pytest real y conservar las integraciones en la suite.

### HU-13 Comparar ejecuciones sin ocultar regresiones

**Como** agente verificador, **quiero** comparar baseline y candidato **para** distinguir una reparación válida de una regresión o resultado inconcluso.  
**Estado:** Parcial · **Fase:** 4 · **Evidencia:** `compare_test_runs` y `verify()`.

- **Implementado:** detección de fallos resueltos, fallos nuevos, casos ausentes y configuraciones distintas.
- **Para cerrar:** cumplir HU-16 y HU-17 y demostrar que una prueba antes aprobada no puede omitirse para obtener `success`.

### HU-14 Guardar y recuperar ejecuciones y evidencia

**Como** consumidor del Test Runner, **quiero** recuperar resultados y registrar evidencia por identificador **para** conectar la verificación con Git Controller.  
**Estado:** Completada, con alcance de capacidad básica · **Fase:** 4 · **Evidencia:** `getRun()`, `verify()`, `getEvidence()`.

- Hay almacenamiento en memoria de runs/evidencia, consulta por ID y caducidad.
- Git Controller puede consumir la instancia como `VerificationStore`.
- El cierre de los presupuestos globales e inmutabilidad adicional queda expresamente en HU-42.

### HU-15 Validar automáticamente los módulos existentes

**Como** integrante del equipo, **quiero** ejecutar las comprobaciones de calidad localmente **para** detectar regresiones antes de integrar cambios.  
**Estado:** Completada · **Fases:** 1–4 · **Evidencia:** cuatro suites y scripts npm.

- En la revisión del 19 de octubre pasaron 132 pruebas, compilación, tipos y lint.
- Los commits de prueba se limitan a repositorios temporales. La ejecución automática en GitHub todavía requiere HU-21.

## B. Correcciones y pruebas pendientes de Fase 4

### HU-16 Rechazar pruebas aprobadas que pasan a omitidas

**Como** agente verificador, **quiero** detectar que un caso aprobado pasa a `skipped` o `todo` **para** no declarar una reparación exitosa al dejar de ejecutar pruebas.  
**Estado:** Pendiente · **Prioridad:** P0 · **Depende de:** HU-13.

- Agregar el caso reproducido: baseline A fallida/B aprobada; candidato A aprobada/B omitida.
- El comparador no devuelve `success`; el resultado comunica regresión o inconclusión según una política documentada.
- Probar transiciones a `skipped`, `todo`, ausencia y fallo, manteniendo la protección adicional de Git Controller.

### HU-17 Rechazar reportes incompletos o inconsistentes

**Como** consumidor de resultados, **quiero** comprobar la integridad del reporte **para** no aceptar como completa una ejecución parcial.  
**Estado:** Pendiente · **Prioridad:** P0 · **Depende de:** HU-12, HU-13.

- Un reporte Jest que declara dos tests y entrega una assertion no queda con `complete: true`.
- Validar contadores, estructura y errores de ejecución; definir y probar las invariantes equivalentes de pytest.
- Ningún reporte inconsistente permite registrar evidencia de reparación exitosa.

### HU-18 Verificar un flujo de reparación con Jest real

**Como** evaluador, **quiero** observar un fallo real que desaparezca después del parche **para** verificar que el sistema repara código y no solo cambia estados simulados.  
**Estado:** Pendiente · **Prioridad:** P0 · **Depende de:** HU-09, HU-11, HU-16, HU-17.

- Agregar una integración permanente: Analyzer → Jest real fallido → parche → Jest real aprobado → comparación → evidencia → commit.
- La prueba real lee el archivo modificado; no depende de cambiar `FAKE_MODE`.
- Incluir un caso de regresión real que impida el commit y permita rollback conservando trabajo ajeno.

### HU-19 Verificar pytest real

**Como** desarrollador de proyectos Python, **quiero** ejecutar pytest con su reporte real **para** utilizar el runner fuera de los fixtures simulados.  
**Estado:** Pendiente · **Prioridad:** P1 · **Depende de:** HU-12, HU-17.

- Documentar e instalar en el entorno de pruebas pytest y `pytest-json-report` de forma reproducible.
- Mantener integraciones de éxito, fallo y error de colección con reportes reales y rutas normalizadas.
- Verificar timeout y cancelación sin procesos huérfanos; ejecutar estas integraciones en CI.

### HU-20 Corregir la documentación de Fase 4

**Como** integrante o evaluador, **quiero** instrucciones y contratos que coincidan con el código **para** reproducir el sistema sin adivinar su inicialización.  
**Estado:** Pendiente · **Prioridad:** P0 · **Depende de:** implementación actual.

- Sustituir las referencias incorrectas a `process-runner.ts` por `process.ts`.
- Alinear las salidas de `run_tests` y `compare_test_runs` con `src/shared/contracts.ts`.
- Corregir el ejemplo que confunde `Result<T>` con una instancia y conectar Runner/Git Controller con variables válidas.
- Actualizar frases de integración pendiente que quedaron obsoletas y distinguir integración simulada de integración real.

## C. Colaboración e integración continua

### HU-21 Ejecutar validaciones en GitHub Actions

**Como** revisor de un PR, **quiero** comprobaciones automáticas en GitHub **para** integrar cambios con evidencia reproducible.  
**Estado:** Pendiente · **Prioridad:** P0 · **Rúbrica:** workflow obligatorio e integración continua.

- Agregar workflow en PR/push a las ramas de trabajo/entrega con Node.js 24 e instalación mediante lockfile.
- Ejecutar tipos, lint, compilación y pruebas; preparar Python y su plugin para las integraciones reales correspondientes.
- Mostrar una ejecución verde enlazable y una prueba de que un fallo detiene el pipeline.

### HU-22 Acreditar colaboración y contribuciones del equipo

**Como** docente, **quiero** acceder al repositorio y reconocer el aporte de los tres integrantes **para** evaluar el trabajo grupal e individual.  
**Estado:** Pendiente de completar/verificar · **Prioridad:** P0 · **Rúbrica:** requisito de defensa y repositorio/equipo, 10 puntos.

- Confirmar invitación aceptada del docente y acceso al repositorio correcto.
- Mostrar contribuciones reales de Eduardo, Sebhastian y Luis Miguel con identidad atribuible y PRs o revisiones.
- Vincular las historias a sus entregas y evitar commits vacíos creados solo para aparentar participación.

## D. Servidor MCP y agente autónomo

### HU-23 Publicar las herramientas mediante un servidor MCP

**Como** cliente MCP, **quiero** descubrir e invocar las doce herramientas **para** operar sobre el motor usando el protocolo previsto.  
**Estado:** Pendiente · **Prioridad:** P1 · **Fase:** 5 · **Depende de:** contratos y módulos de dominio; HU-16/HU-17 para resultados fiables.

- Implementar `src/mcp-server/` con SDK MCP, transporte stdio inicial y esquemas Zod.
- Registrar los doce handlers, configurar raíz y proveedores desde el arranque y mantener logs fuera del canal de protocolo.
- Probar discovery, invocación real, errores de validación y cierre de conexión desde un cliente MCP.

### HU-24 Consultar recursos MCP de proyecto y análisis

**Como** agente conectado, **quiero** consultar configuración, estructura y análisis guardados **para** reutilizar contexto sin repetir herramientas.  
**Estado:** Pendiente · **Prioridad:** P1 · **Fase:** 5 · **Depende de:** HU-07, HU-23.

- Publicar los recursos previstos de configuración, estructura y `devguardian://analysis/{analysisId}`.
- Validar identificadores y permisos; responder correctamente a análisis desconocidos, expirados o expulsados.
- No exponer secretos ni permitir elegir una raíz externa desde un URI.

### HU-25 Diagnosticar y proponer un parche con IA

**Como** desarrollador, **quiero** que el agente use diagnóstico y contexto acotado **para** proponer una reparación coherente con el error.  
**Estado:** Pendiente · **Prioridad:** P1 · **Fase:** 6 · **Depende de:** HU-23, HU-24.

- Implementar `src/agent/` con LangChain y Anthropic, conectado como cliente MCP.
- El agente obtiene diagnóstico/contexto mediante herramientas y genera un parche aplicable con hashes esperados.
- Las credenciales se configuran fuera del repositorio; no se envían archivos completos sin necesidad ni secretos en los prompts/logs.

### HU-26 Orquestar reparación y reintentos acotados

**Como** desarrollador, **quiero** que el agente gestione intentos completos **para** obtener una reparación verificada o una finalización segura.  
**Estado:** Pendiente · **Prioridad:** P1 · **Fase:** 6 · **Depende de:** HU-18, HU-25.

- Ejecutar baseline, rama/checkpoint, parche, pruebas, comparación y commit o rollback mediante MCP.
- Respetar límites de intentos y tratar timeout, cancelación, evidencia inválida y cambios externos sin destruir trabajo ajeno.
- Conservar trazas de decisiones y demostrar tanto éxito como agotamiento seguro de reintentos.

### HU-27 Ejecutar un hook demostrable

**Como** responsable del entorno, **quiero** una validación disparada por un evento real **para** imponer una política y demostrar su ejecución.  
**Estado:** Pendiente · **Prioridad:** P0 · **Rúbrica:** hooks, 10 puntos y requisito de defensa · **Depende de:** definición aceptada por el docente y evento integrable en HU-23/HU-25.

- Confirmar qué tipo de hook acepta el docente; no asumir que un pre-commit satisface un criterio orientado a agentes.
- Registrar el hook, su evento y su política, con un caso permitido y otro bloqueado o gestionado.
- Guardar prueba automatizada y log/captura de una invocación real. Deshabilitar hooks Git en el controlador no cumple esta historia.

### HU-28 Delegar una tarea a un subagente real

**Como** coordinador autónomo, **quiero** delegar diagnóstico o verificación a un subagente **para** separar responsabilidades y utilizar su resultado en la decisión final.  
**Estado:** Pendiente · **Prioridad:** P0 · **Rúbrica:** subagentes, 10 puntos y requisito de defensa · **Depende de:** HU-25 y definición aceptada por el docente.

- Configurar una delegación con rol, tarea, contexto, herramientas autorizadas y límites propios.
- Demostrar invocación, resultado devuelto y uso efectivo por el coordinador; una función renombrada no basta.
- Conservar trazas y una prueba del tratamiento de fallo o timeout del subagente.

## E. Aplicación web y persistencia

Las historias siguientes agregan adaptadores de aplicación y presentación. Deben conservar separados `shared`, Analyzer, Test Runner, Git Controller, MCP Server y Agent; no introducir interfaz web ni acceso a BD dentro de los analizadores.

### HU-29 Persistir auditorías y resultados

**Como** usuario, **quiero** guardar proyectos, ejecuciones, hallazgos, intentos y resultados de tests **para** consultar el historial después de reiniciar la aplicación.  
**Estado:** Pendiente · **Prioridad:** P0 · **Rúbrica:** base para BD desplegada y conexión completa.

- Definir modelo de datos y migraciones para las entidades mínimas de una auditoría.
- Relacionar identificadores de dominio con registros persistidos sin guardar secretos.
- Probar creación/consulta y conservación del historial tras reinicio; diferenciar el historial de las sesiones Git actualmente en memoria.

### HU-30 Ofrecer una API de aplicación

**Como** frontend, **quiero** registrar auditorías y consultar su estado/resultados **para** operar con el motor a través de un contrato HTTP definido.  
**Estado:** Pendiente · **Prioridad:** P0 · **Depende de:** HU-29.

- Implementar healthcheck y endpoints de registro, consulta de estado e historial con validación y autenticación/autorización.
- Utilizar proyectos/workspaces registrados, sin aceptar comandos o rutas arbitrarias del navegador.
- Publicar contrato de API, errores y pruebas de integración con persistencia real.

### HU-31 Operar desde un dashboard

**Como** usuario, **quiero** seleccionar un proyecto e iniciar y revisar una auditoría **para** utilizar DevGuardian sin depender de comandos de consola.  
**Estado:** Pendiente · **Prioridad:** P0 · **Depende de:** HU-30.

- Mostrar lista de proyectos/ejecuciones, diagnósticos, estado de tests y cambios propuestos.
- Utilizar la API real y tratar estados pendientes, error y desconexión; no basar la entrega en JSON fijo.
- Mantener la información persistida al recargar y mostrar errores comprensibles sin exponer datos internos.

### HU-32 Conectar un worker autorizado con el workspace

**Como** propietario de un repositorio local, **quiero** que un worker autorizado ejecute las tareas solicitadas **para** conectar la aplicación desplegada con el entorno de desarrollo controlado.  
**Estado:** Pendiente · **Prioridad:** P0 · **Depende de:** HU-23, HU-30.

- Definir el canal autenticado entre aplicación y worker y el registro de workspaces permitidos.
- Ejecutar las operaciones del motor mediante MCP y reportar estados/resultados al backend.
- Manejar desconexiones y reintentos sin duplicar commits ni exponer ejecución arbitraria pública en la máquina del usuario.

## F. Despliegue y entrega evaluable

### HU-33 Desplegar la base de datos

**Como** evaluador, **quiero** observar datos persistidos en una base desplegada **para** comprobar que la aplicación utiliza almacenamiento real fuera del entorno de desarrollo.  
**Estado:** Pendiente de implementar/acreditar · **Prioridad:** P0 · **Rúbrica:** 10 puntos y requisito de tres partes desplegadas · **Depende de:** HU-29.

- Aplicar migraciones y conectar el backend mediante secretos de entorno.
- Mostrar un registro creado desde la aplicación y recuperado en otra consulta.
- Documentar la evidencia de conexión sin publicar credenciales ni abrir acceso innecesario a la BD.

### HU-34 Desplegar el backend

**Como** usuario del dashboard, **quiero** una API accesible en un entorno de entrega **para** utilizar las operaciones sin ejecutar el backend en mi computadora.  
**Estado:** Pendiente de implementar/acreditar · **Prioridad:** P0 · **Rúbrica:** 10 puntos y requisito de defensa · **Depende de:** HU-30, HU-33.

- Publicar URL HTTPS, healthcheck y configuración de entorno segura.
- Comprobar una operación con BD y el manejo de errores y logs en ese entorno.
- Documentar cómo el worker local se conecta; no confundir backend web desplegado con servidor MCP stdio local.

### HU-35 Desplegar el frontend

**Como** usuario, **quiero** abrir el dashboard mediante una URL pública de entrega **para** utilizar el sistema desde un navegador.  
**Estado:** Pendiente de implementar/acreditar · **Prioridad:** P0 · **Rúbrica:** 10 puntos y requisito de defensa · **Depende de:** HU-31, HU-34.

- Publicar URL HTTPS y configurar el endpoint real del backend sin secretos de servidor en el cliente.
- Verificar navegación, carga de datos, autenticación y mensajes de error en el entorno desplegado.
- Enlazar la URL y las instrucciones de acceso para el docente.

### HU-36 Desplegar desde el pipeline

**Como** responsable de entrega, **quiero** desplegar automáticamente una versión validada **para** demostrar CI/CD y reducir errores manuales.  
**Estado:** Pendiente · **Prioridad:** P0 · **Rúbrica:** CI/CD, 15 puntos junto a HU-21 · **Depende de:** HU-21, HU-33, HU-34, HU-35.

- Desplegar desde la rama de entrega solo tras validaciones satisfactorias, utilizando secretos del entorno de CI.
- Ejecutar un smoke test contra los servicios desplegados y conservar enlace al run y versión entregada.
- Documentar recuperación de una entrega fallida y demostrar que pruebas fallidas impiden desplegar.

### HU-37 Demostrar conexión de punta a punta

**Como** docente, **quiero** iniciar una operación desde frontend y ver su resultado persistido **para** comprobar la integración de las tres partes con el motor.  
**Estado:** Pendiente · **Prioridad:** P0 · **Rúbrica:** 15 puntos · **Depende de:** HU-32, HU-33, HU-34, HU-35.

- Mostrar frontend → backend → worker/motor → BD → resultado actualizado en frontend, con identificador trazable.
- Recuperar el historial tras recargar la página y demostrar una respuesta de error real.
- Para afirmar reparación autónoma completa, incluir además HU-26; no presentar una llamada directa de dominio como una conexión MCP.

### HU-38 Consolidar y documentar la versión de entrega

**Como** docente, **quiero** encontrar en `main` una versión coherente y reproducible **para** revisar el avance sin buscar commits en otras ramas.  
**Estado:** Pendiente · **Prioridad:** P0 · **Depende de:** HU-20, HU-21 y las historias incluidas en la entrega.

- Integrar `Dev` en `main` mediante PR revisado, manteniendo pruebas en verde y resolviendo diferencias de nombres de ramas.
- Actualizar README con URLs, versiones, variables de ejemplo sin secretos, comandos y demo verificable.
- Enlazar commits/PRs, runs y evidencia de cada criterio; no declarar completas historias que sigan sin demostración.

### HU-39 Preparar la defensa grupal e individual

**Como** integrante del equipo, **quiero** explicar y demostrar mi aporte **para** defender el proyecto y mi evaluación individual.  
**Estado:** Pendiente · **Prioridad:** P0 · **Rúbrica:** nota final = grupal × 0,6 + individual × 0,4 · **Depende de:** HU-22 y versión de demo.

- Cada integrante explica un módulo, una decisión de seguridad y un fallo con su solución o límite.
- Reproducir demo de éxito y de regresión/rollback, más hook, subagente, pipeline y persistencia.
- Preparar evidencia de los requisitos de defensa; la planilla indica tope de 50 si falta alguno, cuyo alcance debe confirmar el docente.

### HU-40 Revisar secretos y permisos de entrega

**Como** propietario del proyecto, **quiero** comprobar que código y despliegues no exponen secretos **para** entregar el sistema sin filtrar credenciales ni permisos de ejecución.  
**Estado:** Pendiente de verificación integral · **Prioridad:** P0 · **Rúbrica:** requisito sin secretos `.env`.

- Revisar archivos versionados, historial y logs con herramientas apropiadas; ignorar `.env` no basta para demostrar ausencia de secretos previos.
- Mantener solo ejemplos sin valores reales, secretos en el hosting/CI y permisos mínimos del worker.
- Si se encuentra una credencial expuesta, revocarla/rotarla y resolver su exposición antes de la entrega.

## G. Endurecimiento adicional del Test Runner

### HU-41 Validar el estado y configuración efectivos de una ejecución

**Como** consumidor de evidencia, **quiero** identificar el estado y parámetros realmente utilizados **para** comparar pruebas reproducibles.  
**Estado:** Pendiente · **Prioridad:** P1 · **Depende de:** HU-12, HU-13.

- Comprobar la huella antes y después de ejecutar y definir la coordinación con escritores Git durante el run.
- Definir qué targets, argumentos y variables relevantes integran la huella de configuración, sin exponer sus valores sensibles.
- Cubrir cambios de workspace/configuración y demostrar que no producen evidencia aceptada indebidamente.

### HU-42 Respetar el presupuesto total y proteger la evidencia

**Como** operador del servicio, **quiero** almacenar resultados y evidencia dentro de un presupuesto global **para** mantener el proceso estable y evitar mutaciones externas.  
**Estado:** Pendiente · **Prioridad:** P1 · **Depende de:** HU-14.

- Contabilizar también las copias de evidencia dentro de los límites de bytes y probar TTL/expulsión de ambos almacenes.
- Mutar el objeto devuelto por `verify()` no cambia el registro que luego devuelve `getEvidence()`.
- Leer reportes con límite antes de cargar todo su contenido y limpiar temporales en todos los caminos de error.

### HU-43 Garantizar terminación ante timeout y cancelación

**Como** operador, **quiero** que un runner y sus descendientes terminen bajo una cancelación **para** recuperar los recursos incluso cuando falla el mecanismo principal de cierre.  
**Estado:** Pendiente · **Prioridad:** P1 · **Depende de:** HU-12.

- En Windows, acotar `taskkill`, verificar su código de salida y probar el fallback; probar grupos de procesos en POSIX.
- Cubrir procesos descendientes y fallos del mecanismo de terminación sin que la promesa quede pendiente indefinidamente.
- Preservar los estados `timeout`/`cancelled` y la recuperación de la cola para la siguiente ejecución.

## Orden propuesto de trabajo

| Entrega | Historias principales | Resultado demostrable |
|---|---|---|
| 1. Estabilización y requisitos básicos | HU-16, HU-17, HU-18, HU-19, HU-20, HU-21, HU-22, HU-40 | Comparación fiable, integración real, workflow ejecutado y participación/accesos acreditados. |
| 2. Conexión del producto | HU-23, HU-24, HU-29, HU-30, HU-31, HU-32 | Herramientas MCP y recorrido funcional entre UI, API, worker y persistencia. |
| 3. Autonomía y criterios de agente | HU-25, HU-26, HU-27, HU-28 | Reparación por agente, hook y delegación demostrables. |
| 4. Entrega desplegada | HU-33, HU-34, HU-35, HU-36, HU-37 | Tres partes desplegadas, CI/CD y conexión de punta a punta. |
| 5. Cierre y defensa | HU-38, HU-39 | Versión consolidada, evidencias y presentación individual preparada. |
| Transversal | HU-41, HU-42, HU-43 | Evidencia reproducible y manejo robusto de recursos/procesos. |

Las entregas se pueden trabajar en paralelo por integrantes cuando sus contratos estén acordados; este orden no constituye una asignación de personas ni un calendario comprometido. Ninguna implementación se considera aprobada solo por cambiar su estado en este archivo.

## Definición de terminado para las historias pendientes

Una historia puede pasar a **Completada** cuando:

- Cumple todos sus criterios de aceptación y conserva los contratos y límites de seguridad aplicables.
- Cuenta con pruebas significativas, tipos y lint correctos; si afecta integración externa, incluye evidencia real y no solo mocks.
- Tiene código o configuración revisados y un commit/PR atribuible a su responsable.
- Su documentación permite reproducir el resultado y diferencia lo implementado de lo aún pendiente.
- Si corresponde a un criterio de evaluación, enlaza una URL, ejecución de pipeline, log o evidencia demostrable para el docente.

## Referencias y seguimiento

- [Descripción y estado del proyecto](README.md).
- [Informe de revisión del segundo parcial](reports/INFORME_PARCIAL2_2026-10-19.md), con hallazgos, referencias y contraste con la rúbrica.
- [Git Controller](src/git-controller/README.md), [Analyzer](src/analyzer/README.md) y [Test Runner](src/test-runner/README.md).
- En cada PR utilizar el ID de historia, por ejemplo `HU-16`, y agregar al cerrar la historia su enlace de evidencia. Los responsables y las estimaciones se acuerdan en la planificación del equipo.
