import { test, expect } from '@playwright/test';

for (const role of ['teacher', 'student'] as const) {
  test(`${role}: system appearance, manual override, persistence and accessible settings`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/images.unsplash.com/**', route => route.abort());
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto(process.env.SERVE_HOSTED ? `http://127.0.0.1:3100/${role === 'teacher' ? 'docentes' : 'alumnos'}/` : `http://127.0.0.1:${role === 'teacher' ? 3101 : 3102}/`);
    const root = page.locator('html');
    await expect(root).toHaveAttribute('data-theme', 'dark');
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(root).toHaveAttribute('data-theme', 'light');
    await page.getByText('Configuración', { exact: true }).click();
    await page.getByLabel('Tema de la aplicación').selectOption('dark');
    await page.reload();
    await expect(root).toHaveAttribute('data-theme', 'dark');
    await page.getByLabel('Usuario', { exact: true }).fill(`test-${role}`);
    await page.getByLabel('Contraseña', { exact: true }).fill('Browser-test-only-123');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    const settings = page.getByRole('button', { name: 'Configuración', exact: true });
    await settings.click();
    await expect(page.getByRole('dialog', { name: 'Configuración' })).toBeVisible();
    await expect(page.getByLabel('Tema de la aplicación')).toHaveValue('dark');
    await page.getByLabel('Tema de la aplicación').selectOption('system');
    await expect(root).toHaveAttribute('data-theme', 'light');
    await page.keyboard.press('Escape');
    await expect(settings).toBeFocused();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ animations: 'disabled', path: testInfo.outputPath(`${role}-light.png`), fullPage: true });
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(root).toHaveAttribute('data-theme', 'dark');
    await page.screenshot({ animations: 'disabled', path: testInfo.outputPath(`${role}-dark.png`), fullPage: true });
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await settings.click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await expect(page.getByLabel('Tema de la aplicación')).toBeVisible();
      await page.getByLabel('Tema de la aplicación').selectOption('light');
      await expect(root).toHaveAttribute('data-theme', 'light');
      await page.getByLabel('Tema de la aplicación').selectOption('dark');
      if (width === 390) await page.screenshot({ animations: 'disabled', path: testInfo.outputPath(`${role}-settings-mobile.png`) });
      await page.getByRole('button', { name: 'Cerrar configuración' }).click();
    }
    expect(errors).toEqual([]);
  });
}
