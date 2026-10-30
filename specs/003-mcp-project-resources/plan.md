# Plan de implementación

1. Definir contrato y amenazas en [spec.md](spec.md).
2. Añadir lectura de recursos al backend: validar proyecto/raíz, serializar con sus herramientas, proyectar configuración y reutilizar caché y listado de archivos.
3. Registrar handlers MCP separados en un módulo de recursos; mantener herramientas intactas y compartir la misma instancia backend entre peticiones.
4. Comprobar contrato con SDK oficial, rechazos de acceso, caché y autenticación; ejecutar check, build, pruebas pertinentes y sdd:check.
5. Registrar resultados reales en validation.md y actualizar QA-015 sin afirmar integración ni despliegue.
