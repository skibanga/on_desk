import frappe
from frappe import _
from frappe.utils import get_gravatar, get_url, now_datetime


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
    context.app_name = frappe_get_website_settings("app_name") or "On Desk"
    context.app_logo = "/assets/on_desk/img/icons/logo1.png"
    context.dark_mode = True

    # Get dashboard statistics
    try:
        # This is a placeholder for future implementation
        # When we create the Ticket doctype, we'll update this to fetch real data
        context.open_tickets = "24"
        context.resolved_today = "12"
        context.avg_response_time = "1.8h"
        context.total_customers = "156"
    except Exception as e:
        frappe.log_error(f"Error fetching dashboard statistics: {str(e)}")
        # Set default values if error occurs
        context.open_tickets = "N/A"
        context.resolved_today = "N/A"
        context.avg_response_time = "N/A"
        context.total_customers = "N/A"

    return context


def frappe_get_website_settings(key):
    """Helper function to get website settings"""
    try:
        return frappe.db.get_single_value("Website Settings", key)
    except:
        return None
