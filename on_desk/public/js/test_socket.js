/**
 * Test Socket.io Connection
 *
 * This file provides a simple way to test the socket.io connection
 * and real-time events in the On Desk application.
 */

// Create the on_desk namespace if it doesn't exist
window.on_desk = window.on_desk || {};
// Create the test_socket object if it doesn't exist
window.on_desk.test_socket = window.on_desk.test_socket || {};

// Create a minimal frappe object if it doesn't exist
if (typeof window.frappe === 'undefined') {
    window.frappe = {
        _: window._ || {}, // Use lodash if available
        provide: function (namespace) {
            let parts = namespace.split('.');
            let current = window;

            for (let i = 0; i < parts.length; i++) {
                current[parts[i]] = current[parts[i]] || {};
                current = current[parts[i]];
            }

            return current;
        }
    };
}

on_desk.test_socket = {
    /**
     * Initialize the test socket
     */
    init: function () {
        console.log("Initializing test socket...");

        // Check if socket.io is available
        if (typeof io === 'undefined') {
            console.error("Socket.io not loaded. Make sure socket.io.min.js is included.");
            return false;
        }

        // Get the socket.io port from the window object
        const port = window.socketio_port || 9001;
        console.log("Using socket.io port:", port);

        // Get the host URL
        const host = this.get_host(port);
        console.log("Socket.io host:", host);

        try {
            // Initialize the socket
            this.socket = io(host, {
                withCredentials: true,
                reconnectionAttempts: 5
            });

            // Set up event handlers
            this.setup_event_handlers();

            return true;
        } catch (e) {
            console.error("Error initializing test socket:", e);
            return false;
        }
    },

    /**
     * Set up socket event handlers
     */
    setup_event_handlers: function () {
        if (!this.socket) {
            console.error("Socket not initialized");
            return;
        }

        // Connection events
        this.socket.on("connect", () => {
            console.log("Test socket connected");
            this.connected = true;

            // Listen for WhatsApp events
            this.socket.on("whatsapp_message_received", (data) => {
                console.log("WhatsApp message received:", data);
                this.trigger_callback("whatsapp_message_received", data);
            });

            // Listen for WhatsApp status updates
            this.socket.on("whatsapp_message_status_update", (data) => {
                console.log("WhatsApp status update received:", data);
                this.trigger_callback("whatsapp_message_status_update", data);
            });
        });

        this.socket.on("disconnect", () => {
            console.log("Test socket disconnected");
            this.connected = false;
        });

        this.socket.on("connect_error", (err) => {
            console.error("Test socket connection error:", err);
        });
    },

    /**
     * Get the socket.io host URL
     */
    get_host: function (port) {
        let host = window.location.origin;
        let sitename = window.site_name || frappe.boot?.sitename || '';

        if (window.location.port) {
            // If we're in a development environment with a custom port
            let parts = host.split(":");
            if (parts.length > 2) {
                host = parts[0] + ":" + parts[1];
            }
            host = host + ":" + port;
        }

        return host + `/${sitename}`;
    },

    /**
     * Register a callback for an event
     */
    on: function (event, callback) {
        if (!this.callbacks) {
            this.callbacks = {};
        }

        if (!this.callbacks[event]) {
            this.callbacks[event] = [];
        }

        this.callbacks[event].push(callback);
    },

    /**
     * Trigger callbacks for an event
     */
    trigger_callback: function (event, data) {
        if (!this.callbacks || !this.callbacks[event]) {
            return;
        }

        this.callbacks[event].forEach(callback => {
            try {
                callback(data);
            } catch (e) {
                console.error("Error in event callback:", e);
            }
        });
    },

    /**
     * Test the connection by sending a test WhatsApp event
     */
    send_test_event: function (data) {
        if (!this.socket || !this.connected) {
            console.error("Socket not connected");
            return false;
        }

        // Default data if not provided
        data = data || {
            message_id: "test_" + Date.now(),
            from_number: "1234567890",
            message: "This is a test WhatsApp message sent from the browser",
            timestamp: Math.floor(Date.now() / 1000),
            direction: "Incoming",
            is_test: true
        };

        // Call the API to trigger a test WhatsApp event
        if (typeof frappe !== 'undefined') {
            frappe.call({
                method: 'on_desk.on_desk.doctype.od_whatsapp_integration.api.test_whatsapp_event',
                args: {
                    phone_number: data.from_number,
                    message: data.message
                },
                callback: function (response) {
                    if (response.message && response.message.success) {
                        console.log("Test WhatsApp event triggered successfully:", response.message.event_data);
                    } else {
                        console.error("Failed to trigger test WhatsApp event");
                    }
                }
            });
        } else {
            // Emit the event directly if frappe is not available
            this.socket.emit("whatsapp_message_received_immediate", data);
            console.log("Test WhatsApp event sent:", data);
        }

        return true;
    }
};

// Auto-initialize when the document is ready
document.addEventListener('DOMContentLoaded', function () {
    // Initialize with a slight delay to ensure all dependencies are loaded
    setTimeout(function () {
        try {
            on_desk.test_socket.init();
        } catch (e) {
            console.error("Error initializing test socket:", e);
        }
    }, 1000);
});
