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
        # Use the raw_verify endpoint for webhook verification
        self.webhook_url = f"{site_url}/api/method/on_desk.on_desk.doctype.od_whatsapp_integration.api.raw_verify"

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
        import traceback

        frappe.log_error(
            f"send_message_meta called with: to_number={to_number}, message={message}, template={template}",
            "WhatsApp Debug",
        )

        # Check if API key is configured
        api_key = self.get_password("api_key")
        if not api_key:
            error_msg = "API key is not configured"
            frappe.log_error(error_msg, "WhatsApp Debug")
            frappe.throw(error_msg)

        # Check if phone_number_id is configured
        if not self.phone_number_id:
            error_msg = "Phone Number ID is not configured"
            frappe.log_error(error_msg, "WhatsApp Debug")
            frappe.throw(error_msg)

        # Check if API endpoint is configured
        if not self.api_endpoint:
            error_msg = "API endpoint is not configured"
            frappe.log_error(error_msg, "WhatsApp Debug")
            frappe.throw(error_msg)

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        }

        frappe.log_error(f"Headers prepared (without sensitive data)", "WhatsApp Debug")

        # Format the phone number (remove any non-numeric characters except +)
        original_number = to_number
        to_number = "".join([c for c in to_number if c.isdigit() or c == "+"])

        if original_number != to_number:
            frappe.log_error(
                f"Phone number formatted from {original_number} to {to_number}",
                "WhatsApp Debug",
            )

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
            frappe.log_error(
                f"Using template message with template: {template}", "WhatsApp Debug"
            )
        else:
            # Use text message
            payload = {
                "messaging_product": "whatsapp",
                "recipient_type": "individual",
                "to": to_number,
                "type": "text",
                "text": {"body": message},
            }
            frappe.log_error(f"Using text message", "WhatsApp Debug")

        url = f"{self.api_endpoint}/{self.phone_number_id}/messages"
        frappe.log_error(f"API URL: {url}", "WhatsApp Debug")
        frappe.log_error(f"Request payload: {json.dumps(payload)}", "WhatsApp Debug")

        try:
            frappe.log_error("Sending HTTP request to WhatsApp API", "WhatsApp Debug")
            response = requests.post(url, headers=headers, data=json.dumps(payload))

            frappe.log_error(
                f"API response status code: {response.status_code}", "WhatsApp Debug"
            )

            try:
                response_data = response.json()
                frappe.log_error(
                    f"API response data: {json.dumps(response_data)}", "WhatsApp Debug"
                )
            except Exception as json_error:
                frappe.log_error(
                    f"Failed to parse JSON response: {str(json_error)}\nRaw response: {response.text}",
                    "WhatsApp Debug",
                )
                response_data = {"error": "Failed to parse response"}

            if response.status_code == 200:
                frappe.log_error("API call successful (status 200)", "WhatsApp Debug")
                # Create a record of the sent message
                try:
                    record_name = self.create_message_record(
                        to_number, message, "Outgoing", response_data
                    )
                    frappe.log_error(
                        f"Created message record: {record_name}", "WhatsApp Debug"
                    )
                except Exception as record_error:
                    error_trace = traceback.format_exc()
                    frappe.log_error(
                        f"Failed to create message record: {str(record_error)}\n\nTraceback:\n{error_trace}",
                        "WhatsApp Debug",
                    )

                return response_data
            else:
                error_msg = f"WhatsApp API Error: Status code {response.status_code}"
                frappe.log_error(
                    f"{error_msg}\nResponse data: {json.dumps(response_data)}",
                    "WhatsApp Message Error",
                )
                frappe.throw(error_msg)
                return None
        except requests.exceptions.RequestException as req_error:
            error_trace = traceback.format_exc()
            error_msg = f"WhatsApp API Request Exception: {str(req_error)}"
            frappe.log_error(
                f"{error_msg}\n\nTraceback:\n{error_trace}", "WhatsApp Message Error"
            )
            frappe.throw(error_msg)
            return None
        except Exception as e:
            error_trace = traceback.format_exc()
            error_msg = f"WhatsApp API Exception: {str(e)}"
            frappe.log_error(
                f"{error_msg}\n\nTraceback:\n{error_trace}", "WhatsApp Message Error"
            )
            frappe.throw(error_msg)
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
