import frappe
from frappe import _
from frappe.utils import get_gravatar, pretty_date


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


def get_context(context):
    context.no_cache = 1

    # Check if user is logged in
    if frappe.session.user == "Guest":
        frappe.local.flags.redirect_location = "/login"
        raise frappe.Redirect

    # Get user information
    user = frappe.get_doc("User", frappe.session.user)
    context.user_full_name = user.full_name
    context.user_first_name = user.first_name or user.full_name.split(" ")[0]
    context.user_image = user.user_image or get_gravatar(user.email)

    # Get user role
    user_roles = frappe.get_roles(frappe.session.user)
    if "Administrator" in user_roles:
        context.user_role = "Administrator"
    elif "System Manager" in user_roles:
        context.user_role = "System Manager"
    elif "Helpdesk Manager" in user_roles:
        context.user_role = "Helpdesk Manager"
    elif "Helpdesk Agent" in user_roles:
        context.user_role = "Helpdesk Agent"
    else:
        context.user_role = "User"

    # Get app settings
    context.app_name = (
        frappe.db.get_single_value("Website Settings", "app_name") or "On Desk"
    )
    context.app_logo = "/assets/on_desk/img/icons/logo1.png"
    context.dark_mode = True

    # Set current page for sidebar highlighting
    context.current_page = "whatsapp"
    context.page_title = "WhatsApp Integration"

    # Get WhatsApp conversations
    context.conversations = get_whatsapp_conversations()

    # Get active conversation (first one by default)
    context.active_conversation = (
        context.conversations[0] if context.conversations else None
    )

    # Get messages for active conversation
    context.messages = get_whatsapp_messages(
        context.active_conversation.get("phone")
        if context.active_conversation
        else None
    )

    return context


def get_whatsapp_conversations():
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


def get_whatsapp_messages(phone_number):
    """Get WhatsApp messages for a specific phone number"""
    if not phone_number:
        return []

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
