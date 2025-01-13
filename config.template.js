// Jira OAuth Configuration
const JIRA_CONFIG = {
    // Get these from Atlassian Developer Console:
    // 1. Go to https://developer.atlassian.com/console/myapps/
    // 2. Create a new OAuth 2.0 app
    // 3. Set the callback URL to your extension's OAuth redirect URL
    //    (Get this from chrome.identity.getRedirectURL('oauth2'))
    // 4. Copy the Client ID and Client Secret here
    CLIENT_ID: 'YOUR_CLIENT_ID',
    CLIENT_SECRET: 'YOUR_CLIENT_SECRET'
};