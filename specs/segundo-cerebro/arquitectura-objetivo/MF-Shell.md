---
proyecto: DevGuardian
tipo: arquitectura-objetivo
estado: diseno-no-implementado
categoria: frontend
fecha: 2026-10-28
tags: [devguardian, dg/objetivo, dg/capa/frontend]
---

# Shell de microfrontends

> Arquitectura objetivo solicitada. No acredita implementación, despliegue ni migraciones ejecutadas.

Aloja navegación, apariencia claro/oscuro, sesión y selección de tenant. Compone seis remotos por dominio y un paquete de diseño compartido versionado; ese paquete no es un séptimo remoto.

Propuesta: Module Federation para cargar artefactos versionados. La integración exacta con Vite y las versiones actuales de React requiere un spike antes de elegir paquetes o modificar dependencias. No se instala nada en esta fase.

BFF con sesión de servidor y cookies Secure/HttpOnly es el objetivo de autenticación web; CSRF y SameSite deben definirse y probarse según los orígenes elegidos. El sistema actual de token en memoria no se convierte automáticamente en OIDC.

No existe base propia del Shell ni acceso directo a credenciales de proveedor. El tema puede persistir localmente; identidad y tokens no se guardan en localStorage.

## Relaciones

- [MF-Proyectos](MF-Proyectos.md)
- [MF-Revision](MF-Revision.md)
- [MF-Resultados](MF-Resultados.md)
- [MF-Seguridad](MF-Seguridad.md)
- [MF-Subagentes](MF-Subagentes.md)
- [MF-Sandbox-MCP](MF-Sandbox-MCP.md)
- [BE-Gateway](BE-Gateway.md)
- [AR-Microfrontends](AR-Microfrontends.md)
- [Índice de arquitectura objetivo](00-Arquitectura-Objetivo.md)
- [Arquitectura actual](../arquitectura/00-Arquitectura-modulos.md)
