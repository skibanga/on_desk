/**
 * On Desk Socket.io Client
 *
 * This is a custom socket.io client for the On Desk application.
 * It handles real-time events for WhatsApp messages and other notifications.
 */

// Create the on_desk namespace if it doesn't exist
window.on_desk = window.on_desk || {};
// Create the realtime object if it doesn't exist
window.on_desk.realtime = window.on_desk.realtime || {};

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

class OnDeskRealtimeClient {
    constructor() {
        this.socket = null;
        this.connected = false;
        this.events = {};
        this.reconnect_attempts = 0;
        this.max_reconnect_attempts = 5;
    }

    /**
     * Initialize the socket connection
     * @param {number} port - The socket.io port
     * @param {boolean} lazy_connect - Whether to connect lazily
     */
    init(port = null, lazy_connect = false) {
        console.log("Initializing On Desk realtime client...");

        if (this.socket) {
            console.log("Socket already initialized");
            return;
        }

        try {
            // Get the host URL
            const host = this.get_host(port);
            console.log("Socket.io host:", host);

            // Enable secure option when using HTTPS
            if (window.location.protocol == "https:") {
                this.socket = io(host, {
                    secure: true,
                    withCredentials: true,
                    reconnectionAttempts: this.max_reconnect_attempts,
                    autoConnect: !lazy_connect,
                });
            } else {
                this.socket = io(host, {
                    withCredentials: true,
                    reconnectionAttempts: this.max_reconnect_attempts,
                    autoConnect: !lazy_connect,
                });
            }

            if (!this.socket) {
                console.error("Unable to initialize socket.io connection to " + host);
                return;
            }

            // Set up event handlers
            this.setup_socket_events();

            // Connect if not lazy
            if (!lazy_connect) {
                this.connect();
            }
        } catch (e) {
            console.error("Error initializing socket.io:", e);
        }
    }

    /**
     * Set up socket event handlers
     */
    setup_socket_events() {
        if (!this.socket) {
            console.error("Cannot setup events: Socket not initialized");
            return;
        }

        // Connection events
        this.socket.on("connect", () => {
            console.log("Socket.io connected");
            this.connected = true;
            this.reconnect_attempts = 0;

            // Trigger any registered connect callbacks
            this.trigger("connect");

            // Re-register for WhatsApp events on reconnection
            this.register_whatsapp_events();
        });

        this.socket.on("reconnect", (attemptNumber) => {
            console.log(`Socket.io reconnected after ${attemptNumber} attempts`);
            this.connected = true;
            this.reconnect_attempts = 0;

            // Trigger reconnect event
            this.trigger("reconnect", attemptNumber);

            // Re-register for WhatsApp events on reconnection
            this.register_whatsapp_events();
        });

        this.socket.on("disconnect", () => {
            console.log("Socket.io disconnected");
            this.connected = false;

            // Trigger any registered disconnect callbacks
            this.trigger("disconnect");
        });

        this.socket.on("connect_error", (err) => {
            console.error("Socket.io connection error:", err);
            this.reconnect_attempts++;

            if (this.reconnect_attempts >= this.max_reconnect_attempts) {
                console.error("Maximum reconnection attempts reached. Giving up.");
                this.trigger("max_reconnect_attempts");
            }
        });

        // Ping/pong for testing connection
        this.socket.on("pong", () => {
            console.log("Socket.io pong received");
            this.trigger("pong");
        });

        // Register WhatsApp events
        this.register_whatsapp_events();
    }

    /**
     * Register for WhatsApp specific events
     * This is separated so it can be called on reconnection
     */
    register_whatsapp_events() {
        console.log("Registering for WhatsApp events...");

        if (!this.socket) {
            console.error("Cannot register WhatsApp events: Socket not initialized");
            return;
        }

        // WhatsApp specific events
        this.socket.on("whatsapp_message_received", (data) => {
            console.log("WhatsApp message received via socket.io:", data);

            // Log more details for debugging
            if (data) {
                console.log(`Message details - ID: ${data.message_id}, From: ${data.from_number}, Message: ${data.message && data.message.substring(0, 30)}...`);
            }

            // Trigger the event for any listeners
            this.trigger("whatsapp_message_received", data);

            // Also emit a DOM event for jQuery listeners
            try {
                const event = new CustomEvent('whatsapp_message_received', { detail: data });
                document.dispatchEvent(event);
                console.log("Dispatched DOM event: whatsapp_message_received");

                // For older browsers that might be using jQuery
                if (window.jQuery) {
                    window.jQuery(document).trigger('whatsapp_message_received', data);
                    console.log("Triggered jQuery event: whatsapp_message_received");
                }
            } catch (e) {
                console.error("Error dispatching DOM event:", e);
            }
        });

        this.socket.on("whatsapp_message_status_update", (data) => {
            console.log("WhatsApp message status update via socket.io:", data);

            // Log more details for debugging
            if (data) {
                console.log(`Status update details - ID: ${data.message_id}, Status: ${data.status}`);
            }

            // Trigger the event for any listeners
            this.trigger("whatsapp_message_status_update", data);

            // Also emit a DOM event for jQuery listeners
            try {
                const event = new CustomEvent('whatsapp_message_status_update', { detail: data });
                document.dispatchEvent(event);
                console.log("Dispatched DOM event: whatsapp_message_status_update");

                // For older browsers that might be using jQuery
                if (window.jQuery) {
                    window.jQuery(document).trigger('whatsapp_message_status_update', data);
                    console.log("Triggered jQuery event: whatsapp_message_status_update");
                }
            } catch (e) {
                console.error("Error dispatching DOM event:", e);
            }
        });

        // Also listen for the immediate versions of these events (without after_commit)
        this.socket.on("whatsapp_message_received_immediate", (data) => {
            console.log("WhatsApp message received immediate via socket.io:", data);
            this.trigger("whatsapp_message_received", data);

            // Also dispatch DOM events
            try {
                const event = new CustomEvent('whatsapp_message_received', { detail: data });
                document.dispatchEvent(event);

                if (window.jQuery) {
                    window.jQuery(document).trigger('whatsapp_message_received', data);
                }
            } catch (e) {
                console.error("Error dispatching DOM event:", e);
            }
        });
    }

    /**
     * Connect to the socket.io server
     */
    connect() {
        if (this.socket && !this.connected) {
            console.log("Connecting to socket.io server...");
            this.socket.connect();
        }
    }

    /**
     * Disconnect from the socket.io server
     */
    disconnect() {
        if (this.socket && this.connected) {
            console.log("Disconnecting from socket.io server...");
            this.socket.disconnect();
        }
    }

    /**
     * Register an event handler
     * @param {string} event - The event name
     * @param {function} callback - The callback function
     */
    on(event, callback) {
        if (!this.socket) {
            console.warn("Socket not initialized. Event will be registered but may not work:", event);
        }

        // Connect if lazy
        this.connect();

        // Register the event handler
        this.socket.on(event, callback);
    }

    /**
     * Unregister an event handler
     * @param {string} event - The event name
     * @param {function} callback - The callback function
     */
    off(event, callback) {
        if (this.socket) {
            this.socket.off(event, callback);
        }
    }

    /**
     * Emit an event
     * @param {string} event - The event name
     * @param  {...any} args - The event arguments
     */
    emit(event, ...args) {
        if (!this.socket) {
            console.error("Socket not initialized. Cannot emit event:", event);
            return;
        }

        // Connect if lazy
        this.connect();

        // Emit the event
        this.socket.emit(event, ...args);
    }

    /**
     * Trigger local event handlers
     * @param {string} event - The event name
     * @param  {...any} args - The event arguments
     */
    trigger(event, ...args) {
        if (this.events[event]) {
            this.events[event].forEach(callback => {
                try {
                    callback(...args);
                } catch (e) {
                    console.error("Error in event handler for", event, ":", e);
                }
            });
        }
    }

    /**
     * Get the socket.io host URL
     * @param {number} port - The socket.io port
     * @returns {string} The host URL
     */
    get_host(port = null) {
        let host = window.location.origin;
        let sitename = window.site_name || frappe.boot?.sitename || '';

        // Use the provided port, or get it from window.socketio_port, or use 9001 as fallback
        port = port || window.socketio_port || 9001;

        if (window.location.port) {
            // If we're in a development environment with a custom port
            let parts = host.split(":");
            if (parts.length > 2) {
                host = parts[0] + ":" + parts[1];
            }
            host = host + ":" + port;
        }

        return host + `/${sitename}`;
    }

    /**
     * Test the connection by sending a ping
     */
    ping() {
        this.emit("ping");
    }

    /**
     * Check if the socket is connected and reconnect if needed
     * @returns {boolean} Whether the socket is connected
     */
    check_connection() {
        console.log("Checking socket connection status...");

        if (!this.socket) {
            console.error("Socket not initialized. Initializing now...");
            this.init();
            return false;
        }

        if (!this.connected) {
            console.log("Socket not connected. Reconnecting...");
            this.connect();
            return false;
        }

        console.log("Socket connection is active.");
        return true;
    }

    /**
     * Ensure WhatsApp events are registered
     * This can be called from the WhatsApp interface to make sure events are registered
     */
    ensure_whatsapp_events() {
        console.log("Ensuring WhatsApp events are registered...");

        if (!this.socket) {
            console.log("Socket not initialized. Initializing now...");
            this.init();

            // Set up a one-time connect handler to register events
            this.socket.once("connect", () => {
                console.log("Socket connected, registering WhatsApp events...");
                this.register_whatsapp_events();
            });

            return false;
        }

        if (!this.connected) {
            console.log("Socket not connected. Reconnecting...");
            this.connect();

            // Set up a one-time connect handler to register events
            this.socket.once("connect", () => {
                console.log("Socket reconnected, registering WhatsApp events...");
                this.register_whatsapp_events();
            });

            return false;
        }

        // Re-register for WhatsApp events
        console.log("Socket already connected, registering WhatsApp events...");
        this.register_whatsapp_events();

        // Emit a test event to verify connection
        this.emit("ping");
        console.log("Sent ping to verify connection");

        return true;
    }

    /**
     * Debug WhatsApp events
     * This can be called to log the current state of WhatsApp events
     */
    debug_whatsapp() {
        console.log("Debugging WhatsApp events...");
        console.log("Socket initialized:", !!this.socket);
        console.log("Socket connected:", this.connected);

        if (this.socket) {
            console.log("Socket has whatsapp_message_received handler:",
                this.socket.hasListeners("whatsapp_message_received"));
            console.log("Socket has whatsapp_message_status_update handler:",
                this.socket.hasListeners("whatsapp_message_status_update"));
        }

        // Test the connection
        this.emit("ping");
        console.log("Sent ping to test connection");
    }
}

// Create a singleton instance
on_desk.realtime = new OnDeskRealtimeClient();

// Auto-initialize when the document is ready
document.addEventListener('DOMContentLoaded', function () {
    console.log("DOM loaded, initializing On Desk realtime client...");

    // Initialize with a slight delay to ensure all dependencies are loaded
    setTimeout(function () {
        try {
            // Get the socket.io port from the window object
            const port = window.socketio_port || 9001;

            console.log("Using socket.io port:", port);

            // Initialize the realtime client
            on_desk.realtime.init(port);

            console.log("On Desk realtime client initialized with port:", port);

            // Create a bridge to frappe.realtime for compatibility
            if (typeof frappe !== 'undefined') {
                if (!frappe.realtime) {
                    frappe.realtime = {};
                }

                // Add compatibility methods that forward to on_desk.realtime
                if (!frappe.realtime.on) {
                    frappe.realtime.on = function (event, callback) {
                        console.log("Forwarding event registration to on_desk.realtime:", event);
                        on_desk.realtime.on(event, callback);
                    };
                }

                if (!frappe.realtime.off) {
                    frappe.realtime.off = function (event, callback) {
                        on_desk.realtime.off(event, callback);
                    };
                }

                if (!frappe.realtime.emit) {
                    frappe.realtime.emit = function (event, ...args) {
                        on_desk.realtime.emit(event, ...args);
                    };
                }
            }
        } catch (e) {
            console.error("Error auto-initializing On Desk realtime client:", e);
        }
    }, 500);
});
