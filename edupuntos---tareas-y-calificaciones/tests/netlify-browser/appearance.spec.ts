import { test, expect } from '@playwright/test';

test('public pages follow the saved theme but expose no settings', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('http://127.0.0.1:3200/');
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await expect(page.getByText('Configuración',{exact:true})).toHaveCount(0);
  // A choice previously made inside the app still applies to the public entry points.
  await page.evaluate(() => localStorage.setItem('edupuntos.appearance','light'));
  for(const route of ['/', '/docentes/', '/alumnos/']) {
    await page.goto(`http://127.0.0.1:3200${route}`);
    await expect(page.locator('html')).toHaveAttribute('data-theme','light');
    await expect(page.getByText('Configuración',{exact:true})).toHaveCount(0);
  }
});

test('blocked storage falls back to the system on the public landing page', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked','SecurityError');}});
  });
  await page.emulateMedia({colorScheme:'dark'});
  await page.goto('http://127.0.0.1:3200/');
  await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
  await page.emulateMedia({colorScheme:'light'});
  await expect(page.locator('html')).toHaveAttribute('data-theme','light');
});
