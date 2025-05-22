/**
 * WhatsApp Socket.js
 * 
 * This file contains the socket.io implementation for WhatsApp real-time messaging.
 * It's based on the successful implementation from the Velocetec app.
 */

// Create the on_desk namespace if it doesn't exist
if (typeof window.on_desk === 'undefined') {
    window.on_desk = {};
}

// Create the realtime object
on_desk.realtime = {
    socket: null,
    socketio_port: null,
    socketio_host: null,
    connected: false,
    connection_attempted: false,
    events: {},
    debug: false,

    // Initialize the socket connection
    init: function() {
        console.log("Initializing WhatsApp socket connection...");
        
        // Check if socket.io is available
        if (typeof io === 'undefined') {
            console.error("Socket.io not found. Real-time messaging will not work.");
            return false;
        }
        
        // Get the socket.io port from the window object
        this.socketio_port = window.socketio_port || 3000;
        this.socketio_host = window.location.hostname;
        
        // Get the site name from the URL
        var sitename = window.location.pathname.split('/')[1] || '';
        if (sitename && sitename !== 'app') {
            sitename = '/' + sitename;
        } else {
            sitename = '';
        }
        
        console.log("Socket.io connecting to:", this.socketio_host, "port:", this.socketio_port, "namespace:", sitename);
        
        try {
            // Connect to the socket.io server
            this.socket = io.connect(this.socketio_host + ':' + this.socketio_port + sitename, {
                withCredentials: true,
                reconnection: true,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 5000,
                reconnectionAttempts: Infinity
            });
            
            // Set up event handlers
            this.socket.on('connect', function() {
                console.log("Socket connected successfully");
                on_desk.realtime.connected = true;
                on_desk.realtime.connection_attempted = true;
                
                // Trigger the connect event
                on_desk.realtime.trigger('connect');
                
                // Ensure WhatsApp events are registered
                on_desk.realtime.ensure_whatsapp_events();
            });
            
            this.socket.on('disconnect', function() {
                console.log("Socket disconnected");
                on_desk.realtime.connected = false;
                
                // Trigger the disconnect event
                on_desk.realtime.trigger('disconnect');
            });
            
            this.socket.on('reconnect', function() {
                console.log("Socket reconnected");
                on_desk.realtime.connected = true;
                
                // Trigger the reconnect event
                on_desk.realtime.trigger('reconnect');
                
                // Re-ensure WhatsApp events
                on_desk.realtime.ensure_whatsapp_events();
            });
            
            this.socket.on('error', function(err) {
                console.error("Socket error:", err);
                
                // Trigger the error event
                on_desk.realtime.trigger('error', err);
            });
            
            this.connection_attempted = true;
            return true;
        } catch (e) {
            console.error("Error initializing socket:", e);
            return false;
        }
    },
    
    // Register an event handler
    on: function(event, callback) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        
        this.events[event].push(callback);
        
        // If this is a socket.io event, register it with the socket
        if (this.socket && ['connect', 'disconnect', 'reconnect', 'error'].indexOf(event) === -1) {
            this.socket.on(event, function(data) {
                if (on_desk.realtime.debug) {
                    console.log("Socket event received:", event, data);
                }
                
                // Trigger the event
                on_desk.realtime.trigger(event, data);
            });
        }
        
        return this;
    },
    
    // Trigger an event
    trigger: function(event, data) {
        if (this.events[event]) {
            for (var i = 0; i < this.events[event].length; i++) {
                this.events[event][i](data);
            }
        }
        
        // Also dispatch a DOM event for broader compatibility
        try {
            var domEvent = new CustomEvent(event, { detail: data });
            document.dispatchEvent(domEvent);
        } catch (e) {
            console.error("Error dispatching DOM event:", e);
        }
        
        return this;
    },
    
    // Ensure WhatsApp events are registered
    ensure_whatsapp_events: function() {
        if (!this.socket) {
            if (!this.init()) {
                console.error("Failed to initialize socket for WhatsApp events");
                return false;
            }
        }
        
        console.log("Ensuring WhatsApp events are registered...");
        
        // Register WhatsApp events
        this.socket.on('whatsapp_message_received', function(data) {
            console.log("WhatsApp message received via socket:", data);
            on_desk.realtime.trigger('whatsapp_message_received', data);
            
            // Also dispatch a DOM event
            var domEvent = new CustomEvent('whatsapp_message_received', { detail: data });
            document.dispatchEvent(domEvent);
        });
        
        this.socket.on('whatsapp_message_received_immediate', function(data) {
            console.log("WhatsApp message received immediate via socket:", data);
            on_desk.realtime.trigger('whatsapp_message_received_immediate', data);
            
            // Also dispatch a DOM event
            var domEvent = new CustomEvent('whatsapp_message_received_immediate', { detail: data });
            document.dispatchEvent(domEvent);
        });
        
        return true;
    },
    
    // Debug WhatsApp events
    debug_whatsapp: function() {
        this.debug = true;
        console.log("WhatsApp socket debugging enabled");
        
        // Log all events
        this.socket.onAny(function(event, data) {
            console.log("Socket event:", event, data);
        });
        
        return true;
    },
    
    // Check socket connection
    check_connection: function() {
        if (!this.connection_attempted) {
            this.init();
        } else if (!this.connected && this.socket) {
            console.log("Socket disconnected, attempting to reconnect...");
            this.socket.connect();
        }
        
        return this.connected;
    }
};

// Initialize the socket connection when the script loads
on_desk.realtime.init();

console.log("WhatsApp socket.js loaded");
