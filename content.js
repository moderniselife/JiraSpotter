// Store found task IDs and last clicked element
window.jiraTaskIds = new Set();
window.lastRightClickedElement = null;

// Load shared task IDs
chrome.runtime.sendMessage({ action: 'getSharedTaskIds' }, (response) => {
    if (response && response.taskIds) {
        response.taskIds.forEach(id => window.jiraTaskIds.add(id));
        manageButtonVisibility();
    } else {
        console.warn('Failed to load shared task IDs:', response);
    }
});

// Store the element that was right-clicked
document.addEventListener('contextmenu', (e) => {
    window.lastRightClickedElement = e.target;
}, true);

// Function to normalize task ID
function normalizeTaskId(id) {
    return id.trim().toUpperCase();
}

// Function to extract task IDs from text
function extractTaskIds(text) {
    const taskIds = new Set();

    // Look for jira-taskid attributes
    const regex = /jira-taskid="([^"]+)"/gi;
    const matches = text.matchAll(regex);
    for (const match of matches) {
        const taskId = normalizeTaskId(match[1]);
        console.log('Found task ID:', taskId);
        taskIds.add(taskId);
        window.jiraTaskIds.add(taskId);
    }

    // Look for task IDs in comments
    const commentRegex = /\/\*[\s\S]*?jira-taskid[=:]?\s*["']?([^"'\s]+)["']?[\s\S]*?\*\/|\/\/.*jira-taskid[=:]?\s*["']?([^"'\s]+)["']?/gi;
    const commentMatches = text.matchAll(commentRegex);
    for (const match of commentMatches) {
        if (match[1]) {
            const taskId = normalizeTaskId(match[1]);
            console.log('Found task ID in comment:', taskId);
            taskIds.add(taskId);
            window.jiraTaskIds.add(taskId);
        }
        if (match[2]) {
            const taskId = normalizeTaskId(match[2]);
            console.log('Found task ID in comment:', taskId);
            taskIds.add(taskId);
            window.jiraTaskIds.add(taskId);
        }
    }

    // Look for Jira ticket patterns (e.g., PROJ-123)
    const jiraPattern = /\b[A-Z]+-\d+\b/g;
    const jiraMatches = text.matchAll(jiraPattern);
    for (const match of jiraMatches) {
        const taskId = normalizeTaskId(match[0]);
        console.log('Found Jira ticket:', taskId);
        taskIds.add(taskId);
    }

    return Array.from(taskIds);
}

// Function to create and show ticket selection dialog
function showTicketSelectionDialog(existingTickets, elementDesc) {
    // Create dialog container with shadow DOM
    const container = document.createElement('div');
    container.id = 'jira-ticket-dialog-container';
    const shadow = container.attachShadow({ mode: 'open' });

    // Add styles
    const style = document.createElement('style');
    style.textContent = `
        .dialog-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        }
        .dialog {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            max-width: 500px;
            width: 90%;
        }
        h2 {
            margin-top: 0;
            color: #172B4D;
        }
        .element-desc {
            margin: 10px 0;
            padding: 10px;
            background: #F4F5F7;
            border-radius: 4px;
            font-family: monospace;
            word-break: break-all;
        }
        .section-title {
            margin: 15px 0 5px;
            color: #172B4D;
            font-weight: 500;
        }
        .ticket-list {
            margin: 10px 0;
            max-height: 150px;
            overflow-y: auto;
        }
        .ticket-option {
            padding: 8px;
            margin: 5px 0;
            border: 1px solid #DFE1E6;
            border-radius: 4px;
            cursor: pointer;
            display: flex;
            align-items: center;
        }
        .ticket-option:hover {
            background: #F4F5F7;
        }
        .ticket-option.selected {
            border-color: #0052CC;
            background: #DEEBFF;
        }
        .manual-input {
            margin-top: 15px;
        }
        input, textarea {
            width: 100%;
            padding: 8px;
            margin: 5px 0;
            border: 1px solid #DFE1E6;
            border-radius: 4px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        textarea {
            resize: vertical;
            min-height: 80px;
        }
        input:focus, textarea:focus {
            border-color: #0052CC;
            outline: none;
            box-shadow: 0 0 0 2px #DEEBFF;
        }
        .buttons {
            margin-top: 15px;
            display: flex;
            justify-content: flex-end;
            gap: 10px;
        }
        button {
            padding: 8px 16px;
            border-radius: 4px;
            border: none;
            cursor: pointer;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .primary {
            background: #0052CC;
            color: white;
        }
        .primary:hover {
            background: #0747A6;
        }
        .secondary {
            background: #EBECF0;
            color: #172B4D;
        }
        .secondary:hover {
            background: #DFE1E6;
        }
        .error {
            color: #DE350B;
            font-size: 12px;
            margin-top: 4px;
        }
    `;

    // Create dialog content
    const dialog = document.createElement('div');
    dialog.className = 'dialog-overlay';
    dialog.innerHTML = `
        <div class="dialog">
            <h2>Link Jira Ticket</h2>
            <div class="element-desc">${elementDesc}</div>
            ${existingTickets.length > 0 ? `
                <div class="section-title">Select existing ticket:</div>
                <div class="ticket-list">
                    ${existingTickets.map(ticket => `
                        <div class="ticket-option" data-ticket="${ticket}">${ticket}</div>
                    `).join('')}
                </div>
            ` : ''}
            <div class="manual-input">
                <div class="section-title">Or enter Jira ticket ID:</div>
                <input type="text" placeholder="e.g., PROJ-123" pattern="[A-Za-z]+-[0-9]+" />
                <div class="error" style="display: none;">Please enter a valid Jira ticket ID (e.g., PROJ-123)</div>
            </div>
            <div class="manual-input">
                <div class="section-title">Additional Context:</div>
                <textarea placeholder="Add any additional context about why this element is being linked..."></textarea>
            </div>
            <div class="buttons">
                <button class="secondary" id="cancel">Cancel</button>
                <button class="primary" id="link">Link Ticket</button>
            </div>
        </div>
    `;

    // Add event listeners
    shadow.appendChild(style);
    shadow.appendChild(dialog);
    document.body.appendChild(container);

    // Handle ticket selection
    let selectedTicket = '';
    const input = shadow.querySelector('input');
    const textarea = shadow.querySelector('textarea');
    const error = shadow.querySelector('.error');

    shadow.querySelectorAll('.ticket-option').forEach(option => {
        option.addEventListener('click', () => {
            // Remove selected class from all options
            shadow.querySelectorAll('.ticket-option').forEach(opt =>
                opt.classList.remove('selected'));
            // Add selected class to clicked option
            option.classList.add('selected');
            selectedTicket = option.dataset.ticket;
            input.value = selectedTicket;
            error.style.display = 'none';
        });
    });

    input.addEventListener('input', () => {
        selectedTicket = '';
        shadow.querySelectorAll('.ticket-option').forEach(opt =>
            opt.classList.remove('selected'));
        error.style.display = 'none';
    });

    return new Promise((resolve, reject) => {
        shadow.getElementById('cancel').addEventListener('click', () => {
            container.remove();
            reject('Cancelled');
        });

        shadow.getElementById('link').addEventListener('click', () => {
            const ticketId = input.value.trim().toUpperCase();
            const context = textarea.value.trim();
            const isValid = /^[A-Z]+-\d+$/.test(ticketId);

            if (isValid) {
                // Store the manually entered task ID in shared storage
                try {
                    chrome.runtime.sendMessage({ action: 'getSharedTaskIds' }, (response) => {
                        if (!response) {
                            console.warn('No response from getSharedTaskIds');
                            // Continue with local storage only
                            window.jiraTaskIds.add(ticketId);
                            manageButtonVisibility();
                            container.remove();
                            resolve({ ticketId, context });
                            return;
                        }

                        const taskIds = new Set(response.taskIds || []);
                        taskIds.add(ticketId);
                        chrome.runtime.sendMessage(
                            {
                                action: 'storeSharedTaskId',
                                taskIds: Array.from(taskIds)
                            },
                            (storeResponse) => {
                                if (storeResponse && storeResponse.error) {
                                    console.error('Error storing shared task:', storeResponse.error);
                                }
                                // Continue even if storage failed
                                window.jiraTaskIds.add(ticketId);
                                manageButtonVisibility();
                                container.remove();
                                resolve({ ticketId, context });
                            }
                        );
                    });
                } catch (error) {
                    console.error('Error in ticket selection:', error);
                    // Continue with local storage only
                    window.jiraTaskIds.add(ticketId);
                    manageButtonVisibility();
                    container.remove();
                    resolve({ ticketId, context });
                }
            } else {
                error.style.display = 'block';
                input.focus();
            }
        });

        // Handle Enter key
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                shadow.getElementById('link').click();
            }
        });
    });
}

// Track scanned resources to avoid duplicates
const scannedResources = new Set();

// Scan DOM for task IDs
async function scanDOM() {
    // Get all HTML content
    const html = document.documentElement.outerHTML;
    extractTaskIds(html);

    // Scan script tags
    const scripts = document.querySelectorAll('script[src]');
    for (const script of scripts) {
        const src = script.src;
        if (!scannedResources.has(src)) {
            try {
                const response = await fetch(src);
                if (response.ok) {
                    const content = await response.text();
                    extractTaskIds(content);
                    scannedResources.add(src);
                }
            } catch (err) {
                console.error(`Error fetching script (${src}):`, err);
            }
        }
    }

    // Scan inline scripts
    document.querySelectorAll('script:not([src])').forEach(script => {
        extractTaskIds(script.textContent);
    });

    // Scan CSS
    const stylesheets = document.querySelectorAll('link[rel="stylesheet"]');
    for (const stylesheet of stylesheets) {
        const href = stylesheet.href;
        if (!scannedResources.has(href)) {
            try {
                const response = await fetch(href);
                if (response.ok) {
                    const content = await response.text();
                    extractTaskIds(content);
                    scannedResources.add(href);
                }
            } catch (err) {
                console.error(`Error fetching stylesheet (${href}):`, err);
            }
        }
    }
}

// Initialize test recorder
const testRecorder = new TestRecorder();

// Create shadow root container for isolated styles
let shadowRoot;
function createShadowContainer() {
    const container = document.createElement('div');
    container.id = 'jira-spotter-container';
    shadowRoot = container.attachShadow({ mode: 'open' });

    // Add styles to shadow DOM
    const style = document.createElement('style');
    style.textContent = `
        #jira-spotter-button {
            position: fixed;
            z-index: 10000;
            padding: 10px 20px;
            background-color: #0052CC;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        #jira-spotter-button {
            bottom: 20px;
            right: 20px;
        }
        #jira-spotter-button:hover {
            background-color: #0747a6;
        }
    `;
    shadowRoot.appendChild(style);
    document.body.appendChild(container);
}

// Create floating buttons
function createFloatingButton() {
    if (!shadowRoot) {
        createShadowContainer();
    }

    // Create Jira Tasks button
    const button = document.createElement('button');
    button.id = 'jira-spotter-button';
    button.textContent = 'Jira Tasks';
    button.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'openSidePanel' });
    });
    shadowRoot.appendChild(button);

    // Create Record Test button
    // const recordButton = document.createElement('button');
    // recordButton.id = 'record-test-button';
    // recordButton.textContent = 'Record Test';
    // recordButton.addEventListener('click', toggleTestRecording);
    // shadowRoot.appendChild(recordButton);
}

// Handle test recording
function toggleTestRecording(ticketId) {
    // const recordButton = shadowRoot.getElementById('record-test-button');

    if (!testRecorder.recording) {
        // Start recording
        testRecorder.start();
        // recordButton.textContent = 'Stop Recording';
        // recordButton.classList.add('recording');

        // Record initial page URL
        testRecorder.recordNavigation(window.location.href);

        // Add click event listener for recording
        document.addEventListener('click', recordInteraction, true);
        document.addEventListener('input', recordInput, true);
    } else {
        // Stop recording
        const test = testRecorder.stop();
        // recordButton.textContent = 'Record Test';
        // recordButton.classList.remove('recording');

        // Remove event listeners
        document.removeEventListener('click', recordInteraction, true);
        document.removeEventListener('input', recordInput, true);

        // Add test to comment box in sidepanel
        console.log('Comment input selector:', ticketId);
        chrome.runtime.sendMessage({
            action: 'addTestToComment',
            ticketId: ticketId,
            content: `{code:javascript}\n${test}\n{code}\n\nPlaywright test recorded at ${new Date().toLocaleString()}`
        });
    }
}

// Record user interactions
function recordInteraction(event) {
    if (!testRecorder.recording) return;
    if (event.target.closest('#jira-spotter-container')) return;

    const element = event.target;
    const tagName = element.tagName.toLowerCase();
    const id = element.id;
    const classes = Array.from(element.classList).join('.');

    let selector = tagName;
    if (id) selector += `#${id}`;
    if (classes) selector += `.${classes}`;

    const text = element.textContent.trim();
    testRecorder.recordClick(selector, text.substring(0, 30));
}

// Record input changes
function recordInput(event) {
    if (!testRecorder.recording) return;
    if (event.target.closest('#jira-spotter-container')) return;

    const element = event.target;
    const tagName = element.tagName.toLowerCase();
    const id = element.id;
    const classes = Array.from(element.classList).join('.');

    let selector = tagName;
    if (id) selector += `#${id}`;
    if (classes) selector += `.${classes}`;

    testRecorder.recordInput(selector, event.target.value);
}

// Function to manage button visibility
function manageButtonVisibility() {
    if (!shadowRoot) {
        createShadowContainer();
    }
    const existingButton = shadowRoot.getElementById('jira-spotter-button');
    const hasTaskIds = window.jiraTaskIds.size > 0;

    if (hasTaskIds && !existingButton) {
        createFloatingButton();
    } else if (!hasTaskIds && existingButton) {
        existingButton.remove();
    }
}

// Initial scan
scanDOM();
manageButtonVisibility();

// Debounce function to avoid too frequent updates
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Listen for DOM changes
const observer = new MutationObserver(
    debounce(async () => {
        try {
            // Get shared manually added tasks
            chrome.runtime.sendMessage({ action: 'getSharedTaskIds' }, async (response) => {
                if (!response) {
                    console.warn('No response from getSharedTaskIds');
                    return;
                }

                const sharedTaskIds = new Set(response.taskIds || []);
                const previousTaskIds = new Set(window.jiraTaskIds);
                
                // Clear and rescan, but preserve shared tasks
                window.jiraTaskIds.clear();
                sharedTaskIds.forEach(id => window.jiraTaskIds.add(id));
                await scanDOM();

                // Check if the sets are different
                const hasChanges = previousTaskIds.size !== window.jiraTaskIds.size ||
                    ![...previousTaskIds].every(id => window.jiraTaskIds.has(id));

                if (hasChanges) {
                    manageButtonVisibility();
                }
            });
        } catch (error) {
            console.error('Error in observer callback:', error);
        }
    }, 1000) // Debounce for 1 second
);

observer.observe(document.documentElement, {
    childList: true,
    subtree: true
});

// Track element selection mode
let isSelectingElement = false;

// Add element selection functionality
function enableElementSelection() {
    isSelectingElement = true;
    document.body.style.cursor = 'crosshair';

    // Remove any existing style element
    const existingStyle = document.getElementById('element-selector-style');
    if (existingStyle) existingStyle.remove();

    // Add highlight effect on hover
    const style = document.createElement('style');
    style.id = 'element-selector-style';
    style.textContent = `
        .jira-spotter-hover {
            outline: 2px solid #0052CC !important;
            outline-offset: 1px !important;
            pointer-events: auto !important;
            cursor: crosshair !important;
        }
    `;
    document.head.appendChild(style);

    // Reset any existing highlights
    const highlighted = document.querySelector('.jira-spotter-hover');
    if (highlighted) highlighted.classList.remove('jira-spotter-hover');
}

function disableElementSelection() {
    isSelectingElement = false;
    document.body.style.cursor = '';
    const style = document.getElementById('element-selector-style');
    if (style) style.remove();

    // Remove any remaining highlights
    const highlighted = document.querySelector('.jira-spotter-hover');
    if (highlighted) highlighted.classList.remove('jira-spotter-hover');
}

// Handle element hover during selection mode
document.addEventListener('mouseover', (e) => {
    if (!isSelectingElement) return;

    // Ignore elements in our shadow DOM
    if (e.target.closest('#jira-spotter-container')) return;

    // Remove previous highlight
    const highlighted = document.querySelector('.jira-spotter-hover');
    if (highlighted) highlighted.classList.remove('jira-spotter-hover');

    // Add highlight to current target
    const target = e.target;
    target.classList.add('jira-spotter-hover');

    e.stopPropagation();
}, true); // Use capture phase

// Handle element selection
document.addEventListener('click', (e) => {
    if (!isSelectingElement) return;

    // Ignore elements in our shadow DOM
    if (e.target.closest('#jira-spotter-container')) return;

    e.preventDefault();
    e.stopPropagation();

    const element = e.target;
    const tagName = element.tagName.toLowerCase();
    const id = element.id;
    const classes = Array.from(element.classList)
        .filter(cls => cls !== 'jira-spotter-hover')
        .join('.');

    let selector = tagName;
    if (id) selector += `#${id}`;
    if (classes) selector += `.${classes}`;

    // Send the selector to the sidepanel
    console.log('Updating Comment for Ticket ID:', window.ticketId);
    chrome.runtime.sendMessage({
        action: 'elementSelected',
        selector: selector,
        ticketId: window.ticketId
    });

    disableElementSelection();
});

// Function to generate a unique selector for an element
function generateSelector(element) {
    const path = [];
    let current = element;

    while (current) {
        let selector = current.tagName.toLowerCase();

        if (current.id) {
            selector += `#${current.id}`;
            path.unshift(selector);
            break; // ID is unique, no need to go further up
        }

        if (current.className) {
            const classes = Array.from(current.classList)
                .filter(cls => cls !== 'jira-spotter-hover')
                .join('.');
            if (classes) {
                selector += `.${classes}`;
            }
        }

        // Add nth-child if needed
        const siblings = current.parentNode ? Array.from(current.parentNode.children) : [];
        if (siblings.length > 1) {
            const index = siblings.indexOf(current) + 1;
            selector += `:nth-child(${index})`;
        }

        path.unshift(selector);
        current = current.parentNode;

        // Stop at body to keep selector manageable
        if (current === document.body) {
            path.unshift('body');
            break;
        }
    }

    return path.join(' > ');
}

// New function to get all elements with unique selectors
function getAllPageElements(searchText = '') {
    const elements = document.querySelectorAll('*');
    const elementList = [];

    elements.forEach(element => {
        // Skip our own elements
        if (element.closest('#jira-spotter-container')) return;

        const tagName = element.tagName.toLowerCase();
        const id = element.id;
        const classes = Array.from(element.classList).join('.');

        let selector = tagName;
        if (id) selector += `#${id}`;
        if (classes) selector += `.${classes}`;

        // Add readable description
        let description = tagName;
        if (element.textContent) {
            const text = element.textContent.trim().substring(0, 30);
            if (text) description += ` "${text}${text.length > 30 ? '...' : ''}"`;
        }

        // Filter elements based on search text
        if (description.includes(searchText) || selector.includes(searchText)) {
            elementList.push({
                selector,
                description
            });
        }
    });

    return elementList;
}


// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'handleElementSelection') {
        if (!window.lastRightClickedElement || window.lastRightClickedElement.closest('#jira-ticket-dialog-container')) {
            sendResponse({ error: 'Element not found or invalid' });
            return;
        }

        const element = window.lastRightClickedElement;

        // Get existing task IDs from the page
        const existingTickets = Array.from(window.jiraTaskIds);

        // Get element details for the dialog
        const tagName = element.tagName.toLowerCase();
        const elementText = ((element.textContent || element.value || '') + '').trim().substring(0, 50);
        const selector = generateSelector(element);
        const elementDesc = `Tag: ${tagName}<br>${elementText ? `Value: "${elementText}${(element.textContent || element.value).length > 50 ? '...' : ''}"` : ''}<br>Selector: ${selector}`;

        showTicketSelectionDialog(existingTickets, elementDesc)
            .then(({ ticketId, context }) => {
                // Add comment to the Jira ticket with element details
                const selector = generateSelector(element);
                const comment = `Element linked: \n{quote}${elementDesc}{quote}\n\n` +
                    (context ? `Context: \n{quote}${context}{quote}\n\n` : '') +
                    `Selector: [tag]${selector}[/tag]\n\n` +
                    `Source: ${window.location.href}`;

                chrome.runtime.sendMessage({
                    action: 'addComment',
                    ticketId: ticketId,
                    comment: comment
                });
            })
            .catch(() => { }); // Handle dialog cancellation

        sendResponse({ success: true });
        return true; // Required for async response
    } else if (request.action === 'getTaskIds') {
        sendResponse({ taskIds: Array.from(window.jiraTaskIds) });
    } else if (request.action === 'takeScreenshot') {
        // Use html2canvas for screenshot
        html2canvas(document.documentElement).then(canvas => {
            const dataUrl = canvas.toDataURL('image/png');
            sendResponse({ success: true, dataUrl });
        });
        return true; // Required for async response
    } else if (request.action === 'toggleTestRecording') {
        toggleTestRecording(request.ticketId);
        sendResponse({ success: true, recording: testRecorder.recording });
    } else if (request.action === 'startElementSelection') {
        // Store request.ticketId for later use for element selection
        window.ticketId = request.ticketId;
        enableElementSelection();
        sendResponse({ success: true });
    } else if (request.action === 'highlightElement') {
        console.log('Request Active: Highlight Element');
        console.log(`Highlighting element: ${request.selector}`);
        console.log('Request Info', request)

        const style = document.createElement('style');
        style.id = 'element-selector-style';
        style.textContent = `
    .jira-spotter-hover {
        outline: 2px solid #0052CC !important;
        outline-offset: 1px !important;
    }`;
        document.head.appendChild(style);

        let element;
        if (request.selector.startsWith('//')) {
            // XPath selector
            const result = document.evaluate(request.selector, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            element = result.singleNodeValue;
        } else {
            // CSS selector
            element = document.querySelector(request.selector);
        }

        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element.classList.add('jira-spotter-hover');
            setTimeout(() => element.classList.remove('jira-spotter-hover'), 2000);
        }

        sendResponse({ success: !!element });
    } else if (request.action === 'getPageElements') {
        const searchText = request.searchText || '';
        sendResponse({ elements: getAllPageElements(searchText) });
    }
});