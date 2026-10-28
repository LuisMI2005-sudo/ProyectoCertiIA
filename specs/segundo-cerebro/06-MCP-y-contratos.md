---
proyecto: DevGuardian
tipo: conocimiento
grupo: arquitectura
estado: documentado
fecha: 2026-10-28
tags: [devguardian, dg/arquitectura]
---

# MCP y contratos de herramientas

MCP expone herramientas y esquemas para un cliente. El esquema orienta los argumentos, pero el servidor debe validarlos y aplicar seguridad.

- read_file_context: obtiene contenido acotado y hash.
- analyze_code: ejecuta checks de sintaxis, semántica y/o lint.
- git_apply_patch: exige contexto de sesión/intento y hashes confiables.
- run_tests y compare_test_runs: producen evidencia de comportamiento.

El sandbox JSON de la web es un cliente avanzado: no es un contenedor aislado ni simula mutaciones Git. El projectId corresponde al proyecto seleccionado y los guardrails permanecen activos. No inventar identificadores ni hashes para completar una demostración.

## Relaciones

- [Arquitectura](05-Arquitectura-y-patrones.md)
- [Guardrails](07-Hooks-y-guardrails.md)
- [Flujo de reparación](10-Flujo-reparacion.md)

[Índice del segundo cerebro](00-Segundo-cerebro.md)
