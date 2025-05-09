import frappe
from frappe import _
from frappe.utils import get_gravatar, pretty_date


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
            contact_name = contact.get_display_name()
        else:
            # Try to find a contact with this phone number
            contact_links = frappe.get_all(
                "Contact Phone", filters={"phone": phone.phone}, fields=["parent"]
            )

            if contact_links:
                contact = frappe.get_doc("Contact", contact_links[0].parent)
                contact_name = contact.get_display_name()

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

    # Get messages for this phone number
    messages = frappe.get_all(
        "OD Social Media Message",
        filters=[
            ["channel", "=", "WhatsApp"],
            ["from_number", "=", phone_number, "to_number", "=", phone_number],
        ],
        fields=["message", "creation", "direction", "status"],
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
            }
        )

    return formatted_messages
