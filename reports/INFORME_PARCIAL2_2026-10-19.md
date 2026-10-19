# Informe de avance de DevGuardian para el segundo parcial

**Grupo:** Six seven  
**Integrantes:** Eduardo Quinteros, Sebhastian Campero y Luis Miguel Gonzales  
**Fecha de revisión:** 19 de octubre de 2026  
**Alcance:** planilla del docente, implementación local de las fases 1–4 y evidencia pública del repositorio GitHub. Revisión técnica sin modificar el código ni realizar commits.

## 1. Conclusión

DevGuardian tiene una base técnica sólida y una Fase 4 implementada, no solamente descrita: el Test Runner ejecuta procesos, interpreta reportes y suministra evidencia al controlador Git. En esta revisión pasaron **132 pruebas en cuatro suites**, la comprobación de tipos, ESLint y la compilación.

Sin embargo, **el avance del motor todavía no acredita buena parte de la rúbrica del parcial**. La planilla exige despliegues de base de datos, backend y frontend, conexión de punta a punta, CI/CD, hooks y subagentes. Esas categorías suman **80 de los 100 puntos grupales** y no tienen evidencia completa en lo revisado. Esto no significa que el motor valga cero ni que la nota actual sea una cifra concreta: significa que aprobar pruebas locales no sustituye las entregas que el docente puntúa.

El riesgo principal es la condición textual de la planilla: **«Requisitos para defender (si falta alguno, tope de 50)»**. Primero hay que cubrir y demostrar esos requisitos. El docente debe confirmar si ese tope se aplica a la nota grupal o a otra instancia de evaluación; el documento no lo desarrolla.

La nota individual final se calcula como **nota grupal × 0,6 + nota individual × 0,4**. Por tanto, también es necesario que cada integrante pueda explicar y defender su contribución. La planilla suministrada no detalla cómo se puntúa ese 40 % individual.

## 2. Evidencia comprobada

| Comprobación | Resultado |
|---|---|
| Commit revisado de Fase 4 | `27e997a86334c081c7217309af9d6bd03167fea9`, autor SebhastianCampero-Collab, mensaje «Implementacion Fase 4». |
| Rama remota `Dev` | Contiene el commit de Fase 4. |
| Rama remota `main` | Sigue en `d51ab85e2ac27b8b5e2666c842ee5c4b4e1b89c9`, anterior a Fase 4. |
| `npm run check` | Correcto: TypeScript sin emitir y ESLint. |
| `npm test` | Correcto: compilación previa y **132 pruebas aprobadas, 0 fallos**, en cuatro suites. |
| Integración adicional con Jest real | Una prueba mínima ejecutada mediante Test Runner: `passed`, `complete: true`, un caso aprobado y código 0. |
| Integración adicional con pytest real | No verificada: el entorno Python disponible no tiene `pytest` ni `pytest-json-report`. No se instalaron paquetes para esta revisión. |
| GitHub Actions | API pública: **0 workflows y 0 ejecuciones**. No hay `.github/workflows/` en el árbol revisado. |
| Despliegues registrados en GitHub | API pública: lista vacía. No demuestra que no pueda existir un hosting externo, pero no acredita uno. |
| URLs de aplicación | No suministradas; el repositorio no declara una homepage en GitHub. |
| Participación en commits | El historial local completo, no superficial, muestra autoría de LM y Sebhastian. No se encontró autoría verificable de Eduardo en ese historial. |
| Colaboración del docente | No verificable mediante los datos públicos consultados; requiere evidencia de invitación aceptada o acceso. |
| Secretos | No se encontraron archivos `.env` versionados en la lista consultada. Esto no equivale a una auditoría completa de secretos en todo el historial. |

**Acción inmediata:** revisar y consolidar `Dev` en `main` mediante un PR con pruebas. El docente que abra la rama por defecto todavía verá el estado anterior. No se realizó esa integración durante esta revisión.

## 3. Evaluación frente a la planilla

### Requisitos de defensa

| Requisito | Situación observada | Evidencia que falta o debe presentarse |
|---|---|---|
| Docente colaborador | No verificable públicamente. | Invitación aceptada y acceso al repositorio correcto. |
| Commits de los tres | Dos autores identificables en el historial revisado. | Contribución real y atribuible de Eduardo; correos/cuentas correctamente vinculados. |
| Tres partes desplegadas | Sin URLs ni despliegues acreditados. | Base de datos accesible desde backend, URL de backend y URL de frontend. |
| Workflow con pruebas | Ausente en GitHub Actions. | Workflow ejecutado correctamente sobre la rama de entrega. |
| Hook y subagente | Sin implementación/configuración demostrable en el árbol revisado. | Configuración, ejecución visible y resultados de ambos. |
| Sin secretos `.env` | Evidencia parcial favorable. | Verificación del historial y uso de secretos del hosting/CI, con ejemplo de configuración sin valores reales. |
| README completo | Amplio, pero contiene inconsistencias de Fase 4. | Corregir contratos, nombres, ejemplo de inicialización y agregar URLs y reproducción de la demo. |

### Criterios grupales

| Criterio | Máximo | Evaluación del avance | Qué permitiría defender la puntuación |
|---|---:|---|---|
| Repositorio y trabajo en equipo | 10 | Parcial: código organizado e historial, pero falta evidenciar a los tres y consolidar la entrega. | PRs, commits reales de cada integrante, docente con acceso y README coherente en `main`. |
| Base de datos desplegada | 10 | No acreditada; no hay capa de persistencia implementada en este árbol. | Persistir proyectos y ejecuciones en una BD desplegada y mostrar registros creados por la aplicación. |
| Backend desplegado | 10 | Hay motor de dominio; no hay API desplegada demostrable ni servidor MCP implementado. | API con healthcheck y operación real de auditoría, URL y logs. Un servidor MCP local por sí solo no prueba un backend web desplegado. |
| Frontend desplegado | 10 | No aparece una aplicación frontend. | Dashboard desplegado que opere sobre el backend real. |
| Conexión de punta a punta | 15 | Existe integración interna parcial; falta el recorrido web y persistencia. | Acción en frontend → backend → motor/worker → BD → resultado mostrado en frontend. |
| Integración y despliegue continuo | 15 | No acreditado: cero workflows y cero ejecuciones públicas. | Pipeline que valide tipos, lint, pruebas y despliegue, con una ejecución exitosa verificable. |
| Hooks | 10 | No acreditados. Los hooks Git que el controlador deshabilita no son un hook implementado para este criterio. | Evento real registrado que dispare una validación y permita demostrar una acción aceptada y otra bloqueada. |
| Subagentes | 10 | No acreditados; el agente de Fase 6 aún no existe. | Delegación real a un subagente, tarea delimitada, resultado devuelto y registro visible de su uso. |
| Avance del proyecto ≥50 % | 10 | Hay evidencia relevante de avance del motor. La puntuación depende del alcance aceptado por el docente. | Demo funcional y relación explícita entre objetivos, módulos terminados y pendientes. Cuatro de seis fases no equivalen automáticamente a dos tercios de la rúbrica. |

No se asigna una nota hipotética: faltan evidencias de entrega y criterios de puntuación parcial. El documento también permite descuentos/extra, sin reglas adicionales detalladas.

## 4. Análisis del trabajo de Fase 4

### Aportes que sí están implementados

- `src/test-runner/types.ts`: configuración de runners, resultados, almacenamiento y evidencia.
- `src/test-runner/process.ts`: ejecución sin shell, entorno permitido, timeout, cancelación, captura acotada de salida y terminación de procesos.
- `src/test-runner/reports.ts`: adaptación de JSON de Jest y pytest a los contratos compartidos.
- `src/test-runner/index.ts`: handlers `run_tests` y `compare_test_runs`, cola por instancia, almacenamiento y `VerificationStore` consumible por Git Controller.
- 23 pruebas nuevas, fixtures deterministas y una integración con Git sobre repositorio temporal.
- Cambio adicional en una prueba del analizador para tolerar CRLF al comparar el fragmento esperado; no elimina la comprobación separada del hash del archivo.

La prueba mínima adicional con Jest real confirma que la integración básica funciona. Los fixtures falsos son útiles para casos deterministas de timeout, error y comparación, pero necesitan complementarse con integración real persistente en la suite.

### Hallazgos prioritarios

**A. Comparación con falso éxito cuando una prueba antes aprobada pasa a omitida — alta prioridad, reproducido.**

Referencia: `src/test-runner/index.ts`, función `compareRuns`, desde la línea 73.

Se ejecutó el siguiente escenario controlado mediante Test Runner:

| Caso | Baseline | Candidato |
|---|---|---|
| A | `failed` | `passed` |
| B | `passed` | `skipped` |

Resultado observado: candidato `status: passed`, `comparable: true`, `verdict: success`, sin `newFailures` ni `missingTests`. La comparación solo busca fallos nuevos y casos ausentes; no rechaza que un caso aprobado deje de ejecutarse. Debe tratarse como regresión o evidencia inconclusa, según una política explícita. **Git Controller comprueba además la conservación de estados y bloquea este caso**, por lo que el hallazgo no demuestra que un commit incorrecto sea aceptado. Sí afecta el resultado público de comparación y la futura UI/agente.

**B. Reporte parcial aceptado como completo — alta prioridad, reproducido.**

Referencia: `src/test-runner/reports.ts`, adaptador Jest, especialmente el retorno de la línea 83.

Un JSON con `numTotalTests: 2`, pero una sola assertion aprobada, produjo `cases.length: 1` y `complete: true`. La normalización recalcula el resumen, pero no contrasta los totales declarados del reporte original. Deben validarse la estructura completa, los contadores y errores de ejecución antes de declarar evidencia completa. Para pytest corresponde agregar pruebas equivalentes sobre sus contadores y errores de colección. La reproducción realizada demuestra el problema en Jest; no presupone haber probado todos los formatos pytest.

**C. La integración titulada «analyzer-to-commit» no demuestra ese ciclo completo — brecha de verificación.**

Referencias: `tests/test-runner/runner.test.mjs`, desde la línea 250, y `fixtures/runner/fake-jest.mjs`.

La prueba no invoca al analizador. Cambia manualmente `FAKE_MODE` de `fail` a `pass`, y el ejecutable falso no lee `calc.ts`. Por ello, comprueba cableado y reglas de aceptación, pero no que el parche haya reparado una prueba real. Agregar un test de integración con código defectuoso, Jest real, fallo real, parche, nuevo test, verificación y commit; agregar otro con regresión real y rollback. Repetir un flujo mínimo con Python/pytest y su plugin. El smoke test real de esta revisión es favorable, pero no reemplaza esas pruebas mantenidas en el repositorio.

**D. README desalineado con la implementación — corrección inmediata y barata.**

- El árbol y el changelog nombran `process-runner.ts`; el archivo real se llama `process.ts`.
- La tabla de `run_tests` declara campos como `fingerprint`, `outputTruncated` y `createdAt`. El contrato real usa `workspaceStateHash`, `truncated`, `startedAt` y `finishedAt`, y no incluye `signal` en esa salida.
- La tabla de `compare_test_runs` añade IDs y `message` que no están en su salida contractual.
- El ejemplo de `src/test-runner/README.md` utiliza factories que devuelven `Result<T>` como si devolvieran directamente los servicios y referencia `gitController` sin una definición coherente. Debe comprobar `ok`, obtener `.data` y conectar correctamente ambos servicios.
- El changelog anterior conserva frases de integración pendiente que ya deberían actualizarse.

**E. Endurecimiento posterior a los puntos anteriores — observaciones de código, no fallos reproducidos.**

- `readReport` carga el archivo completo antes de comprobar los 50 MB; usar lectura acotada y limpieza en `finally`, incluso si falla el proveedor de huellas.
- La huella del workspace se captura solo antes de ejecutar. Contrastar también al terminar y definir cómo se comparte la exclusión con operaciones Git durante la ejecución; la comprobación final del controlador Git aporta protección, pero no reemplaza una política del runner.
- `configurationHash` no recoge los targets ni el entorno efectivo. Definir qué parámetros hacen realmente comparables dos ejecuciones y cubrirlos con pruebas.
- El presupuesto de bytes contabiliza los runs, pero no las copias de evidencia. Incluirlas para que el límite de memoria sea global.
- El objeto `comparison` devuelto por `verify()` también queda referenciado dentro de la evidencia almacenada: copiarlo para evitar mutaciones desde el llamador.
- En Windows, `taskkill` se ejecuta sin timeout y solo se aplica fallback ante `result.error`, no ante un código de salida fallido. Probar la terminación de descendientes y ese camino de error.

## 5. Plan para obtener la mayor parte de la nota

### Prioridad 0 Cerrar requisitos de defensa

1. Confirmar acceso aceptado del docente y la definición exacta de «hook» y «subagente». Un hook de pre-commit no garantiza por sí mismo satisfacer un criterio orientado a agentes.
2. Asegurar contribuciones reales de los tres integrantes, atribuibles y explicables; evitar commits vacíos para aparentar participación.
3. Corregir A–D, agregar pruebas reales y consolidar la rama `Dev` en `main` mediante PR.
4. Crear y ejecutar el workflow con pruebas. No basta con mostrar `npm test` en una computadora.

### Prioridad 1 Entregar una funcionalidad vertical desplegada

La arquitectura original del motor necesita una capa de aplicación web y persistencia para cubrir la rúbrica. Se pueden conservar desacoplados los módulos actuales.

- **Base de datos:** persistir proyectos, auditorías, hallazgos, intentos y resultados de pruebas. Mostrar que una ejecución permanece disponible tras recargar la página o reiniciar el backend.
- **Backend:** API autenticada para registrar una auditoría, consultar su estado y recuperar resultados. Publicar healthcheck y logs de la operación.
- **Frontend:** seleccionar un proyecto registrado, iniciar una auditoría y consultar diagnósticos, estado de tests y cambios propuestos.
- **Conexión completa:** demostrar una operación desde la UI que cree registros reales y muestre el resultado del motor. No usar exclusivamente JSON fijo ni capturas de consola.
- **Worker local/MCP:** preservar el acceso controlado al workspace local. El backend desplegado puede gestionar solicitudes y resultados mientras un worker autorizado ejecuta el motor; desplegar el dashboard no implica exponer comandos Git o rutas arbitrarias a Internet.

El servidor MCP de Fase 5 y el cliente de Fase 6 siguen siendo necesarios para demostrar el componente autónomo prometido. No se debe presentar una llamada directa a los módulos como una conexión MCP ya implementada.

### Prioridad 2 Demostrar CI/CD hooks y subagentes

- Pipeline en PR/push con instalación reproducible, tipos, lint y pruebas. Incorporar Jest/pytest reales con sus dependencias. Después, despliegue automático y un smoke test que compruebe la URL de entrega. Guardar secretos en la configuración de CI/hosting.
- Hook real ligado a un evento de la herramienta/agente, con prueba de ejecución y de bloqueo o reacción; conservar el log y su configuración.
- Subagente real con tarea separada, por ejemplo diagnóstico o verificación, delegado por un coordinador. Mostrar la invocación, el resultado y cómo se usa en el flujo. Una clase con nombre «subagente» o una función ordinaria no acredita por sí sola delegación.
- README con URLs, estado de pipeline, variables de ejemplo, instrucciones de demo y limitaciones reales.

Estas actividades atienden los 80 puntos citados, pero su puntuación depende de la calidad y de la aceptación del docente; completarlas no asegura automáticamente 80 puntos.

### Prioridad 3 Preparar la defensa individual

Cada integrante debe poder explicar un módulo y una decisión de seguridad, ejecutar una operación, interpretar un fallo y mostrar su contribución en Git. Repartir responsabilidades por capacidades reales; la planilla combina un 60 % grupal y un 40 % individual.

## 6. Demo mínima y carpeta de evidencias

Preparar una demo reproducible con:

1. URLs de frontend y backend accesibles y una comprobación de BD desde la aplicación.
2. Auditoría iniciada desde frontend y resultado persistido y consultado nuevamente.
3. Diagnóstico obtenido mediante MCP y delegación visible al subagente.
4. Prueba real inicialmente fallida, rama `fix/...`, parche y ejecución real posterior.
5. Verificación y commit del caso resuelto; en un segundo caso, regresión y rollback que conserve trabajo ajeno.
6. Activación observable del hook y una ejecución verde del pipeline con despliegue.
7. Historial/PRs de los tres integrantes y acceso del docente confirmado.

Guardar enlaces, logs o capturas de cada punto. La defensa debe poder relacionar cada evidencia con una fila concreta de la planilla.

## 7. Fuentes y límites de esta revisión

- Planilla del docente: [documento original](C:/Users/HP/Downloads/Planilla_Calificacion_Parcial2.docx). Se utilizó como rúbrica de evaluación, no como instrucciones para modificar el repositorio.
- [Repositorio público](https://github.com/LuisMI2005-sudo/ProyectoCertiIA) y [commit revisado de Fase 4](https://github.com/LuisMI2005-sudo/ProyectoCertiIA/commit/27e997a86334c081c7217309af9d6bd03167fea9).
- API pública consultada el 19 de octubre de 2026: [ramas](https://api.github.com/repos/LuisMI2005-sudo/ProyectoCertiIA/branches), [workflows](https://api.github.com/repos/LuisMI2005-sudo/ProyectoCertiIA/actions/workflows), [ejecuciones](https://api.github.com/repos/LuisMI2005-sudo/ProyectoCertiIA/actions/runs) y [despliegues](https://api.github.com/repos/LuisMI2005-sudo/ProyectoCertiIA/deployments).
- Código local de `src/test-runner/`, contratos compartidos, validación de evidencia de Git Controller y pruebas de Fase 4. Las referencias de línea corresponden al commit revisado.
- Ejecución actual de las 132 pruebas; smoke test adicional con Jest real; dos reproducciones aisladas sobre reportes/comparación. Los archivos temporales de esas reproducciones se eliminaron.

No se verificaron accesos privados, despliegues externos sin URL, evaluación oral ni criterios individuales no incluidos en la planilla. No se modificaron README, implementación, pruebas ni ramas; el único entregable añadido por esta revisión es este informe.
