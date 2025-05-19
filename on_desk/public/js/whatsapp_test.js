/**
 * WhatsApp Test Functions
 * 
 * This file contains test functions for the WhatsApp integration.
 * It can be used to test the real-time functionality and debug issues.
 */

frappe.provide("on_desk.whatsapp.test");

on_desk.whatsapp.test = {
    /**
     * Initialize the test module
     */
    init: function() {
        console.log("Initializing WhatsApp test module...");
        this.setupUI();
    },

    /**
     * Set up the test UI
     */
    setupUI: function() {
        // Create a test panel if it doesn't exist
        if (document.getElementById('whatsapp-test-panel')) {
            return;
        }

        const panel = document.createElement('div');
        panel.id = 'whatsapp-test-panel';
        panel.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 300px;
            background-color: #fff;
            border: 1px solid #ccc;
            border-radius: 5px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
            z-index: 9999;
            font-family: Arial, sans-serif;
            font-size: 12px;
            display: none;
        `;

        panel.innerHTML = `
            <div style="padding: 10px; background-color: #16526e; color: white; font-weight: bold; display: flex; justify-content: space-between; align-items: center; border-radius: 5px 5px 0 0;">
                <span>WhatsApp Test Panel</span>
                <button id="close-test-panel" style="background: none; border: none; color: white; cursor: pointer;">×</button>
            </div>
            <div style="padding: 10px;">
                <div style="margin-bottom: 10px;">
                    <button id="test-socket-connection" style="width: 100%; padding: 5px; margin-bottom: 5px;">Test Socket Connection</button>
                    <button id="test-whatsapp-event" style="width: 100%; padding: 5px; margin-bottom: 5px;">Test WhatsApp Event</button>
                    <button id="test-status-update" style="width: 100%; padding: 5px;">Test Status Update</button>
                </div>
                <div id="test-log" style="height: 150px; overflow-y: auto; border: 1px solid #ccc; padding: 5px; background-color: #f9f9f9;"></div>
            </div>
        `;

        document.body.appendChild(panel);

        // Add event listeners
        document.getElementById('close-test-panel').addEventListener('click', () => {
            panel.style.display = 'none';
        });

        document.getElementById('test-socket-connection').addEventListener('click', () => {
            this.testSocketConnection();
        });

        document.getElementById('test-whatsapp-event').addEventListener('click', () => {
            this.testWhatsAppEvent();
        });

        document.getElementById('test-status-update').addEventListener('click', () => {
            this.testStatusUpdate();
        });

        // Add keyboard shortcut to toggle panel (Ctrl+Shift+W)
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'W') {
                panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
            }
        });

        this.log('WhatsApp test panel initialized. Press Ctrl+Shift+W to toggle.');
    },

    /**
     * Add a log message to the test panel
     * @param {string} message - The message to log
     */
    log: function(message) {
        const logEl = document.getElementById('test-log');
        if (logEl) {
            const time = new Date().toLocaleTimeString();
            logEl.innerHTML += `<div>[${time}] ${message}</div>`;
            logEl.scrollTop = logEl.scrollHeight;
        }
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
     * Test WhatsApp event
     */
    testWhatsAppEvent: function() {
        this.log('Testing WhatsApp event...');
        
        // Simulate a WhatsApp message received event
        const testData = {
            message_id: 'test-' + Date.now(),
            from_number: '+1234567890',
            message: 'This is a test message',
            timestamp: Math.floor(Date.now() / 1000)
        };
        
        // Trigger the event locally
        if (typeof on_desk !== 'undefined' && on_desk.realtime) {
            this.log('Simulating event with on_desk.realtime');
            on_desk.realtime.trigger('whatsapp_message_received', testData);
        }
        else if (typeof frappe !== 'undefined' && frappe.realtime) {
            this.log('Simulating event with frappe.realtime');
            // frappe.realtime doesn't have a trigger method, so we'll just log
            this.log('Cannot simulate with frappe.realtime (no trigger method)');
        }
        
        this.log('Test data: ' + JSON.stringify(testData));
    },

    /**
     * Test status update
     */
    testStatusUpdate: function() {
        this.log('Testing status update...');
        
        // Get a message ID from the UI if possible
        let messageId = '';
        const messages = document.querySelectorAll('.message-outgoing');
        if (messages.length > 0) {
            messageId = messages[0].dataset.messageId;
            this.log('Found message ID: ' + messageId);
        } else {
            messageId = 'test-' + Date.now();
            this.log('No message found, using test ID: ' + messageId);
        }
        
        // Simulate a status update
        const statuses = ['Sent', 'Delivered', 'Read'];
        const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
        
        const testData = {
            message_id: messageId,
            status: randomStatus,
            from_number: '+1234567890',
            to_number: '+0987654321'
        };
        
        // Trigger the event locally
        if (typeof on_desk !== 'undefined' && on_desk.realtime) {
            this.log('Simulating status update with on_desk.realtime');
            on_desk.realtime.trigger('whatsapp_message_status_update', testData);
        }
        else if (typeof frappe !== 'undefined' && frappe.realtime) {
            this.log('Simulating status update with frappe.realtime');
            // frappe.realtime doesn't have a trigger method, so we'll just log
            this.log('Cannot simulate with frappe.realtime (no trigger method)');
        }
        
        this.log('Test data: ' + JSON.stringify(testData));
    }
};

// Initialize when the document is ready
document.addEventListener('DOMContentLoaded', function() {
    // Initialize with a slight delay to ensure all dependencies are loaded
    setTimeout(function() {
        on_desk.whatsapp.test.init();
    }, 1000);
});
