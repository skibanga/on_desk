import frappe

def get_context(context):
    context.app_name = "On Desk"
    
    # Get user information
    user = frappe.session.user
    user_doc = frappe.get_doc("User", user)
    
    context.user_full_name = user_doc.full_name
    context.user_first_name = user_doc.first_name
    context.user_image = user_doc.user_image
    
    # Get user role
    roles = frappe.get_roles(user)
    if "System Manager" in roles:
        context.user_role = "Administrator"
    elif "On Desk Agent" in roles:
        context.user_role = "Agent"
    else:
        context.user_role = "User"
    
    # No index, no cache
    context.no_cache = 1
    context.no_sitemap = 1
    
    return context
