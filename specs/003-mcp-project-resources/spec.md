# Recursos MCP por proyecto — HU-24

Fecha: 2026-10-30. Estado: especificado antes de implementar.

Como cliente MCP necesito descubrir configuración y estructura de cada proyecto autorizado y recuperar un análisis existente sin ejecutarlo otra vez.

- R1: anunciar `resources` y atender listado paginado, plantillas y lectura tanto en HTTP como en stdio del servidor principal.
- R2: publicar `devguardian://project/{projectId}/configuration` y `/structure`. La configuración es una proyección explícita de metadatos; nunca incluye raíz local, entorno, credenciales, URL remota ni comandos de runners. La estructura reutiliza el recorrido limitado y protegido del backend.
- R3: publicar `devguardian://analysis/{analysisId}?projectId={projectId}`. El parámetro es obligatorio en el servidor principal; vincula el análisis a su proyecto. El servidor de compatibilidad conserva su contrato anterior sin modificarlo.
- R4: validar UUID y URI completos antes de acceder. No aceptar rutas, raíces, parámetros adicionales, fragmentos ni variantes codificadas. Comprobar proyecto y raíz canónica en cada lectura; mantener aislamiento del repositorio del tenant y autenticación del transporte.
- R5: leer la caché del analizador del backend, compartida entre peticiones HTTP, con sus límites existentes de TTL, cantidad y bytes. Un análisis desconocido, expirado o expulsado responde MCP -32002; URI inválido -32602. No crear runtimes ni repetir análisis al leer recursos.
- R6: los errores no revelan rutas ni detalles internos. La lectura es de consulta y no crea auditorías de herramientas ficticias. No se anuncian suscripciones ni notificaciones que no estén implementadas.

Aceptación: pruebas con cliente SDK oficial de discovery, lectura de ambos recursos, reutilización de análisis entre clientes, cruce de proyectos, desaparición de caché, URI inválido, raíz cambiada, paginación y autenticación HTTP. Conservar pruebas de compatibilidad y controles de roles del gateway.

Límites: las cachés son efímeras y no sobreviven al reinicio/reclonado. Recursos no sustituyen el historial SQL. La configuración pública de autenticación/CORS y la migración de producción son tareas separadas; este cambio no acredita su cierre.
