import { test, expect } from '@playwright/test';
import { markedPhoto } from '../photo-fixture';
import { workbookBuffer } from '../workbook-helpers';

test('real OCR: wait for Excel, detect differences, recheck updates and preserve official grades on new photos', async ({ browser }, testInfo) => {
  test.setTimeout(120000);
  const context = await browser.newContext();
  await context.route('**/images.unsplash.com/**', route => route.abort());
  const teacher = await context.newPage(), student = await context.newPage();
  const errors: string[] = [], external: string[] = [];
  student.on('pageerror', error => errors.push(error.message));
  student.on('request', request => { if (!request.url().startsWith('http://127.0.0.1') && !request.url().includes('images.unsplash.com')) external.push(request.url()); });
  try {
    for (const [page, role, route, port] of [[teacher, 'teacher', 'docentes', 3101], [student, 'student', 'alumnos', 3102]] as const) {
      await page.goto(process.env.SERVE_HOSTED ? `http://127.0.0.1:3100/${route}/` : `http://127.0.0.1:${port}/`);
      await page.getByLabel('Usuario', { exact: true }).fill(`test-${role}`);
      await page.getByLabel('Contraseña', { exact: true }).fill('Browser-test-only-123');
      await page.getByRole('button', { name: 'Entrar', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
    }
    await teacher.getByRole('button', { name: 'Tareas', exact: true }).click();
    await teacher.getByPlaceholder('Ej: Problemas de Porcentajes').fill('Tarea corregida en clase');
    await teacher.getByRole('button', { name: 'Publicar Tarea' }).click();
    const card = student.locator('.homework-card').filter({ has: student.getByRole('heading', { name: 'Tarea corregida en clase', exact: true }) });
    await expect(card).toBeVisible();
    const upload = async (grade: string) => {
      await card.getByRole('button', { name: /Subir Foto|Reenviar Foto/ }).click();
      await student.locator('input[type=file]').setInputFiles(await markedPhoto(student, grade));
      await expect(student.getByRole('status')).toHaveText(`Nota detectada en la foto: ${grade}`, { timeout: 35000 });
      if (grade === 'A') {
        // Narrow the image to the written mark; selecting a new crop invalidates the old reading.
        await student.getByAltText('Preview').scrollIntoViewIfNeeded();
        const box = (await student.getByAltText('Preview').boundingBox())!;
        await student.mouse.move(box.x + box.width * 0.04, box.y + box.height * 0.05);
        await student.mouse.down();
        await student.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.4, { steps: 5 });
        await student.mouse.up();
        await expect(student.getByRole('button', { name: 'Confirmar Entrega' })).toBeDisabled();
        await student.getByRole('button', { name: 'Leer zona marcada' }).click();
        await expect(student.getByRole('status')).toHaveText('Nota detectada en la foto: A', { timeout: 35000 });
      }
      await student.getByRole('button', { name: 'Confirmar Entrega' }).click();
      await expect(student.getByRole('dialog')).toHaveCount(0);
    };
    await upload('AD');
    await expect(card.getByText('Espera la próxima actualización', { exact: true })).toBeVisible();
    await student.reload();
    await expect(card.getByText('Espera la próxima actualización', { exact: true })).toBeVisible();
    await expect(card.getByText('Nota leída en foto: AD')).toBeVisible();
    const state = await (await teacher.request.get(new URL('/api/teacher/state', teacher.url()).href)).json();
    const assignment = state.state.assignments.find((a: { title: string }) => a.title === 'Tarea corregida en clase');
    const importGrade = async (grade: string) => {
      await teacher.getByRole('button', { name: 'Conectar Excel', exact: true }).click();
      const buffer = await workbookBuffer([['CÓDIGO', `Tarea [${assignment.id}]`], ['EST-01', grade]]);
      await teacher.locator('input[type=file]').setInputFiles({ name: 'registro.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer });
      await teacher.getByRole('button', { name: 'Confirmar y Guardar Notas' }).click();
      await expect(teacher.getByRole('button', { name: 'Confirmar y Guardar Notas' })).toHaveCount(0);
    };
    await importGrade('B');
    await expect(card.getByText('Las notas son diferentes', { exact: true })).toBeVisible();
    await expect(card.getByText('Nota B', { exact: true })).toBeVisible();
    await importGrade('AD');
    await expect(card.getByText('Coincide con Excel', { exact: true })).toBeVisible();
    await upload('A');
    await expect(card.getByText('Las notas son diferentes', { exact: true })).toBeVisible();
    await expect(card.getByText('Nota AD', { exact: true })).toBeVisible();
    await importGrade('A');
    await expect(card.getByText('Coincide con Excel', { exact: true })).toBeVisible();
    await teacher.getByRole('navigation').getByRole('button', { name: /Revisar Fotos/ }).click();
    await teacher.getByLabel('Filtrar por Tarea:').selectOption(assignment.id);
    const teacherCard = teacher.locator('.grid > div').filter({ has: teacher.getByRole('heading', { name: 'Camila Mendoza', exact: true }) });
    await expect(teacherCard.getByText('Coincide con Excel', { exact: true })).toBeVisible();
    await student.setViewportSize({ width: 390, height: 844 });
    await card.scrollIntoViewIfNeeded();
    expect(await student.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await card.screenshot({ path: testInfo.outputPath('comparison-matched.png') });
    await importGrade('BORRAR');
    await expect(card.getByText('Espera la próxima actualización', { exact: true })).toBeVisible();
    await expect(card.getByText('Nota leída en foto: A')).toBeVisible();
    await card.screenshot({ path: testInfo.outputPath('comparison-waiting.png') });
    expect(errors).toEqual([]); expect(external).toEqual([]);
  } finally { await context.close(); }
});

test('an unavailable OCR engine still allows a photo to be saved without inventing a mark', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.context().route('**/ocr/tesseract-core-lstm.wasm.js', route => route.fulfill({ status: 503, body: '' }));
  await page.route('**/images.unsplash.com/**', route => route.abort());
  await page.goto(process.env.SERVE_HOSTED ? 'http://127.0.0.1:3100/alumnos/' : 'http://127.0.0.1:3102/');
  await page.getByLabel('Usuario', { exact: true }).fill('test-student');
  await page.getByLabel('Contraseña', { exact: true }).fill('Browser-test-only-123');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.getByRole('button', { name: 'Tomar / Subir Foto', exact: true }).first().click();
  await page.locator('input[type=file]').setInputFiles(await markedPhoto(page, 'AD'));
  await expect(page.getByRole('status')).toContainText('La lectura no está disponible', { timeout: 10000 });
  await page.getByRole('button', { name: 'Confirmar Entrega' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const state = await (await page.request.get(new URL('/api/student/state', page.url()).href)).json();
  const latest = state.state.submissions.sort((a: { submittedAt: string }, b: { submittedAt: string }) => b.submittedAt.localeCompare(a.submittedAt))[0];
  expect(latest.photoReading).toEqual({ status: 'unavailable', grade: null, confidence: 0 });
  expect(errors).toEqual([]);
});
