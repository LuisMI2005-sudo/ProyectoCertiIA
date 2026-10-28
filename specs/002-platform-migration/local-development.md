# Puesta en marcha local

Este perfil requiere Node.js 24, Git y PostgreSQL instalado con `initdb` y `pg_ctl`. No utiliza la base ni las variables de Render. La base local de pruebas usa puerto 55433; sus datos, configuraciones y credenciales quedan ignorados por Git en `.platform-local/` y `.platform-pg/`.

## Backend

Desde la raíz del backend, en PowerShell:

```powershell
npm install
$env:DEVGUARDIAN_PG_BIN = 'C:\Users\HP\scoop\apps\postgresql\current\bin'
npm run platform:init
npm run platform:start
```

`platform:init` se ejecuta una sola vez. Crea siete bases con un prefijo aleatorio y roles privados y no reemplaza una configuración existente. La identidad inicial es `admin@devguardian.local`; su contraseña aleatoria está exclusivamente en `.platform-local/development/local-login.json`. Abrir ese archivo localmente para iniciar sesión; no subirlo, copiarlo a documentación ni enviarlo a terceros. La autenticación `trust` del clúster de desarrollo queda limitada a loopback: no usar este clúster en producción ni abrir el puerto a la red.

`platform:start` levanta siete servicios y el gateway en procesos separados, sin compartir entre ellos sus credenciales de DB. Solo el planificador recibe `ANTHROPIC_API_KEY` si está definida. El gateway responde en `http://127.0.0.1:4107`. Verificarlo con `npm run platform:status` en otra terminal. El supervisor detiene los demás servicios cuando uno termina inesperadamente.

## Frontend

Desde la raíz del frontend, en otra terminal:

```powershell
npm install
npm run build:platform
npm run preview:platform
```

Abrir `http://127.0.0.1:5173/`, iniciar sesión, elegir organización e importar un repositorio público. `npm run dev` sigue abriendo la aplicación anterior para comparar; no muestra la Shell multitenant. Evitar tener otro Vite usando el mismo puerto.

El build de plataforma usa por defecto el gateway local 4107. Para otra URL, definir `VITE_API_URL` antes de construir. El origen del navegador debe coincidir con `allowedOrigin` en las configuraciones locales del backend. No configurar `*` en este perfil.

## Publicación independiente de un remoto

```powershell
npm run build:remote -- review
```

Reconstruye solo revisión en `dist-platform/remotes/review/` y actualiza el manifiesto. Los nombres contienen hash del contenido; se preservan versiones previas para no romper una Shell ya abierta. Publicar los archivos antes del nuevo manifiesto. Todos los remotos se sirven desde el mismo origen; no se carga código de URLs elegidas por el usuario.

## Validación

```powershell
# Backend: integración PostgreSQL local obligatoria cuando se define esta variable
$env:DEVGUARDIAN_TEST_ADMIN_URL = 'postgresql://dg_local_admin@127.0.0.1:55433/postgres'
npm run test:platform
npm run check

# Frontend
npm run check
npm test
npm run build:platform
```

La integración genera bases temporales propias y las elimina al terminar; no usa las bases de desarrollo ni producción. Sin `DEVGUARDIAN_TEST_ADMIN_URL`, los casos PostgreSQL se omiten explícitamente y no acreditan aislamiento. El workflow de CI configura PostgreSQL efímero y define esa variable.

## Recuperación y límites

Si una auditoría pierde la respuesta, consultar el historial antes de reenviar. Una clave idempotente completada devuelve el resultado guardado; una clave pendiente o con desenlace desconocido no dispara otra ejecución. La reparación usa las garantías del motor previo. Los repositorios importados permiten análisis estático, pero permanecen bloqueados para ejecutar código sin sandbox de sistema operativo.

Los datos legacy no se copian automáticamente. La migración de datos históricos, la recuperación distribuida tras caída, TLS/mTLS, OIDC y el despliegue en Render requieren una etapa posterior con respaldo y validación propia. Ver [arquitectura y límites](architecture.md).
