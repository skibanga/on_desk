/**
 * On Desk Realtime Event Listener
 * 
 * This file provides a simple way to listen for real-time events
 * in the On Desk application.
 */

// Create the on_desk namespace if it doesn't exist
window.on_desk = window.on_desk || {};

// Create a minimal frappe object if it doesn't exist
if (typeof window.frappe === 'undefined') {
    window.frappe = {
        _: window._ || {}, // Use lodash if available
        provide: function(namespace) {
            let parts = namespace.split('.');
            let current = window;
            
            for (let i = 0; i < parts.length; i++) {
                current[parts[i]] = current[parts[i]] || {};
                current = current[parts[i]];
            }
            
            return current;
        },
        datetime: {
            now_datetime: function() {
                return new Date().toISOString();
            }
        },
        show_alert: function(opts) {
            alert(opts.message || 'Alert');
        }
    };
}

// Create the realtime namespace
frappe.provide("on_desk.realtime");

/**
 * On Desk Realtime Client
 * 
 * This class handles real-time events for the On Desk application.
 */
on_desk.realtime.RealtimeClient = class {
    constructor() {
        this.socket = null;
        this.connected = false;
        this.events = {};
        this.socketUrl = null;
        this.port = window.config?.socketio_port || 9001;
        
        // Initialize the client
        this.init();
    }
    
    /**
     * Initialize the realtime client
     */
    init() {
        console.log("Initializing On Desk realtime client...");
        
        // Check if socket.io is available
        if (typeof io === 'undefined') {
            console.error("Socket.io not found. Make sure it's included in your page.");
            return;
        }
        
        // Get the socket.io URL
        this.socketUrl = this.getSocketUrl();
        console.log("Socket.io host:", this.socketUrl);
        
        // Initialize the socket
        this.initSocket();
    }
    
    /**
     * Get the socket.io URL
     */
    getSocketUrl() {
        // Get the host URL
        let host = window.location.origin;
        let sitename = window.location.pathname.split('/')[1] || '';
        
        if (window.location.port) {
            // If we're in a development environment with a custom port
            let parts = host.split(":");
            if (parts.length > 2) {
                host = parts[0] + ":" + parts[1];
            }
            host = host + ":" + this.port;
        }
        
        return host + `/${sitename}`;
    }
    
    /**
     * Initialize the socket
     */
    initSocket() {
        try {
            // Check if socket is already initialized
            if (this.socket) {
                console.log("Socket already initialized");
                return;
            }
            
            console.log("Connecting to socket.io server...");
            
            // Initialize the socket
            this.socket = io(this.socketUrl, {
                withCredentials: true,
                reconnectionAttempts: 5
            });
            
            // Connection events
            this.socket.on("connect", () => {
                console.log("Socket.io connected");
                this.connected = true;
                
                // Trigger the connect event
                this.trigger("connect");
            });
            
            this.socket.on("disconnect", () => {
                console.log("Socket.io disconnected");
                this.connected = false;
                
                // Trigger the disconnect event
                this.trigger("disconnect");
            });
            
            this.socket.on("connect_error", (err) => {
                console.error("Socket.io connection error:", err);
                this.connected = false;
                
                // Trigger the error event
                this.trigger("error", err);
            });
            
            // Listen for document events
            this.socket.on("document_updated", (data) => {
                console.log("Document updated:", data);
                
                // Trigger the document_updated event
                this.trigger("document_updated", data);
            });
            
            // Listen for test events
            this.socket.on("od_test_event", (data) => {
                console.log("Test event received:", data);
                
                // Trigger the od_test_event event
                this.trigger("od_test_event", data);
            });
        } catch (error) {
            console.error("Error initializing socket:", error);
        }
    }
    
    /**
     * Register an event handler
     */
    on(event, callback) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        
        this.events[event].push(callback);
        
        return this;
    }
    
    /**
     * Unregister an event handler
     */
    off(event, callback) {
        if (!this.events[event]) {
            return this;
        }
        
        if (!callback) {
            delete this.events[event];
            return this;
        }
        
        this.events[event] = this.events[event].filter(cb => cb !== callback);
        
        return this;
    }
    
    /**
     * Trigger an event
     */
    trigger(event, ...args) {
        if (!this.events[event]) {
            return;
        }
        
        this.events[event].forEach(callback => {
            try {
                callback(...args);
            } catch (error) {
                console.error(`Error in ${event} event handler:`, error);
            }
        });
    }
    
    /**
     * Ensure WhatsApp events are registered
     */
    ensure_whatsapp_events() {
        // Check if socket is connected
        if (!this.connected) {
            console.log("Socket not initialized. Initializing now...");
            this.init();
        }
    }
};

// Initialize the realtime client
on_desk.realtime = new on_desk.realtime.RealtimeClient();

// Provide a compatibility layer for frappe.realtime
if (!frappe.realtime) {
    frappe.realtime = {
        on: function(event, callback) {
            return on_desk.realtime.on(event, callback);
        },
        off: function(event, callback) {
            return on_desk.realtime.off(event, callback);
        }
    };
}

// Log initialization
console.log("On Desk realtime client initialized with port:", on_desk.realtime.port);
