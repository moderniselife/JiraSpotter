# Jira Spotter

**Effortlessly link and track Jira tickets directly from your platform.**

Jira Spotter is a Chrome extension designed to streamline your development workflow by connecting your platform to Jira. With just a simple attribute or identifier, you can view associated Jira tickets directly in a convenient side panel.

---

## 🚀 Features

- **Flexible Integration**: Add the `jira-taskid` attribute anywhere in your HTML, CSS, or JavaScript files, even in comments.
- **Real-Time Insights**: Display linked Jira tickets in a responsive side panel while navigating your platform.
- **Secure Authentication**: Supports both OAuth and access key/base URL authentication methods.
- **Local Processing**: All operations are performed locally within your browser—no data is transmitted externally.

---

## 🛠️ Installation

1. Download and install the Jira Spotter Chrome extension from the [Chrome Web Store](#) (soon - in review - for now download and load as unpacked extension).
2. Click the extension icon in your browser to open the settings panel.
3. Configure your Jira authentication method (OAuth or access key with base URL).
4. Add `jira-taskid="JIRA ID HERE"` anywhere in your project's HTML, CSS, or JavaScript files.

---

## ⚙️ Usage

1. Open your platform where you've added `jira-taskid` attributes or comments.
2. Click on the Jira Spotter icon in your browser to open the side panel.
3. View the Jira tickets associated with the page directly in the panel.

### Examples:

#### HTML:

You can place the `jira-taskid` attribute anywhere in your HTML. For example:

```html
<!-- Link a Jira ticket to this section -->
<div jira-taskid="JIRA-1234">Feature Section</div>

<!-- Or even in a comment -->
<!-- jira-taskid="JIRA-5678" -->
```

#### JavaScript:

The `jira-taskid` can also be used within comments in your JavaScript code:

```javascript
// jira-taskid="JIRA-91011"
// This function implements the feature described in JIRA-91011
function exampleFeature() {
  console.log("Feature implemented");
}
```

#### CSS:

Use `jira-taskid` within CSS comments to link styles to Jira tickets:

```css
/* jira-taskid="JIRA-121314" */
.my-class {
  color: blue;
  font-size: 16px;
}
```

Wherever you place the `jira-taskid`, the associated Jira task will appear in the side panel when the extension is active.

---

## 🔒 Authentication

Jira Spotter supports two authentication methods:

1. **OAuth**:

   - Log in to your Jira account securely using OAuth.

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

---

## 🐛 Troubleshooting

- **Jira tickets not appearing**: Ensure `jira-taskid` attributes or comments are correctly added and match existing Jira ticket IDs.
- **Authentication issues**: Double-check your credentials and try re-authenticating.
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
