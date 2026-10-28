---
proyecto: DevGuardian
tipo: modulo
estado: implementacion-documentada
tags: [devguardian, dg/seguridad, dg/modulos]
---

# Integración con el asistente del IDE

Los hooks y perfiles del asistente del entorno de desarrollo son una integración separada de los workers deterministas y de los hooks React. La activación local requiere las condiciones documentadas; no cambiar permisos para conseguir un resultado de demostración.

## Evidencia y alcance

src/ide-integration/README.md; .codex/hooks.json; .codex/agents/.

Esta nota describe responsabilidades de la implementación; no constituye una prueba de ejecución ni una medición de rendimiento.

## Relaciones de colaboración

- [Hooks y guardrails del motor](09-Hooks.md)
- [Contratos, errores y seguridad de rutas](04-Shared.md)
- [Agent Client generativo: LangChain y MCP](10-Agent-Client.md)
- [Concepto relacionado](../07-Hooks-y-guardrails.md)
- [Mapa de módulos](00-Arquitectura-modulos.md)
