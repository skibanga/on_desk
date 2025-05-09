frappe.ui.form.on('HD Ticket', {
    refresh: function(frm) {
        // Add WhatsApp conversation HTML
        if (frm.doc.communication_channel === 'WhatsApp' && frm.doc.raised_by_phone) {
            // Load WhatsApp conversation
            loadWhatsAppConversation(frm);
        }
        
        // Add WhatsApp send button handler
        frm.fields_dict.whatsapp_send.$input.on('click', function() {
            sendWhatsAppMessage(frm);
        });
        
        // Add Social Media Messages HTML
        loadSocialMediaMessages(frm);
    },
    
    communication_channel: function(frm) {
        // When communication channel changes to WhatsApp, load the conversation
        if (frm.doc.communication_channel === 'WhatsApp' && frm.doc.raised_by_phone) {
            loadWhatsAppConversation(frm);
        }
    },
    
    raised_by_phone: function(frm) {
        // When phone number changes and channel is WhatsApp, reload the conversation
        if (frm.doc.communication_channel === 'WhatsApp' && frm.doc.raised_by_phone) {
            loadWhatsAppConversation(frm);
        }
    }
});

function loadWhatsAppConversation(frm) {
    // Get WhatsApp messages for this ticket
    frappe.call({
        method: 'on_desk.on_desk.doctype.od_social_media_message.od_social_media_message.get_messages_for_ticket',
        args: {
            ticket_name: frm.doc.name
        },
        callback: function(response) {
            if (response.message) {
                const messages = response.message;
                renderWhatsAppConversation(frm, messages);
            }
        }
    });
}

function renderWhatsAppConversation(frm, messages) {
    // Filter only WhatsApp messages
    const whatsAppMessages = messages.filter(msg => msg.channel === 'WhatsApp');
    
    if (whatsAppMessages.length === 0) {
        frm.set_df_property('whatsapp_conversation', 'options', `
            <div class="whatsapp-conversation-empty">
                <p>No WhatsApp messages found for this ticket.</p>
            </div>
        `);
        return;
    }
    
    // Sort messages by timestamp
    whatsAppMessages.sort((a, b) => {
        return new Date(a.timestamp) - new Date(b.timestamp);
    });
    
    // Render the conversation
    let conversationHTML = `
        <div class="whatsapp-conversation">
            <style>
                .whatsapp-conversation {
                    height: 300px;
                    overflow-y: auto;
                    background-color: #0f172a;
                    border-radius: 8px;
                    padding: 10px;
                }
                .whatsapp-message {
                    max-width: 70%;
                    padding: 8px 12px;
                    border-radius: 8px;
                    margin-bottom: 10px;
                    position: relative;
                }
                .whatsapp-message-incoming {
                    background-color: #1e293b;
                    color: #e2e8f0;
                    align-self: flex-start;
                    border-bottom-left-radius: 0;
                    float: left;
                    clear: both;
                }
                .whatsapp-message-outgoing {
                    background-color: rgba(22, 82, 110, 0.2);
                    color: #16526e;
                    align-self: flex-end;
                    border-bottom-right-radius: 0;
                    float: right;
                    clear: both;
                }
                .whatsapp-message-time {
                    font-size: 0.7rem;
                    color: #94a3b8;
                    margin-top: 4px;
                    text-align: right;
                }
                .whatsapp-message-status {
                    font-size: 0.7rem;
                    color: #94a3b8;
                    margin-top: 2px;
                    text-align: right;
                }
                .whatsapp-media {
                    max-width: 200px;
                    max-height: 200px;
                    margin-top: 5px;
                    border-radius: 4px;
                }
            </style>
    `;
    
    // Add each message
    whatsAppMessages.forEach(message => {
        const messageClass = message.direction === 'Incoming' ? 'whatsapp-message-incoming' : 'whatsapp-message-outgoing';
        const timestamp = frappe.datetime.str_to_user(message.timestamp);
        
        let mediaHTML = '';
        if (message.media_type && message.media_attachment) {
            if (message.media_type === 'Image') {
                mediaHTML = `<img src="${message.media_attachment}" class="whatsapp-media" alt="Image">`;
            } else if (message.media_type === 'Video') {
                mediaHTML = `<video src="${message.media_attachment}" class="whatsapp-media" controls></video>`;
            } else if (message.media_type === 'Audio') {
                mediaHTML = `<audio src="${message.media_attachment}" controls></audio>`;
            } else if (message.media_type === 'Document') {
                mediaHTML = `<a href="${message.media_attachment}" target="_blank" class="btn btn-sm btn-default">View Document</a>`;
            }
        }
        
        conversationHTML += `
            <div class="whatsapp-message ${messageClass}">
                ${frappe.utils.escape_html(message.message)}
                ${mediaHTML}
                <div class="whatsapp-message-time">${timestamp}</div>
                ${message.direction === 'Outgoing' ? `<div class="whatsapp-message-status">${message.status}</div>` : ''}
            </div>
        `;
    });
    
    conversationHTML += '</div>';
    
    // Set the HTML
    frm.set_df_property('whatsapp_conversation', 'options', conversationHTML);
    
    // Scroll to bottom
    setTimeout(() => {
        const conversationElement = frm.fields_dict.whatsapp_conversation.$wrapper.find('.whatsapp-conversation');
        conversationElement.scrollTop(conversationElement[0].scrollHeight);
    }, 100);
}

function sendWhatsAppMessage(frm) {
    const message = frm.doc.whatsapp_message;
    
    if (!message) {
        frappe.msgprint(__('Please enter a message to send.'));
        return;
    }
    
    if (!frm.doc.raised_by_phone) {
        frappe.msgprint(__('No phone number found for this ticket.'));
        return;
    }
    
    frappe.call({
        method: 'on_desk.on_desk.doctype.od_social_media_message.od_social_media_message.send_whatsapp_message_from_ticket',
        args: {
            ticket_name: frm.doc.name,
            message: message
        },
        freeze: true,
        freeze_message: __('Sending WhatsApp message...'),
        callback: function(response) {
            if (response.message) {
                frm.set_value('whatsapp_message', '');
                frappe.show_alert({
                    message: __('WhatsApp message sent successfully.'),
                    indicator: 'green'
                });
                
                // Reload the conversation
                loadWhatsAppConversation(frm);
            } else {
                frappe.msgprint(__('Failed to send WhatsApp message. Please try again.'));
            }
        }
    });
}

function loadSocialMediaMessages(frm) {
    // Get all social media messages for this ticket
    frappe.call({
        method: 'on_desk.on_desk.doctype.od_social_media_message.od_social_media_message.get_messages_for_ticket',
        args: {
            ticket_name: frm.doc.name
        },
        callback: function(response) {
            if (response.message) {
                const messages = response.message;
                renderSocialMediaMessages(frm, messages);
            }
        }
    });
}

function renderSocialMediaMessages(frm, messages) {
    if (messages.length === 0) {
        frm.set_df_property('social_media_messages', 'options', `
            <div class="social-media-messages-empty">
                <p>No social media messages found for this ticket.</p>
            </div>
        `);
        return;
    }
    
    // Group messages by channel
    const messagesByChannel = {};
    messages.forEach(message => {
        if (!messagesByChannel[message.channel]) {
            messagesByChannel[message.channel] = [];
        }
        messagesByChannel[message.channel].push(message);
    });
    
    // Render the messages
    let messagesHTML = `
        <div class="social-media-messages">
            <style>
                .social-media-channel {
                    margin-bottom: 20px;
                }
                .social-media-channel-header {
                    font-weight: bold;
                    margin-bottom: 10px;
                    padding-bottom: 5px;
                    border-bottom: 1px solid #334155;
                }
                .social-media-message {
                    padding: 8px 12px;
                    border-radius: 8px;
                    margin-bottom: 10px;
                    background-color: #1e293b;
                }
                .social-media-message-header {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 5px;
                }
                .social-media-message-direction {
                    font-weight: bold;
                }
                .social-media-message-time {
                    font-size: 0.8rem;
                    color: #94a3b8;
                }
                .social-media-message-content {
                    margin-bottom: 5px;
                }
                .social-media-message-status {
                    font-size: 0.8rem;
                    color: #94a3b8;
                    text-align: right;
                }
                .social-media-media {
                    max-width: 200px;
                    max-height: 200px;
                    margin-top: 5px;
                    border-radius: 4px;
                }
            </style>
    `;
    
    // Add each channel
    Object.keys(messagesByChannel).forEach(channel => {
        messagesHTML += `
            <div class="social-media-channel">
                <div class="social-media-channel-header">${channel}</div>
        `;
        
        // Sort messages by timestamp
        messagesByChannel[channel].sort((a, b) => {
            return new Date(a.timestamp) - new Date(b.timestamp);
        });
        
        // Add each message
        messagesByChannel[channel].forEach(message => {
            const timestamp = frappe.datetime.str_to_user(message.timestamp);
            
            let mediaHTML = '';
            if (message.media_type && message.media_attachment) {
                if (message.media_type === 'Image') {
                    mediaHTML = `<img src="${message.media_attachment}" class="social-media-media" alt="Image">`;
                } else if (message.media_type === 'Video') {
                    mediaHTML = `<video src="${message.media_attachment}" class="social-media-media" controls></video>`;
                } else if (message.media_type === 'Audio') {
                    mediaHTML = `<audio src="${message.media_attachment}" controls></audio>`;
                } else if (message.media_type === 'Document') {
                    mediaHTML = `<a href="${message.media_attachment}" target="_blank" class="btn btn-sm btn-default">View Document</a>`;
                }
            }
            
            messagesHTML += `
                <div class="social-media-message">
                    <div class="social-media-message-header">
                        <div class="social-media-message-direction">${message.direction}</div>
                        <div class="social-media-message-time">${timestamp}</div>
                    </div>
                    <div class="social-media-message-content">${frappe.utils.escape_html(message.message)}</div>
                    ${mediaHTML}
                    <div class="social-media-message-status">${message.status}</div>
                </div>
            `;
        });
        
        messagesHTML += '</div>';
    });
    
    messagesHTML += '</div>';
    
    // Set the HTML
    frm.set_df_property('social_media_messages', 'options', messagesHTML);
}
