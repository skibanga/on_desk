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
    context.page_title = "Create Ticket"

    # Get ticket types
    context.ticket_types = get_ticket_types()

    # Get ticket priorities
    context.priorities = get_ticket_priorities()

    # Get customers (for agents and admins)
    if any(
        role in user_roles
        for role in [
            "Administrator",
            "System Manager",
            "Helpdesk Manager",
            "Helpdesk Agent",
        ]
    ):
        context.customers = get_customers()
    else:
        context.customers = []

    # Get agent groups
    context.agent_groups = get_agent_groups()

    return context


def get_ticket_types():
    """Get all ticket types"""
    try:
        if frappe.db.exists("DocType", "HD Ticket Type"):
            types = frappe.get_all("HD Ticket Type", fields=["name"], order_by="name")
            return types
        else:
            # Return default types if DocType doesn't exist
            return [
                {"name": "Question"},
                {"name": "Problem"},
                {"name": "Incident"},
                {"name": "Feature Request"},
                {"name": "Other"},
            ]
    except Exception as e:
        frappe.log_error(f"Error fetching ticket types: {str(e)}")
        return [
            {"name": "Question"},
            {"name": "Problem"},
            {"name": "Incident"},
            {"name": "Feature Request"},
        ]


def get_ticket_priorities():
    """Get all ticket priorities"""
    try:
        if frappe.db.exists("DocType", "HD Ticket Priority"):
            priorities = frappe.get_all(
                "HD Ticket Priority", fields=["name", "color"], order_by="name"
            )
            return priorities
        else:
            # Return default priorities if DocType doesn't exist
            return [
                {"name": "Low", "color": "blue"},
                {"name": "Medium", "color": "orange"},
                {"name": "High", "color": "red"},
                {"name": "Urgent", "color": "purple"},
            ]
    except Exception as e:
        frappe.log_error(f"Error fetching ticket priorities: {str(e)}")
        return [
            {"name": "Low", "color": "blue"},
            {"name": "Medium", "color": "orange"},
            {"name": "High", "color": "red"},
            {"name": "Urgent", "color": "purple"},
        ]


def get_customers():
    """Get all customers"""
    try:
        if frappe.db.exists("DocType", "HD Customer"):
            customers = frappe.get_all(
                "HD Customer",
                fields=["name", "customer_name"],
                order_by="customer_name",
            )
            return customers
        else:
            # Return empty list if DocType doesn't exist
            return []
    except Exception as e:
        frappe.log_error(f"Error fetching customers: {str(e)}")
        return []


def get_agent_groups():
    """Get all agent groups"""
    try:
        if frappe.db.exists("DocType", "HD Agent Group"):
            groups = frappe.get_all("HD Agent Group", fields=["name"], order_by="name")
            return groups
        else:
            # Return default groups if DocType doesn't exist
            return [
                {"name": "Support"},
                {"name": "Technical"},
                {"name": "Sales"},
                {"name": "Billing"},
            ]
    except Exception as e:
        frappe.log_error(f"Error fetching agent groups: {str(e)}")
        return [{"name": "Support"}, {"name": "Technical"}]
