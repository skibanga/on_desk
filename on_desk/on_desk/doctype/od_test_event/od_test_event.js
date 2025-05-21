// Copyright (c) 2023, Sydney Kibanga and contributors
// For license information, please see license.txt

frappe.ui.form.on('OD Test Event', {
    refresh: function(frm) {
        // Add a button to manually trigger an event
        frm.add_custom_button(__('Trigger Test Event'), function() {
            // Show a message
            frappe.show_alert({
                message: __('Triggering test event...'),
                indicator: 'blue'
            });
            
            // Call a server method to trigger the event
            frappe.call({
                method: 'frappe.publish_realtime',
                args: {
                    event: 'od_test_event',
                    message: {
                        name: frm.doc.name,
                        title: frm.doc.title,
                        description: frm.doc.description,
                        event_type: frm.doc.event_type,
                        status: frm.doc.status,
                        action: 'manual_trigger',
                        timestamp: frappe.datetime.now_datetime()
                    }
                },
                callback: function(r) {
                    frappe.show_alert({
                        message: __('Test event triggered successfully!'),
                        indicator: 'green'
                    });
                }
            });
        });
    }
});
