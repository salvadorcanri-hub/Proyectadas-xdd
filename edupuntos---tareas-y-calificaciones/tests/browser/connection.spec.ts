import { test, expect } from '@playwright/test';
const address = (role: string) => process.env.SERVE_HOSTED ? `http://127.0.0.1:3100/${role === 'teacher' ? 'docentes' : 'alumnos'}/` : `http://127.0.0.1:${role === 'teacher' ? 3101 : 3102}/`;

test('stalled initial loading shows a delay notice, stops waiting and can retry', async ({ page }) => {
  let blocked = true, requests = 0;
  await page.clock.install();
  await page.route('**/api/student/auth/me', route => { requests++; if (!blocked) return route.continue(); });
  await page.goto(address('student'));
  await expect.poll(() => requests).toBe(1);
  await page.clock.fastForward(8100);
  await expect(page.getByText(/Está tardando más de lo habitual/)).toBeVisible();
  await page.clock.fastForward(23000);
  await expect(page.getByRole('alert')).toContainText('tardó demasiado');
  await expect(page.getByText('Cargando EduPuntos…')).toHaveCount(0);
  blocked = false;
  await page.getByRole('button', { name: 'Reintentar carga' }).click();
  await expect(page.getByLabel('Usuario', { exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

for (const role of ['student', 'teacher']) test(`${role}: offline and failed refresh warnings recover without logging out`, async ({ context, page }, testInfo) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  if (role === 'student') await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(address(role));
  await page.getByLabel('Usuario', { exact: true }).fill(`test-${role}`);
  await page.getByLabel('Contraseña', { exact: true }).fill('Browser-test-only-123');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
  let failed = true;
  await page.route(`**/api/${role}/state`, route => failed ? route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"Test unavailable"}' }) : route.continue());
  await context.setOffline(true);
  await expect(page.getByText(/Sin conexión. Los datos podrían/)).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByText(/No pudimos actualizar los datos/)).toBeVisible();
  const banner = await page.getByRole('complementary', { name: 'Estado de conexión' }).boundingBox();
  const navigation = await page.locator(`.${role}-navigation`).boundingBox();
  expect(navigation!.y).toBeGreaterThanOrEqual(banner!.y + banner!.height - 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath(`${role}-stale-data.png`), fullPage: true });
  failed = false;
  await page.getByRole('button', { name: 'Actualizar datos' }).click();
  await expect(page.getByText(/No pudimos actualizar los datos/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
  if (role === 'student') {
    await page.getByRole('button', { name: 'Tomar / Subir Foto', exact: true }).first().click();
    await context.setOffline(true);
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText(/Sin conexión. Los datos podrían/)).toBeVisible();
    const notice = await dialog.getByRole('complementary').boundingBox();
    const title = await dialog.getByRole('heading').boundingBox();
    expect(notice!.y + notice!.height).toBeLessThanOrEqual(title!.y);
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('student-offline-dialog.png'), fullPage: true });
    await context.setOffline(false);
    await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  }
  expect(errors).toEqual([]);
});
