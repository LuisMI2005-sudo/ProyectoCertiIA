---
proyecto: DevGuardian
tipo: arquitectura-objetivo
estado: diseno-no-implementado
categoria: frontend
fecha: 2026-10-28
tags: [devguardian, dg/objetivo, dg/capa/frontend]
---

# Microfrontend: Sandbox MCP

> Arquitectura objetivo solicitada. No acredita implementación, despliegue ni migraciones ejecutadas.

## Frontera funcional

Editor JSON y respuesta del servidor para usuarios autorizados. Punto de partida: Frontend/src/components/McpPanel.tsx. Se extrae como unidad de construcción y despliegue independiente; dividir carpetas o rutas no basta para acreditar microfrontends.

## Contrato con el Shell

Entradas versionadas: ruta base, cliente BFF y contexto de presentación de sesión/tenant. El contexto no concede permisos: el servidor los verifica. Cada remoto declara mount/unmount o entrada React compatible y sus eventos. No importar stores privados, páginas internas ni fuentes de otro remoto.

## Dependencias

Consume [BE-Gateway](BE-Gateway.md) a través del BFF; nunca PostgreSQL ni comandos del host. React, react-dom y subrutas compartidas requieren versiones compatibles verificadas en el spike de federación. El remoto debe funcionar en desarrollo aislado con contratos de prueba.

## Fallos y seguridad

ErrorBoundary por remoto, carga cancelable, mensajes de fallo y limpieza de suscripciones al desmontar. Aplicar guardas visibles sin confiar en ellas como autorización. Remotos permitidos y versiones controladas: el código remoto comparte contexto de navegador y no es un sandbox de seguridad.

**Patrones:** composition root en Shell, Adapter de transporte, componentes de presentación y hooks para estado. Mantener accesibilidad y temas compartidos mediante paquete UI versionado.

## Relaciones

- [MF-Shell](MF-Shell.md)
- [BE-Gateway](BE-Gateway.md)
- [AR-Microfrontends](AR-Microfrontends.md)
- [INF-Contratos](INF-Contratos.md)
- [Índice de arquitectura objetivo](00-Arquitectura-Objetivo.md)
- [Arquitectura actual](../arquitectura/00-Arquitectura-modulos.md)
