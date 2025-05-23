/**
 * On Desk Socket.io Client
 *
 * This is a custom socket.io client for the On Desk application.
 * It handles real-time events for WhatsApp messages and other notifications.
 */

frappe.provide("on_desk.realtime");

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
    init(port = 9000, lazy_connect = false) {
        console.log("Initializing On Desk realtime client...");

        if (this.socket) {
            console.log("Socket already initialized");
            return;
        }

        // Get the host URL
        const host = this.get_host(port);
        console.log("Socket.io host:", host);

        // Initialize socket with proper options
        try {
            // Enable secure option when using HTTPS
            if (window.location.protocol == "https:") {
                this.socket = io(host, {
                    secure: true,
                    withCredentials: true,
                    reconnectionAttempts: this.max_reconnect_attempts,
                    autoConnect: !lazy_connect,
                });
            } else if (window.location.protocol == "http:") {
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
        // Connection events
        this.socket.on("connect", () => {
            console.log("Socket.io connected");
            this.connected = true;
            this.reconnect_attempts = 0;

            // Trigger any registered connect callbacks
            this.trigger("connect");
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

        // WhatsApp specific events
        this.socket.on("whatsapp_message_received", (data) => {
            console.log("WhatsApp message received:", data);
            this.trigger("whatsapp_message_received", data);
        });

        this.socket.on("whatsapp_message_status_update", (data) => {
            console.log("WhatsApp message status update:", data);
            this.trigger("whatsapp_message_status_update", data);
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
    get_host(port = 9000) {
        let protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
        let hostname = window.location.hostname;
        let sitename = window.site_name || frappe.boot?.sitename || '';

        // Use the provided port or the default
        port = window.socketio_port || port.toString() || "9000";

        // Construct the host URL with the correct protocol
        let host = `${protocol}//${hostname}:${port}`;

        return host + `/${sitename}`;
    }

    /**
     * Test the connection by sending a ping
     */
    ping() {
        this.emit("ping");
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
            const port = window.socketio_port || 9000;

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
