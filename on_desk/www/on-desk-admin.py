import frappe


def get_context(context):
    # Redirect to the new URL structure
    frappe.local.flags.redirect_location = "/on-desk"
    raise frappe.Redirect
