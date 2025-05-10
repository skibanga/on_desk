# Copyright (c) 2023, Sydney Kibanga and contributors
# For license information, please see license.txt

import frappe
import requests
import json
from frappe.model.document import Document
from frappe.utils import get_url
from on_desk.utils.whatsapp import get_whatsapp_integration


class ODWhatsAppIntegration(Document):
    def validate(self):
        self.set_webhook_url()

    def set_webhook_url(self):
        """Set the webhook URL based on the site URL"""
        site_url = get_url()
        self.webhook_url = f"{site_url}/api/method/on_desk.on_desk.doctype.od_whatsapp_integration.api.webhook"

    def send_message(self, to_number, message, template=None, template_params=None):
        """Send a WhatsApp message using the configured provider"""
        if not self.enabled:
            frappe.throw("WhatsApp integration is not enabled")

        if self.provider == "Meta":
            return self.send_message_meta(to_number, message, template, template_params)
        elif self.provider == "Twilio":
            return self.send_message_twilio(to_number, message)
        elif self.provider == "Custom":
            return self.send_message_custom(to_number, message)
        else:
            frappe.throw(f"Unsupported provider: {self.provider}")

    def send_message_meta(
        self, to_number, message, template=None, template_params=None
    ):
        """Send a WhatsApp message using Meta's WhatsApp Business API"""
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.get_password('api_key')}",
        }

        # Format the phone number (remove any non-numeric characters except +)
        to_number = "".join([c for c in to_number if c.isdigit() or c == "+"])

        # If template is provided, use template message
        if template and template_params:
            payload = {
                "messaging_product": "whatsapp",
                "recipient_type": "individual",
                "to": to_number,
                "type": "template",
                "template": {
                    "name": template,
                    "language": {"code": "en_US"},
                    "components": [{"type": "body", "parameters": template_params}],
                },
            }
        else:
            # Use text message
            payload = {
                "messaging_product": "whatsapp",
                "recipient_type": "individual",
                "to": to_number,
                "type": "text",
                "text": {"body": message},
            }

        url = f"{self.api_endpoint}/{self.phone_number_id}/messages"

        try:
            response = requests.post(url, headers=headers, data=json.dumps(payload))
            response_data = response.json()

            if response.status_code == 200:
                # Create a record of the sent message
                self.create_message_record(
                    to_number, message, "Outgoing", response_data
                )
                return response_data
            else:
                frappe.log_error(
                    f"WhatsApp API Error: {response_data}", "WhatsApp Message Error"
                )
                return None
        except Exception as e:
            frappe.log_error(
                f"WhatsApp API Exception: {str(e)}", "WhatsApp Message Error"
            )
            return None

    def send_message_twilio(self, to_number, message):
        """Send a WhatsApp message using Twilio's API"""
        # Implementation for Twilio
        frappe.throw("Twilio integration not implemented yet")

    def send_message_custom(self, to_number, message):
        """Send a WhatsApp message using a custom API"""
        # Implementation for custom provider
        frappe.throw("Custom provider integration not implemented yet")

    def create_message_record(self, to_number, message, direction, response=None):
        """Create a record of the WhatsApp message"""
        message_doc = frappe.new_doc("OD Social Media Message")
        message_doc.channel = "WhatsApp"
        message_doc.direction = direction
        message_doc.to_number = to_number
        message_doc.message = message
        message_doc.status = "Sent" if direction == "Outgoing" else "Received"

        if response:
            message_doc.message_id = response.get("messages", [{}])[0].get("id", "")
            message_doc.raw_response = json.dumps(response)

        message_doc.insert(ignore_permissions=True)
        return message_doc.name


@frappe.whitelist()
def get_whatsapp_settings():
    """Get the WhatsApp integration settings"""
    doc = get_whatsapp_integration()
    if doc:
        return {
            "enabled": doc.enabled,
            "provider": doc.provider,
            "webhook_url": doc.webhook_url,
        }
    return {"enabled": False}


@frappe.whitelist()
def send_whatsapp_message(to_number, message, template=None, template_params=None):
    """Send a WhatsApp message"""
    doc = get_whatsapp_integration(throw_if_not_found=True)
    return doc.send_message(to_number, message, template, template_params)
