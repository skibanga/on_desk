import frappe
from frappe import _
from frappe.utils import get_gravatar


def get_context(context):
    """Get context for advanced tickets page"""
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

    # Get user role
    user_roles = frappe.get_roles(frappe.session.user)
    if "Administrator" in user_roles:
        context.user_role = "Administrator"
    elif "System Manager" in user_roles:
        context.user_role = "System Manager"
    elif "Helpdesk Manager" in user_roles:
        context.user_role = "Helpdesk Manager"
    elif "Helpdesk Agent" in user_roles:
        context.user_role = "Helpdesk Agent"
    else:
        context.user_role = "User"

    # Get app settings
    context.app_name = (
        frappe.db.get_single_value("Website Settings", "app_name") or "On Desk"
    )
    context.app_logo = "/assets/on_desk/img/icons/logo1.png"
    context.dark_mode = True

    # Set current page for sidebar highlighting
    context.current_page = "tickets"
    context.page_title = "Tickets - Advanced"

    # Advanced filtering is always enabled for this page
    context.use_advanced_filtering = True
    context.tickets = []  # Will be loaded via AJAX
    context.filter_options = get_filter_options_for_context()

    return context


def get_filter_options_for_context():
    """Get filter options for the frontend context"""
    try:
        from on_desk.api import get_filter_options
        
        result = get_filter_options()
        if result.get("success"):
            return result.get("options", {})
        return {}
    except Exception:
        return {
            "statuses": [{"name": "All", "label": "All Statuses"}],
            "priorities": [{"name": "All", "label": "All Priorities"}],
            "agent_groups": [{"name": "All", "label": "All Teams"}],
            "ticket_types": [{"name": "All", "label": "All Types"}],
            "customers": [{"name": "All", "label": "All Customers"}],
            "agents": [{"name": "All", "label": "All Agents"}],
        }
