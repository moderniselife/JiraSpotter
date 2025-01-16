# Jira Spotter

**Effortlessly link and track Jira tickets directly from your platform.**

Jira Spotter is a Chrome extension designed to streamline your development workflow by connecting your platform to Jira. With just a simple attribute or task ID, you can view associated Jira tickets directly in a convenient side panel.

---

## 🚀 Features

- **Flexible Integration**: Use either the `jira-taskid` attribute or simply include the Jira task ID anywhere in your HTML, CSS, or JavaScript files, even in comments.
- **Smart Task Detection**: Automatically detects Jira task IDs in your code without requiring explicit attributes.
- **Real-Time Insights**: Display linked Jira tickets in a responsive side panel while navigating your platform.
- **Secure Authentication**: Supports both OAuth and access key/base URL authentication methods.
- **Local Processing**: All operations are performed locally within your browser—no data is transmitted externally.
- **Native Side Panel**: Seamlessly integrated with Chrome's side panel API for a better user experience.
- **Test Recording**: Built-in Playwright test recorder for automated testing of Jira ticket workflows.
- **Screenshot Capture**: Capture and attach screenshots directly to Jira tickets.
- **Enhanced Jira Integration**: Full read/write access for ticket management and attachments.
- **Smart Element Selection**: Automatically detect and link Jira tickets from selected text or elements.
- **Element Tagging**: Link and highlight HTML elements using CSS or XPath selectors in Jira descriptions and comments.
- **User Mentions**: Reference Jira users with @ mentions in ticket descriptions and comments.

---

## 🛠️ Installation

1. Download and install the Jira Spotter Chrome extension from the [Chrome Web Store](#) (soon - in review - for now download and load as unpacked extension).
2. Click the extension icon in your browser to open the settings panel.
3. Configure your Jira authentication method (OAuth or access key with base URL).
4. Add either `jira-taskid="JIRA ID HERE"` or simply include the Jira ID (e.g., "JIRA-1234") anywhere in your project's HTML, CSS, or JavaScript files.

---

## ⚙️ Usage

1. Open your platform where you've added Jira task references.
2. Click on the Jira Spotter icon in your browser to open the side panel.
3. View the Jira tickets associated with the page directly in the panel.

### Examples:

#### HTML:

You can reference Jira tickets in two ways:

```html
<!-- Using the jira-taskid attribute -->
<div jira-taskid="JIRA-1234">Feature Section</div>

<!-- Or simply include the task ID -->
<div>Feature Section for JIRA-1234</div>

<!-- In comments - both styles work -->
<!-- jira-taskid="JIRA-5678" -->
<!-- Working on JIRA-5678 -->
```

#### JavaScript:

Reference Jira tickets in your JavaScript code:

```javascript
// Using the attribute in comments
// jira-taskid="JIRA-91011"
function exampleFeature() {
  console.log("Feature implemented");
}

// Or simply reference the ticket
// This implements JIRA-91011
function anotherFeature() {
  console.log("Another feature implemented");
}
```

#### CSS:

Reference Jira tickets within CSS comments:

```css
/* Using the attribute */
/* jira-taskid="JIRA-121314" */
.my-class {
  color: blue;
}

/* Or simply reference the ticket */
/* Styling for JIRA-121314 */
.another-class {
  font-size: 16px;
}
```

The extension will detect and link Jira tasks regardless of how they're referenced, making them visible in the side panel when active.

### Smart Selection

To quickly link Jira tickets from existing content:

1. Select any text or element containing a Jira ticket reference
2. Right-click and choose "Link Jira Ticket"
3. You will be asked to pick from tickets found on the page or to enter a Jira URL/ID
4. A comment will then be added to the ticket - but won't show in the JiraSpotter side panel unless we can figure out a way to do that..

### Element Tagging

Link and highlight specific HTML elements using CSS or XPath selectors in Jira ticket descriptions and comments:

#### CSS Selector Examples:

```
[tag]input[type="email"][/tag] - Links to email input fields
[tag].submit-button[/tag] - Links to elements with class 'submit-button'
[tag]#login-form[/tag] - Links to element with ID 'login-form'
[tag]button.primary:first-child[/tag] - Links to first primary button
```

#### XPath Selector Examples:

```
[tag]//button[contains(text(), 'Submit')][/tag] - Links to button containing 'Submit'
[tag]//div[@class='container']//input[/tag] - Links to inputs within container class
[tag]//form[1]/div[2]/input[/tag] - Links to specific input using path
[tag]//*[@data-testid='login-button'][/tag] - Links to element by test ID
```

When you click these tags in the Jira ticket:

1. The matching element(s) on the page will be highlighted

### User Mentions

Reference team members in ticket descriptions and comments:

```
@john.doe Could you please review this implementation?
@jane.smith This relates to your previous work on...
```

### Test Recording

Jira Spotter includes a built-in test recorder that generates Playwright tests:

1. Click the "Start Recording" button in the side panel
2. Perform your actions on the page
3. Click "Stop Recording" to generate a Playwright test script
4. The test script will be automatically added to the comment field

### Screenshot Integration

To capture and attach screenshots to Jira tickets:

1. Navigate to the relevant section of your page
2. Click the "Capture Screenshot" button in the side panel
3. The screenshot will be automatically attached to the comment field

---

## 🔒 Authentication

Jira Spotter supports two authentication methods:

1. **OAuth**:

   - Log in to your Jira account securely using OAuth.
   - Supports extended permissions for ticket management and attachments.
   - Available scopes include:
     - read:jira-work
     - write:jira-work
     - read:jira-user
     - read:jira-attachment
     - offline_access

2. **Access Key and Base URL**:

   - Provide your Jira access key and base URL for quick setup.

---

## 🛡️ Privacy

Your data is safe with Jira Spotter:

- All data is processed locally within your browser.
- No information is transmitted to external servers.

For more details, refer to our [Privacy Policy](#).

---

## 🛠️ Development Setup

To set up the development environment:

1. Clone the repository

2. Create a Jira OAuth App:

   - Go to https://developer.atlassian.com/console/myapps/
   - Create a new OAuth 2.0 app
   - After creating the app, launch JiraSpotter in Chrome
   - Check the browser console for the Redirect URI
   - Add this Redirect URI to your Jira OAuth App settings
   - Copy the Client ID and Client Secret

3. Copy `.env.example` to `.env`:

   ```bash
   cp .env.example .env
   ```

4. Add your Jira OAuth credentials to `.env`:

   ```
   JIRA_CLIENT_ID=your_client_id_here
   JIRA_CLIENT_SECRET=your_client_secret_here
   ```

5. Install dependencies:

   ```bash
   npm install
   ```

6. Build the configuration:
   ```bash
   npm run build
   ```

### Building for Production

When building for production distribution:

1. Ensure your `.env` file contains the production credentials
2. Run the build script:
   ```bash
   npm run build
   ```
3. The build process will generate `config.js` with the proper credentials
4. Package your extension as normal

Note: The `config.js` file is gitignored to prevent accidentally committing credentials. Always use the build process to generate it.

### Running Tests

Jira Spotter uses Playwright for automated testing:

1. Install Playwright:

   ```bash
   npx playwright install
   ```

2. Run the tests:

   ```bash
   npm test
   ```

3. To run recorded tests:
   ```bash
   npm run test:recorded
   ```

---

## 🐛 Troubleshooting

- **Jira tickets not appearing**: Ensure Jira task IDs are correctly formatted and match existing tickets.
- **Authentication issues**: Double-check your credentials and try re-authenticating.
- **Screenshot capture fails**: Ensure the page has fully loaded before attempting to capture.
- **Test recording issues**: Check that the page is accessible and interactive before recording.
- **Element tags not highlighting**: Verify that the CSS or XPath selector in the [tag] syntax is valid and matches elements on the page.
- **User mentions not resolving**: Ensure the mentioned users exist in your Jira instance and have access to the project.
- **Other problems**: Contact us at joe@jjs.digital.

---

## 🤝 Contributing

We welcome contributions to improve Jira Spotter! To contribute:

1. Fork the repository.
2. Create a new branch (`feature/my-new-feature`).
3. Commit your changes.
4. Open a pull request.

---

## 📧 Support

For any questions, issues, or feedback, reach out at joe@jjs.digital.

---

## 📜 License

Jira Spotter is licensed under the [MIT License](LICENSE).
Feel free to use, modify, and distribute the extension as per the terms of the license.

---

### 🌟 [Download Jira Spotter Now](#)
