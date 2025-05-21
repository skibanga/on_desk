/**
 * Test Socket.io Connection
 * 
 * This file provides a simple way to test the socket.io connection
 * and real-time events in the On Desk application.
 */

frappe.provide("on_desk.test_socket");

on_desk.test_socket = {
    /**
     * Initialize the test socket
     */
    init: function() {
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
    setup_event_handlers: function() {
        if (!this.socket) {
            console.error("Socket not initialized");
            return;
        }
        
        // Connection events
        this.socket.on("connect", () => {
            console.log("Test socket connected");
            this.connected = true;
            
            // Subscribe to test events
            this.socket.emit("doc_subscribe", "OD Test Event", "*");
            
            // Listen for test events
            this.socket.on("od_test_event", (data) => {
                console.log("Test event received:", data);
                this.trigger_callback("od_test_event", data);
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
    get_host: function(port) {
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
    on: function(event, callback) {
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
    trigger_callback: function(event, data) {
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
     * Test the connection by sending a test event
     */
    send_test_event: function(data) {
        if (!this.socket || !this.connected) {
            console.error("Socket not connected");
            return false;
        }
        
        // Default data if not provided
        data = data || {
            title: "Test Event",
            description: "This is a test event sent from the browser",
            event_type: "Info",
            status: "Active",
            action: "test",
            timestamp: new Date().toISOString()
        };
        
        // Emit the event
        this.socket.emit("test_event", data);
        console.log("Test event sent:", data);
        
        return true;
    }
};

// Auto-initialize when the document is ready
document.addEventListener('DOMContentLoaded', function() {
    // Initialize with a slight delay to ensure all dependencies are loaded
    setTimeout(function() {
        try {
            on_desk.test_socket.init();
        } catch (e) {
            console.error("Error initializing test socket:", e);
        }
    }, 1000);
});
