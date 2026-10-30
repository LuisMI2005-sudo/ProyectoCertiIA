# Arquitectura

```mermaid
flowchart LR
  Cliente[Cliente MCP] --> Transporte[HTTP o stdio]
  Transporte --> Recursos[Handlers de recursos]
  Recursos --> Backend[Backend del tenant o workspace]
  Backend --> Guardia[Proyecto y raiz canonica]
  Guardia --> Config[Metadatos permitidos]
  Guardia --> Estructura[Recorrido limitado]
  Guardia --> Cache[Cache de analisis del proyecto]
```

El gateway conserva sus controles de membresía y escritura para POST MCP. No se amplían permisos del rol viewer. El servidor independiente conserva su autenticación configurable existente.
