/**
 * Frappe Provide Function
 * 
 * This file adds the frappe.provide function to the global frappe object
 * if it doesn't already exist. This is needed for the WhatsApp interface
 * to work properly with the frappe.request module.
 */

// Create the frappe object if it doesn't exist
if (!window.frappe) window.frappe = {};

// Add the provide function if it doesn't exist
if (!window.frappe.provide) {
    window.frappe.provide = function (namespace) {
        // docs: create a namespace
        var nsl = namespace.split(".");
        var parent = window;
        for (var i = 0; i < nsl.length; i++) {
            var n = nsl[i];
            if (!parent[n]) {
                parent[n] = {};
            }
            parent = parent[n];
        }
        return parent;
    };
}

// Initialize common namespaces
frappe.provide("frappe.request");
frappe.provide("frappe.request.error_handlers");
frappe.provide("frappe.utils");
frappe.provide("frappe.model");
frappe.provide("frappe._messages");
frappe.provide("frappe.session");

// Set up some defaults
frappe.request.url = "/";
frappe.request.ajax_count = 0;
frappe.request.waiting_for_ajax = [];
frappe.request.logs = {};

// Add a simple implementation of frappe.call if it doesn't exist
if (!frappe.call) {
    frappe.call = function(opts) {
        if (typeof opts === 'string') {
            opts = { method: opts };
        }
        
        return $.ajax({
            url: '/api/method/' + opts.method,
            type: 'POST',
            data: opts.args || {},
            dataType: 'json',
            headers: {
                'X-Frappe-CSRF-Token': frappe.csrf_token || ''
            }
        }).done(function(data) {
            if (opts.callback) {
                opts.callback(data);
            }
        }).fail(function(xhr, textStatus) {
            console.error("Request failed:", textStatus);
            if (opts.error) {
                opts.error(xhr, textStatus);
            }
        });
    };
}

console.log("Frappe provide function initialized");
