---
proyecto: DevGuardian
tipo: conocimiento
grupo: analisis
estado: documentado
fecha: 2026-10-28
tags: [devguardian, dg/analisis]
---

# Auditoría de código: teoría y límites

Auditar código ayuda a identificar errores y riesgos. **Análisis estático** inspecciona fuente y tipos sin ejecutar el programa; **pruebas dinámicas** ejecutan casos y comparan comportamiento. Un LLM puede proponer un parche, pero su explicación no demuestra que funcione.

DevGuardian usa TypeScript Compiler API y ESLint para diagnósticos. Cero hallazgos significa únicamente que los checks ejecutados no reportaron problemas: un descuento calculado con una fórmula equivocada puede ser válido en sintaxis y tipos.

Fuente documental local: src/analyzer/README.md y src/shared/contracts.ts.

## Relaciones

- [ACF y DevGuardian](03-ACF-y-DevGuardian.md)
- [Pruebas y regresiones](08-Verificacion-y-regresiones.md)
- [IA y workers](09-IA-y-workers.md)

[Índice del segundo cerebro](00-Segundo-cerebro.md)
