# Copyright (c) 2025, Frappe Technologies and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class ODFilterPreset(Document):
    def before_save(self):
        # Ensure user is set to current user if not specified
        if not self.user:
            self.user = frappe.session.user
        
        # Validate that only one default preset per user
        if self.is_default:
            existing_default = frappe.db.exists("OD Filter Preset", {
                "user": self.user,
                "is_default": 1,
                "name": ["!=", self.name]
            })
            if existing_default:
                frappe.throw("Only one default filter preset is allowed per user")
    
    def validate(self):
        # Validate JSON format for filters
        if self.filters:
            try:
                frappe.parse_json(self.filters)
            except:
                frappe.throw("Invalid JSON format in filters field")
    
    def on_update(self):
        # Clear cache when preset is updated
        frappe.cache().delete_key(f"filter_presets_{self.user}")
    
    def on_trash(self):
        # Clear cache when preset is deleted
        frappe.cache().delete_key(f"filter_presets_{self.user}")


def get_user_filter_presets(user=None):
    """Get filter presets for a user with caching"""
    if not user:
        user = frappe.session.user
    
    cache_key = f"filter_presets_{user}"
    presets = frappe.cache().get_value(cache_key)
    
    if presets is None:
        presets = frappe.get_all(
            "OD Filter Preset",
            filters={"user": user},
            fields=["name", "preset_name", "filters", "search_text", "sort_by", "sort_order", "is_default"],
            order_by="is_default desc, preset_name"
        )
        
        # Parse filters JSON
        for preset in presets:
            try:
                preset.filters = frappe.parse_json(preset.filters) if preset.filters else {}
            except:
                preset.filters = {}
        
        # Cache for 5 minutes
        frappe.cache().set_value(cache_key, presets, expires_in_sec=300)
    
    return presets
