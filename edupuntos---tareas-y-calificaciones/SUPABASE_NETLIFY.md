# Publicar EduPuntos con Netlify + Supabase

Esta modalidad publica dos aplicaciones estáticas en Netlify y usa Supabase para usuarios, base de datos y fotografías. No necesita Render, Express, SQLite ni un servidor de pago. Puedes comenzar con los planes gratuitos disponibles; revisa sus cuotas y condiciones actuales, especialmente almacenamiento de fotos, transferencia, usuarios y pausas por inactividad. Esta configuración no contrata servicios ni activa facturación automáticamente.

## 1. Crear el proyecto de Supabase

1. Entra en https://supabase.com y crea una cuenta.
2. Crea una organización/proyecto en el plan gratuito que ofrezca tu cuenta. Ponle un nombre, por ejemplo `edupuntos`, elige una región cercana y una contraseña fuerte para la base de datos.
3. Guarda esa contraseña de forma privada. **No es una variable del sitio ni tienes que enviarla por chat.**
4. Espera a que termine de crearse el proyecto.

Cada proyecto de Supabase equivale a un aula/institución compartida: todos sus docentes gestionan los mismos estudiantes. No mezcles escuelas que deban tener datos aislados en este mismo proyecto.

## 2. Crear las tablas, funciones y permisos

1. Dentro de Supabase abre **SQL Editor → New query**.
2. Ejecuta los archivos de `supabase/migrations/` en orden: primero `001_edupuntos.sql` y después `002_photo_authorization.sql`. Copia cada archivo completo, pégalo y pulsa **Run**. Si ya ejecutaste el primero, ejecuta solo el segundo; no vuelvas a aplicar `001` después de `002`.
3. Para empezar con ocho estudiantes y tres tareas de ejemplo, ejecuta también `supabase/demo.sql`. Este paso es opcional, no crea cuentas, notas ni fotos y no sustituye datos existentes.

El primer SQL crea las tablas `edu_*`, un bucket **privado** `edupuntos-homework`, las políticas RLS y las funciones de la aplicación. También incorpora `edu_changes` a la publicación `supabase_realtime`, si existe. Comprueba en la configuración de Realtime/replicación que `edu_changes` está habilitada; solo transmite un contador de cambios, nunca fotos o comentarios. La app también vuelve a consultar cada minuto como respaldo.

No hagas público el bucket y no desactives RLS para resolver errores. Los profesores pueden gestionar el aula; los alumnos solo pueden entregar con su identidad, leer sus notas y abrir sus fotos. El ranking comparte nombres, puntos y recuentos de notas del aula.

## 3. Crear una cuenta docente y otra de alumno

1. Abre **Authentication → Users → Add user** y crea una cuenta con correo y contraseña para el profesor y otra diferente para el alumno. Usa la opción de confirmar el correo administrativamente si estás creando cuentas de prueba; así no dependes del envío de correo.
2. Si no quieres inscripciones públicas, deshabilita el registro de nuevos usuarios en la configuración de Authentication. Registrarse por sí solo nunca concede acceso al aula.
3. Abre `supabase/profiles.example.sql`, sustituye los dos correos por los que acabas de crear y ejecútalo en SQL Editor.
4. El profesor recibe rol `teacher`. El alumno queda vinculado a `est-1` (Camila, si cargaste la demostración). Para añadir más alumnos, crea sus cuentas y asígnales identificadores distintos, como `est-2`, `est-3`, etc.

La segunda migración protege las fotografías si se cambia el alumno asociado a una cuenta.

El rol se guarda en `edu_profiles`, no en metadatos que pueda modificar el usuario. Una cuenta sin perfil asignado no puede entrar a los datos. Las cuentas de la versión SQLite anterior **no se transfieren**; crea las cuentas nuevas en Supabase Auth. La recuperación de contraseñas en la interfaz no está implementada: el administrador debe gestionarla desde Supabase.

## 4. Obtener los dos datos públicos del proyecto

En los ajustes del proyecto o el diálogo **Connect**, localiza:

| Variable de Netlify | Qué debes copiar |
| --- | --- |
| `VITE_SUPABASE_URL` | La URL de proyecto, con formato `https://…supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | La clave pública **publishable**, normalmente `sb_publishable_…`. Si tu proyecto muestra claves antiguas, sirve la clave **anon**. |

Estas dos variables se incorporan al navegador por diseño; la seguridad depende de Auth y RLS. **Nunca uses `service_role`, una clave `sb_secret_…`, una contraseña de base de datos ni un token personal.** El compilador rechaza claves secretas reconocibles.

## 5. Conectar Netlify con GitHub

1. Entra en https://app.netlify.com y elige **Add new project / Import an existing project** (el nombre puede variar).
2. Conecta GitHub y selecciona `salvadorcanri-hub/Proyectadas-xdd`, rama `main`.
3. Netlify debe leer `netlify.toml` de la raíz del repositorio. Comprueba estos ajustes:
   - Base directory: `edupuntos---tareas-y-calificaciones`
   - Build command: `bun install --frozen-lockfile && npm run build:netlify`
   - Publish directory: `dist/netlify` (relativo al directorio base)
4. Antes de compilar, añade las dos variables anteriores en **Environment variables**, disponibles durante el build. Si la interfaz no permite añadirlas antes, guarda el proyecto, añádelas en sus ajustes y vuelve a desplegar.
5. Usa las opciones gratuitas que se ajusten a tu cuenta. Revisa cualquier pantalla de facturación antes de aceptar cambios de plan.
6. Pulsa **Deploy** y espera a que la compilación finalice. Si falta una variable, el despliegue se detiene con un mensaje explícito; no se publica una app desconectada.

La dirección HTTPS de Netlify ofrece:

- `/`: accesos a las dos apps.
- `/docentes/`: aplicación docente.
- `/alumnos/`: aplicación de alumnos.

En Supabase configura la **Site URL** de Authentication con la dirección HTTPS de Netlify. El inicio de sesión actual usa correo y contraseña, no OAuth ni enlaces mágicos. No necesita desplegar funciones de Netlify ni configurar `/api`: el navegador se conecta directamente a Supabase con los permisos de su usuario.

## 6. Comprobar que funciona

1. Abre `/docentes/` y entra con la cuenta del profesor.
2. Abre `/alumnos/` y entra con la cuenta del alumno; las dos sesiones pueden convivir en el mismo navegador.
3. Crea una tarea desde docentes y comprueba que aparece en alumnos.
4. Sube una foto PNG, JPEG o WebP de hasta 5 MB desde alumnos.
5. Califícala desde docentes y verifica que la nota aparece en la libreta del alumno.
6. Descarga la plantilla Excel, modifica una nota y vuelve a importarla. Se aceptan `.xlsx` y `.csv` en UTF-8; guarda los `.xls` antiguos como `.xlsx`. Las celdas vacías conservan notas; `BORRAR` elimina una nota explícitamente. Los cambios del archivo se validan y guardan en una sola transacción.

Las fotografías se sirven con enlaces firmados que caducan a los cinco minutos. Como cualquier enlace firmado, quien lo reciba puede usarlo hasta su caducidad; no lo compartas. Las fotos reemplazadas quedan en el almacenamiento hasta su limpieza administrativa: vigila la cuota del plan gratuito. Los roles y el ranking se calculan en la base de datos para que ambas apps y Excel coincidan.

## Datos existentes y límites de esta adaptación

El SQL no importa automáticamente la base SQLite actual ni sus fotos; permanece intacta en el entorno anterior. Para las primeras pruebas usa el aula de demostración. Si necesitas trasladar datos reales, prepara una migración administrativa con respaldo y correspondencia entre estudiantes y cuentas Auth. No publiques esos datos ni claves privadas en GitHub.

El modo Express/SQLite sigue disponible con `npm run dev`; `render.yaml` se conserva solo como alternativa de pago. No necesitas usarlo para Netlify. Si ya hubieras contratado algo en Render, elimina/cancela allí ese servicio para evitar que siga generando cargos: cambiar el código no lo cancela.

## Desarrollo y verificaciones

Para desarrollo Supabase, copia `.env.example` a `.env.local`, rellena solo los dos datos públicos y ejecuta `npm run dev:supabase:teacher` y `npm run dev:supabase:student`. Las rutas son `/docentes/` y `/alumnos/` en sus respectivos puertos de desarrollo.

- `npm run lint`: tipos.
- `npm test`: pruebas del servidor local y SQL/RLS usando PostgreSQL embebido (PGlite).
- `npm run build:netlify`: compilación estática; requiere configuración pública válida.
- `npm run test:netlify`: navegador con respuestas de Supabase simuladas para comprobar el cliente compilado. No conecta con un proyecto real.

Las pruebas locales no acreditan que tu proyecto remoto esté configurado. La publicación real y la comprobación final requieren completar los pasos anteriores con tu propio proyecto.
