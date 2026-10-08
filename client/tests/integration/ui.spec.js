import { test, expect } from '@playwright/test';

test.describe('React Application Integration', () => {

  test('should mock backend health check and display state on screen', async ({ page }) => {
    // Intercept client API calls and supply a mock backend response
    await page.route('**/api/health', async (route) => {
      const json = { status: 'Mocked OK', environment: 'frontend-test' };
      await route.fulfill({ json });
    });

    // Go to your local development or pipeline application URL
    await page.goto('/');

    // Assert that your React component updated properly based on the mocked API response
    const statusText = page.locator('#backend-status');
    await expect(statusText).toContainText('Mocked OK');
  });

});

