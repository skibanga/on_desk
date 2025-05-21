import frappe
from frappe import _
from frappe.utils import get_gravatar


def get_context(context):
    context.no_cache = 1

    # Check if user is logged in
    if frappe.session.user == "Guest":
        frappe.local.flags.redirect_location = "/login"
        raise frappe.Redirect

    # Get user information
    user = frappe.get_doc("User", frappe.session.user)
    context.user_full_name = user.full_name
    context.user_first_name = user.first_name or user.full_name.split(" ")[0]
    context.user_image = user.user_image or get_gravatar(user.email)

    # Set current page for sidebar highlighting
    context.current_page = "test-event"
    context.page_title = "Test Real-time Events"
    
    # Get recent test events
    context.recent_events = get_recent_events()
    
    return context


def get_recent_events():
    """Get recent test events"""
    try:
        events = frappe.get_all(
            "OD Test Event",
            fields=["name", "title", "description", "event_type", "status", "creation"],
            order_by="creation desc",
            limit=10
        )
        
        # Format the events for display
        for event in events:
            event.creation_formatted = frappe.utils.format_datetime(event.creation, "medium")
            
            # Set color based on event type
            if event.event_type == "Info":
                event.color = "primary"
            elif event.event_type == "Warning":
                event.color = "warning"
            elif event.event_type == "Error":
                event.color = "danger"
            elif event.event_type == "Success":
                event.color = "success"
            else:
                event.color = "secondary"
                
        return events
    except Exception as e:
        frappe.log_error(f"Error fetching test events: {str(e)}")
        return []
