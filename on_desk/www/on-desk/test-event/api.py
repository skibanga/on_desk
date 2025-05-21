import frappe
from frappe import _
import json


@frappe.whitelist()
def trigger_test_event(title=None, description=None, event_type=None, status=None):
    """Manually trigger a test event"""
    try:
        # Create default values if not provided
        title = title or "Manual Test Event"
        description = description or "This event was triggered manually via API"
        event_type = event_type or "Info"
        status = status or "Active"
        
        # Create the event data
        event_data = {
            "title": title,
            "description": description,
            "event_type": event_type,
            "status": status,
            "action": "manual_api",
            "timestamp": frappe.utils.now()
        }
        
        # Log the event for debugging
        frappe.log_error(
            message=f"Manually triggering test event: {event_data}",
            title="Manual Test Event"
        )
        
        # Emit the event to all users
        frappe.publish_realtime(
            "od_test_event",
            event_data
        )
        
        return {
            "success": True,
            "message": "Test event triggered successfully",
            "event": event_data
        }
    except Exception as e:
        frappe.log_error(
            message=f"Error triggering test event: {str(e)}",
            title="Test Event Error"
        )
        return {
            "success": False,
            "message": f"Error triggering test event: {str(e)}"
        }


@frappe.whitelist()
def create_test_event(title=None, description=None, event_type=None, status=None):
    """Create a new test event document"""
    try:
        # Create default values if not provided
        title = title or "API Created Test Event"
        description = description or "This event was created via API"
        event_type = event_type or "Info"
        status = status or "Active"
        
        # Create the document
        doc = frappe.new_doc("OD Test Event")
        doc.title = title
        doc.description = description
        doc.event_type = event_type
        doc.status = status
        doc.insert()
        
        return {
            "success": True,
            "message": "Test event created successfully",
            "name": doc.name
        }
    except Exception as e:
        frappe.log_error(
            message=f"Error creating test event: {str(e)}",
            title="Test Event Error"
        )
        return {
            "success": False,
            "message": f"Error creating test event: {str(e)}"
        }
