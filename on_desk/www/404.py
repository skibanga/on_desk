import frappe
from frappe import _

def get_context(context):
    context.http_status_code = 404
    
    # Get app settings
    context.app_name = frappe.db.get_single_value("Website Settings", "app_name") or "On Desk"
    
    # Check if we're in the On Desk app context
    path = frappe.local.request.path if hasattr(frappe.local, "request") else ""
    if path.startswith('/on-desk'):
        # If we're in the On Desk app, redirect to the On Desk 404 page
        frappe.local.flags.redirect_location = "/on-desk/404"
        raise frappe.Redirect
    
    return context
