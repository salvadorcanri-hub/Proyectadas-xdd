import { test, expect } from '@playwright/test';

test('appearance survives navigation and synchronizes tabs under production CSP', async ({ context, page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await context.route('https://test-project.supabase.co/**', route => route.fulfill({ status: 401, contentType: 'application/json', body: '{}' }));
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('http://127.0.0.1:3200/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByText('Configuración', { exact: true }).click();
  await expect(page.getByLabel('Tema de la aplicación')).toHaveValue('system');
  await page.getByLabel('Tema de la aplicación').selectOption('light');
  await page.screenshot({ animations: 'disabled', path: testInfo.outputPath('landing-light.png') });
  await page.getByRole('link', { name: /Profesores/ }).click();
  await expect(page.getByRole('heading', { name: 'EduPuntos Docentes' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  const second = await context.newPage();
  await second.emulateMedia({ colorScheme: 'dark' });
  await second.goto('http://127.0.0.1:3200/alumnos/');
  await second.getByText('Configuración', { exact: true }).click();
  await expect(second.getByLabel('Tema de la aplicación')).toHaveValue('light');
  await page.getByText('Configuración', { exact: true }).click();
  await page.getByLabel('Tema de la aplicación').selectOption('dark');
  await expect(second.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(second.getByLabel('Tema de la aplicación')).toHaveValue('dark');
  await second.getByLabel('Tema de la aplicación').selectOption('system');
  await expect(page.getByLabel('Tema de la aplicación')).toHaveValue('system');
  await page.goto('http://127.0.0.1:3200/');
  await page.getByText('Configuración', { exact: true }).click();
  await page.screenshot({ animations: 'disabled', path: testInfo.outputPath('landing-dark.png') });
  expect(errors).toEqual([]);
  await second.close();
});

test('blocked storage still allows changing appearance', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } });
  });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('http://127.0.0.1:3200/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByText('Configuración', { exact: true }).click();
  await page.getByLabel('Tema de la aplicación').selectOption('light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});
