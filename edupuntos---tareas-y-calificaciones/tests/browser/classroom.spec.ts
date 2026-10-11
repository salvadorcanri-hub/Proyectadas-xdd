import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { readWorkbook, workbookBuffer } from '../workbook-helpers';

const photo = { name: 'cuaderno.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64') };
const portal = (role: 'teacher' | 'student') => process.env.SERVE_HOSTED
  ? `http://127.0.0.1:3100/${role === 'teacher' ? 'docentes' : 'alumnos'}/`
  : `http://127.0.0.1:${role === 'teacher' ? 3101 : 3102}/`;

async function login(page: Page, role: 'teacher' | 'student', username = `test-${role}`) {
  await page.route('**/images.unsplash.com/**', route => route.abort());
  await page.goto(portal(role));
  await page.getByLabel('Usuario', { exact: true }).fill(username);
  await page.getByLabel('Contraseña', { exact: true }).fill('Browser-test-only-123');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
}

test('rejected replacement files cannot accidentally submit a previously selected photo', async ({ page }) => {
  await login(page, 'student');
  await page.getByRole('button', { name: 'Tomar / Subir Foto', exact: true }).first().click();
  const file = page.locator('input[type=file]');
  const confirm = page.getByRole('button', { name: 'Confirmar Entrega', exact: true });
  await file.setInputFiles(photo);
  await expect(confirm).toBeEnabled();
  await file.setInputFiles({ name: 'documento.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7') });
  await expect(page.getByText('Selecciona una imagen JPG, PNG o WebP de hasta 5 MB.')).toBeVisible();
  await expect(confirm).toBeDisabled();
  await expect(page.getByAltText('Preview')).toHaveCount(0);
  await file.setInputFiles({ ...photo, buffer: Buffer.alloc(5 * 1024 * 1024 + 1) });
  await expect(confirm).toBeDisabled();
  await file.setInputFiles(photo);
  await expect(confirm).toBeEnabled();
});

test('live classroom changes preserve an unsaved teacher reward draft', async ({ browser }) => {
  const context = await browser.newContext();
  const teacher = await context.newPage();
  const student = await context.newPage();
  try {
    await login(teacher, 'teacher');
    await login(student, 'student', 'test-student-2');
    await teacher.getByRole('button', { name: 'Premios Top 3', exact: true }).click();
    const draft = teacher.locator('form input').first();
    await draft.fill('Elegir el próximo experimento del aula');
    await student.getByRole('button', { name: 'Tomar / Subir Foto', exact: true }).first().click();
    await student.locator('input[type=file]').setInputFiles(photo);
    const review = teacher.getByRole('navigation').getByRole('button', { name: /Revisar Fotos/ });
    const before = await review.textContent();
    await student.getByRole('button', { name: 'Confirmar Entrega', exact: true }).click();
    await expect(student.getByRole('button', { name: 'Confirmar Entrega', exact: true })).toHaveCount(0);
    await expect(review).not.toHaveText(before!);
    await expect(draft).toHaveValue('Elegir el próximo experimento del aula');
    await teacher.getByRole('button', { name: 'Guardar y Publicar Premios' }).click();
    await expect(teacher.getByText(/Premios actualizados/)).toBeVisible();
    await teacher.reload();
    await teacher.getByRole('button', { name: 'Premios Top 3', exact: true }).click();
    await expect(draft).toHaveValue('Elegir el próximo experimento del aula');
  } finally { await context.close(); }
});

test('classroom journey: three students, interrupted upload, feedback, resubmission and Excel', async ({ browser }, testInfo) => {
  test.setTimeout(90000);
  const teacherContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const studentContexts = await Promise.all([390, 768, 1440].map(width => browser.newContext({ viewport: { width, height: 844 } })));
  const teacher = await teacherContext.newPage();
  const students = await Promise.all(studentContexts.map(context => context.newPage()));
  const errors: string[] = [];
  let initialPoints: number[] = [];
  for (const page of [teacher, ...students]) page.on('pageerror', error => errors.push(error.message));
  const title = 'Reto del aula: fracciones en la cocina';
  const instructions = Array.from({ length: 8 }, (_, i) => `${i + 1}. Representa una fracción con dibujos y explica el procedimiento con tus palabras.`).join('\n') + '\nÚltimo paso: escribe una conclusión y tu nombre antes de tomar la foto.';
  const task = (page: Page) => page.locator('.homework-card').filter({ has: page.getByRole('heading', { name: title, exact: true }) });
  const report = (page: Page) => page.locator('div.py-3\\.5').filter({ hasText: title });
  const reviewCard = (name: string) => teacher.locator('.grid > div').filter({ has: teacher.getByRole('heading', { name, exact: true }) });
  try {
    await test.step('Create a task and deliver it live to three independent student accounts', async () => {
      await login(teacher, 'teacher');
      await Promise.all(students.map((page, i) => login(page, 'student', i ? `test-student-${i + 1}` : 'test-student')));
      await teacher.getByRole('button', { name: 'Tareas', exact: true }).click();
      await teacher.getByPlaceholder('Ej: Problemas de Porcentajes').fill(title);
      await teacher.locator('input[type=date]').fill('2026-12-01');
      await teacher.getByPlaceholder('Detalles sobre los ejercicios y cómo tomar la foto...').fill(instructions);
      await teacher.getByRole('button', { name: 'Publicar Tarea', exact: true }).click();
      await Promise.all(students.map(page => expect(task(page)).toBeVisible()));
      initialPoints = await Promise.all(students.map(async page => parseInt((await page.locator('.student-journey strong').textContent())!, 10)));
      const mobile = students[0];
      await task(mobile).getByText('Leer instrucciones completas').click();
      await expect(task(mobile).locator('details')).toHaveAttribute('open', '');
      const description = task(mobile).locator('details p');
      await expect(description).toContainText('Último paso: escribe una conclusión');
      expect(await description.evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
    });
    await test.step('Recover from connection failure with the photo and comment preserved', async () => {
      const mobile = students[0];
      await task(mobile).getByRole('button', { name: 'Tomar / Subir Foto' }).click();
      const dialog = mobile.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await mobile.keyboard.press('Escape');
      await expect(dialog).toHaveCount(0);
      await expect(task(mobile).getByRole('button', { name: 'Tomar / Subir Foto' })).toBeFocused();
      await task(mobile).getByRole('button', { name: 'Tomar / Subir Foto' }).click();
      for (let i = 0; i < 7; i++) {
        await mobile.keyboard.press('Tab');
        expect(await mobile.evaluate(() => !!document.activeElement?.closest('dialog'))).toBe(true);
      }
      await dialog.locator('input[type=file]').setInputFiles(photo);
      await dialog.getByLabel('Comentario al profesor:').fill('Camila: explicación de la receta familiar');
      await mobile.route('**/api/student/submissions', route => route.abort('internetdisconnected'));
      await dialog.getByRole('button', { name: 'Confirmar Entrega' }).click();
      await expect(dialog.getByRole('alert')).toContainText('Comprueba tu conexión');
      await expect(dialog.getByLabel('Comentario al profesor:')).toHaveValue('Camila: explicación de la receta familiar');
      await expect(dialog.getByAltText('Preview')).toBeVisible();
      await mobile.unroute('**/api/student/submissions');
      let release!: () => void;
      const pending = new Promise<void>(resolve => { release = resolve; });
      await mobile.route('**/api/student/submissions', async route => { await pending; await route.continue(); });
      try {
        await dialog.getByRole('button', { name: 'Confirmar Entrega' }).click();
        await expect(dialog.getByRole('button', { name: 'Enviando...' })).toBeDisabled();
        await expect(dialog.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
        await mobile.keyboard.press('Escape');
        await expect(dialog).toBeVisible();
      } finally { release(); }
      await expect(dialog).toHaveCount(0);
      await mobile.unroute('**/api/student/submissions');
    });
    await test.step('Two more students submit simultaneously and the teacher receives both', async () => {
      await Promise.all(students.slice(1).map(async (page, i) => {
        await task(page).getByRole('button', { name: 'Tomar / Subir Foto' }).click();
        await page.locator('input[type=file]').setInputFiles(photo);
        await page.getByLabel('Comentario al profesor:').fill(`Entrega privada de ${i === 0 ? 'Mateo' : 'Lucía'}`);
        await page.getByRole('button', { name: 'Confirmar Entrega' }).click();
        await expect(page.getByRole('dialog')).toHaveCount(0);
      }));
      await teacher.getByRole('navigation').getByRole('button', { name: /Revisar Fotos/ }).click();
      const id = await teacher.getByRole('option', { name: new RegExp(title) }).getAttribute('value');
      await teacher.getByLabel('Filtrar por Tarea:').selectOption(id!);
      for (const name of ['Camila Mendoza', 'Mateo Quispe', 'Lucía Fernández']) {
        await expect(reviewCard(name).getByRole('button', { name: 'Ampliar y Examinar Foto' })).toBeVisible();
      }
      const own = await students[0].request.get(new URL('/api/student/state', students[0].url()).href);
      const { state } = await own.json();
      expect(state.submissions.every((s: { studentId: string }) => s.studentId === 'est-1')).toBe(true);
      expect(state.grades.every((g: { studentId: string }) => g.studentId === 'est-1')).toBe(true);
    });
    await test.step('Grade photos, return feedback and show points on each student account', async () => {
      const names = ['Camila Mendoza', 'Mateo Quispe', 'Lucía Fernández'];
      const grades = ['AD', 'A', 'B'];
      for (let i = 0; i < names.length; i++) {
        const card = reviewCard(names[i]);
        await card.getByPlaceholder('Retroalimentación al estudiante...').fill(`Buen trabajo, ${names[i].split(' ')[0]}. Revisa la conclusión.`);
        await card.getByRole('button', { name: new RegExp(`^${grades[i]} \\+`) }).click();
        await students[i].getByRole('button', { name: 'Mi Libreta' }).click();
        await expect(report(students[i]).getByText(`Nota ${grades[i]}`, { exact: true })).toBeVisible();
        await expect(report(students[i])).toContainText(`Buen trabajo, ${names[i].split(' ')[0]}`);
        await expect(students[i].locator('.student-journey strong')).toHaveText(`${initialPoints[i] + [10, 8, 6][i]} puntos`);
      }
      await reviewCard(names[0]).getByRole('button', { name: 'Ampliar y Examinar Foto' }).click();
      await expect(teacher.getByRole('dialog')).toBeVisible();
      await teacher.getByRole('button', { name: 'Acercar foto' }).click();
      await teacher.getByRole('button', { name: 'Girar foto' }).click();
      await teacher.keyboard.press('Escape');
      await expect(teacher.getByRole('dialog')).toHaveCount(0);
      for (const page of [teacher, students[0]]) {
        await page.waitForFunction(() => !document.querySelector('canvas'));
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      }
      await teacher.screenshot({ path: testInfo.outputPath('teacher-classroom.png'), fullPage: true });
      await students[0].screenshot({ path: testInfo.outputPath('student-mobile-report.png'), fullPage: true });
    });
    await test.step('Replace a photo without deleting the official grade or points', async () => {
      const mobile = students[0];
      await mobile.getByRole('button', { name: 'Mis Deberes' }).click();
      await task(mobile).getByRole('button', { name: 'Cambiar / Reenviar Foto' }).click();
      await expect(mobile.getByRole('dialog')).toContainText('Leeremos la nota de la foto');
      await mobile.locator('input[type=file]').setInputFiles(photo);
      await mobile.getByLabel('Comentario al profesor:').fill('Camila: segunda versión con la conclusión corregida');
      await mobile.getByRole('button', { name: 'Confirmar Entrega' }).click();
      await expect(mobile.getByRole('dialog')).toHaveCount(0);
      await expect(task(mobile).getByText('Nota AD', { exact: true })).toBeVisible();
      await expect(mobile.locator('.student-journey strong')).toHaveText(`${initialPoints[0] + 10} puntos`);
      await expect(reviewCard('Camila Mendoza').getByPlaceholder('Retroalimentación al estudiante...')).toHaveValue('Buen trabajo, Camila. Revisa la conclusión.');
    });
    await test.step('Download Excel, reject a partially invalid sheet atomically, then import corrected grades', async () => {
      await teacher.getByRole('button', { name: 'Conectar Excel' }).click();
      const downloaded = teacher.waitForEvent('download');
      await teacher.getByRole('button', { name: 'Descargar .XLSX' }).click();
      const download = await downloaded;
      const sheet = await readWorkbook(readFileSync((await download.path())!));
      const col = sheet[0].findIndex(cell => String(cell).startsWith(title));
      expect(col).toBeGreaterThan(1);
      sheet[1][col] = 'C'; sheet[2][col] = 'NOTA INCORRECTA';
      const upload = async () => {
        await teacher.locator('input[type=file]').setInputFiles({ name: 'notas-aula.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: await workbookBuffer(sheet) });
        await teacher.getByRole('button', { name: 'Confirmar y Guardar Notas' }).click();
      };
      await upload();
      await expect(teacher.getByText(/nota «NOTA INCORRECTA» inválida/)).toBeVisible();
      await students[0].reload();
      await expect(task(students[0]).getByText('Nota AD', { exact: true })).toBeVisible();
      sheet[1][col] = 'AD'; sheet[2][col] = 'B';
      await upload();
      await expect(teacher.getByRole('button', { name: 'Confirmar y Guardar Notas' })).toHaveCount(0);
      await expect(task(students[0]).getByText('Nota AD')).toBeVisible();
      await expect(report(students[1]).getByText('Nota B')).toBeVisible();
      await teacher.reload();
      await teacher.getByRole('button', { name: 'Planilla Rápida' }).click();
      await expect(teacher.getByLabel(`Nota de Camila Mendoza en ${title}`)).toHaveValue('AD');
      await expect(teacher.getByLabel(`Nota de Mateo Quispe en ${title}`)).toHaveValue('B');
      for (const page of students) {
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      }
    });
    await test.step('Ranking remains consistent across accounts and saved work survives a new login', async () => {
      const ranks: string[] = [];
      for (const page of students) {
        await page.getByRole('button', { name: 'Ranking & Premios' }).click();
        const row = page.getByRole('row').filter({ hasText: 'Camila Mendoza' });
        await expect(row).toBeVisible();
        ranks.push((await row.locator('td').first().textContent())!);
        await expect(row).toContainText(`${initialPoints[0] + 10}`);
      }
      expect(new Set(ranks).size).toBe(1);
      await students[0].getByRole('button', { name: 'Cerrar sesión' }).click();
      await expect(students[0].getByRole('button', { name: 'Entrar', exact: true })).toBeVisible();
      await login(students[0], 'student');
      await expect(task(students[0]).getByText('Nota AD')).toBeVisible();
    });
    expect(errors).toEqual([]);
  } finally { await Promise.all([teacherContext, ...studentContexts].map(context => context.close())); }
});

test('incorrect password can be corrected and a student cannot sign in to the teacher portal', async ({ page }) => {
  await page.goto(portal('teacher'));
  await page.getByLabel('Usuario', { exact: true }).fill('test-student');
  await page.getByLabel('Contraseña', { exact: true }).fill('Browser-test-only-123');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Usuario o contraseña incorrectos');
  await page.goto(portal('student'));
  await page.getByLabel('Usuario', { exact: true }).fill('test-student');
  await page.getByLabel('Contraseña', { exact: true }).fill('Contraseña equivocada');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Usuario o contraseña incorrectos');
  await page.getByLabel('Contraseña', { exact: true }).fill('Browser-test-only-123');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
});
