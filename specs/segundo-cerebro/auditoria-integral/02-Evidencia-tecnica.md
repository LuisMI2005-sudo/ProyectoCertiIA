---
proyecto: DevGuardian
tipo: evidencia
fecha: 2026-10-28
tags: [devguardian, dg/verificacion]
---

# Evidencia técnica de esta revisión

## Identificación

Backend HEAD 84a8b91; frontend HEAD 325d6a23fdbd5a95ac29a302ed80aa18ae4f7f97. Ambos workspaces contienen documentación sin commit; por ello el HEAD no identifica por sí solo el contenido completo revisado. No se cambiaron fuentes de aplicación para este informe.

## Checks y pruebas

| Repositorio | Verificación | Resultado observado |
| --- | --- | --- |
| Frontend | npm run check | Código de salida 0 |
| Frontend | npm test | 119 pruebas, 13 archivos, aprobados; salida 0 |
| Backend | npm run check | Código de salida 0 (TypeScript y ESLint) |
| Backend | npm test en sandbox | Fallos al crear .git/config por permisos; ejecución interrumpida tras registrar el problema del entorno |
| Backend | npm test autorizado | Inconclusa: interrumpida tras más de tres minutos sin resumen final y con un subproceso Git activo; salida -1 |

## Archivos reproducibles

- [Log check backend](evidencia/check.log).
- [Pruebas iniciales backend](evidencia/tests.log).
- [Pruebas autorizadas backend](evidencia/tests-autorizados.log).
- [Receipt inicial backend](evidencia/resultados.json).
- [Receipt de reejecución](evidencia/resultados-autorizados.json).
- [Check frontend](evidencia/frontend/check.log).
- [Pruebas frontend](evidencia/frontend/tests.log).
- [Receipt frontend](evidencia/frontend/resultados.json).

No sumar pruebas no ejecutadas ni usar el histórico del README como resultado actual. Los fallos iniciales de Git son evidencia de restricción del entorno, no demostración de un defecto funcional. La reejecución no permitió atribuir el problema a código, configuración Git o entorno. Debe reproducirse con tiempo acotado, prueba individual y procesos Git con timeout antes de acreditar el backend.

## Evidencia documental

Se inspeccionaron src/server/http.ts (autenticación opcional sin token), src/db/schema.sql (sin tenant_id/RLS), .github/workflows/ci.yml (configuración para checks y runners), y límites documentados de importación/ejecución. Ver [hallazgos](03-Hallazgos-y-plan.md). No se verificó un workflow remoto ni el estado de Render en esta sesión.

## Cobertura de la revisión

Se revisaron responsabilidades de analyzer, test-runner, Git, hooks, subagentes, MCP, servidor, persistencia, cliente generativo y frontend. No se ejecutó análisis de cobertura de líneas ni scanner de vulnerabilidades/dependencias; no atribuir a estas pruebas un porcentaje de cobertura o certificación.

[Índice integral](00-Informe-Integral.md).
