# EduPuntos

Dos aplicaciones web independientes conectadas a una API común:

- **Docentes**: tareas, revisión de fotos, calificaciones, Excel y premios.
- **Alumnos**: entregas propias, notas, comentarios del docente y ranking del aula.

Cada aplicación tiene su entrada, servidor y compilación. No existe un selector para cambiar de rol ni para hacerse pasar por otro alumno. Las sesiones de ambas apps pueden coexistir en el mismo navegador.

## Requisitos e instalación

Node.js **24 o posterior** y Bun **1.4.2**. Desde esta carpeta:

```sh
bun install --frozen-lockfile
```

En el entorno de Codex, Bun está en `/workspace/cloud-tools/node_modules/.bin/bun`.

## Cuentas

No hay contraseñas predeterminadas ni registro público. Un administrador con acceso al servidor crea las cuentas con estos comandos; cada uno solicita una contraseña de 12 a 128 caracteres sin mostrarla:

```sh
npm run user:create -- --username profesor --role teacher
npm run user:create -- --username alumno01 --role student --student est-1
```

Los identificadores `est-1` a `est-8` corresponden a los estudiantes de demostración. Para datos migrados, usa los identificadores de esos estudiantes. La administración de matrículas y la recuperación de contraseñas desde la interfaz no están implementadas. El comando también acepta la contraseña por entrada estándar para automatización; no la pases como argumento ni la guardes en el repositorio.

Las contraseñas se guardan como hashes scrypt con sal aleatoria. Las sesiones duran ocho horas, usan cookies HttpOnly y SameSite=Strict, y se revocan al salir. Cada rol tiene su cookie y ruta de API. El servidor autoriza todas las operaciones; el alumno solo puede entregar con la identidad de su sesión. Las fotografías y los comentarios individuales están restringidos al alumno propietario y al docente. El ranking comparte nombres, puntos y recuentos de notas dentro del aula.

## Desarrollo

```sh
npm run dev
```

Inicia tres procesos y los detiene juntos con Ctrl+C:

| Servicio | Puerto predeterminado | Comando individual |
| --- | --- | --- |
| API común | 3000 | `npm run dev:api` |
| App de docentes | 3001 | `npm run dev:teacher` |
| App de alumnos | 3002 | `npm run dev:student` |

Las apps envían `/api` al servidor común mediante un proxy. Las actualizaciones llegan por SSE; crear una tarea, entregar una foto o cambiar una nota se refleja en las apps conectadas. El navegador nunca necesita acceder directamente al puerto de la API.

Variables opcionales:

- `DATA_DIR`: directorio persistente; predeterminado `data/` junto al proyecto.
- `PORT` y `API_HOST`: API; predeterminados `3000` y `127.0.0.1`.
- `API_TARGET`: destino del proxy de ambas apps; predeterminado `http://127.0.0.1:3000`.
- `TEACHER_PORT` y `STUDENT_PORT`: puertos de desarrollo.
- `APP_PORT` y `APP_HOST`: puerto y dirección del servidor de una app compilada.

No se requiere Gemini ni una clave de IA. La aplicación no utiliza inteligencia artificial.

## Datos y migración

La API usa `data/edupuntos.sqlite` con transacciones, claves externas y modo WAL. Las imágenes PNG, JPEG o WebP, de hasta 5 MB, se guardan en `data/uploads/`; la base solo guarda sus referencias. Las fotos solo se sirven después de comprobar la sesión y el propietario.

Al arrancar por primera vez, si existe el antiguo `data/db.json`, se copia a `data/db.json.backup` y se importa a SQLite. Se conservan notas, tareas, estudiantes, premios y entregas, y se extraen las imágenes Base64. El JSON original permanece intacto. Si la migración falla, el arranque se interrumpe para evitar sustituir datos por una demostración. Tras una migración correcta, SQLite pasa a ser la fuente de datos; editar el JSON ya no afecta a la aplicación.

Sin datos previos se crea el aula de demostración. No se crean cuentas automáticamente. Haz copias de seguridad de todo `DATA_DIR` con el servicio detenido, incluyendo fotografías, SQLite y los archivos WAL/SHM que existan. No borres los datos como parte de una instalación. Los archivos de fotos que queden sin referencias tras reemplazar una entrega se conservan para evitar eliminar material; no hay limpieza automática.

## Calificaciones, entregas y Excel

- AD = 10 puntos; A = 8; B = 6; C = 4.
- Una tarea entregada sin nota aparece **en revisión**; una tarea sin entrega ni nota está **pendiente**.
- Reemplazar una foto elimina la calificación anterior de esa tarea para que el docente revise la nueva entrega.
- El ranking y Excel usan el mismo cálculo: puntos, número de tareas calificadas, nombre en español e identificador para un desempate estable.
- Descarga la plantilla desde la app docente. Conserva la columna **CÓDIGO** y los identificadores de tarea `[asg-…]`.
- Las celdas vacías **conservan** las notas existentes. `BORRAR` elimina explícitamente una nota, sin eliminar la entrega.
- Se aceptan AD/A/B/C y sus equivalencias 10/8/6/4. Otras notas, códigos desconocidos, duplicados o columnas ambiguas rechazan **todo** el archivo, sin cambios parciales.
- Se admiten hasta 10000 filas y archivos de hasta 5 MB. No se asocian tareas por posición ni estudiantes por nombres parciales.

## Pruebas y compilación

```sh
npm run lint
npm test
npm run build
```

`npm test` comprueba permisos, sesiones, sincronización, privacidad de las fotos, migración, persistencia, ranking e importación de Excel. Las pruebas crean datos temporales y no usan el aula real.

```sh
npx playwright install chromium
npm run test:browser
```

Si Chromium ya está instalado, puede usarse `CHROMIUM_PATH=/usr/bin/chromium npm run test:browser`. La prueba abre ambas apps, inicia sesiones distintas, crea una tarea, sube una foto, califica y comprueba la actualización en vivo. Usa los puertos 3100–3102 y un directorio temporal propio.

La compilación produce `dist/teacher/` y `dist/student/`. La app del alumno no incluye la interfaz docente ni la librería de Excel; la app docente carga Excel bajo demanda.

## Ejecutar las apps compiladas

Después de `npm run build`, ejecuta cada proceso en su terminal:

```sh
npm start
npm run start:teacher
npm run start:student
```

Para desplegar, sirve cada app en su propio dominio HTTPS, configura `API_TARGET` hacia **la misma API** y conserva `DATA_DIR` en un volumen persistente. Los servidores de app incluidos sirven archivos estáticos y reenvían `/api`, incluidos cookies y SSE. Usa `NODE_ENV=production` en la API para activar cookies Secure; necesitas HTTPS en los dominios de las apps. Ajusta `API_HOST` o `APP_HOST` si el proxy o la red de contenedores lo requiere. Conserva una sola instancia de la API para que todos sus clientes compartan las notificaciones SSE.

## Despliegue sencillo en un alojamiento Node.js

**GitHub Pages no ejecuta Node.js, SQLite ni sesiones.** El 404 de Pages aparece cuando se publica una carpeta sin `index.html`. Publicar solo los archivos de React tampoco pone en funcionamiento la API. Usa un alojamiento que ejecute el servidor para desplegar EduPuntos completo.

Se incluye una modalidad de un solo servicio web con dos aplicaciones compiladas e independientes:

```sh
npm run build:hosted
NODE_ENV=production npm run start:hosted
```

El proceso escucha en `0.0.0.0` y respeta el `PORT` que indique el alojamiento. La raíz ofrece los accesos a **`/docentes/`** y **`/alumnos/`**. Cada app conserva su entrada, compilación y sesión. Ambas llaman a `/api` en el mismo dominio, lo que permite usar sus cookies de forma segura sin configurar CORS. Esta modalidad no sustituye los comandos para desplegar las apps en dominios separados.

La compilación de esta modalidad queda en `dist/hosted/`, con las rutas de recursos correctas para cada app. Para comprobar todo el flujo antes de desplegar:

```sh
CHROMIUM_PATH=/usr/bin/chromium npm run test:hosted
```

### Opción preparada: Render

El archivo `render.yaml` está en la **raíz del repositorio**. Define un servicio Node.js y un disco persistente de 1 GB para SQLite y fotos. **El plan Starter y el disco son de pago**; revisa el precio en Render antes de confirmar. Este archivo por sí solo no crea servicios ni realiza cargos.

1. Sube a GitHub todos los cambios del proyecto, incluidos `render.yaml`, `server/`, `scripts/`, `apps/`, `package.json` y `bun.lock`. Los cambios locales de Codex no aparecen en GitHub hasta que los publiques allí. No subas `data/`, `node_modules/` ni contraseñas.
2. En Render, crea un **Blueprint** y conecta `salvadorcanri-hub/Proyectadas-xdd`. Render leerá `render.yaml`; revisa el plan y el disco antes de aceptar.
3. Espera a que el servicio termine de compilar y alcance el estado disponible. Usa la dirección HTTPS que proporcione Render, no la dirección `github.io`.
4. En la consola del servicio, dentro de la carpeta de la aplicación, crea las cuentas con `npm run user:create -- --username profesor --role teacher` y el comando equivalente para cada alumno. Introduce las contraseñas cuando el programa las solicite.
5. Abre `/docentes/` o `/alumnos/` en el dominio de Render. La comprobación de disponibilidad está en `/api/health`.

El servidor nuevo comienza con el aula de demostración si su disco está vacío. Los datos del entorno actual no se transfieren con el código: para conservarlos, detén la API de origen, copia el directorio de datos completo por un canal privado al `DATA_DIR` de destino y arranca el servicio. No publiques esa copia en GitHub.

No uses un disco efímero para datos reales: las notas, cuentas y fotografías deben sobrevivir a los reinicios y despliegues. Si prefieres otro proveedor, usa los mismos comandos de compilación y arranque, HTTPS y un volumen persistente para `DATA_DIR`.
