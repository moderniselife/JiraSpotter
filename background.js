/*  */// Store Jira API configuration
let jiraConfig = {
    baseUrl: '',
    token: '',
    authType: '', // 'oauth' or 'token'
    oauthToken: null,
    refreshToken: null
};

// Create context menu item
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: 'linkJiraTicket',
        title: 'Link Jira Ticket',
        contexts: ['all']
    });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'linkJiraTicket') {
        // Get the clicked element directly in the content script
        chrome.tabs.sendMessage(tab.id, {
            action: 'handleElementSelection'
        });
    }
});

// Import Jira OAuth configuration
importScripts('config.js');

// Helper function to handle Jira API requests with authentication
async function handleJiraRequest(url, options, retryCount = 0) {
    try {
        const response = await fetch(url, options);
        
        if (response.status === 401 && retryCount < 1) {
            // Token expired, try to refresh
            if (jiraConfig.authType === 'oauth') {
                await refreshAccessToken();
                // Update authorization header with new token
                options.headers.Authorization = getAuthHeader();
                // Retry request
                return handleJiraRequest(url, options, retryCount + 1);
            }
        }
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || response.statusText);
        }
        
        return response;
    } catch (error) {
        console.error('Jira request failed:', error);
        throw error;
    }
}

// OAuth configuration
function getOAuthConfig() {
    return {
        clientId: JIRA_CONFIG.CLIENT_ID,
        authEndpoint: 'https://auth.atlassian.com/authorize',
        tokenEndpoint: 'https://auth.atlassian.com/oauth/token',
        redirectUri: chrome.identity.getRedirectURL('oauth2'),
        scope: 'read:jira-work write:jira-work read:jira-user read:jira-attachment offline_access'
    };
}

// Load configuration from storage
chrome.storage.local.get(['jiraConfig'], (result) => {
    if (result.jiraConfig) {
        jiraConfig = result.jiraConfig;
    }
});

console.log('Redirect URL', chrome.identity.getRedirectURL('oauth2'));

// Handle OAuth flow
async function initiateOAuthFlow() {
    const config = getOAuthConfig();
    const authUrl = `${config.authEndpoint}?` + new URLSearchParams({
        client_id: config.clientId,
        response_type: 'code',
        redirect_uri: config.redirectUri,
        scope: config.scope,
        prompt: 'consent'
    });

    try {
        const redirectUrl = await chrome.identity.launchWebAuthFlow({
            url: authUrl,
            interactive: true
        });

        const code = new URL(redirectUrl).searchParams.get('code');
        return await exchangeCodeForTokens(code);
    } catch (error) {
        console.error('OAuth flow failed:', error);
        throw new Error('Authentication failed');
    }
}

async function exchangeCodeForTokens(code) {
    const config = getOAuthConfig();
    const basicAuth = btoa(`${config.clientId}:${JIRA_CONFIG.CLIENT_SECRET}`);

    const response = await fetch(config.tokenEndpoint, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${basicAuth}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            grant_type: 'authorization_code',
            code,
            redirect_uri: config.redirectUri
        })
    });

    if (!response.ok) {
        throw new Error('Token exchange failed');
    }

    const data = await response.json();
    return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in
    };
}

async function refreshAccessToken() {
    if (!jiraConfig.refreshToken) {
        throw new Error('No refresh token available');
    }

    const config = getOAuthConfig();
    const basicAuth = btoa(`${config.clientId}:${JIRA_CONFIG.CLIENT_SECRET}`);

    const response = await fetch(config.tokenEndpoint, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${basicAuth}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            grant_type: 'refresh_token',
            refresh_token: jiraConfig.refreshToken
        })
    });

    if (!response.ok) {
        throw new Error('Token refresh failed');
    }

    const data = await response.json();
    jiraConfig.oauthToken = data.access_token;
    jiraConfig.refreshToken = data.refresh_token;
    await chrome.storage.local.set({ jiraConfig });
    return data.access_token;
}

// Get authorization header based on auth type
function getAuthHeader() {
    if (jiraConfig.authType === 'oauth') {
        return `Bearer ${jiraConfig.oauthToken}`;
    }
    return `Bearer ${jiraConfig.token}`;
}

// Upload attachment to Jira
async function uploadJiraAttachment(ticketId, filename, dataUrl) {
    try {
        // Convert data URL to Blob
        const response = await fetch(dataUrl);
        const blob = await response.blob();

        // Create FormData and append the file
        const formData = new FormData();
        formData.append('file', blob, filename);

        const uploadResponse = await fetch(
            `${jiraConfig.baseUrl}/rest/api/2/issue/${ticketId}/attachments`,
            {
                method: 'POST',
                headers: {
                    'Authorization': getAuthHeader(),
                    'X-Atlassian-Token': 'no-check'
                },
                body: formData
            }
        );

        if (!uploadResponse.ok) {
            throw new Error(`Failed to upload attachment: ${uploadResponse.statusText}`);
        }

        const attachmentData = await uploadResponse.json();
        return attachmentData[0]; // Jira returns an array with the new attachment
    } catch (error) {
        throw new Error(`Failed to upload attachment: ${error.message}`);
    }
}

// Get attachment URL with proper authentication
async function getAttachmentUrl(attachmentId) {
    try {
        // Return the direct content URL with auth header
        return {
            url: `${jiraConfig.baseUrl}/rest/api/2/attachment/content/${attachmentId}`,
            headers: {
                'Authorization': getAuthHeader()
            }
        };
    } catch (error) {
        throw new Error(`Failed to get attachment URL: ${error.message}`);
    }
}

// Jira API Functions
async function searchJiraUsers(searchText, retryCount = 0) {
    try {
        console.log('Searching Jira users with query:', searchText);
        const url = `${jiraConfig.baseUrl}/rest/api/2/user/search?query=${encodeURIComponent(searchText)}&maxResults=10&includeActive=true&includeInactive=false`;
        console.log('Request URL:', url);

        const response = await fetch(url, {
            headers: {
                'Authorization': getAuthHeader(),
                'Content-Type': 'application/json'
            }
        });

        console.log('Response status:', response.status);
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Search users error:', errorText);
            if (response.status === 401 && retryCount < 1) {
                if (jiraConfig.authType === 'oauth') {
                    await refreshAccessToken();
                    return searchJiraUsers(searchText, retryCount + 1);
                }
            }
            throw new Error(`Failed to search users: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        if (error.message.includes('401') && jiraConfig.authType === 'oauth' && retryCount < 1) {
            try {
                await refreshAccessToken();
                return searchJiraUsers(searchText, retryCount + 1);
            } catch (refreshError) {
                throw new Error('Authentication failed. Please login again.');
            }
        }
        throw error;
    }
}

async function fetchJiraTicket(ticketId, retryCount = 0) {
    try {
        const response = await fetch(`${jiraConfig.baseUrl}/rest/api/2/issue/${ticketId}`, {
            headers: {
                'Authorization': getAuthHeader(),
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            if (response.status === 401 && retryCount < 1) {
                if (jiraConfig.authType === 'oauth') {
                    await refreshAccessToken();
                    return fetchJiraTicket(ticketId, retryCount + 1);
                }
            }
            throw new Error(`Failed to fetch ticket: ${response.statusText}`);
        }

        const data = await response.json();

        // If we have attachments in description, fetch them separately
        if (data.fields.description && data.fields.description.match(/!(.*?)\|(.*?)!/g)) {
            // Get attachments in a separate call
            const attachResponse = await fetch(`${jiraConfig.baseUrl}/rest/api/2/issue/${ticketId}?fields=attachment`, {
                headers: {
                    'Authorization': getAuthHeader(),
                    'Content-Type': 'application/json'
                }
            });

            if (attachResponse.ok) {
                const attachData = await attachResponse.json();
                data.attachments = attachData.fields.attachment || [];
            }
        }

        return data;
    } catch (error) {
        if (error.message.includes('401') && jiraConfig.authType === 'oauth' && retryCount < 1) {
            try {
                await refreshAccessToken();
                return fetchJiraTicket(ticketId, retryCount + 1);
            } catch (refreshError) {
                throw new Error('Authentication failed. Please login again.');
            }
        }
        throw error;
    }
}

async function updateJiraTicketStatus(ticketId, status) {
    // First get the available transitions
    const transitionsResponse = await fetch(
        `${jiraConfig.baseUrl}/rest/api/2/issue/${ticketId}/transitions`,
        {
            headers: {
                'Authorization': getAuthHeader(),
                'Content-Type': 'application/json'
            }
        }
    );

    const transitions = await transitionsResponse.json();
    const transition = transitions.transitions.find(t =>
        t.name.toLowerCase() === status.toLowerCase()
    );

    if (!transition) {
        throw new Error('Invalid status transition');
    }

    const response = await fetch(
        `${jiraConfig.baseUrl}/rest/api/2/issue/${ticketId}/transitions`,
        {
            method: 'POST',
            headers: {
                'Authorization': getAuthHeader(),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                transition: { id: transition.id }
            })
        }
    );

    if (!response.ok) {
        throw new Error(`Failed to update status: ${response.statusText}`);
    }

    return { success: true };
}

async function addJiraComment(ticketId, comment, screenshotData = null, filename = null) {
    try {
        let finalComment = comment;

        // If there's a screenshot, upload it first
        if (screenshotData && filename) {
            const attachmentResult = await uploadJiraAttachment(ticketId, filename, screenshotData);
            // Add the image syntax to the comment using the actual filename from the upload
            finalComment = `${comment}\n\n!${attachmentResult.filename}|thumbnail!`;
        }

        const response = await fetch(
            `${jiraConfig.baseUrl}/rest/api/2/issue/${ticketId}/comment`,
            {
                method: 'POST',
                headers: {
                    'Authorization': getAuthHeader(),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    body: finalComment
                })
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to add comment: ${response.statusText}`);
        }

        return response.json();
    } catch (error) {
        throw new Error(`Failed to add comment with attachment: ${error.message}`);
    }
}

// Handle messages from content script and side panel
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
        case 'captureScreenshot':
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (!tabs[0]) {
                    sendResponse({ error: 'No active tab found' });
                    return;
                }
                chrome.tabs.sendMessage(tabs[0].id, { action: 'takeScreenshot' }, (response) => {
                    if (chrome.runtime.lastError) {
                        sendResponse({ error: chrome.runtime.lastError.message });
                    } else if (response && response.success) {
                        sendResponse({ dataUrl: response.dataUrl });
                    } else {
                        sendResponse({ error: 'Failed to capture screenshot' });
                    }
                });
            });
            return true;

        case 'getAttachmentUrl':
            getAttachmentUrl(request.attachmentId)
                .then(data => sendResponse(data))
                .catch(error => sendResponse({ error: error.message }));
            return true;

        case 'openSidePanel':
            chrome.sidePanel.open({ windowId: sender.tab.windowId });
            break;

        case 'initiateOAuth':
            initiateOAuthFlow()
                .then(async (tokens) => {
                    // Get accessible resources to find the Jira cloud instance URL
                    const resourcesResponse = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
                        headers: {
                            'Authorization': `Bearer ${tokens.accessToken}`,
                            'Accept': 'application/json'
                        }
                    });

                    if (!resourcesResponse.ok) {
                        throw new Error('Failed to get Jira cloud URL');
                    }

                    const resources = await resourcesResponse.json();
                    const cloudId = resources[0].id;
                    const cloudUrl = resources[0].url;

                    jiraConfig = {
                        ...jiraConfig,
                        authType: 'oauth',
                        oauthToken: tokens.accessToken,
                        refreshToken: tokens.refreshToken,
                        baseUrl: `https://api.atlassian.com/ex/jira/${cloudId}`,
                        cloudUrl: cloudUrl // Store the Jira Cloud URL from the API
                    };
                    await chrome.storage.local.set({ jiraConfig });
                    sendResponse({ success: true });
                })
                .catch(error => sendResponse({ error: error.message }));
            return true;

        case 'getJiraTicket':
            fetchJiraTicket(request.ticketId)
                .then(data => sendResponse(data))
                .catch(async error => {
                    if (error.message.includes('401') && jiraConfig.authType === 'oauth') {
                        try {
                            await refreshAccessToken();
                            const data = await fetchJiraTicket(request.ticketId);
                            sendResponse(data);
                        } catch (refreshError) {
                            sendResponse({ error: 'Authentication failed. Please login again.' });
                        }
                    } else {
                        sendResponse({ error: error.message });
                    }
                });
            return true;

        case 'updateTicketStatus':
            updateJiraTicketStatus(request.ticketId, request.status)
                .then(data => sendResponse(data))
                .catch(async error => {
                    if (error.message.includes('401') && jiraConfig.authType === 'oauth') {
                        try {
                            await refreshAccessToken();
                            const data = await updateJiraTicketStatus(request.ticketId, request.status);
                            sendResponse(data);
                        } catch (refreshError) {
                            sendResponse({ error: 'Authentication failed. Please login again.' });
                        }
                    } else {
                        sendResponse({ error: error.message });
                    }
                });
            return true;

        case 'addComment':
            addJiraComment(
                request.ticketId,
                request.comment,
                request.screenshotData,
                request.filename
            )
                .then(data => sendResponse(data))
                .catch(async error => {
                    if (error.message.includes('401') && jiraConfig.authType === 'oauth') {
                        try {
                            await refreshAccessToken();
                            const data = await addJiraComment(
                                request.ticketId,
                                request.comment,
                                request.screenshotData,
                                request.filename
                            );
                            sendResponse(data);
                        } catch (refreshError) {
                            sendResponse({ error: 'Authentication failed. Please login again.' });
                        }
                    } else {
                        sendResponse({ error: error.message });
                    }
                });
            return true;

        case 'saveConfig':
            jiraConfig = {
                ...request.config,
                authType: 'token'
            };
            chrome.storage.local.set({ jiraConfig });
            sendResponse({ success: true });
            break;

        case 'uploadAttachment':
            uploadJiraAttachment(request.ticketId, request.filename, request.dataUrl)
                .then(data => sendResponse(data))
                .catch(async error => {
                    if (error.message.includes('401') && jiraConfig.authType === 'oauth') {
                        try {
                            await refreshAccessToken();
                            const data = await uploadJiraAttachment(request.ticketId, request.filename, request.dataUrl);
                            sendResponse(data);
                        } catch (refreshError) {
                            sendResponse({ error: 'Authentication failed. Please login again.' });
                        }
                    } else {
                        sendResponse({ error: error.message });
                    }
                });
            return true;

        case 'storeSharedTaskId':
            // First try to get the shared storage issue
            handleJiraRequest(`${jiraConfig.baseUrl}/rest/api/2/search?jql=project=DEV AND summary~'"JiraSpotter Shared Storage"'`, {
                headers: {
                    'Authorization': getAuthHeader(),
                    'Content-Type': 'application/json'
                }
            }, 0)
            .then(async response => {
                const data = await response.json();
                if (data.issues && data.issues.length > 0) {
                    // Update existing issue
                    return handleJiraRequest(`${jiraConfig.baseUrl}/rest/api/2/issue/${data.issues[0].key}`, {
                        method: 'PUT',
                        headers: {
                            'Authorization': getAuthHeader(),
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            fields: {
                                description: JSON.stringify({
                                    manualTasks: request.taskIds
                                })
                            }
                        })
                    });
                } else {
                    // Create new issue for storage
                    return handleJiraRequest(`${jiraConfig.baseUrl}/rest/api/2/issue`, {
                        method: 'POST',
                        headers: {
                            'Authorization': getAuthHeader(),
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            fields: {
                                project: { key: 'DEV' },
                                summary: 'JiraSpotter Shared Storage',
                                description: JSON.stringify({
                                    manualTasks: request.taskIds
                                }),
                                issuetype: { name: 'Task' }
                            }
                        })
                    });
                }
            })
            .then(response => {
                sendResponse({ success: true });
            })
            .catch(error => {
                console.error('Error storing shared tasks:', error);
                sendResponse({ error: error.message });
            });
            return true;

        case 'getSharedTaskIds':
            // Get shared task IDs from storage issue
            handleJiraRequest(`${jiraConfig.baseUrl}/rest/api/2/search?jql=project=DEV AND summary~'"JiraSpotter Shared Storage"'`, {
                headers: {
                    'Authorization': getAuthHeader(),
                    'Content-Type': 'application/json'
                }
            })
            .then(async response => {
                const data = await response.json();
                if (data.issues && data.issues.length > 0) {
                    const description = data.issues[0].fields.description;
                    try {
                        const stored = JSON.parse(description || '{}');
                        sendResponse({ taskIds: stored.manualTasks || [] });
                    } catch (e) {
                        sendResponse({ taskIds: [] });
                    }
                } else {
                    sendResponse({ taskIds: [] });
                }
            })
            .catch(error => {
                console.error('Error getting shared tasks:', error);
                sendResponse({ taskIds: [] });
            });
            return true;

        case 'searchJiraUsers':
            searchJiraUsers(request.searchText)
                .then(users => sendResponse({ users }))
                .catch(async error => {
                    if (error.message.includes('401') && jiraConfig.authType === 'oauth') {
                        try {
                            await refreshAccessToken();
                            const users = await searchJiraUsers(request.searchText);
                            sendResponse({ users });
                        } catch (refreshError) {
                            sendResponse({ error: 'Authentication failed. Please login again.' });
                        }
                    } else {
                        sendResponse({ error: error.message });
                    }
                });
            return true;

        case 'saveTest':
            // Create a Blob with the test content
            const testBlob = new Blob([request.test], { type: 'text/javascript' });
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `test-${timestamp}.spec.js`;

            // For each Jira task ID, upload the test file and add a comment
            Promise.all(request.taskIds.map(async (taskId) => {
                try {
                    // Upload the test file
                    const formData = new FormData();
                    formData.append('file', testBlob, filename);

                    const uploadResponse = await fetch(
                        `${jiraConfig.baseUrl}/rest/api/2/issue/${taskId}/attachments`,
                        {
                            method: 'POST',
                            headers: {
                                'Authorization': getAuthHeader(),
                                'X-Atlassian-Token': 'no-check'
                            },
                            body: formData
                        }
                    );

                    if (!uploadResponse.ok) {
                        throw new Error(`Failed to upload test file: ${uploadResponse.statusText}`);
                    }

                    // Add a comment with the test content and file reference
                    const comment = `Automated test recorded:\n\n{code:javascript}\n${request.test}\n{code}\n\nAttached file: [${filename}|${filename}]`;
                    await addJiraComment(taskId, comment);

                    return { taskId, success: true };
                } catch (error) {
                    return { taskId, success: false, error: error.message };
                }
            }))
                .then(results => sendResponse({ results }))
                .catch(error => sendResponse({ error: error.message }));
            return true;
    }
});