import frappe
from frappe import _
from frappe.utils import pretty_date
from on_desk.utils.whatsapp import get_whatsapp_integration


def get_contact_display_name(contact):
    """Get the display name of a contact, handling different Contact object structures"""
    # Try the get_display_name method first
    if hasattr(contact, "get_display_name") and callable(
        getattr(contact, "get_display_name")
    ):
        return contact.get_display_name()

    # If that doesn't work, try to construct a name from the available fields
    if hasattr(contact, "first_name"):
        name_parts = [contact.first_name]
        if hasattr(contact, "last_name") and contact.last_name:
            name_parts.append(contact.last_name)
        return " ".join(name_parts)

    # If we have a full_name field, use that
    if hasattr(contact, "full_name") and contact.full_name:
        return contact.full_name

    # Fall back to the name field
    return contact.name


@frappe.whitelist()
def get_conversations():
    """Get recent WhatsApp conversations"""
    # Get unique phone numbers from social media messages
    phone_numbers = frappe.db.sql(
        """
        SELECT
            DISTINCT from_number as phone
        FROM
            `tabOD Social Media Message`
        WHERE
            channel = 'WhatsApp'
            AND direction = 'Incoming'
        ORDER BY
            creation DESC
        LIMIT 10
    """,
        as_dict=True,
    )

    conversations = []

    for phone in phone_numbers:
        # Get the latest message for this phone number
        latest_message = frappe.get_all(
            "OD Social Media Message",
            filters={"channel": "WhatsApp", "from_number": phone.phone},
            fields=["message", "creation", "reference_contact"],
            order_by="creation desc",
            limit=1,
        )

        if not latest_message:
            continue

        # Get contact information if available
        contact_name = "Unknown"
        contact_image = None

        if latest_message[0].reference_contact:
            contact = frappe.get_doc("Contact", latest_message[0].reference_contact)
            contact_name = get_contact_display_name(contact)
        else:
            # Try to find a contact with this phone number
            contact_links = frappe.get_all(
                "Contact Phone", filters={"phone": phone.phone}, fields=["parent"]
            )

            if contact_links:
                contact = frappe.get_doc("Contact", contact_links[0].parent)
                contact_name = get_contact_display_name(contact)

        # Format the conversation
        conversations.append(
            {
                "name": contact_name,
                "phone": phone.phone,
                "image": contact_image,
                "last_message": (
                    latest_message[0].message[:50] + "..."
                    if len(latest_message[0].message) > 50
                    else latest_message[0].message
                ),
                "time": pretty_date(latest_message[0].creation),
                "status": "Online",  # Placeholder, in a real implementation this would be dynamic
            }
        )

    return conversations


@frappe.whitelist()
def get_conversation_messages(phone_number):
    """Get WhatsApp messages for a specific phone number"""
    if not phone_number:
        return []

    frappe.log_error(
        message=f"Getting messages for phone number: {phone_number}",
        title="WhatsApp Debug",
    )

    # Get messages for this phone number (both incoming and outgoing)
    messages = frappe.db.sql(
        """
        SELECT message, creation, direction, status, message_id
        FROM `tabOD Social Media Message`
        WHERE channel = 'WhatsApp'
        AND (from_number = %s OR to_number = %s)
        ORDER BY creation ASC
    """,
        (phone_number, phone_number),
        as_dict=1,
    )

    frappe.log_error(message=f"Found {len(messages)} messages", title="WhatsApp Debug")

    formatted_messages = []

    for message in messages:
        formatted_messages.append(
            {
                "message": message.message,
                "time": pretty_date(message.creation),
                "direction": message.direction,
                "status": message.status,
                "message_id": message.message_id,
            }
        )

    return formatted_messages


@frappe.whitelist()
def send_message(phone_number, message):
    """Send a WhatsApp message to a specific phone number"""
    import traceback
    import json
    import datetime

    # Log the function call with all parameters
    frappe.log_error(
        message=f"send_message called with: phone_number={phone_number}, message={message}",
        title="WhatsApp Debug",
    )

    # Check if parameters are valid
    if not phone_number or not message:
        error_msg = "Missing phone number or message"
        frappe.log_error(message=error_msg, title="WhatsApp Debug")
        return {"success": False, "error": error_msg}

    frappe.log_error(
        message=f"Sending message to {phone_number}: {message}", title="WhatsApp Debug"
    )

    try:
        # Check if WhatsApp integration is configured
        frappe.log_error(
            message="Checking WhatsApp integration configuration",
            title="WhatsApp Debug",
        )

        # Get WhatsApp integration settings
        settings = get_whatsapp_integration(throw_if_not_found=True)

        if not settings:
            error_msg = "WhatsApp integration not found"
            frappe.log_error(message=error_msg, title="WhatsApp Debug")
            return {"success": False, "error": error_msg}

        if not settings.enabled:
            error_msg = "WhatsApp integration is not enabled"
            frappe.log_error(message=error_msg, title="WhatsApp Debug")
            return {"success": False, "error": error_msg}

        # Log all settings (except sensitive data)
        settings_info = {
            "name": settings.name,
            "enabled": settings.enabled,
            "provider": settings.provider,
            "api_endpoint": settings.api_endpoint,
            "phone_number_id": settings.phone_number_id,
            "business_account_id": settings.business_account_id,
            "webhook_url": settings.webhook_url,
        }
        frappe.log_error(
            message=f"WhatsApp settings: {json.dumps(settings_info)}",
            title="WhatsApp Debug",
        )

        # Send the message
        frappe.log_error(
            message="Calling settings.send_message", title="WhatsApp Debug"
        )
        response = settings.send_message(phone_number, message)
        frappe.log_error(
            message=f"Send message response: {json.dumps(response) if response else 'None'}",
            title="WhatsApp Debug",
        )

        if response:
            message_id = response.get("messages", [{}])[0].get("id", "")
            frappe.log_error(
                message=f"Message sent with ID: {message_id}", title="WhatsApp Debug"
            )

            # Create a record in OD Social Media Message
            try:
                frappe.log_error(
                    message="Creating message record in database",
                    title="WhatsApp Debug",
                )
                msg = frappe.new_doc("OD Social Media Message")
                msg.channel = "WhatsApp"
                msg.direction = "Outgoing"
                msg.from_number = settings.phone_number
                msg.to_number = phone_number
                msg.message = message
                msg.message_id = message_id
                msg.status = "Sent"
                msg.insert(ignore_permissions=True)
                frappe.db.commit()

                # Prepare event data
                event_data = {
                    "message_id": message_id,
                    "from_number": settings.phone_number,
                    "to_number": phone_number,
                    "message": message,
                    "timestamp": int(datetime.datetime.now().timestamp()),
                    "direction": "Outgoing",
                }

                # Publish immediate realtime event for outgoing message
                frappe.publish_realtime(
                    "whatsapp_message_received_immediate", event_data
                )

                # Publish regular realtime event for outgoing message
                frappe.publish_realtime(
                    "whatsapp_message_received", event_data, after_commit=True
                )

                frappe.log_error(
                    message=f"Created message record: {msg.name} and published realtime events (immediate and after_commit)\nMessage ID: {message_id}\nTo: {phone_number}\nMessage: {message}",
                    title="WhatsApp Debug",
                )
            except Exception as e:
                error_trace = traceback.format_exc()
                frappe.log_error(
                    message=f"Failed to create message record: {str(e)}\n\nTraceback:\n{error_trace}",
                    title="WhatsApp Debug",
                )

            return {"success": True, "message_id": message_id}
        else:
            error_msg = "Failed to send message: No response from WhatsApp API"
            frappe.log_error(message=error_msg, title="WhatsApp Debug")
            return {"success": False, "error": error_msg}
    except frappe.exceptions.ValidationError as e:
        # This is a validation error from the WhatsApp integration
        error_trace = traceback.format_exc()
        error_message = str(e)

        # Check if this is an authentication error
        if (
            "401 Unauthorized" in error_message
            or "Authentication Failed" in error_message
        ):
            # This is an authentication error
            frappe.log_error(
                message=f"WhatsApp Authentication Error: {error_message}\n\nTraceback:\n{error_trace}",
                title="WhatsApp Authentication Error",
            )

            # Return a more user-friendly error message
            return {
                "success": False,
                "error": error_message,
                "auth_error": True,
                "help": "Please check your WhatsApp API key in the integration settings.",
            }
        else:
            # This is some other validation error
            frappe.log_error(
                message=f"WhatsApp Send Message Error: {error_message}\n\nTraceback:\n{error_trace}",
                title="WhatsApp API Error",
            )
            return {"success": False, "error": error_message}
    except Exception as e:
        # This is an unexpected error
        error_trace = traceback.format_exc()
        frappe.log_error(
            message=f"WhatsApp Send Message Error: {str(e)}\n\nTraceback:\n{error_trace}",
            title="WhatsApp API Error",
        )
        return {"success": False, "error": str(e)}


@frappe.whitelist()
def get_message_statuses(message_ids):
    """Get the status of multiple WhatsApp messages"""
    if not message_ids:
        return []

    # Convert string to list if needed
    if isinstance(message_ids, str):
        import json

        message_ids = json.loads(message_ids)

    # Get the messages
    messages = frappe.get_all(
        "OD Social Media Message",
        filters={"message_id": ["in", message_ids]},
        fields=["message_id", "status"],
    )

    # Update the status of each message from the WhatsApp API
    for message in messages:
        try:
            # Get the message document
            message_doc = frappe.get_doc(
                "OD Social Media Message", {"message_id": message.message_id}
            )

            # Update the status
            message_doc.update_message_status()

            # Refresh the status
            message.status = message_doc.status
        except Exception as e:
            frappe.log_error(
                message=f"WhatsApp Message Status Error: {str(e)}",
                title="WhatsApp API Error",
            )

    return messages


@frappe.whitelist()
def test_api():
    """Simple test function to check if the API is reachable"""
    frappe.log_error(
        message="test_api function was called successfully", title="WhatsApp Debug"
    )
    return {"success": True, "message": "API is reachable"}


@frappe.whitelist()
def create_conversation(phone_number, contact_name):
    """Create a new WhatsApp conversation"""
    if not phone_number or not contact_name:
        return {"success": False, "error": "Phone number and contact name are required"}

    try:
        # Check if a contact with this phone number already exists
        contact_links = frappe.get_all(
            "Contact Phone", filters={"phone": phone_number}, fields=["parent"]
        )

        if contact_links:
            # Contact already exists
            contact = frappe.get_doc("Contact", contact_links[0].parent)
            return {"success": True, "contact": contact.name}

        # Create a new contact
        contact = frappe.new_doc("Contact")
        contact.first_name = contact_name

        # Add phone
        contact.append("phone_nos", {"phone": phone_number, "is_primary_phone": 1})

        # Generate a placeholder email
        email = f"whatsapp_{phone_number.replace('+', '')}@example.com"
        contact.append("email_ids", {"email_id": email, "is_primary": 1})

        contact.insert(ignore_permissions=True)

        return {"success": True, "contact": contact.name}
    except Exception as e:
        frappe.log_error(
            message=f"WhatsApp Create Conversation Error: {str(e)}",
            title="WhatsApp API Error",
        )
        return {"success": False, "error": str(e)}
