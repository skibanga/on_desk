# Copyright (c) 2023, Sydney Kibanga and contributors
# For license information, please see license.txt

import frappe
import json
import requests
from frappe.model.document import Document
from frappe.utils import now
from on_desk.utils.whatsapp import get_whatsapp_integration


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
            settings = get_whatsapp_integration()

            if not settings or not settings.enabled:
                return

            # Only Meta provider supports message status check via API
            if settings.provider != "Meta":
                return

            # Prepare the API request
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {settings.get_password('api_key')}",
            }

            # Make the API request - use query parameter instead of path for message ID
            url = f"{settings.api_endpoint}/{settings.phone_number_id}/messages"
            params = {"id": self.message_id}
            response = requests.get(url, headers=headers, params=params)
            response_data = response.json()

            if response.status_code == 200:
                # Update the message status
                status = response_data.get("status", "")

                old_status = self.status

                if status == "delivered":
                    self.status = "Delivered"
                elif status == "read":
                    self.status = "Read"
                elif status == "failed":
                    self.status = "Failed"

                self.save()

                # If status changed, publish realtime update
                if old_status != self.status:
                    frappe.publish_realtime(
                        "whatsapp_message_status_update",
                        {
                            "message_id": self.message_id,
                            "status": self.status,
                            "from_number": self.from_number,
                            "to_number": self.to_number,
                        },
                    )

                return response_data
            else:
                # Truncate the error message to avoid "Value too big" errors
                error_msg = str(response_data)
                if len(error_msg) > 1000:
                    error_msg = error_msg[:997] + "..."

                frappe.log_error(
                    f"WhatsApp Message Status API Error: {error_msg}",
                    "WhatsApp API Error",
                )
                return None
        except Exception as e:
            # Truncate the error message to avoid "Value too big" errors
            error_msg = str(e)
            if len(error_msg) > 1000:
                error_msg = error_msg[:997] + "..."

            frappe.log_error(
                f"WhatsApp Message Status API Exception: {error_msg}",
                "WhatsApp API Error",
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
            settings = get_whatsapp_integration()

            if not settings or not settings.enabled:
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
    settings = get_whatsapp_integration(throw_if_not_found=True)
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
    # Get WhatsApp integration settings
    settings = get_whatsapp_integration()

    if not settings or not settings.enabled:
        return

    # Only Meta provider supports message status check via API
    if settings.provider != "Meta":
        return

    # Get all outgoing WhatsApp messages that are not in a final state
    # Limit to messages sent in the last 24 hours to avoid checking very old messages
    messages = frappe.get_all(
        "OD Social Media Message",
        filters={
            "channel": "WhatsApp",
            "direction": "Outgoing",
            "status": ["in", ["Sent", "Delivered"]],
            "creation": [">", frappe.utils.add_days(frappe.utils.now(), -1)],
        },
        fields=["name", "message_id"],
        limit=50,  # Process in batches to avoid overloading
    )

    if not messages:
        return

    # Prepare API request headers
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {settings.get_password('api_key')}",
    }

    # Process messages in batches
    for message_data in messages:
        try:
            # Make the API request - use query parameter instead of path for message ID
            url = f"{settings.api_endpoint}/{settings.phone_number_id}/messages"
            params = {"id": message_data.message_id}
            response = requests.get(url, headers=headers, params=params)

            if response.status_code == 200:
                response_data = response.json()
                status = response_data.get("status", "")

                # Update the message status
                if status in ["delivered", "read", "failed"]:
                    message = frappe.get_doc(
                        "OD Social Media Message", message_data.name
                    )
                    old_status = message.status

                    if status == "delivered" and message.status != "Delivered":
                        message.status = "Delivered"
                    elif status == "read" and message.status != "Read":
                        message.status = "Read"
                    elif status == "failed" and message.status != "Failed":
                        message.status = "Failed"

                    # Only save if status changed
                    if old_status != message.status:
                        message.save()

                        # Publish realtime update
                        frappe.publish_realtime(
                            "whatsapp_message_status_update",
                            {
                                "message_id": message.message_id,
                                "status": message.status,
                                "from_number": message.from_number,
                                "to_number": message.to_number,
                            },
                        )
            else:
                # Truncate the error message to avoid "Value too big" errors
                error_msg = str(response.text)
                if len(error_msg) > 1000:
                    error_msg = error_msg[:997] + "..."

                frappe.log_error(
                    f"WhatsApp Message Status API Error for message {message_data.message_id}: {error_msg}",
                    "WhatsApp API Error",
                )
        except Exception as e:
            # Truncate the error message to avoid "Value too big" errors
            error_msg = str(e)
            if len(error_msg) > 1000:
                error_msg = error_msg[:997] + "..."

            frappe.log_error(
                f"Error updating WhatsApp message status for message {message_data.message_id}: {error_msg}",
                "WhatsApp API Error",
            )
