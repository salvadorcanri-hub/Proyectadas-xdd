# Publicar EduPuntos con Netlify + Supabase

Esta modalidad publica dos aplicaciones estáticas en Netlify y usa Supabase para usuarios, base de datos y fotografías. No necesita Render, Express, SQLite ni un servidor de pago. Puedes comenzar con los planes gratuitos disponibles; revisa sus cuotas y condiciones actuales, especialmente almacenamiento de fotos, transferencia, usuarios y pausas por inactividad. Esta configuración no contrata servicios ni activa facturación automáticamente.

## 1. Crear el proyecto de Supabase

1. Entra en https://supabase.com y crea una cuenta.
2. Crea una organización/proyecto en el plan gratuito que ofrezca tu cuenta. Ponle un nombre, por ejemplo `edupuntos`, elige una región cercana y una contraseña fuerte para la base de datos.
3. Guarda esa contraseña de forma privada. **No es una variable del sitio ni tienes que enviarla por chat.**
4. Espera a que termine de crearse el proyecto.

Cada proyecto representa una institución con 20 aulas de secundaria (1.º–5.º, secciones A–D). Cada profesor gestiona solo las aulas asignadas por el administrador. No mezcles colegios en el mismo proyecto. Consulta [aulas y migración de datos anteriores](CLASSROOMS.md).

## 2. Crear las tablas, funciones y permisos

1. Dentro de Supabase abre **SQL Editor → New query**.
2. Ejecuta los archivos de `supabase/migrations/` en orden: `001_edupuntos.sql`, `002_photo_authorization.sql`, `003_photo_grade_comparison.sql`, `004_student_registration.sql` y `005_classrooms.sql`. Copia cada archivo completo, pégalo y pulsa **Run**. Si ya ejecutaste alguno, continúa con los siguientes pendientes; no vuelvas a aplicar una migración antigua después de una nueva. `003` añade la comparación de notas; `004` habilita los perfiles del registro de alumnos y la búsqueda privada para acceder con DNI; `005` crea las 20 aulas y restringe el acceso por asignación.
3. Para empezar con ocho estudiantes y tres tareas de ejemplo, ejecuta también `supabase/demo.sql`. Este paso es opcional, no crea cuentas, notas ni fotos y no sustituye datos existentes. Los ejemplos quedan pendientes de asignación de aula; no ejecutes este archivo para el piloto de cinco cuentas nuevas.

El primer SQL crea las tablas `edu_*`, un bucket **privado** `edupuntos-homework`, las políticas RLS y las funciones de la aplicación. También incorpora `edu_changes` a la publicación `supabase_realtime`, si existe. Comprueba en la configuración de Realtime/replicación que `edu_changes` está habilitada; solo transmite un contador de cambios, nunca fotos o comentarios. La app también vuelve a consultar cada minuto como respaldo.

No hagas público el bucket y no desactives RLS para resolver errores. Los profesores pueden gestionar sus aulas asignadas; los alumnos solo pueden entregar con su identidad, leer sus notas y abrir sus fotos. El ranking comparte nombres, puntos y recuentos de notas del aula.

## 3. Crear las cuentas y asignar las aulas

Sigue [PILOT_FIVE_USERS.md](PILOT_FIVE_USERS.md): crea los dos docentes en Authentication, confirma sus cuentas y ejecuta `supabase/pilot.example.sql` con sus correos reales. Ese archivo asigna al primero 1.º A y al segundo 2.º B. Los tres alumnos se registran desde la web, eligen el aula indicada y confirman su correo.

El rol se guarda en `edu_profiles`; las asignaciones docentes en `edu_teacher_classrooms`. El registro público solo concede el rol de alumno. La administración de estas asignaciones se hace en Supabase, sin conceder permisos de edición de perfiles a los usuarios. Las cuentas de SQLite no se transfieren. La recuperación de contraseña en la interfaz sigue pendiente.

## 4. Obtener los dos datos públicos del proyecto

En los ajustes del proyecto o el diálogo **Connect**, localiza:

| Variable de Netlify | Qué debes copiar |
| --- | --- |
| `VITE_SUPABASE_URL` | La URL de proyecto, con formato `https://…supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | La clave pública **publishable**, normalmente `sb_publishable_…`. Si tu proyecto muestra claves antiguas, sirve la clave **anon**. |

Estas dos variables se incorporan al navegador por diseño; la seguridad depende de Auth y RLS. **Nunca pongas `service_role`, `sb_secret_…` ni contraseñas en variables `VITE_*`.** El compilador rechaza claves secretas reconocibles. El acceso por DNI requiere además `SUPABASE_SECRET_KEY`, únicamente para la función del servidor de Netlify; consulta [su configuración](STUDENT_ACCOUNTS.md).

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

En Supabase configura la **Site URL** de Authentication con la dirección HTTPS de Netlify y permite la URL `/alumnos/` para volver desde la confirmación del correo. El acceso usa correo o DNI y contraseña. El correo se autentica directamente con Supabase; el DNI usa `/.netlify/functions/dni-login`, que Netlify despliega desde el repositorio. No configures `/api` para esta modalidad.

## 6. Comprobar que funciona

1. Abre `/docentes/` y entra con la cuenta del profesor.
2. Abre `/alumnos/` y entra con la cuenta del alumno; las dos sesiones pueden convivir en el mismo navegador.
3. Crea una tarea desde docentes y comprueba que aparece en alumnos.
4. Sube una foto PNG, JPEG o WebP de hasta 5 MB desde alumnos.
5. Sube una foto con la nota escrita por el profesor. Si aún no hay nota en el registro, el alumno verá **Espera la próxima actualización**. La lectura de escritura a mano debe validarse con fotos reales; una imagen dudosa queda sin lectura clara.
6. Descarga la plantilla Excel, registra la nota de esa tarea y vuelve a importarla. El alumno debe ver la coincidencia o diferencia con la foto sin reenviarla. Se aceptan `.xlsx` y `.csv` en UTF-8; guarda los `.xls` antiguos como `.xlsx`. Las celdas vacías conservan notas; `BORRAR` elimina una nota explícitamente. Los cambios del archivo se validan y guardan en una sola transacción. Repite la importación cada vez que actualices el archivo. Consulta [el flujo de comprobación](PHOTO_GRADE_WORKFLOW.md).

Las fotografías se sirven con enlaces firmados que caducan a los cinco minutos. Como cualquier enlace firmado, quien lo reciba puede usarlo hasta su caducidad; no lo compartas. Las fotos reemplazadas quedan en el almacenamiento hasta su limpieza administrativa: vigila la cuota del plan gratuito. Los roles y el ranking se calculan en la base de datos para que ambas apps y Excel coincidan.

## Datos existentes y límites de esta adaptación

El SQL no importa automáticamente la base SQLite actual ni sus fotos; permanece intacta en el entorno anterior. Para las primeras pruebas sigue el piloto de cinco cuentas nuevas. Si necesitas trasladar datos reales, prepara una migración administrativa con respaldo y correspondencia entre estudiantes y cuentas Auth. No publiques esos datos ni claves privadas en GitHub.

El modo Express/SQLite sigue disponible con `npm run dev`. Se retiró la configuración de Render porque el despliegue elegido es Netlify + Supabase. Si ya hubieras contratado algo en Render, elimina/cancela allí ese servicio para evitar que siga generando cargos: cambiar el código no lo cancela.

## Desarrollo y verificaciones

Para desarrollo Supabase, copia `.env.example` a `.env.local`, rellena solo los dos datos públicos y ejecuta `npm run dev:supabase:teacher` y `npm run dev:supabase:student`. Las rutas son `/docentes/` y `/alumnos/` en sus respectivos puertos de desarrollo.

- `npm run lint`: tipos.
- `npm test`: pruebas del servidor local y SQL/RLS usando PostgreSQL embebido (PGlite).
- `npm run build:netlify`: compilación estática; requiere configuración pública válida.
- `npm run test:netlify`: navegador con respuestas de Supabase simuladas para comprobar el cliente compilado. No conecta con un proyecto real.

Las pruebas locales no acreditan que tu proyecto remoto esté configurado. La publicación real y la comprobación final requieren completar los pasos anteriores con tu propio proyecto.
