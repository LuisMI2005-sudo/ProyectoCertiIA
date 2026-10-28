---
proyecto: DevGuardian
tipo: conocimiento
grupo: ia
estado: documentado
fecha: 2026-10-28
tags: [devguardian, dg/ia]
---

# Cliente generativo y workers deterministas

| Componente | Responsabilidad | LLM necesario |
| --- | --- | --- |
| Worker diagnostic | Herramientas de análisis sobre contexto acotado | No |
| Worker verification | Pruebas y comparación autorizadas | No |
| Worker patch-safety | Inspección/preflight sin escritura Git | No |
| Agent Client CLI | Planificación de parche con LangChain/Anthropic y orquestación MCP | Sí para el proveedor generativo |
| Dashboard | Formularios, evidencia, historial y herramientas avanzadas | No implica una llamada LLM |

Fuentes: src/subagents/README.md y src/agent-client/README.md. No afirmar que una llamada pagada ocurrió ni que un proveedor está activo sin evidencias. Un parche sugerido solo se acepta tras controles del servidor y verificación.

## Relaciones

- [Presupuestos](04-Recursos-y-contexto.md)
- [Coordinación](05-Arquitectura-y-patrones.md)
- [Seguridad de la IA](07-Hooks-y-guardrails.md)

[Índice del segundo cerebro](00-Segundo-cerebro.md)
