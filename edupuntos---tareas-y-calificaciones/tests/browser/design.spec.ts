import { test, expect } from '@playwright/test';

test('both workspaces remain usable on narrow screens and overview shortcuts open the right task', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  await context.route('**/images.unsplash.com/**', route => route.abort());
  for (const role of ['teacher', 'student'] as const) {
    const page = await context.newPage();
    const port = role === 'teacher' ? 3101 : 3102;
    await page.goto(process.env.SERVE_HOSTED ? `http://127.0.0.1:3100/${role === 'teacher' ? 'docentes' : 'alumnos'}/` : `http://127.0.0.1:${port}`);
    await page.getByLabel('Usuario', { exact: true }).fill(`test-${role}`);
    await page.getByLabel('Contraseña', { exact: true }).fill('Browser-test-only-123');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
    const navigation = page.getByRole('navigation');
    const tabs = role === 'teacher' ? ['Inicio', 'Tareas', 'Revisar Fotos', 'Planilla Rápida', 'Conectar Excel', 'Podio & Ranking', 'Premios Top 3'] : ['Mis Deberes', 'Mi Libreta', 'Ranking & Premios'];
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const tab of tabs) {
        const button = navigation.getByRole('button', { name: tab, exact: tab !== 'Revisar Fotos' });
        await button.click();
        await expect(button).toHaveAttribute('aria-current', 'page');
        expect(await page.evaluate(() => document.documentElement.scrollWidth), `${role}: ${tab} at ${width}px`).toBeLessThanOrEqual(width);
      }
    }
    if (role === 'teacher') {
      await navigation.getByRole('button', { name: 'Inicio', exact: true }).click();
      await page.getByRole('button', { name: 'Revisar Ensayo: El Medio Ambiente', exact: true }).click();
      await expect(page.getByLabel('Filtrar por Tarea:')).toHaveValue('asg-2');
    } else {
      await page.getByRole('button', { name: 'Ver mis pendientes' }).click();
      await expect(page.getByRole('button', { name: 'Pendientes', exact: true })).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByRole('heading', { name: 'Fracciones y Porcentajes', exact: true })).toHaveCount(0);
    }
  }
  await context.close();
});
