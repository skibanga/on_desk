# Copyright (c) 2025, Frappe Technologies and Contributors
# See license.txt

import frappe
import unittest


class TestODFilterPreset(unittest.TestCase):
    def setUp(self):
        # Clean up any existing test presets
        frappe.db.delete("OD Filter Preset", {"preset_name": ["like", "Test%"]})
        frappe.db.commit()
    
    def tearDown(self):
        # Clean up test data
        frappe.db.delete("OD Filter Preset", {"preset_name": ["like", "Test%"]})
        frappe.db.commit()
    
    def test_create_filter_preset(self):
        """Test creating a filter preset"""
        preset = frappe.new_doc("OD Filter Preset")
        preset.preset_name = "Test Preset"
        preset.user = frappe.session.user
        preset.filters = '{"status": "Open", "priority": "High"}'
        preset.search_text = "test search"
        preset.sort_by = "creation"
        preset.sort_order = "asc"
        preset.insert()
        
        self.assertTrue(preset.name)
        self.assertEqual(preset.preset_name, "Test Preset")
        self.assertEqual(preset.user, frappe.session.user)
    
    def test_default_preset_validation(self):
        """Test that only one default preset is allowed per user"""
        # Create first default preset
        preset1 = frappe.new_doc("OD Filter Preset")
        preset1.preset_name = "Test Default 1"
        preset1.user = frappe.session.user
        preset1.is_default = 1
        preset1.insert()
        
        # Try to create second default preset - should fail
        preset2 = frappe.new_doc("OD Filter Preset")
        preset2.preset_name = "Test Default 2"
        preset2.user = frappe.session.user
        preset2.is_default = 1
        
        with self.assertRaises(frappe.ValidationError):
            preset2.insert()
    
    def test_json_validation(self):
        """Test JSON validation for filters field"""
        preset = frappe.new_doc("OD Filter Preset")
        preset.preset_name = "Test Invalid JSON"
        preset.user = frappe.session.user
        preset.filters = "invalid json"
        
        with self.assertRaises(frappe.ValidationError):
            preset.insert()
