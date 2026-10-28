---
proyecto: DevGuardian
tipo: conocimiento
grupo: fuentes
estado: documentado
fecha: 2026-10-28
tags: [devguardian, dg/fuentes]
---

# ACF y DevGuardian: comparación crítica

| Afirmación del PDF | Evaluación para DevGuardian |
| --- | --- |
| Ambos buscan integridad del código | Coincidencia de dominio; no equivalencia de cobertura |
| DevGuardian es auditoría dinámica impulsada por IA | Incompleto: el diagnóstico AST/ESLint es estático; la ejecución de pruebas es dinámica |
| Los subagentes implican comprensión mediante LLM | Los workers de diagnóstico, verificación y seguridad son deterministas; el Agent Client generativo es otro flujo |
| El sistema busca desbordamientos, inyecciones y fugas como ACF | No se puede acreditar esa cobertura general solo por tener AST y lint |
| Es infinitamente más moderno | Valoración del resumen, no métrica técnica ni conclusión demostrada |
| DevGuardian agrega parches y pruebas | Implementación documentada, condicionada a autorización, guardrails y evidencia válida |

**Conclusión:** sirve para justificar el problema y formular hipótesis, no para afirmar superioridad, detección universal ni uso de IA en todas las pantallas. La comparación de herramientas históricas requiere consultar la tesis original.

## Relaciones

- [Fuente secundaria](01-Fuente-y-procedencia.md)
- [Métodos de análisis](02-Auditoria-de-codigo.md)
- [Separación de agentes](09-IA-y-workers.md)
- [Validación académica](11-Validacion-pendiente.md)

[Índice del segundo cerebro](00-Segundo-cerebro.md)
