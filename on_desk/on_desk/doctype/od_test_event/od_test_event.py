# Copyright (c) 2023, Sydney Kibanga and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class ODTestEvent(Document):
    def after_insert(self):
        self.emit_test_event("created")

    def on_update(self):
        self.emit_test_event("updated")

    def on_trash(self):
        self.emit_test_event("deleted")

    def emit_test_event(self, action):
        """Emit a real-time event when this document is modified"""
        event_data = {
            "name": self.name,
            "title": self.title,
            "description": self.description,
            "event_type": self.event_type,
            "status": self.status,
            "action": action,
            "timestamp": frappe.utils.now()
        }
        
        # Log the event for debugging
        frappe.log_error(
            message=f"Emitting test event: {event_data}",
            title="Test Event Emitted"
        )
        
        # Emit the event to all users
        frappe.publish_realtime(
            "od_test_event",
            event_data,
            after_commit=True
        )
