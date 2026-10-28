---
proyecto: DevGuardian
tipo: conocimiento
grupo: seguridad
estado: documentado
fecha: 2026-10-28
tags: [devguardian, dg/seguridad]
---

# Hooks, guardrails y límites de confianza

Un **hook** intercepta un punto del flujo; un **guardrail** decide si la operación satisface una política. La evaluación puede permitir o bloquear antes de una modificación.

Proteger archivos sensibles, rutas y contenido no equivale a demostrar que todo el repositorio está libre de secretos. .env.example documenta nombres de variables; los valores reales no deben publicarse.

Los workers de Node aíslan contexto y capacidades de especialistas confiables; no son un sandbox del sistema operativo para ejecutar código hostil. Importar un repositorio para análisis estático no autoriza ejecutar sus scripts.

Los hooks de seguridad del backend, los hooks del asistente IDE y los hooks React son conceptos distintos. Un log registra una decisión; recargarlo no dispara por sí mismo una nueva intercepción.

## Relaciones

- [Operaciones MCP](06-MCP-y-contratos.md)
- [Evidencia de pruebas](08-Verificacion-y-regresiones.md)
- [Aislamiento de workers](09-IA-y-workers.md)

[Índice del segundo cerebro](00-Segundo-cerebro.md)
