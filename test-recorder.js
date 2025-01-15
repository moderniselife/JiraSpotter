class TestRecorder {
    constructor() {
        this.recording = false;
        this.actions = [];
        this.startTime = null;
    }

    start() {
        this.recording = true;
        this.actions = [];
        this.startTime = new Date();
        this.addAction('// Test recorded on ' + this.startTime.toLocaleString());
    }

    stop() {
        this.recording = false;
        return this.generateTest();
    }

    addAction(action) {
        if (this.recording) {
            this.actions.push(action);
        }
    }

    recordClick(selector, text) {
        this.addAction(`await page.click('${selector}');${text ? ` // Clicked "${text}"` : ''}`);
    }

    recordNavigation(url) {
        this.addAction(`await page.goto('${url}');`);
    }

    recordInput(selector, value) {
        this.addAction(`await page.fill('${selector}', '${value}');`);
    }

    recordScreenshot(name) {
        this.addAction(`await page.screenshot({ path: '${name}.png' });`);
    }

    generateTest() {
        const template = `
import { test, expect } from '@playwright/test';

test('Recorded Test', async ({ page }) => {
    ${this.actions.join('\n    ')}
});
`;
        return template.trim();
    }
}

// Export for use in content script
window.TestRecorder = TestRecorder;