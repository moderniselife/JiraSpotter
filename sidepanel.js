// DOM Elements
const configPanel = document.getElementById('config-panel');
const configForm = document.getElementById('config-form');
const ticketsPanel = document.getElementById('tickets-panel');
const ticketsList = document.getElementById('tickets-list');
const ticketTemplate = document.getElementById('ticket-template');
const oauthLoginBtn = document.getElementById('oauth-login');
const logoutBtn = document.getElementById('logout-button');
const ticketFilter = document.getElementById('ticket-filter');

// DOM Elements for filters
const statusFilter = document.getElementById('status-filter');
const sortOrder = document.getElementById('sort-order');

// Filter and sort tickets
function filterAndSortTickets() {
    const tickets = Array.from(ticketsList.querySelectorAll('.ticket'));
    const searchText = ticketFilter.value.toLowerCase();
    const statusValue = statusFilter.value.toLowerCase();
    const sortValue = sortOrder.value;

    // Filter tickets
    tickets.forEach(ticket => {
        const ticketKey = ticket.querySelector('.ticket-key').textContent.toLowerCase();
        const ticketSummary = ticket.querySelector('.ticket-summary').textContent.toLowerCase();
        const ticketStatus = ticket.querySelector('.ticket-status').textContent.toLowerCase();

        const matchesSearch =
            ticketKey.includes(searchText) ||
            ticketSummary.includes(searchText) ||
            ticketStatus.includes(searchText);

        const matchesStatus = statusValue === 'all' || ticketStatus === statusValue;

        ticket.style.display = matchesSearch && matchesStatus ? 'block' : 'none';
    });

    // Sort visible tickets
    const visibleTickets = tickets.filter(t => t.style.display !== 'none');
    visibleTickets.sort((a, b) => {
        const dateA = new Date(a.dataset.createdDate || 0);
        const dateB = new Date(b.dataset.createdDate || 0);
        return sortValue === 'newest' ? dateB - dateA : dateA - dateB;
    });

    // Reorder tickets in the DOM
    visibleTickets.forEach(ticket => {
        ticketsList.appendChild(ticket);
    });
}

// Add filter event listeners
ticketFilter.addEventListener('input', filterAndSortTickets);
statusFilter.addEventListener('change', filterAndSortTickets);
sortOrder.addEventListener('change', filterAndSortTickets);

// Track displayed tickets
const displayedTickets = new Set();

// Function to create slider element
function createSliderElement(elements) {
    const wrapper = document.createElement('div');
    wrapper.className = 'attachment-wrapper';

    const header = document.createElement('div');
    header.className = 'attachment-header';
    header.innerHTML = `
        <div class="attachment-title">Attachments</div>
        <div class="attachment-nav">
            <button class="nav-button prev" title="Previous">Prev</button>
            <button class="nav-button next" title="Next">Next</button>
        </div>
    `;
    wrapper.appendChild(header);

    const slider = document.createElement('div');
    slider.className = 'attachment-slider';
    elements.forEach(element => {
        const slide = document.createElement('div');
        slide.className = 'attachment-slide';
        slide.innerHTML = element;
        slider.appendChild(slide);
    });
    wrapper.appendChild(slider);

    // Add navigation functionality
    const prevBtn = header.querySelector('.prev');
    const nextBtn = header.querySelector('.next');

    prevBtn.addEventListener('click', () => {
        const slideWidth = slider.querySelector('.attachment-slide').offsetWidth + 8;
        slider.scrollBy({ left: -slideWidth, behavior: 'smooth' });
    });

    nextBtn.addEventListener('click', () => {
        const slideWidth = slider.querySelector('.attachment-slide').offsetWidth + 8;
        slider.scrollBy({ left: slideWidth, behavior: 'smooth' });
    });

    slider.addEventListener('scroll', () => {
        prevBtn.disabled = slider.scrollLeft <= 0;
        nextBtn.disabled = slider.scrollLeft >= slider.scrollWidth - slider.clientWidth;
    });

    // Initial button state
    const updateButtons = () => {
        const maxScroll = slider.scrollWidth - slider.clientWidth;
        prevBtn.disabled = slider.scrollLeft <= 1; // Use 1 instead of 0 to account for rounding
        nextBtn.disabled = slider.scrollLeft >= maxScroll - 1; // Use -1 to account for rounding
    };

    // Add scroll event listener
    slider.addEventListener('scroll', updateButtons);

    // Add resize observer to update buttons when content changes
    new ResizeObserver(updateButtons).observe(slider);

    // Initial update
    setTimeout(updateButtons, 0); // Wait for layout to complete

    // Create a container to hold everything
    const container = document.createElement('div');
    container.className = 'slider-container';
    container.appendChild(wrapper);

    // Convert to HTML string
    const tempDiv = document.createElement('div');
    tempDiv.appendChild(container);
    return tempDiv.innerHTML;
}

// Function to parse Jira content
async function parseJiraContent(content, attachments = []) {
    if (!content) return '';

    // Handle Jira image/attachment format !filename|parameters!
    if (content.match(/!(.*?)\|(.*?)!/g)) {
        const matches = content.match(/!(.*?)\|(.*?)!/g);
        let currentGroup = [];
        let lastIndex = 0;

        for (let i = 0; i < matches.length; i++) {
            const match = matches[i];
            const currentIndex = content.indexOf(match, lastIndex);
            const [filename, params] = match.slice(1, -1).split('|');

            try {
                const element = await createAttachmentElement(filename, params, attachments);
                const textBetween = i > 0 ? content.substring(lastIndex, currentIndex).trim() : '';

                if (textBetween === '') {
                    currentGroup.push({ match, element });
                } else {
                    if (currentGroup.length > 0) {
                        const sliderHtml = createSliderElement(currentGroup.map(g => g.element));
                        const firstMatch = currentGroup[0].match;
                        const lastMatch = currentGroup[currentGroup.length - 1].match;
                        const startIndex = content.indexOf(firstMatch);
                        const endIndex = content.indexOf(lastMatch) + lastMatch.length;
                        content = content.substring(0, startIndex) + sliderHtml + content.substring(endIndex);
                        currentGroup = [];
                    }
                    currentGroup.push({ match, element });
                }

                lastIndex = currentIndex + match.length;
            } catch (error) {
                console.error('Error processing attachment:', error);
                content = content.replace(match, `<span class="error">Error loading attachment: ${filename}</span>`);
            }
        }

        // Process remaining group
        if (currentGroup.length > 0) {
            const sliderHtml = createSliderElement(currentGroup.map(g => g.element));
            const firstMatch = currentGroup[0].match;
            const lastMatch = currentGroup[currentGroup.length - 1].match;
            const startIndex = content.indexOf(firstMatch);
            const endIndex = content.indexOf(lastMatch) + lastMatch.length;
            content = content.substring(0, startIndex) + sliderHtml + content.substring(endIndex);
        }
    }

    // Replace Jira links [text|url] with HTML links
    content = content.replace(/\[([^\]]+)\|([^\]]+)\]/g, (match, text, url) => {
        if (url.startsWith('mailto:')) {
            return `<a href="${url}">${text}</a>`;
        }
        return `<a href="${url}" target="_blank">${text}</a>`;
    });

    // Parse tags in content
    const tagRegex = /\[tag\](.*?)\[\/tag\]/g;
    let lastIndex = 0;
    let parsedContent = '';
    let match;

    while ((match = tagRegex.exec(content)) !== null) {
        // Add text before the tag
        parsedContent += content.slice(lastIndex, match.index);

        // Add the tag as a clickable element
        const selector = match[1];
        parsedContent += `<span class="tag-reference" data-selector="${selector}">${selector}</span>`;

        lastIndex = tagRegex.lastIndex;
    }

    // Add remaining text
    parsedContent += content.slice(lastIndex);

    // Parse with marked
    const markedContent = marked.parse(parsedContent, { sanitize: false });

    // Create a temporary div to ensure proper HTML structure
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = markedContent;

    // Process any sliders that might have been affected by marked
    const sliders = tempDiv.querySelectorAll('.attachment-slider');
    sliders.forEach(slider => {
        // Ensure slider structure is preserved
        if (slider.parentElement.tagName === 'P') {
            slider.parentElement.replaceWith(slider);
        }
    });

    // Add click handlers for tag references
    tempDiv.querySelectorAll('.tag-reference').forEach(tag => {
        const newTag = tag.cloneNode(true);
        newTag.addEventListener('click', async () => {
            const selector = newTag.dataset.selector;
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            chrome.tabs.sendMessage(tab.id, {
                action: 'highlightElement',
                selector: selector
            });
        });
        tag.parentNode.replaceChild(newTag, tag);
    });

    return tempDiv.innerHTML;
}

// Function to create an attachment element
async function createAttachmentElement(filename, params, attachments) {
    try {
        const paramMap = {};
        params.split(',').forEach(param => {
            const [key, value] = param.split('=');
            if (key && value) paramMap[key.trim()] = value.trim();
        });

        // Find the attachment by filename
        const attachment = attachments.find(a => a.filename === filename);
        if (!attachment) {
            throw new Error(`Attachment not found: ${filename}`);
        }

        const { url, headers } = await getAttachmentUrl(attachment.id);
        const extension = filename.split('.').pop().toLowerCase();

        // Create a blob URL with authentication headers
        const response = await fetch(url, { headers });
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);

        // Create a container for the attachment
        const container = document.createElement('div');
        container.className = 'attachment-container';

        // Create expand button
        const expandBtn = document.createElement('button');
        expandBtn.className = 'expand-btn';
        expandBtn.innerHTML = 'Expand';
        expandBtn.title = 'View full size';
        expandBtn.onclick = (e) => {
            e.stopPropagation();
            const modal = document.createElement('div');
            modal.className = 'attachment-modal';
            modal.onclick = () => modal.remove();

            const content = document.createElement('div');
            content.className = 'modal-content';
            content.onclick = (e) => e.stopPropagation();

            // Handle different file types
            if (['jpg', 'jpeg', 'png', 'gif'].includes(extension)) {
                const img = document.createElement('img');
                img.src = blobUrl;
                img.alt = filename;
                content.appendChild(img);
            } else if (['mp4', 'mov', 'avi'].includes(extension)) {
                const video = document.createElement('video');
                video.controls = true;
                video.preload = 'metadata';

                const source = document.createElement('source');
                source.src = blobUrl;
                source.type = {
                    'mp4': 'video/mp4',
                    'mov': 'video/quicktime',
                    'avi': 'video/x-msvideo'
                }[extension] || `video/${extension}`;

                video.appendChild(source);
                content.appendChild(video);
            }

            modal.appendChild(content);
            document.body.appendChild(modal);
        };

        // Create the actual attachment element
        if (['jpg', 'jpeg', 'png', 'gif'].includes(extension)) {
            const img = document.createElement('img');
            img.src = blobUrl;
            img.alt = filename;
            img.className = 'attachment-preview';
            img.style.maxWidth = '100%';
            img.style.height = 'auto';
            container.appendChild(img);
        } else if (['mp4', 'mov', 'avi'].includes(extension)) {
            const videoContainer = document.createElement('div');
            videoContainer.className = 'video-container';

            const video = document.createElement('video');
            video.controls = true;
            video.style.width = '100%';
            video.style.height = 'auto';
            video.preload = 'metadata';

            const source = document.createElement('source');
            source.src = blobUrl;
            source.type = {
                'mp4': 'video/mp4',
                'mov': 'video/quicktime',
                'avi': 'video/x-msvideo'
            }[extension] || `video/${extension}`;

            video.appendChild(source);
            videoContainer.appendChild(video);
            container.appendChild(videoContainer);
        } else {
            const link = document.createElement('a');
            link.href = blobUrl;
            link.className = 'attachment-link';
            link.download = filename;

            const icon = document.createElement('span');
            icon.className = 'attachment-icon';
            icon.textContent = '📎';

            link.appendChild(icon);
            link.appendChild(document.createTextNode(filename));
            container.appendChild(link);
            return container.outerHTML; // Return early for files, no expand button needed
        }

        container.appendChild(expandBtn);
        return container.outerHTML;
    } catch (error) {
        console.error('Error creating attachment element:', error);
        return `<span class="error">Error loading attachment: ${filename}</span>`;
    }
}

// Content update tracking
const contentTracker = {
    state: new Map(),
    cache: new Map(),
    lastUpdate: new Map(),

    shouldUpdate(key, content) {
        const currentState = this.state.get(key);
        const lastUpdateTime = this.lastUpdate.get(key) || 0;
        const now = Date.now();

        // Prevent updates within 2 seconds of the last update
        if (now - lastUpdateTime < 2000) {
            console.log(`Skipping update for ${key} - too soon`);
            return false;
        }

        if (currentState === content) {
            console.log(`Skipping update for ${key} - content unchanged`);
            return false;
        }

        this.state.set(key, content);
        this.lastUpdate.set(key, now);
        return true;
    },

    getCache(key) {
        return this.cache.get(key);
    },

    setCache(key, content) {
        this.cache.set(key, content);
    },

    cleanup(ticketId) {
        console.log(`Cleaning up content for ticket ${ticketId}`);
        [this.state, this.cache, this.lastUpdate].forEach(map => {
            for (const key of map.keys()) {
                if (key.startsWith(ticketId)) {
                    map.delete(key);
                }
            }
        });
    },

    cleanupRemoved() {
        for (const key of this.state.keys()) {
            const ticketId = key.split('-')[0];
            if (!displayedTickets.has(ticketId.toUpperCase())) {
                this.cleanup(ticketId);
            }
        }
    }
};

// Handle logout
logoutBtn.addEventListener('click', async () => {
    try {
        await chrome.storage.local.remove(['jiraConfig']);
        configPanel.style.display = 'block';
        ticketsPanel.style.display = 'none';
        // Clear form fields
        document.getElementById('jira-url').value = '';
        document.getElementById('jira-token').value = '';
        // Clear tickets list
        ticketsList.innerHTML = '';
        displayedTickets.clear();
        contentTracker.cleanupRemoved();
        stopTicketChecking();
    } catch (error) {
        showError('Failed to logout: ' + error.message);
    }
});

// Load configuration
chrome.storage.local.get(['jiraConfig'], (result) => {
    if (result.jiraConfig) {
        if (result.jiraConfig.authType === 'token') {
            document.getElementById('jira-url').value = result.jiraConfig.baseUrl;
            document.getElementById('jira-token').value = result.jiraConfig.token;
        }
        configPanel.style.display = 'none';
        ticketsPanel.style.display = 'block';
        startTicketChecking();
    } else {
        ticketsPanel.style.display = 'none';
    }
});

// Handle OAuth login
oauthLoginBtn.addEventListener('click', async () => {
    try {
        const response = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({ action: 'initiateOAuth' }, response => {
                if (response.error) {
                    reject(new Error(response.error));
                } else {
                    resolve(response);
                }
            });
        });

        if (response.success) {
            configPanel.style.display = 'none';
            ticketsPanel.style.display = 'block';
            startTicketChecking();
        }
    } catch (error) {
        showError(`OAuth login failed: ${error.message}`);
    }
});

// Handle configuration form submission
configForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const config = {
        baseUrl: document.getElementById('jira-url').value.trim(),
        token: document.getElementById('jira-token').value.trim()
    };

    chrome.runtime.sendMessage({
        action: 'saveConfig',
        config
    }, () => {
        configPanel.style.display = 'none';
        ticketsPanel.style.display = 'block';
        startTicketChecking();
    });
});

// Function to synchronize comments between tickets
function syncTicketComments(ticketId) {
    // Find all instances of this ticket
    const tickets = Array.from(ticketsList.querySelectorAll(`.ticket[data-ticket-id="${ticketId}"]`));
    if (tickets.length <= 1) return;

    console.log(`Syncing comments for ${tickets.length} instances of ticket ${ticketId}`);

    // Get the first instance as our target
    const primaryTicket = tickets[0];
    const primaryComments = primaryTicket.querySelector('.ticket-comments');

    // Collect and preserve all comments
    tickets.slice(1).forEach(ticket => {
        const comments = ticket.querySelector('.ticket-comments');
        while (comments.firstChild) {
            // Move each comment to the primary ticket
            primaryComments.appendChild(comments.firstChild);
        }
    });

    // Sort comments by date
    const allComments = Array.from(primaryComments.children);
    allComments.sort((a, b) => {
        const dateA = new Date(a.querySelector('.comment-date').textContent);
        const dateB = new Date(b.querySelector('.comment-date').textContent);
        return dateA - dateB;
    });

    // Remove duplicates while preserving order
    const seen = new Set();
    const uniqueComments = allComments.filter(comment => {
        const key = comment.querySelector('.comment-date').textContent +
            comment.querySelector('.comment-content').textContent;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    // Clear and re-add sorted unique comments
    primaryComments.innerHTML = '';
    uniqueComments.forEach(comment => {
        primaryComments.appendChild(comment);
    });

    // Remove other instances
    tickets.slice(1).forEach(ticket => ticket.remove());
}


// Function to remove duplicate tickets
function removeDuplicateTickets() {
    const seenTickets = new Map(); // Map to store first instance of each ticket
    const tickets = ticketsList.querySelectorAll('.ticket');

    tickets.forEach(ticket => {
        const ticketId = ticket.dataset['ticket-id'];
        if (seenTickets.has(ticketId)) {
            // Sync comments before removing duplicates
            syncTicketComments(ticketId);
        } else {
            seenTickets.set(ticketId, ticket);
        }
    });
}

// Load tickets from the active tab
async function loadTickets() {
    if (!ticketsList.children.length) {
        ticketsList.innerHTML = '<div class="loading">Loading tickets...</div>';
    }

    try {
        // Get active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        // Get task IDs from content script
        const response = await new Promise((resolve) => {
            chrome.tabs.sendMessage(tab.id, { action: 'getTaskIds' }, resolve);
        });

        if (response.taskIds && response.taskIds.length > 0) {
            if (ticketsList.querySelector('.loading')) {
                ticketsList.innerHTML = '';
            }

            // Remove tickets that are no longer present
            const currentTickets = new Set(response.taskIds.map(id => id.toUpperCase()));
            const ticketsToRemove = [...displayedTickets].filter(id => !currentTickets.has(id));

            for (const ticketId of ticketsToRemove) {
                const ticketElement = document.querySelector(`.ticket[data-ticket-id="${ticketId}"]`);
                if (ticketElement) {
                    ticketElement.remove();
                    displayedTickets.delete(ticketId);
                    contentTracker.cleanup(ticketId);
                }
            }

            // Add or update tickets
            for (const ticketId of response.taskIds) {
                const normalizedId = ticketId.toUpperCase();
                try {
                    const ticketData = await fetchTicketData(ticketId);
                    await displayTicket(ticketData);
                    displayedTickets.add(normalizedId);
                } catch (error) {
                    console.error(`Error loading ticket ${ticketId}:`, error);
                    if (error.message.includes('Authentication failed')) {
                        configPanel.style.display = 'block';
                        ticketsPanel.style.display = 'none';
                        stopTicketChecking();
                        return;
                    }
                    showError(`Failed to load ticket ${ticketId}: ${error.message}`);
                }
            }

            // Clean up any orphaned content
            contentTracker.cleanupRemoved();
            removeDuplicateTickets();
            
            // Apply initial sorting
            filterAndSortTickets();
        } else if (!ticketsList.children.length || ticketsList.querySelector('.loading')) {
            ticketsList.innerHTML = '<div class="loading">No Jira tickets found on this page.</div>';
            displayedTickets.clear();
            contentTracker.cleanupRemoved();
        }
    } catch (error) {
        console.error('Error loading tickets:', error);
        showError('Failed to load tickets: ' + error.message);
    }
}

// Fetch ticket data from Jira
async function fetchTicketData(ticketId) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
            { action: 'getJiraTicket', ticketId },
            response => {
                if (response.error) {
                    reject(new Error(response.error));
                } else {
                    resolve(response);
                }
            }
        );
    });
}

// Display a ticket in the panel
async function displayTicket(ticketData) {
    const normalizedKey = ticketData.key.toUpperCase();
    const ticketAttachments = ticketData.fields.attachment || ticketData.attachments || [];

    // Check if ticket already exists
    let ticketContainer = document.querySelector(`.ticket[data-ticket-id="${normalizedKey}"]`);

    if (ticketContainer) {
        // Update existing ticket
        ticketContainer.querySelector('.ticket-status').textContent = ticketData.fields.status.name;
        ticketContainer.querySelector('.ticket-status').dataset.status = ticketData.fields.status.name.toLowerCase();
        ticketContainer.querySelector('.status-select').value = ticketData.fields.status.name.toLowerCase();
        
        // Ensure creation date is set
        if (!ticketContainer.dataset.createdDate) {
            ticketContainer.dataset.createdDate = ticketData.fields.created || new Date().toISOString();
        }

        // Update description only if content has changed
        const description = ticketData.fields.description || 'No description';
        const descriptionKey = `${ticketData.key}-description`;

        if (contentTracker.shouldUpdate(descriptionKey, description)) {
            console.log(`Updating description for ${ticketData.key}`);
            const parsedContent = await parseJiraContent(description, ticketAttachments);
            contentTracker.setCache(descriptionKey, parsedContent);
            ticketContainer.querySelector('.ticket-description').innerHTML = parsedContent;
        }

        // Update "Open in Jira" button handler
        const openInJiraBtn = ticketContainer.querySelector('.open-in-jira');
        const newOpenInJiraBtn = openInJiraBtn.cloneNode(true);
        openInJiraBtn.parentNode.replaceChild(newOpenInJiraBtn, openInJiraBtn);
        newOpenInJiraBtn.addEventListener('click', () => {
            chrome.storage.local.get(['jiraConfig'], (result) => {
                if (result.jiraConfig) {
                    let baseUrl = result.jiraConfig.baseUrl;
                    if (result.jiraConfig.authType === 'oauth') {
                        baseUrl = `${result.jiraConfig.cloudUrl}/browse`;
                    }
                    const ticketUrl = `${baseUrl}/${ticketData.key}`;
                    chrome.tabs.create({ url: ticketUrl });
                }
            });
        });
        return;
    }

    // Create new ticket
    const ticketElement = ticketTemplate.content.cloneNode(true);
    ticketContainer = ticketElement.querySelector('.ticket');
    ticketContainer.dataset.ticketId = normalizedKey;
    ticketContainer.dataset.createdDate = ticketData.fields.created || new Date().toISOString();

    // Set ticket data
    ticketContainer.querySelector('.ticket-key').textContent = ticketData.key;
    ticketContainer.querySelector('.ticket-status').textContent = ticketData.fields.status.name;
    ticketContainer.querySelector('.ticket-status').dataset.status = ticketData.fields.status.name.toLowerCase();
    ticketContainer.querySelector('.ticket-summary').textContent = ticketData.fields.summary;

    // Set description with caching
    const description = ticketData.fields.description || 'No description';
    const descriptionKey = `${ticketData.key}-description`;
    let parsedContent;

    if (contentTracker.shouldUpdate(descriptionKey, description)) {
        console.log(`Setting initial description for ${ticketData.key}`);
        parsedContent = await parseJiraContent(description, ticketAttachments);
        contentTracker.setCache(descriptionKey, parsedContent);
    } else {
        parsedContent = contentTracker.getCache(descriptionKey) || await parseJiraContent(description, ticketAttachments);
    }

    ticketContainer.querySelector('.ticket-description').innerHTML = parsedContent;

    // Add click handler for "Open in Jira" button
    const openInJiraBtn = ticketContainer.querySelector('.open-in-jira');
    openInJiraBtn.addEventListener('click', () => {
        chrome.storage.local.get(['jiraConfig'], (result) => {
            if (result.jiraConfig) {
                let baseUrl = result.jiraConfig.baseUrl;
                if (result.jiraConfig.authType === 'oauth') {
                    baseUrl = `${result.jiraConfig.cloudUrl}/browse`;
                }
                const ticketUrl = `${baseUrl}/${ticketData.key}`;
                chrome.tabs.create({ url: ticketUrl });
            }
        });
    });

    // Set current status in select
    const statusSelect = ticketContainer.querySelector('.status-select');
    statusSelect.value = ticketData.fields.status.name.toLowerCase();

    // Handle status change
    statusSelect.addEventListener('change', async (e) => {
        const newStatus = e.target.value;
        try {
            await updateTicketStatus(ticketData.key, newStatus);
            ticketContainer.querySelector('.ticket-status').textContent = newStatus;
            ticketContainer.querySelector('.ticket-status').dataset.status = newStatus.toLowerCase();
        } catch (error) {
            if (error.message.includes('Authentication failed')) {
                configPanel.style.display = 'block';
                ticketsPanel.style.display = 'none';
                stopTicketChecking();
            }
            showError(`Failed to update status: ${error.message}`);
            e.target.value = ticketData.fields.status.name.toLowerCase();
        }
    });

    // Display comments
    const commentsContainer = ticketContainer.querySelector('.ticket-comments');
    if (ticketData.fields.comment && ticketData.fields.comment.comments) {
        // Process all comments first to ensure proper parsing with attachments
        const processedComments = await Promise.all(
            ticketData.fields.comment.comments.map(async comment => {
                const commentKey = `${ticketData.key}-comment-${comment.id}`;
                let parsedBody;

                if (contentTracker.shouldUpdate(commentKey, comment.body)) {
                    console.log(`Processing comment ${comment.id} for ${ticketData.key}`);
                    parsedBody = await parseJiraContent(comment.body, ticketAttachments);
                    contentTracker.setCache(commentKey, parsedBody);
                } else {
                    parsedBody = contentTracker.getCache(commentKey) ||
                        await parseJiraContent(comment.body, ticketAttachments);
                }

                return {
                    ...comment,
                    body: parsedBody,
                    processed: true
                };
            })
        );

        // Display processed comments
        for (const comment of processedComments) {
            const commentElement = document.createElement('div');
            commentElement.className = 'comment';
            commentElement.dataset.commentId = comment.id;

            // Create author div
            const authorDiv = document.createElement('div');
            authorDiv.className = 'comment-author';
            authorDiv.textContent = comment.author.displayName;
            commentElement.appendChild(authorDiv);

            // Create content div and parse HTML
            const contentDiv = document.createElement('div');
            contentDiv.className = 'comment-content';

            // Parse tags in comment body
            const tagRegex = /\[tag\](.*?)\[\/tag\]/g;
            let lastIndex = 0;
            let parsedContent = '';
            let match;

            while ((match = tagRegex.exec(comment.body)) !== null) {
                // Add text before the tag
                parsedContent += comment.body.slice(lastIndex, match.index);

                // Add the tag as a clickable element
                const selector = match[1];
                parsedContent += `<span class="tag-reference" data-selector="${selector}">${selector}</span>`;

                lastIndex = tagRegex.lastIndex;
            }

            // Add remaining text
            parsedContent += comment.body.slice(lastIndex);

            // Parse the modified content with marked
            const parser = new DOMParser();
            const doc = parser.parseFromString(marked.parse(parsedContent), 'text/html');

            // Find and process attachment sliders
            const sliders = doc.querySelectorAll('.attachment-slider');
            sliders.forEach(slider => {
                if (slider.parentElement.tagName === 'P') {
                    slider.parentElement.replaceWith(slider);
                }
            });

            // Import nodes and add click handlers for tags
            Array.from(doc.body.childNodes).forEach(node => {
                contentDiv.appendChild(document.importNode(node, true));
            });

            // Add click handlers for tag references
            contentDiv.querySelectorAll('.tag-reference').forEach(tag => {
                tag.addEventListener('click', async () => {
                    const selector = tag.dataset.selector;
                    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    chrome.tabs.sendMessage(tab.id, {
                        action: 'highlightElement',
                        selector: selector
                    });
                });
            });

            commentElement.appendChild(contentDiv);

            // Create date div
            const dateDiv = document.createElement('div');
            dateDiv.className = 'comment-date';
            dateDiv.textContent = new Date(comment.created).toLocaleString();
            commentElement.appendChild(dateDiv);

            commentsContainer.appendChild(commentElement);
        }
    }

    // Handle new comments
    const commentForm = ticketContainer.querySelector('.comment-section');
    const commentInput = commentForm.querySelector('.comment-input');
    const addCommentBtn = commentForm.querySelector('.add-comment-btn');
    const selectElementBtn = commentForm.querySelector('.select-element-btn');
    const attachScreenshotBtn = commentForm.querySelector('.attach-screenshot-btn');

    // Handle element selection button click
    selectElementBtn.addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        chrome.tabs.sendMessage(tab.id, { action: 'startElementSelection' });
    });

    // Handle screenshot attachment button click
    attachScreenshotBtn.addEventListener('click', async () => {
        try {
            attachScreenshotBtn.disabled = true;
            attachScreenshotBtn.textContent = 'Capturing...';

            const response = await new Promise((resolve, reject) => {
                chrome.runtime.sendMessage({ action: 'captureScreenshot' }, (response) => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else if (response.error) {
                        reject(new Error(response.error));
                    } else {
                        resolve(response);
                    }
                });
            });

            if (response.dataUrl) {
                // Store screenshot data for later use when adding comment
                commentInput.dataset.screenshotData = response.dataUrl;
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                commentInput.dataset.screenshotFilename = `screenshot-${timestamp}.png`;
                
                // Add placeholder text to comment
                commentInput.value += `\n\n[Screenshot will be attached when comment is added]`;
                commentInput.dispatchEvent(new Event('input'));
                showError('Screenshot captured! Click "Add Comment" to post with the screenshot.', 'success');
            }
        } catch (error) {
            console.error('Screenshot error:', error);
            showError('Failed to capture screenshot: ' + error.message);
        } finally {
            attachScreenshotBtn.disabled = false;
            attachScreenshotBtn.textContent = 'Add Screenshot';
        }
    });

    // Listen for element selection
    const elementSelectionListener = (request, sender, sendResponse) => {
        if (request.action === 'elementSelected') {
            const selector = request.selector;
            const tagText = `[tag]${selector}[/tag]`;

            // Insert tag at cursor position or append to end
            const cursorPos = commentInput.selectionStart;
            const currentValue = commentInput.value;
            commentInput.value = currentValue.slice(0, cursorPos) +
                tagText +
                currentValue.slice(cursorPos);
        }
    };
    chrome.runtime.onMessage.addListener(elementSelectionListener);

    // Remove listener when ticket is removed
    const cleanup = () => {
        chrome.runtime.onMessage.removeListener(elementSelectionListener);
    };
    ticketContainer.addEventListener('remove', cleanup);

    addCommentBtn.addEventListener('click', async () => {
        const comment = commentInput.value.trim().replace('[Screenshot will be attached when comment is added]', '').trim();
        if (!comment) return;

        try {
            // Get screenshot data if it exists
            const screenshotData = commentInput.dataset.screenshotData;
            const filename = commentInput.dataset.screenshotFilename;
            
            // Add comment with screenshot if available
            const response = await new Promise((resolve, reject) => {
                chrome.runtime.sendMessage({
                    action: 'addComment',
                    ticketId: ticketData.key,
                    comment: comment,
                    screenshotData: screenshotData,
                    filename: filename
                }, response => {
                    if (response.error) {
                        reject(new Error(response.error));
                    } else {
                        resolve(response);
                    }
                });
            });

            // Clear screenshot data
            delete commentInput.dataset.screenshotData;
            delete commentInput.dataset.screenshotFilename;

            // Create and display the new comment
            const parsedBody = await parseJiraContent(response.body, ticketAttachments);
            const commentElement = document.createElement('div');
            commentElement.className = 'comment';
            commentElement.dataset.commentId = response.id;

            // Create author div
            const authorDiv = document.createElement('div');
            authorDiv.className = 'comment-author';
            authorDiv.textContent = 'You';
            commentElement.appendChild(authorDiv);

            // Create content div
            const contentDiv = document.createElement('div');
            contentDiv.className = 'comment-content';
            contentDiv.innerHTML = parsedBody;
            commentElement.appendChild(contentDiv);

            // Create date div
            const dateDiv = document.createElement('div');
            dateDiv.className = 'comment-date';
            dateDiv.textContent = new Date().toLocaleString();
            commentElement.appendChild(dateDiv);

            commentsContainer.appendChild(commentElement);
            commentInput.value = '';
        } catch (error) {
            if (error.message.includes('Authentication failed')) {
                configPanel.style.display = 'block';
                ticketsPanel.style.display = 'none';
                stopTicketChecking();
            }
            showError(`Failed to add comment: ${error.message}`);
        }
    });

    ticketsList.appendChild(ticketContainer);
}

// Update ticket status
async function updateTicketStatus(ticketId, status) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
            { action: 'updateTicketStatus', ticketId, status },
            response => {
                if (response.error) {
                    reject(new Error(response.error));
                } else {
                    resolve(response);
                }
            }
        );
    });
}

// Add a comment to a ticket
async function addComment(ticketId, comment) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
            { action: 'addComment', ticketId, comment },
            response => {
                if (response.error) {
                    reject(new Error(response.error));
                } else {
                    resolve(response);
                }
            }
        );
    });
}

// Get attachment URL with auth
async function getAttachmentUrl(attachmentId) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
            { action: 'getAttachmentUrl', attachmentId },
            response => {
                if (response.error) {
                    reject(new Error(response.error));
                } else {
                    resolve(response);
                }
            }
        );
    });
}

// Show notification message
function showError(message, type = 'error') {
    const notificationElement = document.createElement('div');
    notificationElement.className = type === 'success' ? 'success' : 'error';
    notificationElement.textContent = message;
    ticketsList.insertBefore(notificationElement, ticketsList.firstChild);
    setTimeout(() => notificationElement.remove(), 5000);
}

// Track ticket IDs
let lastKnownTickets = new Set();

// Start periodic ticket checking
let ticketCheckInterval;

function startTicketChecking() {
    loadTickets();
    if (!ticketCheckInterval) {
        ticketCheckInterval = setInterval(async () => {
            try {
                // Get active tab
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

                // Get task IDs from content script
                const response = await new Promise((resolve) => {
                    chrome.tabs.sendMessage(tab.id, { action: 'getTaskIds' }, resolve);
                });

                const currentTickets = new Set(response.taskIds?.map(id => id.toUpperCase()) || []);

                // Check if there are any changes
                const hasChanges =
                    currentTickets.size !== lastKnownTickets.size ||
                    ![...currentTickets].every(id => lastKnownTickets.has(id)) ||
                    ![...lastKnownTickets].every(id => currentTickets.has(id));

                if (hasChanges) {
                    console.log('Ticket changes detected, updating...');
                    await loadTickets();
                    lastKnownTickets = currentTickets;
                }
            } catch (error) {
                console.error('Error checking tickets:', error);
            }
        }, 5000); // Check every 5 seconds
    }
}

function stopTicketChecking() {
    if (ticketCheckInterval) {
        clearInterval(ticketCheckInterval);
        ticketCheckInterval = null;
        lastKnownTickets.clear();
        contentTracker.cleanupRemoved();
    }
}

// Start checking when panel becomes visible
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && ticketsPanel.style.display !== 'none') {
        startTicketChecking();
    } else {
        stopTicketChecking();
    }
});

// Initial start if panel is visible and logged in
if (document.visibilityState === 'visible' && ticketsPanel.style.display !== 'none') {
    startTicketChecking();
}