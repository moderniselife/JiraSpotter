// Store found task IDs
window.jiraTaskIds = new Set();

// Function to normalize task ID
function normalizeTaskId(id) {
    return id.trim().toUpperCase();
}

// Function to extract task IDs from text
function extractTaskIds(text) {
    const regex = /jira-taskid="([^"]+)"/gi;
    const matches = text.matchAll(regex);

    for (const match of matches) {
        const taskId = normalizeTaskId(match[1]);
        console.log('Found task ID:', taskId);
        window.jiraTaskIds.add(taskId);
    }

    // Also look for task IDs in comments (if applicable)
    const commentRegex = /\/\*[\s\S]*?jira-taskid[=:]?\s*["']?([^"'\s]+)["']?[\s\S]*?\*\/|\/\/.*jira-taskid[=:]?\s*["']?([^"'\s]+)["']?/gi;
    const commentMatches = text.matchAll(commentRegex);

    for (const match of commentMatches) {
        if (match[1]) {
            const taskId = normalizeTaskId(match[1]);
            console.log('Found task ID in comment:', taskId);
            window.jiraTaskIds.add(taskId);
        }
        if (match[2]) {
            const taskId = normalizeTaskId(match[2]);
            console.log('Found task ID in comment:', taskId);
            window.jiraTaskIds.add(taskId);
        }
    }
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
            bottom: 20px;
            right: 20px;
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
        #jira-spotter-button:hover {
            background-color: #0747a6;
        }
    `;
    shadowRoot.appendChild(style);
    document.body.appendChild(container);
}

// Create floating button
function createFloatingButton() {
    if (!shadowRoot) {
        createShadowContainer();
    }

    const button = document.createElement('button');
    button.id = 'jira-spotter-button';
    button.textContent = 'Jira Tasks';

    button.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'openSidePanel' });
    });

    shadowRoot.appendChild(button);
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
        const previousTaskIds = new Set(window.jiraTaskIds);
        window.jiraTaskIds.clear();
        await scanDOM();

        // Check if the sets are different
        const hasChanges = previousTaskIds.size !== window.jiraTaskIds.size ||
            ![...previousTaskIds].every(id => window.jiraTaskIds.has(id));

        if (hasChanges) {
            manageButtonVisibility();
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
    chrome.runtime.sendMessage({
        action: 'elementSelected',
        selector: selector
    });

    disableElementSelection();
});

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getTaskIds') {
        sendResponse({ taskIds: Array.from(window.jiraTaskIds) });
    } else if (request.action === 'takeScreenshot') {
        // Use html2canvas for screenshot
        html2canvas(document.documentElement).then(canvas => {
            const dataUrl = canvas.toDataURL('image/png');
            sendResponse({ success: true, dataUrl });
        });
        return true; // Required for async response
    } else if (request.action === 'startElementSelection') {
        enableElementSelection();
        sendResponse({ success: true });
    } else if (request.action === 'highlightElement') {
        console.log('Request Active: Highlight Element');
        console.log(`Highlighting element: ${request.selector}`);
        console.log('Request Info', request)
        // Add highlight effect on hover
        const style = document.createElement('style');
        style.id = 'element-selector-style';
        style.textContent = `
        .jira-spotter-hover {
            outline: 2px solid #0052CC !important;
            outline-offset: 1px !important;
        }
    `;
        document.head.appendChild(style);
        const element = document.querySelector(request.selector);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element.classList.add('jira-spotter-hover');
            setTimeout(() => {
                element.classList.remove('jira-spotter-hover');
            }, 2000);
        }
        sendResponse({ success: !!element });
    }
});