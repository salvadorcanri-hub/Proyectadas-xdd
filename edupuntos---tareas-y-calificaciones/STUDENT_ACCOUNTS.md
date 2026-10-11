# Registro de alumnos y acceso con DNI o correo

Los alumnos pueden abrir **Crear cuenta de alumno** en `/alumnos/` y completar nombres, apellidos, DNI peruano de 8 dígitos, correo y contraseña. Después pueden elegir **Correo electrónico** o **DNI** para entrar con la misma contraseña. Las cuentas docentes siguen siendo asignadas por el administrador; no hay alta pública de profesores.

## Activar la nueva versión en Supabase y Netlify

1. En **Supabase → SQL Editor**, ejecuta el contenido completo de [`supabase/migrations/004_student_registration.sql`](supabase/migrations/004_student_registration.sql). Requiere las migraciones 001, 002 y 003 ya aplicadas. No repitas las antiguas después de esta.
2. En la configuración de **Authentication**, habilita las nuevas inscripciones y el proveedor **Email**. Configura una contraseña mínima de **12 caracteres** en Supabase. Con **Confirm email** activado, el alumno recibe un enlace y debe confirmar su correo antes de entrar. Su ficha de alumno se crea al confirmar.
3. En **Authentication → URL Configuration**, usa tu dirección real de Netlify como **Site URL**, por ejemplo `https://mini-proyectos.netlify.app`, y añade `https://mini-proyectos.netlify.app/alumnos/` a **Redirect URLs**. Tras abrir el enlace de confirmación, el alumno vuelve al acceso e introduce sus credenciales.
4. Para entrar con DNI, añade en **Netlify → Environment variables** una variable **solo de servidor**, llamada `SUPABASE_SECRET_KEY`. Copia allí una clave **secret** (`sb_secret_…`) de **Supabase → Project Settings → API Keys**. También es compatible la clave antigua `service_role`. Debe estar disponible para **Functions** (o **All scopes**, según tu plan). **No uses el prefijo `VITE_`, no la pegues en el chat y no la guardes en GitHub.** Las dos variables públicas existentes se mantienen.
5. Vuelve a desplegar la rama `main` desde Netlify. La configuración del repositorio incluye la función `dni-login`; no hay que crearla a mano.

El correo de confirmación depende del servicio de correo configurado en Supabase. El servicio predeterminado tiene límites y restricciones para destinatarios; para alumnos con correos externos puede ser necesario configurar **SMTP propio** en Authentication. Revisa los registros de Auth si el correo no llega. La app muestra el estado de confirmación y los errores de envío; no da por confirmado un correo porque se haya enviado el formulario.

Si falta la clave del servidor o la migración, el acceso con DNI muestra un error y permite usar el correo. El formulario comprueba que la migración está disponible antes de solicitar el alta a Supabase. Las cuentas creadas administrativamente antes de este cambio siguen funcionando con su correo; no tienen DNI asociado automáticamente.

## Verificación en tu web

1. Entra en `/alumnos/`: no debe aparecer **Configuración**. Abre **Crear cuenta de alumno**, completa los campos y comprueba que las contraseñas coinciden.
2. Si se solicita, confirma tu correo mediante el enlace recibido. Entra con el correo y la contraseña.
3. Abre **Configuración → Apariencia**, cambia el tema y cierra sesión. Configuración debe desaparecer y el tema elegido debe conservarse.
4. Selecciona **DNI** y entra con los 8 dígitos y la misma contraseña. Debe aparecer el mismo nombre, tareas y cuenta.
5. Comprueba que una contraseña incorrecta no deja entrar, que la sesión persiste al recargar y que la cuenta de alumno no puede entrar en `/docentes/`.
6. Entra con una cuenta docente existente y comprueba que el nuevo alumno aparece en el aula y en la plantilla Excel.

Cada registro nuevo crea una ficha nueva. No se vincula automáticamente a una ficha de demostración con nombre parecido. El sistema valida el formato del DNI, pero no consulta RENIEC ni acredita que quien lo escribe sea su titular.

## Protección de datos y pruebas

- Nombres y apellidos forman el nombre mostrado en el aula. El DNI se guarda en `edu_student_accounts`, con RLS y sin permisos de lectura para alumnos o profesores; tampoco aparece en el ranking, las fotos ni la plantilla Excel.
- El acceso por correo usa Supabase Auth. Para DNI, una función de Netlify resuelve el correo de forma privada y pide a Supabase Auth comprobar la contraseña. El navegador recibe los tokens solo después de una autenticación válida. Los fallos no revelan el correo asociado.
- El servidor limita los intentos por DNI y por origen en PostgreSQL, compartidos entre instancias. Los registros de estos límites caducan a los 15 minutos; no contienen contraseñas ni DNI en texto.
- Los metadatos enviados desde el formulario nunca conceden el rol docente ni permiten elegir otro estudiante. El perfil del registro público siempre es `student`. Cambiar los metadatos de Auth no cambia el DNI de acceso ni el rol.
- En el modo local Express/SQLite se usa la misma interfaz. El registro crea la sesión inmediatamente; no dispone de envío ni confirmación de correo. Supabase es quien gestiona esa confirmación en la web publicada.
- Las pruebas automatizadas usan SQLite, PostgreSQL embebido y navegador; las llamadas a Supabase en el navegador de pruebas están simuladas. La entrega real del correo, las claves y la configuración del proyecto remoto deben comprobarse siguiendo los pasos anteriores.
