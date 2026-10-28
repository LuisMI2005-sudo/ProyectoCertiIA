---
proyecto: DevGuardian
tipo: conocimiento
grupo: investigacion
estado: propuesta-de-medicion
fecha: 2026-10-28
tags: [devguardian, dg/investigacion]
---

# Recursos, contexto y cobertura

La página 1 del PDF relaciona el consumo de memoria de ACF con el contexto de los LLM. Es una analogía útil, pero memoria RAM, tiempo de CPU y tokens son presupuestos diferentes.

DevGuardian ya documenta lectura acotada, límites de tamaño, truncamiento y presupuestos de workers. Antes de usar IA, el cliente debe rechazar contexto no utilizable o parecido a secretos.

## Experimento propuesto, no ejecutado

Medir duración y memoria para repositorios pequeños/medianos/grandes; registrar tamaño, archivos analizados, checks, truncamiento y errores. Para LLM registrar tokens reales del proveedor y presupuesto. No extrapolar un resultado favorable sin medición ni convertir 19.000 paquetes en un benchmark propio.

## Relaciones

- [Cobertura](02-Auditoria-de-codigo.md)
- [Contexto de IA](09-IA-y-workers.md)
- [Experimentos pendientes](11-Validacion-pendiente.md)

[Índice del segundo cerebro](00-Segundo-cerebro.md)
