import frappe
from frappe import _
from frappe.utils import get_url
from on_desk.utils.whatsapp import get_whatsapp_integration


def setup_whatsapp_integration():
    """Setup WhatsApp integration for On Desk"""
    # Create WhatsApp Integration document if it doesn't exist
    if not frappe.db.exists("OD WhatsApp Integration", "OD WhatsApp Integration"):
        doc = frappe.new_doc("OD WhatsApp Integration")
        doc.enabled = 0
        doc.provider = "Meta"
        doc.api_endpoint = "https://graph.facebook.com/v17.0"
        doc.webhook_verify_token = frappe.generate_hash(length=16)
        doc.insert()

        frappe.msgprint(
            _(
                "WhatsApp Integration document created. Please configure it in the On Desk settings."
            )
        )

    # Create default WhatsApp templates
    create_default_templates()

    # Add custom fields to HD Ticket
    from on_desk.on_desk.custom_fields.hd_ticket_whatsapp_fields import (
        setup_all_custom_fields,
    )

    setup_all_custom_fields()

    # Add client script to include WhatsApp JS
    create_client_script()

    frappe.msgprint(_("WhatsApp Integration setup completed successfully."))


def create_default_templates():
    """Create default WhatsApp templates"""
    templates = [
        {
            "template_name": "ticket_created",
            "language": "en_US",
            "category": "TICKET_UPDATE",
            "header_type": "TEXT",
            "header_text": "Ticket Created",
            "body_text": "Hello! Your ticket #{{1}} has been created. We'll get back to you as soon as possible. Thank you for contacting us.",
            "footer_text": "Reply to this message to add more information to your ticket.",
            "sample_values": [{"parameter_number": 1, "value": "12345"}],
        },
        {
            "template_name": "ticket_updated",
            "language": "en_US",
            "category": "TICKET_UPDATE",
            "header_type": "TEXT",
            "header_text": "Ticket Updated",
            "body_text": "Hello! Your ticket #{{1}} has been updated. Status: {{2}}. You can view the details by replying to this message.",
            "footer_text": "Reply to this message to add more information to your ticket.",
            "sample_values": [
                {"parameter_number": 1, "value": "12345"},
                {"parameter_number": 2, "value": "In Progress"},
            ],
        },
        {
            "template_name": "ticket_resolved",
            "language": "en_US",
            "category": "TICKET_UPDATE",
            "header_type": "TEXT",
            "header_text": "Ticket Resolved",
            "body_text": "Hello! Your ticket #{{1}} has been resolved. If you're satisfied with the resolution, no further action is needed. If you need further assistance, please reply to this message.",
            "footer_text": "Thank you for using our services.",
            "sample_values": [{"parameter_number": 1, "value": "12345"}],
        },
    ]

    for template_data in templates:
        if not frappe.db.exists("OD WhatsApp Template", template_data["template_name"]):
            template = frappe.new_doc("OD WhatsApp Template")
            template.template_name = template_data["template_name"]
            template.language = template_data["language"]
            template.category = template_data["category"]
            template.header_type = template_data["header_type"]
            template.header_text = template_data["header_text"]
            template.body_text = template_data["body_text"]
            template.footer_text = template_data["footer_text"]

            # Add sample values
            for sample in template_data["sample_values"]:
                template.append(
                    "sample_values",
                    {
                        "parameter_number": sample["parameter_number"],
                        "value": sample["value"],
                    },
                )

            template.insert()


def create_client_script():
    """Create client script to include WhatsApp JS"""
    if not frappe.db.exists("Client Script", "HD Ticket WhatsApp Integration"):
        script = frappe.new_doc("Client Script")
        script.dt = "HD Ticket"
        script.name = "HD Ticket WhatsApp Integration"
        script.script_type = "Client"
        script.script = """
// Include WhatsApp integration JS
frappe.ui.form.on('HD Ticket', {
    refresh: function(frm) {
        // Load the WhatsApp integration script
        if (!window.whatsapp_integration_loaded) {
            $.getScript('/assets/on_desk/js/hd_ticket_whatsapp.js', function() {
                window.whatsapp_integration_loaded = true;
                // Trigger refresh to initialize WhatsApp functionality
                frm.trigger('refresh');
            });
        }
    }
});
"""
        script.insert()


def get_whatsapp_settings():
    """Get WhatsApp integration settings"""
    doc = get_whatsapp_integration()
    if not doc:
        return {"enabled": False, "provider": None, "webhook_url": None}

    return {
        "enabled": doc.enabled,
        "provider": doc.provider,
        "webhook_url": doc.webhook_url,
    }


def send_whatsapp_notification(ticket, template_name=None, message=None):
    """Send WhatsApp notification for a ticket"""
    settings = get_whatsapp_integration()

    if not settings or not settings.enabled:
        return False

    # Get the contact's phone number
    phone_number = None
    if ticket.contact:
        contact = frappe.get_doc("Contact", ticket.contact)
        for phone in contact.phone_nos:
            if phone.is_primary_phone:
                phone_number = phone.phone
                break

        if not phone_number and contact.phone_nos:
            phone_number = contact.phone_nos[0].phone

    # If no contact phone, try raised_by_phone
    if (
        not phone_number
        and hasattr(ticket, "raised_by_phone")
        and ticket.raised_by_phone
    ):
        phone_number = ticket.raised_by_phone

    if not phone_number:
        return False

    # Send the message
    if template_name:
        # Get the template
        if not frappe.db.exists("OD WhatsApp Template", template_name):
            return False

        template = frappe.get_doc("OD WhatsApp Template", template_name)

        # Prepare template parameters
        template_params = []
        if template_name == "ticket_created":
            template_params = [{"type": "text", "text": ticket.name}]
        elif template_name == "ticket_updated":
            template_params = [
                {"type": "text", "text": ticket.name},
                {"type": "text", "text": ticket.status},
            ]
        elif template_name == "ticket_resolved":
            template_params = [{"type": "text", "text": ticket.name}]

        # Send template message
        return settings.send_message(
            phone_number, None, template.template_name, template_params
        )
    elif message:
        # Send text message
        return settings.send_message(phone_number, message)

    return False
