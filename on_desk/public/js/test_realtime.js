/**
 * Test script for On Desk real-time functionality
 * 
 * This script can be used to test the real-time functionality of the On Desk WhatsApp integration.
 * It simulates incoming messages and status updates.
 */

frappe.provide("on_desk.test");

on_desk.test = {
    /**
     * Initialize the test module
     */
    init: function() {
        console.log("Initializing On Desk test module...");
        this.setupUI();
    },

    /**
     * Set up the test UI
     */
    setupUI: function() {
        // Create a test panel if it doesn't exist
        if (document.getElementById('on-desk-test-panel')) {
            return;
        }

        const panel = document.createElement('div');
        panel.id = 'on-desk-test-panel';
        panel.style.position = 'fixed';
        panel.style.bottom = '20px';
        panel.style.right = '20px';
        panel.style.zIndex = '9999';
        panel.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        panel.style.color = 'white';
        panel.style.padding = '15px';
        panel.style.borderRadius = '5px';
        panel.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.5)';
        panel.style.width = '300px';
        panel.style.maxHeight = '400px';
        panel.style.overflowY = 'auto';

        panel.innerHTML = `
            <h3 style="margin-top: 0; color: #25D366;">On Desk Test Panel</h3>
            <div style="margin-bottom: 10px;">
                <button id="test-socket-connection" style="background: #25D366; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer; margin-right: 5px;">Test Connection</button>
                <button id="test-close-panel" style="background: #ff5555; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer;">Close</button>
            </div>
            <div style="margin-bottom: 10px;">
                <h4 style="margin: 5px 0;">Simulate Incoming Message</h4>
                <input id="test-phone-number" type="text" placeholder="Phone Number (e.g., +1234567890)" style="width: 100%; padding: 5px; margin-bottom: 5px; border-radius: 3px; border: 1px solid #ccc;">
                <input id="test-message" type="text" placeholder="Message Text" style="width: 100%; padding: 5px; margin-bottom: 5px; border-radius: 3px; border: 1px solid #ccc;">
                <button id="test-send-message" style="background: #25D366; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer; width: 100%;">Simulate Incoming Message</button>
            </div>
            <div style="margin-bottom: 10px;">
                <h4 style="margin: 5px 0;">Simulate Status Update</h4>
                <input id="test-message-id" type="text" placeholder="Message ID" style="width: 100%; padding: 5px; margin-bottom: 5px; border-radius: 3px; border: 1px solid #ccc;">
                <select id="test-status" style="width: 100%; padding: 5px; margin-bottom: 5px; border-radius: 3px; border: 1px solid #ccc;">
                    <option value="Sent">Sent</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Read">Read</option>
                    <option value="Failed">Failed</option>
                </select>
                <button id="test-update-status" style="background: #25D366; color: white; border: none; padding: 5px 10px; border-radius: 3px; cursor: pointer; width: 100%;">Simulate Status Update</button>
            </div>
            <div id="test-log" style="margin-top: 10px; border-top: 1px solid #444; padding-top: 10px; font-family: monospace; font-size: 12px; max-height: 150px; overflow-y: auto;"></div>
        `;

        document.body.appendChild(panel);

        // Set up event handlers
        document.getElementById('test-socket-connection').addEventListener('click', () => {
            this.testSocketConnection();
        });

        document.getElementById('test-close-panel').addEventListener('click', () => {
            document.getElementById('on-desk-test-panel').remove();
        });

        document.getElementById('test-send-message').addEventListener('click', () => {
            const phoneNumber = document.getElementById('test-phone-number').value;
            const message = document.getElementById('test-message').value;
            
            if (!phoneNumber || !message) {
                this.log('Please enter both phone number and message');
                return;
            }
            
            this.simulateIncomingMessage(phoneNumber, message);
        });

        document.getElementById('test-update-status').addEventListener('click', () => {
            const messageId = document.getElementById('test-message-id').value;
            const status = document.getElementById('test-status').value;
            
            if (!messageId) {
                this.log('Please enter a message ID');
                return;
            }
            
            this.simulateStatusUpdate(messageId, status);
        });
    },

    /**
     * Test the socket connection
     */
    testSocketConnection: function() {
        this.log('Testing socket connection...');
        
        // Try with our custom client first
        if (typeof on_desk !== 'undefined' && on_desk.realtime) {
            this.log('Using on_desk.realtime client');
            
            // Set up a one-time pong handler
            on_desk.realtime.on('pong', () => {
                this.log('Received pong from server! Connection working.');
            });
            
            // Send a ping
            on_desk.realtime.ping();
            this.log('Ping sent to server');
        } 
        // Fall back to frappe.realtime
        else if (typeof frappe !== 'undefined' && frappe.realtime) {
            this.log('Using frappe.realtime client');
            
            // Set up a one-time pong handler
            frappe.realtime.on('pong', () => {
                this.log('Received pong from server! Connection working.');
            });
            
            // Send a ping
            frappe.realtime.emit('ping');
            this.log('Ping sent to server');
        } 
        else {
            this.log('ERROR: No realtime client available');
        }
    },

    /**
     * Simulate an incoming WhatsApp message
     * @param {string} phoneNumber - The phone number
     * @param {string} message - The message text
     */
    simulateIncomingMessage: function(phoneNumber, message) {
        this.log(`Simulating incoming message from ${phoneNumber}: ${message}`);
        
        const data = {
            message_id: 'test_' + Date.now(),
            from_number: phoneNumber,
            message: message,
            timestamp: Math.floor(Date.now() / 1000)
        };
        
        // Trigger the event using jQuery
        $(document).trigger('whatsapp_message_received', data);
        
        this.log('Event triggered: whatsapp_message_received');
    },

    /**
     * Simulate a WhatsApp message status update
     * @param {string} messageId - The message ID
     * @param {string} status - The new status
     */
    simulateStatusUpdate: function(messageId, status) {
        this.log(`Simulating status update for message ${messageId}: ${status}`);
        
        const data = {
            message_id: messageId,
            status: status,
            from_number: document.getElementById('test-phone-number').value || '+1234567890',
            to_number: '+1234567890'
        };
        
        // Trigger the event using jQuery
        $(document).trigger('whatsapp_message_status_update', data);
        
        this.log('Event triggered: whatsapp_message_status_update');
    },

    /**
     * Log a message to the test panel
     * @param {string} message - The message to log
     */
    log: function(message) {
        console.log('[On Desk Test]', message);
        
        const logElement = document.getElementById('test-log');
        if (logElement) {
            const logEntry = document.createElement('div');
            logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
            logElement.appendChild(logEntry);
            logElement.scrollTop = logElement.scrollHeight;
        }
    }
};

// Initialize the test module when the document is ready
$(document).ready(function() {
    on_desk.test.init();
});
