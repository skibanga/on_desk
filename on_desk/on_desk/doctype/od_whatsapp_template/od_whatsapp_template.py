# Copyright (c) 2023, Sydney Kibanga and contributors
# For license information, please see license.txt

import frappe
import re
import json
import requests
from frappe.model.document import Document


class ODWhatsAppTemplate(Document):
    def validate(self):
        self.validate_body_text()

    def validate_body_text(self):
        """Validate the body text for WhatsApp template requirements"""
        # Check for variable placeholders
        placeholders = re.findall(r"{{[1-9][0-9]*}}", self.body_text)

        # Ensure sample values are provided for all placeholders
        if placeholders and not self.sample_values:
            frappe.throw(
                "Sample values must be provided for all variables in the template"
            )

        # Check if all placeholders have sample values
        placeholder_numbers = [int(p.strip("{}")) for p in placeholders]
        sample_values_count = len(self.sample_values) if self.sample_values else 0

        if max(placeholder_numbers, default=0) > sample_values_count:
            frappe.throw(
                f"Sample values must be provided for all variables. Found {max(placeholder_numbers)} variables but only {sample_values_count} sample values."
            )

    def after_insert(self):
        """Submit the template to WhatsApp for approval if integration is configured"""
        if frappe.db.exists("OD WhatsApp Integration", "OD WhatsApp Integration"):
            self.submit_template_for_approval()

    def submit_template_for_approval(self):
        """Submit the template to WhatsApp for approval"""
        try:
            # Get WhatsApp integration settings
            settings = frappe.get_doc(
                "OD WhatsApp Integration", "OD WhatsApp Integration"
            )

            if not settings.enabled:
                return

            # Only Meta provider supports template submission via API
            if settings.provider != "Meta":
                return

            # Prepare the API request
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {settings.get_password('api_key')}",
            }

            # Prepare components based on template configuration
            components = []

            # Add header component if applicable
            if self.header_type != "NONE":
                header_component = {"type": "HEADER", "format": self.header_type}

                if self.header_type == "TEXT" and self.header_text:
                    header_component["text"] = self.header_text

                components.append(header_component)

            # Add body component
            body_component = {"type": "BODY", "text": self.body_text}
            components.append(body_component)

            # Add footer component if applicable
            if self.footer_text:
                footer_component = {"type": "FOOTER", "text": self.footer_text}
                components.append(footer_component)

            # Prepare sample values if available
            example = {}
            if self.sample_values:
                body_variables = []
                for param in self.sample_values:
                    body_variables.append(param.value)

                if body_variables:
                    example["body_text"] = [body_variables]

            # Prepare the payload
            payload = {
                "name": self.template_name,
                "category": self.category,
                "language": self.language,
                "components": components,
            }

            if example:
                payload["example"] = example

            # Make the API request
            url = f"{settings.api_endpoint}/{settings.business_account_id}/message_templates"
            response = requests.post(url, headers=headers, data=json.dumps(payload))
            response_data = response.json()

            if response.status_code == 200:
                # Update the template status
                self.status = "PENDING"
                self.save()
                return response_data
            else:
                frappe.log_error(
                    f"WhatsApp Template API Error: {response_data}",
                    "WhatsApp Template Error",
                )
                return None
        except Exception as e:
            frappe.log_error(
                f"WhatsApp Template API Exception: {str(e)}", "WhatsApp Template Error"
            )
            return None

    def check_template_status(self):
        """Check the status of the template with WhatsApp"""
        try:
            # Get WhatsApp integration settings
            settings = frappe.get_doc(
                "OD WhatsApp Integration", "OD WhatsApp Integration"
            )

            if not settings.enabled:
                return

            # Only Meta provider supports template status check via API
            if settings.provider != "Meta":
                return

            # Prepare the API request
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {settings.get_password('api_key')}",
            }

            # Make the API request
            url = f"{settings.api_endpoint}/{settings.business_account_id}/message_templates?name={self.template_name}"
            response = requests.get(url, headers=headers)
            response_data = response.json()

            if response.status_code == 200 and "data" in response_data:
                templates = response_data.get("data", [])

                for template in templates:
                    if template.get("name") == self.template_name:
                        # Update the template status
                        self.status = template.get("status", "PENDING")

                        if self.status == "REJECTED":
                            self.rejection_reason = template.get("quality", {}).get(
                                "rejection_reason", ""
                            )

                        self.save()
                        return template

            return None
        except Exception as e:
            frappe.log_error(
                f"WhatsApp Template Status API Exception: {str(e)}",
                "WhatsApp Template Error",
            )
            return None


@frappe.whitelist()
def get_template_parameters(template_name):
    """Get the parameters for a WhatsApp template"""
    if not frappe.db.exists("OD WhatsApp Template", template_name):
        return []

    template = frappe.get_doc("OD WhatsApp Template", template_name)
    placeholders = re.findall(r"{{[1-9][0-9]*}}", template.body_text)

    parameters = []
    for placeholder in placeholders:
        param_number = int(placeholder.strip("{}"))
        parameters.append(
            {"placeholder": placeholder, "parameter_number": param_number}
        )

    return parameters


def update_template_statuses():
    """Update the status of all WhatsApp templates (scheduled task)"""
    # Get all templates that are in PENDING status
    templates = frappe.get_all(
        "OD WhatsApp Template", filters={"status": "PENDING"}, fields=["name"]
    )

    for template_data in templates:
        try:
            template = frappe.get_doc("OD WhatsApp Template", template_data.name)
            template.check_template_status()
        except Exception as e:
            frappe.log_error(
                f"Error updating WhatsApp template status: {str(e)}",
                "WhatsApp Template Status Error",
            )
