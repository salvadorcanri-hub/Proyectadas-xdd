# Comprobar la nota del cuaderno con Excel

## Flujo del aula

1. El profesor revisa la tarea en clase y escribe su nota en el cuaderno.
2. El estudiante, desde casa, abre esa tarea y sube una foto donde se vea la nota.
3. La app intenta leer la nota escrita en la imagen. No evalúa ni corrige los ejercicios.
4. Compara esa lectura con el registro del mismo estudiante y la misma tarea, actualizado por el profesor desde Excel.
5. Cada actualización del registro vuelve a calcular la comparación; el alumno no necesita reenviar la foto para recibir el resultado.

| Situación | Mensaje para el estudiante |
| --- | --- |
| Todavía no subió la foto | Falta la foto de la tarea. |
| Subió la foto, pero todavía no hay nota en el registro | **Espera la próxima actualización.** Tu foto está guardada; se comprobará cuando el profesor actualice Excel. |
| La nota de la foto coincide con la del registro | **Coincide con Excel.** |
| Las dos notas son distintas | **Las notas son diferentes.** Pide al profesor que revise la diferencia. |
| Hay nota en el registro, pero la foto no se pudo leer | **No se pudo leer la nota de la foto.** Sube una imagen más clara o marca la zona de la nota. |

La lectura de una foto nunca cambia la nota oficial ni concede puntos. Subir otra foto conserva la nota, los comentarios del profesor y los puntos registrados. Las discrepancias tampoco sustituyen la nota por la lectura automática. El profesor puede comprobar la imagen y corregir su registro si corresponde.

## Uso por el profesor

En **Conectar Excel**, descarga la plantilla, registra las notas y vuelve a importar el archivo actualizado. Conserva el código de cada alumno y el identificador de cada tarea. La confirmación de la importación publica los cambios para los alumnos conectados.

La integración actual funciona mediante importación de archivos. Editar un Excel en el ordenador o en OneDrive no modifica la app hasta volver a importarlo. Las celdas vacías conservan notas existentes; si la nota nunca estuvo registrada, la foto queda en espera. `BORRAR` quita explícitamente una nota y devuelve la comparación a la espera de una nueva actualización.

**Revisar Fotos** muestra ambas notas, el resultado y la imagen. La planilla y los botones de ajuste manual siguen disponibles como alternativa para modificar el registro del profesor. El ranking usa exclusivamente ese registro.

## Lectura gratuita en el navegador

La app utiliza Tesseract.js, cargado desde los archivos de su propio despliegue. El reconocimiento se ejecuta en el navegador del alumno, sin clave de IA ni servicio externo de pago. La foto se guarda en el almacenamiento privado de la app al confirmar la entrega. El motor y su modelo se descargan la primera vez que hacen falta y consumen ancho de banda del alojamiento.

Esta primera versión reconoce **AD, A, B y C**. Busca marcas como `NOTA: AD` o `Calificación: B`. Para una nota aislada en una página con ejercicios, el alumno puede marcar la zona de la nota con el dedo o el ratón y pulsar **Leer zona marcada**. También hay controles de zona accesibles con teclado. Se conserva la foto completa para que el profesor pueda revisarla.

No se interpretan números de los ejercicios como notas. Excel sigue admitiendo las equivalencias 10/8/6/4; las notas numéricas fotografiadas no se reconocen en esta versión.

El motor no garantiza una lectura correcta de escritura a mano. Las lecturas de baja confianza o con notas contradictorias quedan sin lectura clara. El umbral de confianza es una regla conservadora, no un porcentaje garantizado de exactitud. Se puede detener la lectura o guardar una foto que no se pudo interpretar; nunca se inventa una nota para completar el proceso. El alumno no dispone de un campo para escribir la supuesta nota detectada.

La comparación es una ayuda: una coincidencia no autentica la escritura o la firma del profesor. La lectura se calcula en el navegador y sus metadatos se consideran datos aportados por el cliente. El servidor valida su estructura y permisos, pero **nunca los usa para modificar notas ni puntos**. La nota oficial sigue siendo responsabilidad del profesor.

## Actualización del despliegue

- **Express/SQLite:** no requiere migración manual; el dato adicional se guarda en el contenido de cada entrega. Las fotos antiguas sin lectura aparecen pendientes de una foto legible cuando ya existe nota oficial.
- **Supabase:** ejecutar `supabase/migrations/003_photo_grade_comparison.sql` después de `001_edupuntos.sql` y `002_photo_authorization.sql`. Si las dos primeras ya se aplicaron, ejecutar solo `003`. Después desplegar la compilación nueva en Netlify. La migración conserva las notas y fotos existentes y mantiene las políticas de acceso privado.
- La compilación incluye el motor OCR, su modelo y la política CSP que permite ejecutar WebAssembly. No necesita destinos externos nuevos ni claves secretas.

## Pruebas y límites

`tests/browser/verification.spec.ts` usa el motor OCR real con una imagen PNG sintética de una tarea que contiene una nota **impresa**. Comprueba la espera, la discrepancia, la coincidencia tras actualizar Excel, la lectura de una zona y la conservación de la nota al reemplazar la foto. Comprueba también que el OCR no hace peticiones a servicios externos y que la lectura guardada sobrevive a una recarga.

La prueba de Netlify ejecuta también el OCR real y las cabeceras de producción; simula solamente los servicios remotos de Supabase. Las pruebas de API y SQL comprueban permisos, validación de lecturas y conservación del registro oficial. No hay un proyecto Supabase real configurado en este entorno.

Antes del piloto hay que probar fotografías reales de las notas manuscritas de los profesores, con distintos teléfonos y condiciones de luz. Si la precisión no es suficiente, se necesitará mejorar el reconocimiento o facilitar una marca escrita más clara; las pruebas sintéticas no demuestran exactitud con escritura real.
