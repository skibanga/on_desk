/**
 * WhatsApp Integration JavaScript
 *
 * This file contains all the JavaScript functionality for the WhatsApp interface
 * in the On Desk application.
 */

document.addEventListener('DOMContentLoaded', function () {
    let activeConversation = null;
    let messageStatusInterval = null;

    // Function to load conversation messages
    function loadConversation(phoneNumber, contactName) {
        // Clear any existing status update interval
        if (messageStatusInterval) {
            clearInterval(messageStatusInterval);
        }

        // Set active conversation
        activeConversation = {
            phone: phoneNumber,
            name: contactName
        };

        // Update UI
        document.querySelector('.chat-name').textContent = contactName;
        document.querySelector('.chat-status').textContent = 'Loading...';

        // Enable the input
        document.querySelector('.chat-input input').disabled = false;
        document.querySelector('.chat-input button').disabled = false;

        // Show chat on mobile
        document.querySelector('.whatsapp-grid').classList.add('show-chat');

        // Fetch messages
        frappe.call({
            method: 'on_desk.www.on-desk.whatsapp.api.get_conversation_messages',
            args: {
                phone_number: phoneNumber
            },
            callback: function (response) {
                if (response.message) {
                    renderMessages(response.message);
                    document.querySelector('.chat-status').textContent = 'Online';

                    // Start polling for message status updates
                    startMessageStatusUpdates();
                }
            }
        });
    }

    // Function to render messages
    function renderMessages(messages) {
        const messagesContainer = document.querySelector('.chat-messages');
        messagesContainer.innerHTML = '';

        if (messages.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.classList.add('empty-state');
            emptyState.innerHTML = `
                <div class="empty-state-icon">
                    <i class="uil uil-comment-alt-message"></i>
                </div>
                <div class="empty-state-title">No messages yet</div>
                <div class="empty-state-text">Start the conversation by sending a message</div>
            `;
            messagesContainer.appendChild(emptyState);
            return;
        }

        // Add date divider
        const dateDivider = document.createElement('div');
        dateDivider.classList.add('date-divider');
        dateDivider.textContent = 'Today';
        messagesContainer.appendChild(dateDivider);

        messages.forEach(message => {
            const messageElement = document.createElement('div');
            messageElement.classList.add('message');
            messageElement.classList.add(message.direction === 'Incoming' ? 'message-incoming' : 'message-outgoing');
            messageElement.dataset.messageId = message.message_id;

            let messageContent = `
                ${message.message}
                <div class="message-time">${message.time}</div>
            `;

            if (message.direction === 'Outgoing') {
                let statusIcon = '';
                let statusClass = '';

                if (message.status === 'Sent') {
                    statusIcon = 'uil-check';
                    statusClass = 'status-sent';
                } else if (message.status === 'Delivered') {
                    statusIcon = 'uil-check-double';
                    statusClass = 'status-delivered';
                } else if (message.status === 'Read') {
                    statusIcon = 'uil-check-double';
                    statusClass = 'status-read';
                } else if (message.status === 'Failed') {
                    statusIcon = 'uil-times';
                    statusClass = 'status-failed';
                }

                messageContent += `
                    <div class="message-status">
                        <span>${message.status}</span>
                        <i class="uil ${statusIcon} status-icon ${statusClass}"></i>
                    </div>
                `;
            }

            messageElement.innerHTML = messageContent;
            messagesContainer.appendChild(messageElement);
        });

        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Function to send a message
    function sendMessage(message) {
        if (!activeConversation || !message) return;

        // Disable the send button
        const sendButton = document.querySelector('.chat-input button');
        sendButton.disabled = true;
        sendButton.innerHTML = '<i class="uil uil-spinner-alt fa-spin"></i>';

        // Add temporary message to UI
        const messagesContainer = document.querySelector('.chat-messages');
        const tempId = 'temp-' + Date.now();
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', 'message-outgoing');
        messageElement.dataset.messageId = tempId;
        messageElement.innerHTML = `
            ${message}
            <div class="message-time">Just now</div>
            <div class="message-status">
                <span>Sending...</span>
                <i class="uil uil-spinner-alt fa-spin status-icon"></i>
            </div>
        `;
        messagesContainer.appendChild(messageElement);

        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        // Send the message via API
        frappe.call({
            method: 'on_desk.www.on-desk.whatsapp.api.send_message',
            args: {
                phone_number: activeConversation.phone,
                message: message
            },
            callback: function (response) {
                // Re-enable the send button
                sendButton.disabled = false;
                sendButton.innerHTML = '<i class="uil uil-message"></i>';

                if (response.message && response.message.success) {
                    // Update the temporary message with the real message ID
                    const tempMessage = document.querySelector(`[data-message-id="${tempId}"]`);
                    if (tempMessage) {
                        tempMessage.dataset.messageId = response.message.message_id;
                        tempMessage.querySelector('.message-status').innerHTML = `
                            <span>Sent</span>
                            <i class="uil uil-check status-icon status-sent"></i>
                        `;
                    }

                    // Start polling for status updates
                    startMessageStatusUpdates();
                } else {
                    // Get error details
                    const errorData = response.message || {};
                    const errorMessage = errorData.error ? errorData.error : 'Failed to send message';

                    // Update the temporary message to show failure
                    const tempMessage = document.querySelector(`[data-message-id="${tempId}"]`);
                    if (tempMessage) {
                        tempMessage.querySelector('.message-status').innerHTML = `
                            <span>Failed</span>
                            <i class="uil uil-times status-icon status-failed"></i>
                        `;
                    }

                    // Check if this is an authentication error
                    if (errorData.auth_error || (errorMessage && (errorMessage.includes('401 Unauthorized') || errorMessage.includes('Authentication Failed')))) {
                        // Show a more detailed error for authentication issues
                        const helpMessage = errorData.help || 'Please check your WhatsApp integration settings.';

                        // Create a more detailed error message
                        const detailedError = `
                            <div class="auth-error-message">
                                <p><strong>Authentication Error:</strong> ${errorMessage}</p>
                                <p>${helpMessage}</p>
                                <p>To fix this issue:</p>
                                <ol>
                                    <li>Go to WhatsApp Integration settings</li>
                                    <li>Update your API key</li>
                                    <li>Save the settings</li>
                                </ol>
                            </div>
                        `;

                        // Show a modal with the detailed error
                        frappe.msgprint({
                            title: 'WhatsApp Authentication Error',
                            message: detailedError,
                            indicator: 'red'
                        });
                    } else {
                        // Show a regular error message
                        frappe.msgprint({
                            title: __('Error'),
                            indicator: 'red',
                            message: __('Failed to send message: ') + errorMessage
                        });
                    }

                    console.error('WhatsApp send error:', errorData);
                }
            }
        });
    }

    // Initialize the UI event handlers
    function initializeUI() {
        // Set up conversation click handlers
        setupConversationClickHandlers();

        // Set up send message handler
        const sendButton = document.querySelector('#send-message-btn');
        const messageInput = document.querySelector('#message-input');

        sendButton.addEventListener('click', function () {
            const message = messageInput.value.trim();
            if (message) {
                sendMessage(message);
                messageInput.value = '';
            }
        });

        // Allow sending with Enter key
        messageInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                sendButton.click();
            }
        });

        // Set up new conversation button
        const newConversationButton = document.querySelector('#new-conversation-btn');
        newConversationButton.addEventListener('click', showNewConversationModal);

        // Set up empty state new conversation button
        const emptyNewConversationBtn = document.querySelector('#empty-new-conversation-btn');
        if (emptyNewConversationBtn) {
            emptyNewConversationBtn.addEventListener('click', showNewConversationModal);
        }

        // Set up modal close buttons
        const closeModalBtn = document.querySelector('#close-modal-btn');
        const cancelModalBtn = document.querySelector('#cancel-modal-btn');
        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', hideNewConversationModal);
        }
        if (cancelModalBtn) {
            cancelModalBtn.addEventListener('click', hideNewConversationModal);
        }

        // Set up create conversation button
        const createConversationBtn = document.querySelector('#create-conversation-btn');
        if (createConversationBtn) {
            createConversationBtn.addEventListener('click', createNewConversation);
        }

        // Set up back button for mobile
        const backButton = document.querySelector('#back-button');
        if (backButton) {
            backButton.addEventListener('click', function () {
                document.querySelector('.whatsapp-grid').classList.remove('show-chat');
            });
        }

        // Set up refresh button
        const refreshButton = document.querySelector('#refresh-messages-btn');
        if (refreshButton) {
            refreshButton.addEventListener('click', function () {
                if (activeConversation) {
                    loadConversation(activeConversation.phone, activeConversation.name);
                }
            });
        }

        // Set up search functionality
        const searchInput = document.querySelector('#search-conversations');
        if (searchInput) {
            searchInput.addEventListener('input', function () {
                const searchTerm = this.value.toLowerCase();
                const conversationItems = document.querySelectorAll('.conversation-item');

                conversationItems.forEach(item => {
                    const name = item.dataset.name.toLowerCase();
                    const phone = item.dataset.phone.toLowerCase();

                    if (name.includes(searchTerm) || phone.includes(searchTerm)) {
                        item.style.display = '';
                    } else {
                        item.style.display = 'none';
                    }
                });
            });
        }
    }

    // Function to start polling for message status updates
    function startMessageStatusUpdates() {
        // Clear any existing interval
        if (messageStatusInterval) {
            clearInterval(messageStatusInterval);
        }

        // Set up new interval
        messageStatusInterval = setInterval(() => {
            if (!activeConversation) return;

            // Get all outgoing messages that aren't in a final state
            const outgoingMessages = document.querySelectorAll('.message-outgoing');
            const messageIds = [];

            outgoingMessages.forEach(msg => {
                const messageId = msg.dataset.messageId;
                if (messageId && !messageId.startsWith('temp-')) {
                    const statusEl = msg.querySelector('.message-status span');
                    if (statusEl && statusEl.textContent !== 'Read' && statusEl.textContent !== 'Failed') {
                        messageIds.push(messageId);
                    }
                }
            });

            if (messageIds.length === 0) {
                // No messages to update, clear the interval
                clearInterval(messageStatusInterval);
                messageStatusInterval = null;
                return;
            }

            // Fetch status updates
            frappe.call({
                method: 'on_desk.www.on-desk.whatsapp.api.get_message_statuses',
                args: {
                    message_ids: messageIds
                },
                callback: function (response) {
                    if (response.message) {
                        // Update message statuses in the UI
                        response.message.forEach(msg => {
                            const messageEl = document.querySelector(`[data-message-id="${msg.message_id}"]`);
                            if (messageEl) {
                                const statusEl = messageEl.querySelector('.message-status');
                                if (statusEl) {
                                    let statusIcon = '';
                                    let statusClass = '';

                                    if (msg.status === 'Sent') {
                                        statusIcon = 'uil-check';
                                        statusClass = 'status-sent';
                                    } else if (msg.status === 'Delivered') {
                                        statusIcon = 'uil-check-double';
                                        statusClass = 'status-delivered';
                                    } else if (msg.status === 'Read') {
                                        statusIcon = 'uil-check-double';
                                        statusClass = 'status-read';
                                    } else if (msg.status === 'Failed') {
                                        statusIcon = 'uil-times';
                                        statusClass = 'status-failed';
                                    }

                                    statusEl.innerHTML = `
                                        <span>${msg.status}</span>
                                        <i class="uil ${statusIcon} status-icon ${statusClass}"></i>
                                    `;
                                }
                            }
                        });

                        // If all messages are in a final state, clear the interval
                        const allFinal = response.message.every(msg =>
                            msg.status === 'Read' || msg.status === 'Failed');

                        if (allFinal) {
                            clearInterval(messageStatusInterval);
                            messageStatusInterval = null;
                        }
                    }
                }
            });
        }, 5000); // Check every 5 seconds
    }

    // Function to refresh conversations list
    function refreshConversations() {
        frappe.call({
            method: 'on_desk.www.on-desk.whatsapp.api.get_conversations',
            callback: function (response) {
                if (response.message) {
                    renderConversations(response.message);
                }
            }
        });
    }

    // Function to render conversations
    function renderConversations(conversations) {
        const conversationsList = document.querySelector('#conversation-list');
        conversationsList.innerHTML = '';

        if (conversations.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.classList.add('empty-state');
            emptyState.innerHTML = `
                <div class="empty-state-icon">
                    <i class="uil uil-comment-alt-dots"></i>
                </div>
                <div class="empty-state-title">No conversations yet</div>
                <div class="empty-state-text">Start a new conversation to connect with your contacts via WhatsApp</div>
                <button class="empty-state-button" id="empty-new-conversation-btn">
                    <i class="uil uil-plus"></i> New Conversation
                </button>
            `;
            conversationsList.appendChild(emptyState);

            // Re-attach event listener to the new button
            const emptyNewConversationBtn = document.querySelector('#empty-new-conversation-btn');
            if (emptyNewConversationBtn) {
                emptyNewConversationBtn.addEventListener('click', showNewConversationModal);
            }

            return;
        }

        conversations.forEach((conversation, index) => {
            const item = document.createElement('li');
            item.classList.add('conversation-item');
            if (activeConversation && activeConversation.phone === conversation.phone) {
                item.classList.add('active');
            }

            let avatarContent = '';
            if (conversation.image) {
                avatarContent = `<img src="${conversation.image}" alt="${conversation.name}">`;
            } else {
                avatarContent = conversation.name[0];
            }

            let unreadBadge = '';
            if (conversation.unread_count) {
                unreadBadge = `<div class="unread-badge">${conversation.unread_count}</div>`;
            }

            item.innerHTML = `
                <div class="conversation-avatar">
                    ${avatarContent}
                    <div class="online-indicator"></div>
                </div>
                <div class="conversation-info">
                    <div class="conversation-name">${conversation.name}</div>
                    <div class="conversation-preview">${conversation.last_message}</div>
                </div>
                <div class="conversation-meta">
                    <div class="conversation-time">${conversation.time}</div>
                    ${unreadBadge}
                </div>
            `;

            item.dataset.phone = conversation.phone;
            item.dataset.name = conversation.name;

            conversationsList.appendChild(item);
        });

        // Add click handlers to the new conversation items
        setupConversationClickHandlers();
    }

    // Function to set up conversation click handlers
    function setupConversationClickHandlers() {
        const conversationItems = document.querySelectorAll('.conversation-item');
        conversationItems.forEach(item => {
            item.addEventListener('click', function () {
                conversationItems.forEach(i => i.classList.remove('active'));
                this.classList.add('active');

                const phone = this.dataset.phone;
                const name = this.dataset.name;

                if (phone && name) {
                    loadConversation(phone, name);
                }
            });
        });
    }

    // Function to show new conversation modal
    function showNewConversationModal() {
        // Use Frappe's dialog system instead of custom modal
        frappe.prompt([
            {
                fieldname: 'phone_number',
                label: 'Phone Number',
                fieldtype: 'Data',
                reqd: 1,
                description: 'Enter phone number with country code (e.g., +1234567890)'
            },
            {
                fieldname: 'contact_name',
                label: 'Contact Name',
                fieldtype: 'Data',
                reqd: 1
            }
        ],
            function (values) {
                // Create a new conversation
                frappe.call({
                    method: 'on_desk.www.on-desk.whatsapp.api.create_conversation',
                    args: {
                        phone_number: values.phone_number,
                        contact_name: values.contact_name
                    },
                    callback: function (response) {
                        if (response.message && response.message.success) {
                            // Refresh conversations list
                            refreshConversations();

                            // Load the new conversation
                            loadConversation(values.phone_number, values.contact_name);
                        } else {
                            frappe.msgprint({
                                title: __('Error'),
                                indicator: 'red',
                                message: __('Failed to create conversation. Please try again.')
                            });
                        }
                    }
                });
            },
            'New Conversation',
            'Create'
        );
    }

    // Function to hide new conversation modal
    function hideNewConversationModal() {
        const modal = document.querySelector('#new-conversation-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    // Function to create a new conversation
    function createNewConversation() {
        const phoneInput = document.querySelector('#phone-number-input');
        const nameInput = document.querySelector('#contact-name-input');

        const phone = phoneInput.value.trim();
        const name = nameInput.value.trim();

        if (!phone || !name) {
            frappe.msgprint({
                title: __('Error'),
                indicator: 'red',
                message: __('Phone number and contact name are required.')
            });
            return;
        }

        // Create a new conversation
        frappe.call({
            method: 'on_desk.www.on-desk.whatsapp.api.create_conversation',
            args: {
                phone_number: phone,
                contact_name: name
            },
            callback: function (response) {
                if (response.message && response.message.success) {
                    // Hide the modal
                    hideNewConversationModal();

                    // Refresh conversations list
                    refreshConversations();

                    // Load the new conversation
                    loadConversation(phone, name);
                } else {
                    frappe.msgprint({
                        title: __('Error'),
                        indicator: 'red',
                        message: __('Failed to create conversation. Please try again.')
                    });
                }
            }
        });
    }

    // Set up real-time updates using our custom realtime client
    function setupRealtimeEvents() {
        console.log("Setting up realtime events for WhatsApp...");

        // Try to use our custom realtime client first
        if (typeof on_desk !== 'undefined' && on_desk.realtime) {
            console.log("Using on_desk.realtime client for WhatsApp events");

            // Make sure the socket is connected and events are registered
            if (on_desk.realtime.ensure_whatsapp_events) {
                on_desk.realtime.ensure_whatsapp_events();

                // Debug the WhatsApp events
                if (on_desk.realtime.debug_whatsapp) {
                    on_desk.realtime.debug_whatsapp();
                }
            } else {
                // If the method doesn't exist, initialize the socket
                if (on_desk.realtime.init) {
                    on_desk.realtime.init();
                }
            }

            // Listen for incoming and outgoing messages
            on_desk.realtime.on('whatsapp_message_received', function (data) {
                console.log("WhatsApp message received via on_desk.realtime:", data);

                // Show a notification
                showNotification("New WhatsApp Message",
                    data.direction === "Outgoing" ?
                        `Message sent to ${data.to_number}` :
                        `New message from ${data.from_number}`);

                // Process the message
                processWhatsAppMessage(data);
            });

            // Also listen for immediate messages
            on_desk.realtime.on('whatsapp_message_received_immediate', function (data) {
                console.log("WhatsApp message received immediate via on_desk.realtime:", data);

                // Process the message
                processWhatsAppMessage(data);
            });

            // Listen for message status updates
            on_desk.realtime.on('whatsapp_message_status_update', function (data) {
                console.log("WhatsApp message status update via on_desk.realtime:", data);

                // If this message is in the current view, update its status
                updateMessageStatus(data);
            });

            // Also listen for immediate status updates
            on_desk.realtime.on('whatsapp_message_status_update_immediate', function (data) {
                console.log("WhatsApp message status update immediate via on_desk.realtime:", data);

                // If this message is in the current view, update its status
                updateMessageStatus(data);
            });

            // Set up reconnection handler
            on_desk.realtime.on('reconnect', function () {
                console.log("Socket reconnected, refreshing WhatsApp data...");

                // Refresh conversations list
                refreshConversations();

                // Refresh active conversation if any
                if (activeConversation) {
                    loadConversation(activeConversation.phone, activeConversation.name);
                }
            });
        }
        // Fall back to frappe.realtime for backward compatibility
        else if (typeof frappe !== 'undefined' && frappe.realtime) {
            console.log("Falling back to frappe.realtime for WhatsApp events");

            // Initialize frappe.realtime if needed
            if (frappe.realtime.init && !frappe.realtime.socket) {
                frappe.realtime.init();
            }

            // Listen for incoming and outgoing messages
            frappe.realtime.on('whatsapp_message_received', function (data) {
                console.log("WhatsApp message received via frappe.realtime:", data);

                // Show a notification
                showNotification("New WhatsApp Message",
                    data.direction === "Outgoing" ?
                        `Message sent to ${data.to_number}` :
                        `New message from ${data.from_number}`);

                // Process the message
                processWhatsAppMessage(data);
            });

            // Also listen for immediate messages
            frappe.realtime.on('whatsapp_message_received_immediate', function (data) {
                console.log("WhatsApp message received immediate via frappe.realtime:", data);

                // Process the message
                processWhatsAppMessage(data);
            });

            // Listen for message status updates
            frappe.realtime.on('whatsapp_message_status_update', function (data) {
                console.log("WhatsApp message status update via frappe.realtime:", data);

                // If this message is in the current view, update its status
                updateMessageStatus(data);
            });

            // Also listen for immediate status updates
            frappe.realtime.on('whatsapp_message_status_update_immediate', function (data) {
                console.log("WhatsApp message status update immediate via frappe.realtime:", data);

                // If this message is in the current view, update its status
                updateMessageStatus(data);
            });
        }

        // Also set up DOM event listeners as a fallback
        document.addEventListener('whatsapp_message_received', function (event) {
            console.log("WhatsApp message received via DOM event:", event.detail);

            // Process the message
            processWhatsAppMessage(event.detail);
        });

        document.addEventListener('whatsapp_message_status_update', function (event) {
            console.log("WhatsApp message status update via DOM event:", event.detail);

            // If this message is in the current view, update its status
            updateMessageStatus(event.detail);
        });

        // If no realtime client is available, show an error
        if (typeof on_desk === 'undefined' && (typeof frappe === 'undefined' || !frappe.realtime)) {
            console.error("No realtime client available for WhatsApp events");
        }
    }

    // Process a WhatsApp message event
    function processWhatsAppMessage(data) {
        // Check if this is an outgoing message for the active conversation
        if (data.direction === "Outgoing" && activeConversation && data.to_number === activeConversation.phone) {
            console.log("Outgoing message for active conversation, refreshing...");
            loadConversation(activeConversation.phone, activeConversation.name);
        }
        // Check if this is an incoming message for the active conversation
        else if (activeConversation && data.from_number === activeConversation.phone) {
            console.log("Incoming message for active conversation, refreshing...");
            loadConversation(activeConversation.phone, activeConversation.name);
        } else {
            // If it's not for the active conversation, just refresh the conversations list
            // This ensures new conversations appear without a page reload
            console.log("Message not for active conversation, refreshing list...");
            refreshConversations();
        }
    }

    // Show a notification
    function showNotification(title, message) {
        try {
            // Check if notifications are supported
            if (!("Notification" in window)) {
                console.log("Notifications not supported");
                return;
            }

            // Check if permission is granted
            if (Notification.permission === "granted") {
                new Notification(title, {
                    body: message,
                    icon: "/assets/on_desk/img/whatsapp-icon.png"
                });
            }
            // Otherwise, request permission
            else if (Notification.permission !== "denied") {
                Notification.requestPermission().then(function (permission) {
                    if (permission === "granted") {
                        new Notification(title, {
                            body: message,
                            icon: "/assets/on_desk/img/whatsapp-icon.png"
                        });
                    }
                });
            }
        } catch (e) {
            console.error("Error showing notification:", e);
        }
    }

    // Function to check socket connection periodically
    function startSocketConnectionCheck() {
        // Check connection every 30 seconds
        setInterval(function () {
            if (typeof on_desk !== 'undefined' && on_desk.realtime) {
                on_desk.realtime.check_connection();
            }
        }, 30000);
    }

    // Helper function to update message status in the UI
    function updateMessageStatus(data) {
        // If this message is in the current view, update its status
        const messageEl = document.querySelector(`[data-message-id="${data.message_id}"]`);
        if (messageEl) {
            const statusEl = messageEl.querySelector('.message-status');
            if (statusEl) {
                let statusIcon = '';
                let statusClass = '';

                if (data.status === 'Sent') {
                    statusIcon = 'uil-check';
                    statusClass = 'status-sent';
                } else if (data.status === 'Delivered') {
                    statusIcon = 'uil-check-double';
                    statusClass = 'status-delivered';
                } else if (data.status === 'Read') {
                    statusIcon = 'uil-check-double';
                    statusClass = 'status-read';
                } else if (data.status === 'Failed') {
                    statusIcon = 'uil-times';
                    statusClass = 'status-failed';
                }

                statusEl.innerHTML = `
                    <span>${data.status}</span>
                    <i class="uil ${statusIcon} status-icon ${statusClass}"></i>
                `;
            }
        }
    }

    // Function to test WhatsApp events
    function testWhatsAppEvent() {
        // Show a loading message
        frappe.show_alert({
            message: __('Triggering test WhatsApp event...'),
            indicator: 'blue'
        });

        // Call the API to trigger a test event
        frappe.call({
            method: 'on_desk.on_desk.doctype.od_whatsapp_integration.api.test_whatsapp_event',
            args: {
                phone_number: activeConversation ? activeConversation.phone : null,
                message: 'Test message from WhatsApp interface'
            },
            callback: function (response) {
                if (response.message && response.message.success) {
                    frappe.show_alert({
                        message: __('Test WhatsApp event triggered successfully!'),
                        indicator: 'green'
                    });

                    console.log('Test WhatsApp event triggered:', response.message.event_data);
                } else {
                    frappe.show_alert({
                        message: __('Failed to trigger test WhatsApp event'),
                        indicator: 'red'
                    });
                }
            }
        });
    }

    // Add test button to the UI
    function addTestButton() {
        // Create the test button
        const testButton = document.createElement('button');
        testButton.className = 'btn btn-sm btn-outline-primary ms-2';
        testButton.innerHTML = '<i class="uil uil-bolt"></i> Test Event';
        testButton.title = 'Trigger a test WhatsApp event';
        testButton.onclick = testWhatsAppEvent;

        // Find the header actions container
        const headerActions = document.querySelector('.whatsapp-header-actions');
        if (headerActions) {
            headerActions.appendChild(testButton);
        } else {
            // If the header actions container doesn't exist, add it to the refresh button
            const refreshButton = document.querySelector('#refresh-conversations-btn');
            if (refreshButton && refreshButton.parentNode) {
                refreshButton.parentNode.appendChild(testButton);
            }
        }
    }

    // Set up realtime events
    setupRealtimeEvents();

    // Initialize the UI
    initializeUI();

    // Initial load of conversations
    refreshConversations();

    // Start periodic socket connection check
    startSocketConnectionCheck();

    // Add test button after a short delay to ensure the UI is loaded
    setTimeout(addTestButton, 1000);
});