# Copyright (c) 2023, Sydney Kibanga and contributors
# For license information, please see license.txt

import frappe
from frappe import _

def get_active_whatsapp_integration():
    """
    Get the active WhatsApp integration settings.
    
    Returns:
        Document: The active WhatsApp integration document or None if not found
    """
    # Get all enabled WhatsApp integration settings
    integrations = frappe.get_all(
        "OD WhatsApp Integration",
        filters={"enabled": 1},
        order_by="modified desc",
        limit=1
    )
    
    if not integrations:
        # If no enabled integrations, get the most recently modified one
        integrations = frappe.get_all(
            "OD WhatsApp Integration",
            order_by="modified desc",
            limit=1
        )
    
    if integrations:
        return frappe.get_doc("OD WhatsApp Integration", integrations[0].name)
    
    return None

def get_whatsapp_integration(throw_if_not_found=False):
    """
    Get the WhatsApp integration settings.
    
    Args:
        throw_if_not_found (bool): Whether to throw an error if no integration is found
        
    Returns:
        Document: The WhatsApp integration document or None if not found
    """
    integration = get_active_whatsapp_integration()
    
    if not integration and throw_if_not_found:
        frappe.throw(_("WhatsApp integration is not configured"))
    
    return integration
