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

    # Get messages for this phone number
    messages = frappe.get_all(
        "OD Social Media Message",
        filters=[
            ["channel", "=", "WhatsApp"],
            ["from_number", "=", phone_number],
            ["to_number", "=", phone_number],
        ],
        fields=["message", "creation", "direction", "status", "message_id"],
        order_by="creation asc",
    )

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
    if not phone_number or not message:
        return {"success": False, "error": "Phone number and message are required"}

    try:
        # Get WhatsApp integration settings
        settings = get_whatsapp_integration(throw_if_not_found=True)

        # Send the message
        response = settings.send_message(phone_number, message)

        if response:
            message_id = response.get("messages", [{}])[0].get("id", "")
            return {"success": True, "message_id": message_id}
        else:
            return {"success": False, "error": "Failed to send message"}
    except Exception as e:
        frappe.log_error(f"WhatsApp Send Message Error: {str(e)}", "WhatsApp API Error")
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
                f"WhatsApp Message Status Error: {str(e)}", "WhatsApp API Error"
            )

    return messages


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
            f"WhatsApp Create Conversation Error: {str(e)}", "WhatsApp API Error"
        )
        return {"success": False, "error": str(e)}
