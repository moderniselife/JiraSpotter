import { test, expect } from '@playwright/test';

test('basic test example', async ({ page }) => {
    // Go to a test page
    await page.goto('https://example.com');
    
    // Click on example link
    await page.click('a');
    
    // Fill in a form field
    await page.fill('input[type="text"]', 'test input');
    
    // Take a screenshot
    await page.screenshot({ path: 'example.png' });
});