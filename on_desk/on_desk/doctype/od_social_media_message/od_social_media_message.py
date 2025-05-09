# Copyright (c) 2023, Sydney Kibanga and contributors
# For license information, please see license.txt

import frappe
import json
import requests
from frappe.model.document import Document
from frappe.utils import now


class ODSocialMediaMessage(Document):
    def after_insert(self):
        """After inserting a new message, update the status of the message"""
        if self.direction == "Outgoing" and self.channel == "WhatsApp":
            self.update_message_status()

    def update_message_status(self):
        """Update the status of the message from the WhatsApp API"""
        if not self.message_id:
            return

        # Only for WhatsApp messages
        if self.channel != "WhatsApp":
            return

        # Only for outgoing messages
        if self.direction != "Outgoing":
            return

        try:
            # Get WhatsApp integration settings
            if not frappe.db.exists(
                "OD WhatsApp Integration", "OD WhatsApp Integration"
            ):
                return

            settings = frappe.get_doc(
                "OD WhatsApp Integration", "OD WhatsApp Integration"
            )

            if not settings.enabled:
                return

            # Only Meta provider supports message status check via API
            if settings.provider != "Meta":
                return

            # Prepare the API request
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {settings.get_password('api_key')}",
            }

            # Make the API request
            url = f"{settings.api_endpoint}/{settings.phone_number_id}/messages/{self.message_id}"
            response = requests.get(url, headers=headers)
            response_data = response.json()

            if response.status_code == 200:
                # Update the message status
                status = response_data.get("status", "")

                if status == "delivered":
                    self.status = "Delivered"
                elif status == "read":
                    self.status = "Read"
                elif status == "failed":
                    self.status = "Failed"

                self.save()
                return response_data
            else:
                frappe.log_error(
                    f"WhatsApp Message Status API Error: {response_data}",
                    "WhatsApp Message Error",
                )
                return None
        except Exception as e:
            frappe.log_error(
                f"WhatsApp Message Status API Exception: {str(e)}",
                "WhatsApp Message Error",
            )
            return None

    def download_media(self):
        """Download media from WhatsApp API and attach it to the message"""
        if not self.media_id or not self.media_type:
            return

        # Only for WhatsApp messages
        if self.channel != "WhatsApp":
            return

        try:
            # Get WhatsApp integration settings
            if not frappe.db.exists(
                "OD WhatsApp Integration", "OD WhatsApp Integration"
            ):
                return

            settings = frappe.get_doc(
                "OD WhatsApp Integration", "OD WhatsApp Integration"
            )

            if not settings.enabled:
                return

            # Only Meta provider supports media download via API
            if settings.provider != "Meta":
                return

            # Prepare the API request
            headers = {"Authorization": f"Bearer {settings.get_password('api_key')}"}

            # Make the API request to get the media URL
            url = f"{settings.api_endpoint}/{self.media_id}"
            response = requests.get(url, headers=headers)
            response_data = response.json()

            if response.status_code == 200 and "url" in response_data:
                media_url = response_data.get("url")

                # Download the media
                media_response = requests.get(media_url, headers=headers)

                if media_response.status_code == 200:
                    # Determine file extension based on media type
                    extension = self.get_file_extension()

                    # Save the media as an attachment
                    file_name = f"whatsapp_media_{self.name}_{now()}.{extension}"
                    file_doc = frappe.get_doc(
                        {
                            "doctype": "File",
                            "file_name": file_name,
                            "content": media_response.content,
                            "attached_to_doctype": "OD Social Media Message",
                            "attached_to_name": self.name,
                        }
                    )
                    file_doc.save()

                    # Update the message with the attachment
                    self.media_attachment = file_doc.file_url
                    self.media_url = media_url
                    self.save()

                    return file_doc.file_url
                else:
                    frappe.log_error(
                        f"WhatsApp Media Download Error: {media_response.text}",
                        "WhatsApp Media Error",
                    )
                    return None
            else:
                frappe.log_error(
                    f"WhatsApp Media URL API Error: {response_data}",
                    "WhatsApp Media Error",
                )
                return None
        except Exception as e:
            frappe.log_error(
                f"WhatsApp Media Download Exception: {str(e)}", "WhatsApp Media Error"
            )
            return None

    def get_file_extension(self):
        """Get the file extension based on the media type"""
        if self.media_type == "Image":
            return "jpg"
        elif self.media_type == "Video":
            return "mp4"
        elif self.media_type == "Audio":
            return "mp3"
        elif self.media_type == "Document":
            return "pdf"
        elif self.media_type == "Sticker":
            return "webp"
        else:
            return "bin"


@frappe.whitelist()
def get_messages_for_ticket(ticket_name):
    """Get all social media messages for a ticket"""
    if not frappe.db.exists("HD Ticket", ticket_name):
        return []

    messages = frappe.get_all(
        "OD Social Media Message",
        filters={"reference_ticket": ticket_name},
        fields=["*"],
        order_by="timestamp asc",
    )

    return messages


@frappe.whitelist()
def get_messages_for_contact(contact_name):
    """Get all social media messages for a contact"""
    if not frappe.db.exists("Contact", contact_name):
        return []

    messages = frappe.get_all(
        "OD Social Media Message",
        filters={"reference_contact": contact_name},
        fields=["*"],
        order_by="timestamp asc",
    )

    return messages


@frappe.whitelist()
def send_whatsapp_message_from_ticket(
    ticket_name, message, template=None, template_params=None
):
    """Send a WhatsApp message from a ticket"""
    if not frappe.db.exists("HD Ticket", ticket_name):
        frappe.throw("Ticket not found")

    ticket = frappe.get_doc("HD Ticket", ticket_name)

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
        frappe.throw("No phone number found for the ticket contact")

    # Send the WhatsApp message
    if not frappe.db.exists("OD WhatsApp Integration", "OD WhatsApp Integration"):
        frappe.throw("WhatsApp integration is not configured")

    settings = frappe.get_doc("OD WhatsApp Integration", "OD WhatsApp Integration")
    response = settings.send_message(phone_number, message, template, template_params)

    if response:
        # Update the message with the ticket reference
        message_id = response.get("messages", [{}])[0].get("id", "")
        if message_id:
            message_doc = frappe.get_all(
                "OD Social Media Message",
                filters={"message_id": message_id},
                fields=["name"],
            )

            if message_doc:
                frappe.db.set_value(
                    "OD Social Media Message",
                    message_doc[0].name,
                    "reference_ticket",
                    ticket_name,
                )
                frappe.db.set_value(
                    "OD Social Media Message",
                    message_doc[0].name,
                    "reference_contact",
                    ticket.contact,
                )

        return response

    return None


def update_message_statuses():
    """Update the status of all outgoing WhatsApp messages (scheduled task)"""
    # Get all outgoing WhatsApp messages that are not in a final state
    messages = frappe.get_all(
        "OD Social Media Message",
        filters={
            "channel": "WhatsApp",
            "direction": "Outgoing",
            "status": ["in", ["Sent", "Delivered"]],
        },
        fields=["name"],
    )

    for message_data in messages:
        try:
            message = frappe.get_doc("OD Social Media Message", message_data.name)
            message.update_message_status()
        except Exception as e:
            frappe.log_error(
                f"Error updating WhatsApp message status: {str(e)}",
                "WhatsApp Message Status Error",
            )
