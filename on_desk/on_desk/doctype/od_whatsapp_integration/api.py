# Copyright (c) 2023, Sydney Kibanga and contributors
# For license information, please see license.txt

import frappe
import json
import hmac
import hashlib
from frappe import _
from frappe.utils import get_datetime, now
from on_desk.utils.whatsapp import get_whatsapp_integration


@frappe.whitelist(allow_guest=True)
def webhook():
    """Handle WhatsApp webhook requests"""
    if frappe.request.method == "GET":
        return handle_verification()
    elif frappe.request.method == "POST":
        return handle_incoming_message()
    else:
        frappe.throw(_("Method not allowed"), frappe.PermissionError)


def handle_verification():
    """Handle webhook verification from Meta"""
    try:
        # Get the WhatsApp integration settings
        settings = get_whatsapp_integration(throw_if_not_found=True)

        # Get query parameters
        mode = frappe.form_dict.get("hub.mode")
        token = frappe.form_dict.get("hub.verify_token")
        challenge = frappe.form_dict.get("hub.challenge")

        # Verify the token
        if mode == "subscribe" and token == settings.webhook_verify_token:
            frappe.response["message"] = challenge
            return

        frappe.throw(_("Verification failed"))
    except Exception as e:
        frappe.log_error(
            f"WhatsApp Webhook Verification Error: {str(e)}", "WhatsApp Webhook Error"
        )
        frappe.throw(_("Verification failed"))


def handle_incoming_message():
    """Handle incoming WhatsApp messages"""
    try:
        # Get the WhatsApp integration settings
        settings = get_whatsapp_integration(throw_if_not_found=True)

        # Get the request data
        data = json.loads(frappe.request.data)

        # Verify the request signature if using Meta
        if settings.provider == "Meta":
            verify_meta_signature(settings)

        # Process the message
        process_incoming_message(data, settings)

        frappe.response["message"] = "OK"
        return
    except Exception as e:
        frappe.log_error(
            f"WhatsApp Webhook Error: {str(e)}\nData: {frappe.request.data}",
            "WhatsApp Webhook Error",
        )
        frappe.throw(_("Error processing webhook"))


def verify_meta_signature(settings):
    """Verify the signature of the webhook request from Meta"""
    signature = frappe.request.headers.get("X-Hub-Signature-256", "")

    if not signature:
        frappe.throw(_("Missing signature"))

    # Get the API secret
    api_secret = settings.get_password("api_secret")

    # Calculate the expected signature
    expected_signature = (
        "sha256="
        + hmac.new(
            api_secret.encode("utf-8"), frappe.request.data, hashlib.sha256
        ).hexdigest()
    )

    # Compare signatures
    if not hmac.compare_digest(signature, expected_signature):
        frappe.throw(_("Invalid signature"))


def process_incoming_message(data, settings):
    """Process an incoming WhatsApp message"""
    # Check if this is a WhatsApp message
    if "object" not in data or data["object"] != "whatsapp_business_account":
        return

    # Process each entry
    for entry in data.get("entry", []):
        for change in entry.get("changes", []):
            if change.get("field") != "messages":
                continue

            value = change.get("value", {})

            # Process each message
            for message in value.get("messages", []):
                process_message(message, value, settings)


def process_message(message, value, settings):
    """Process a single WhatsApp message"""
    # Get message details
    message_id = message.get("id")
    from_number = message.get("from")
    timestamp = message.get("timestamp")

    # Check message type
    if message.get("type") == "text":
        text = message.get("text", {}).get("body", "")
        create_social_media_message(message_id, from_number, text, timestamp, value)
        create_or_update_ticket(from_number, text, message_id)
    elif message.get("type") == "image":
        # Handle image messages
        image_id = message.get("image", {}).get("id")
        caption = message.get("image", {}).get("caption", "")
        create_social_media_message(
            message_id,
            from_number,
            caption,
            timestamp,
            value,
            media_type="image",
            media_id=image_id,
        )
        create_or_update_ticket(
            from_number, caption, message_id, media_type="image", media_id=image_id
        )
    # Add more message types as needed


def create_social_media_message(
    message_id, from_number, text, timestamp, value, media_type=None, media_id=None
):
    """Create a record of the incoming social media message"""
    # Check if message already exists
    if frappe.db.exists("OD Social Media Message", {"message_id": message_id}):
        return

    # Create new message record
    message_doc = frappe.new_doc("OD Social Media Message")
    message_doc.channel = "WhatsApp"
    message_doc.direction = "Incoming"
    message_doc.message_id = message_id
    message_doc.from_number = from_number
    message_doc.message = text
    message_doc.timestamp = get_datetime.fromtimestamp(int(timestamp))
    message_doc.status = "Received"
    message_doc.raw_response = json.dumps(value)

    if media_type:
        message_doc.media_type = media_type
        message_doc.media_id = media_id

    message_doc.insert(ignore_permissions=True)

    # Publish realtime event for incoming message
    frappe.publish_realtime(
        "whatsapp_message_received",
        {
            "message_id": message_id,
            "from_number": from_number,
            "message": text,
            "timestamp": timestamp,
        },
    )

    return message_doc.name


def create_or_update_ticket(
    from_number, text, message_id, media_type=None, media_id=None
):
    """Create a new ticket or update an existing one based on the WhatsApp message"""
    # Look for an existing open ticket for this phone number
    existing_ticket = find_existing_ticket(from_number)

    if existing_ticket:
        # Update the existing ticket with the new message
        update_ticket_with_message(
            existing_ticket, text, from_number, message_id, media_type, media_id
        )
    else:
        # Create a new ticket
        create_ticket_from_message(text, from_number, message_id, media_type, media_id)


def find_existing_ticket(phone_number):
    """Find an existing open ticket for the given phone number"""
    # Look for tickets with WhatsApp communication from this number
    tickets = frappe.get_all(
        "HD Ticket",
        filters={
            "status": ["not in", ["Closed", "Resolved"]],
            "raised_by_phone": phone_number,
        },
        order_by="creation desc",
        limit=1,
    )

    if tickets:
        return frappe.get_doc("HD Ticket", tickets[0].name)

    return None


def update_ticket_with_message(
    ticket, text, from_number, message_id, media_type=None, media_id=None
):
    """Update an existing ticket with a new WhatsApp message"""
    # Add a comment to the ticket with the WhatsApp message
    comment = frappe.new_doc("HD Ticket Comment")
    comment.commented_by = "Guest"  # Or link to the contact if available
    comment.content = f"WhatsApp message: {text}"
    comment.is_pinned = False
    comment.reference_ticket = ticket.name
    comment.communication_channel = "WhatsApp"
    comment.message_id = message_id

    if media_type:
        comment.has_attachment = 1
        # Handle media attachment

    comment.save(ignore_permissions=True)

    # Update the ticket status if needed
    if ticket.status == "Waiting for Customer":
        ticket.status = "Open"
        ticket.save(ignore_permissions=True)


def create_ticket_from_message(
    text, from_number, message_id, media_type=None, media_id=None
):
    """Create a new ticket from a WhatsApp message"""
    # Create a new ticket
    ticket = frappe.new_doc("HD Ticket")
    ticket.subject = (
        f"WhatsApp: {text[:50]}..." if len(text) > 50 else f"WhatsApp: {text}"
    )
    ticket.description = text
    ticket.raised_by_phone = from_number
    ticket.via_customer_portal = 1
    ticket.communication_channel = "WhatsApp"

    # Try to find a contact with this phone number
    contact = find_or_create_contact(from_number)
    if contact:
        ticket.contact = contact.name
        ticket.raised_by = contact.email_id

    ticket.insert(ignore_permissions=True)

    # Add the initial comment
    comment = frappe.new_doc("HD Ticket Comment")
    comment.commented_by = "Guest"  # Or link to the contact if available
    comment.content = f"WhatsApp message: {text}"
    comment.is_pinned = False
    comment.reference_ticket = ticket.name
    comment.communication_channel = "WhatsApp"
    comment.message_id = message_id

    if media_type:
        comment.has_attachment = 1
        # Handle media attachment

    comment.save(ignore_permissions=True)

    return ticket


def find_or_create_contact(phone_number):
    """Find an existing contact or create a new one for the given phone number"""
    # Look for an existing contact with this phone number
    contacts = frappe.get_all(
        "Contact Phone", filters={"phone": phone_number}, fields=["parent"]
    )

    if contacts:
        return frappe.get_doc("Contact", contacts[0].parent)

    # Create a new contact
    contact = frappe.new_doc("Contact")
    contact.first_name = f"WhatsApp User {phone_number[-4:]}"

    # Add phone
    contact.append("phone_nos", {"phone": phone_number, "is_primary_phone": 1})

    # Generate a placeholder email
    email = f"whatsapp_{phone_number.replace('+', '')}@example.com"
    contact.append("email_ids", {"email_id": email, "is_primary": 1})

    contact.insert(ignore_permissions=True)
    return contact


def process_ticket_creation(doc, method):
    """Process ticket creation for WhatsApp notification"""
    # Get WhatsApp integration settings
    settings = get_whatsapp_integration()

    if not settings or not settings.enabled:
        return

    # Only send notification if the ticket was not created via WhatsApp
    if doc.communication_channel == "WhatsApp":
        return

    # Import here to avoid circular import
    from on_desk.setup.whatsapp_integration import send_whatsapp_notification

    # Send WhatsApp notification
    send_whatsapp_notification(doc, "ticket_created")


def process_ticket_update(doc, method):
    """Process ticket update for WhatsApp notification"""
    # Get WhatsApp integration settings
    settings = get_whatsapp_integration()

    if not settings or not settings.enabled:
        return

    # Get the old document
    old_doc = frappe.get_cached_doc("HD Ticket", doc.name)

    # Check if status has changed
    if old_doc.status != doc.status:
        # Import here to avoid circular import
        from on_desk.setup.whatsapp_integration import send_whatsapp_notification

        # Send different notifications based on status
        if doc.status == "Resolved":
            send_whatsapp_notification(doc, "ticket_resolved")
        else:
            send_whatsapp_notification(doc, "ticket_updated")


def process_pending_messages():
    """Process any pending WhatsApp messages (scheduled task)"""
    # This function can be used to retry failed messages or process queued messages
    pass
