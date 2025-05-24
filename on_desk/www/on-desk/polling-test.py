import frappe
from frappe import _

def get_context(context):
    context.no_cache = 1
    context.page_title = "Event Polling Test"
    
    # Get user information if logged in
    if frappe.session.user != "Guest":
        user = frappe.get_doc("User", frappe.session.user)
        context.user_full_name = user.full_name
        context.user_first_name = user.first_name or user.full_name.split(" ")[0]
        context.user_image = user.user_image
    
    return context
