import frappe


def get_context(context):
    context.no_cache = 1

    # If user is already logged in, redirect to our custom admin panel
    if frappe.session.user != "Guest":
        frappe.local.flags.redirect_location = "/on-desk"
        raise frappe.Redirect

    # Otherwise redirect to login page
    frappe.local.flags.redirect_location = "/login"
    raise frappe.Redirect
