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
        console.log('Loading conversation for:', phoneNumber, contactName);

        // Clear any existing status update interval
        if (messageStatusInterval) {
            clearInterval(messageStatusInterval);
        }

        // Set active conversation
        activeConversation = {
            phone: phoneNumber,
            name: contactName
        };
        console.log('Active conversation set:', activeConversation);

        // Update UI
        const chatNameEl = document.querySelector('.chat-name');
        const chatStatusEl = document.querySelector('.chat-status');

        if (chatNameEl) {
            chatNameEl.textContent = contactName;
        } else {
            console.error('Chat name element not found');
        }

        if (chatStatusEl) {
            chatStatusEl.textContent = 'Loading...';
        } else {
            console.error('Chat status element not found');
        }

        // Enable the input
        const chatInput = document.querySelector('.chat-input input');
        const chatButton = document.querySelector('#send-message-btn');

        if (chatInput) {
            chatInput.disabled = false;
        } else {
            console.error('Chat input element not found');
        }

        if (chatButton) {
            chatButton.disabled = false;
        } else {
            console.error('Chat button element not found');
        }

        // Show chat on mobile
        const whatsappGrid = document.querySelector('.whatsapp-grid');
        if (whatsappGrid) {
            whatsappGrid.classList.add('show-chat');
        } else {
            console.error('WhatsApp grid element not found');
        }

        console.log('Fetching messages for phone number:', phoneNumber);
        // Fetch messages
        frappe.call({
            method: 'on_desk.on_desk.www.on-desk.whatsapp.api.get_conversation_messages',
            args: {
                phone_number: phoneNumber
            },
            callback: function (response) {
                console.log('API response for messages:', response);

                if (response.message) {
                    renderMessages(response.message);

                    if (chatStatusEl) {
                        chatStatusEl.textContent = 'Online';
                    }

                    // Start polling for message status updates
                    startMessageStatusUpdates();
                } else {
                    console.error('No messages returned from API');
                }
            }
        });
    }

    // Function to render messages
    function renderMessages(messages) {
        console.log('Rendering messages:', messages);

        const messagesContainer = document.querySelector('.chat-messages') || document.querySelector('#chat-messages');
        console.log('Messages container:', messagesContainer);

        if (!messagesContainer) {
            console.error('Messages container not found');
            return;
        }

        messagesContainer.innerHTML = '';

        if (messages.length === 0) {
            console.log('No messages to display');
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

        console.log('Adding date divider');
        // Add date divider
        const dateDivider = document.createElement('div');
        dateDivider.classList.add('date-divider');
        dateDivider.textContent = 'Today';
        messagesContainer.appendChild(dateDivider);

        console.log('Adding message elements');
        messages.forEach(message => {
            console.log('Processing message:', message);

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

        console.log('Scrolling to bottom');
        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Function to send a message
    function sendMessage(message) {
        console.log('sendMessage called with message:', message);
        console.log('activeConversation:', activeConversation);

        if (!activeConversation || !message) {
            console.error('Cannot send message: activeConversation or message is missing');
            return;
        }

        // Disable the send button
        const sendButton = document.querySelector('#send-message-btn') || document.querySelector('.chat-input button');
        console.log('Send button for disabling:', sendButton);

        if (sendButton) {
            sendButton.disabled = true;
            sendButton.innerHTML = '<i class="uil uil-spinner-alt fa-spin"></i>';
        }

        // Add temporary message to UI
        const messagesContainer = document.querySelector('.chat-messages') || document.querySelector('#chat-messages');
        console.log('Messages container:', messagesContainer);

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

        if (messagesContainer) {
            messagesContainer.appendChild(messageElement);
            // Scroll to bottom
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        } else {
            console.error('Messages container not found');
        }

        console.log('Calling API to send message');
        // Send the message via API
        frappe.call({
            method: 'on_desk.on_desk.www.on-desk.whatsapp.api.send_message',
            args: {
                phone_number: activeConversation.phone,
                message: message
            },
            callback: function (response) {
                console.log('API response:', response);

                // Re-enable the send button
                const sendButton = document.querySelector('#send-message-btn') || document.querySelector('.chat-input button');
                if (sendButton) {
                    sendButton.disabled = false;
                    sendButton.innerHTML = '<i class="uil uil-message"></i>';
                }

                if (response.message && response.message.success) {
                    console.log('Message sent successfully with ID:', response.message.message_id);

                    // Update the temporary message with the real message ID
                    const tempMessage = document.querySelector(`[data-message-id="${tempId}"]`);
                    if (tempMessage) {
                        tempMessage.dataset.messageId = response.message.message_id;
                        tempMessage.querySelector('.message-status').innerHTML = `
                            <span>Sent</span>
                            <i class="uil uil-check status-icon status-sent"></i>
                        `;
                    } else {
                        console.error('Temporary message element not found');
                    }

                    // Start polling for status updates
                    startMessageStatusUpdates();
                } else {
                    console.error('Failed to send message:', response);

                    // Show error
                    const tempMessage = document.querySelector(`[data-message-id="${tempId}"]`);
                    if (tempMessage) {
                        tempMessage.querySelector('.message-status').innerHTML = `
                            <span>Failed</span>
                            <i class="uil uil-times status-icon status-failed"></i>
                        `;
                    }

                    frappe.msgprint({
                        title: __('Error'),
                        indicator: 'red',
                        message: __('Failed to send message. Please try again.')
                    });
                }
            }
        });
    }

    // Initialize the UI event handlers
    function initializeUI() {
        console.log('Initializing UI event handlers');

        // Set up conversation click handlers
        setupConversationClickHandlers();

        // Set up send message handler
        let sendButton = document.querySelector('#send-message-btn');
        console.log('Send button:', sendButton);

        // If we can't find the button by ID, try to find it by its position in the chat-input
        if (!sendButton) {
            const chatInput = document.querySelector('.chat-input');
            if (chatInput) {
                const button = chatInput.querySelector('button');
                if (button) {
                    console.log('Found send button by position:', button);
                    button.id = 'send-message-btn';  // Add the ID for future reference
                    sendButton = button;
                }
            }
        }

        const messageInput = document.querySelector('#message-input');
        console.log('Message input:', messageInput);

        if (sendButton) {
            console.log('Adding click event listener to send button');
            sendButton.addEventListener('click', function () {
                console.log('Send button clicked');
                const message = messageInput.value.trim();
                console.log('Message:', message);
                if (message) {
                    sendMessage(message);
                    messageInput.value = '';
                }
            });
        } else {
            console.error('Send button not found!');
        }

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
                method: 'on_desk.on_desk.www.on-desk.whatsapp.api.get_message_statuses',
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
            method: 'on_desk.on_desk.www.on-desk.whatsapp.api.get_conversations',
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
                    method: 'on_desk.on_desk.www.on-desk.whatsapp.api.create_conversation',
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
            method: 'on_desk.on_desk.www.on-desk.whatsapp.api.create_conversation',
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

    // Set up real-time updates using Frappe's realtime events
    frappe.realtime.on('whatsapp_message_received', function (data) {
        // If this message is for the active conversation, refresh the messages
        if (activeConversation && data.from_number === activeConversation.phone) {
            loadConversation(activeConversation.phone, activeConversation.name);
        }

        // Refresh the conversations list
        refreshConversations();
    });

    frappe.realtime.on('whatsapp_message_status_update', function (data) {
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
    });

    // Initialize the UI
    initializeUI();

    // Initial load of conversations
    refreshConversations();