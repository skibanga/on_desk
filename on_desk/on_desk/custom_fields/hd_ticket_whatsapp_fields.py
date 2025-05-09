import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

def setup_whatsapp_fields():
    """Add WhatsApp integration fields to HD Ticket DocType"""
    custom_fields = {
        "HD Ticket": [
            {
                "fieldname": "communication_channel",
                "label": "Communication Channel",
                "fieldtype": "Select",
                "options": "\nEmail\nWhatsApp\nFacebook\nInstagram\nTwitter\nOther",
                "insert_after": "via_customer_portal",
                "translatable": 0
            },
            {
                "fieldname": "raised_by_phone",
                "label": "Raised By (Phone)",
                "fieldtype": "Data",
                "insert_after": "raised_by",
                "translatable": 0
            },
            {
                "fieldname": "whatsapp_section",
                "label": "WhatsApp",
                "fieldtype": "Section Break",
                "insert_after": "content_type",
                "depends_on": "eval:doc.communication_channel=='WhatsApp'",
                "translatable": 0
            },
            {
                "fieldname": "whatsapp_conversation",
                "label": "WhatsApp Conversation",
                "fieldtype": "HTML",
                "insert_after": "whatsapp_section",
                "translatable": 0
            },
            {
                "fieldname": "whatsapp_column_break",
                "fieldtype": "Column Break",
                "insert_after": "whatsapp_conversation",
                "translatable": 0
            },
            {
                "fieldname": "whatsapp_message",
                "label": "WhatsApp Message",
                "fieldtype": "Text",
                "insert_after": "whatsapp_column_break",
                "translatable": 0
            },
            {
                "fieldname": "whatsapp_send",
                "label": "Send WhatsApp",
                "fieldtype": "Button",
                "insert_after": "whatsapp_message",
                "translatable": 0
            },
            {
                "fieldname": "social_media_tab",
                "label": "Social Media",
                "fieldtype": "Tab Break",
                "insert_after": "meta_tab",
                "translatable": 0
            },
            {
                "fieldname": "social_media_messages_section",
                "label": "Social Media Messages",
                "fieldtype": "Section Break",
                "insert_after": "social_media_tab",
                "translatable": 0
            },
            {
                "fieldname": "social_media_messages",
                "label": "Social Media Messages",
                "fieldtype": "HTML",
                "insert_after": "social_media_messages_section",
                "translatable": 0
            }
        ]
    }
    
    create_custom_fields(custom_fields)
    frappe.msgprint("WhatsApp integration fields added to HD Ticket DocType")

def setup_hd_ticket_comment_fields():
    """Add WhatsApp integration fields to HD Ticket Comment DocType"""
    custom_fields = {
        "HD Ticket Comment": [
            {
                "fieldname": "communication_channel",
                "label": "Communication Channel",
                "fieldtype": "Select",
                "options": "\nEmail\nWhatsApp\nFacebook\nInstagram\nTwitter\nOther",
                "insert_after": "is_pinned",
                "translatable": 0
            },
            {
                "fieldname": "message_id",
                "label": "Message ID",
                "fieldtype": "Data",
                "insert_after": "communication_channel",
                "translatable": 0
            },
            {
                "fieldname": "has_attachment",
                "label": "Has Attachment",
                "fieldtype": "Check",
                "insert_after": "message_id",
                "translatable": 0
            }
        ]
    }
    
    create_custom_fields(custom_fields)
    frappe.msgprint("WhatsApp integration fields added to HD Ticket Comment DocType")

def setup_contact_fields():
    """Add WhatsApp integration fields to Contact DocType"""
    custom_fields = {
        "Contact": [
            {
                "fieldname": "whatsapp_opt_in",
                "label": "WhatsApp Opt-In",
                "fieldtype": "Check",
                "insert_after": "phone_nos",
                "translatable": 0
            },
            {
                "fieldname": "whatsapp_opt_in_date",
                "label": "WhatsApp Opt-In Date",
                "fieldtype": "Date",
                "insert_after": "whatsapp_opt_in",
                "depends_on": "eval:doc.whatsapp_opt_in==1",
                "translatable": 0
            }
        ]
    }
    
    create_custom_fields(custom_fields)
    frappe.msgprint("WhatsApp integration fields added to Contact DocType")

def setup_all_custom_fields():
    """Setup all custom fields for WhatsApp integration"""
    setup_whatsapp_fields()
    setup_hd_ticket_comment_fields()
    setup_contact_fields()
    
    # Update module property
    frappe.db.sql("""
        UPDATE `tabCustom Field` 
        SET module = 'On Desk' 
        WHERE fieldname IN (
            'communication_channel', 'raised_by_phone', 'whatsapp_section', 
            'whatsapp_conversation', 'whatsapp_column_break', 'whatsapp_message', 
            'whatsapp_send', 'social_media_tab', 'social_media_messages_section', 
            'social_media_messages', 'whatsapp_opt_in', 'whatsapp_opt_in_date'
        )
    """)
    
    frappe.db.commit()
    frappe.msgprint("All WhatsApp integration custom fields have been set up")
