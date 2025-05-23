import frappe
from frappe import _
from frappe.utils import now_datetime


@frappe.whitelist(allow_guest=True)
def create_ticket(**kwargs):
    """Create a new ticket in the system."""
    # Extract parameters from kwargs or form_dict
    subject = kwargs.get("subject") or frappe.form_dict.get("subject")
    description = kwargs.get("description") or frappe.form_dict.get("description")
    ticket_type = kwargs.get("ticket_type") or frappe.form_dict.get("ticket_type")
    priority = kwargs.get("priority") or frappe.form_dict.get("priority")
    customer = kwargs.get("customer") or frappe.form_dict.get("customer")
    agent_group = kwargs.get("agent_group") or frappe.form_dict.get("agent_group")
    redirect_to = kwargs.get("redirect_to") or frappe.form_dict.get("redirect_to")

    # Log the received parameters
    frappe.logger().debug(f"Received parameters: {frappe.as_json(kwargs)}")
    frappe.logger().debug(f"Form dict: {frappe.as_json(frappe.form_dict)}")

    # Validate required parameters
    if not subject or not description or not ticket_type or not priority:
        frappe.logger().error("Missing required parameters")
        return {
            "success": False,
            "message": "Missing required parameters: subject, description, ticket_type, and priority are required",
        }

    try:
        # Log the incoming data for debugging
        frappe.logger().debug(
            f"Creating ticket with: subject={subject}, type={ticket_type}, priority={priority}"
        )

        # Check if we have the HD Ticket doctype
        if frappe.db.exists("DocType", "HD Ticket"):
            # Create a new ticket
            ticket = frappe.new_doc("HD Ticket")

            # Set basic ticket information
            ticket.subject = subject
            ticket.description = description
            ticket.ticket_type = ticket_type
            ticket.priority = priority
            ticket.status = "Open"
            ticket.raised_by = frappe.session.user

            # Set optional fields if provided
            if customer:
                ticket.customer = customer

            if agent_group:
                ticket.agent_group = agent_group

            # Save the ticket
            ticket.insert(ignore_permissions=False)

            # Create a sample activity log
            create_ticket_activity(
                ticket.name,
                "Ticket Created",
                f"Ticket was created by {frappe.session.user}",
            )

            # Return the ticket data
            result = {
                "success": True,
                "name": ticket.name,
                "message": _("Ticket created successfully"),
            }

            # Handle redirect if provided
            if redirect_to:
                frappe.local.response["type"] = "redirect"
                frappe.local.response["location"] = redirect_to

            return result
        else:
            # Fallback to creating a simple ToDo item if HD Ticket doesn't exist
            frappe.logger().info("HD Ticket doctype not found, creating a ToDo instead")

            todo = frappe.new_doc("ToDo")
            todo.description = f"{subject}\n\n{description}"
            todo.priority = priority.lower() if priority else "medium"
            todo.status = "Open"
            todo.allocated_to = frappe.session.user
            todo.reference_type = "Ticket"
            todo.reference_name = (
                f"TICKET-{frappe.utils.now_datetime().strftime('%Y%m%d%H%M%S')}"
            )

            todo.insert(ignore_permissions=False)

            result = {
                "success": True,
                "name": todo.name,
                "message": _("Ticket created as ToDo item"),
                "is_todo": True,
            }

            # Handle redirect if provided
            if redirect_to:
                frappe.local.response["type"] = "redirect"
                frappe.local.response["location"] = redirect_to

            return result
    except Exception as e:
        frappe.logger().error(f"Error creating ticket: {str(e)}")
        result = {"success": False, "message": str(e)}

        # Handle redirect if provided
        if redirect_to:
            # Add error message to session
            frappe.local.response["type"] = "redirect"
            frappe.local.response["location"] = redirect_to
            frappe.msgprint(
                _("Failed to create ticket: {0}").format(str(e)),
                indicator="red",
                alert=True,
            )

        return result


@frappe.whitelist()
def update_ticket(ticket, status=None, priority=None):
    """Update an existing ticket."""
    try:
        if not frappe.has_permission("HD Ticket", "write"):
            frappe.throw(_("You don't have permission to update tickets"))

        ticket_doc = frappe.get_doc("HD Ticket", ticket)

        # Update status if provided
        if status and ticket_doc.status != status:
            old_status = ticket_doc.status
            ticket_doc.status = status
            create_ticket_activity(
                ticket,
                "Status Updated",
                f"Status changed from {old_status} to {status}",
            )

        # Update priority if provided
        if priority and ticket_doc.priority != priority:
            old_priority = ticket_doc.priority
            ticket_doc.priority = priority
            create_ticket_activity(
                ticket,
                "Priority Updated",
                f"Priority changed from {old_priority} to {priority}",
            )

        # Save the changes
        ticket_doc.save(ignore_permissions=False)

        return {"success": True, "message": _("Ticket updated successfully")}
    except Exception as e:
        frappe.log_error(f"Error updating ticket: {str(e)}", "Ticket Update Error")
        return {"success": False, "message": str(e)}


@frappe.whitelist()
def assign_ticket(ticket, user):
    """Assign a ticket to a user."""
    try:
        if not frappe.has_permission("HD Ticket", "write"):
            frappe.throw(_("You don't have permission to assign tickets"))

        # Check if the user exists
        if not frappe.db.exists("User", user):
            frappe.throw(_("User {0} does not exist").format(user))

        # Get the ticket
        ticket_doc = frappe.get_doc("HD Ticket", ticket)

        # Add the assignment
        ticket_doc.add_comment("Assigned", f"Assigned to {user}")

        # Use Frappe's assignment functionality
        from frappe.desk.form.assign_to import add

        add(
            {
                "assign_to": user,
                "doctype": "HD Ticket",
                "name": ticket,
                "description": f"Ticket {ticket} assigned",
            }
        )

        create_ticket_activity(ticket, "Assignment", f"Ticket assigned to {user}")

        return {"success": True, "message": _("Ticket assigned successfully")}
    except Exception as e:
        frappe.log_error(f"Error assigning ticket: {str(e)}", "Ticket Assignment Error")
        return {"success": False, "message": str(e)}


@frappe.whitelist()
def add_comment(ticket, comment):
    """Add a comment to a ticket."""
    try:
        if not frappe.has_permission("HD Ticket", "write"):
            frappe.throw(_("You don't have permission to comment on tickets"))

        # Get the ticket
        ticket_doc = frappe.get_doc("HD Ticket", ticket)

        # Add the comment
        ticket_doc.add_comment("Comment", comment)

        # Create a comment record
        comment_doc = frappe.new_doc("HD Ticket Comment")
        comment_doc.reference_ticket = ticket
        comment_doc.comment = comment
        comment_doc.is_pinned = 0
        comment_doc.insert(ignore_permissions=False)

        create_ticket_activity(
            ticket, "Comment Added", f"Comment added by {frappe.session.user}"
        )

        return {
            "success": True,
            "message": _("Comment added successfully"),
            "comment_id": comment_doc.name,
        }
    except Exception as e:
        frappe.log_error(f"Error adding comment: {str(e)}", "Ticket Comment Error")
        return {"success": False, "message": str(e)}


def create_ticket_activity(ticket, action, description):
    """Create an activity log entry for a ticket."""
    try:
        # Check if the HD Ticket Activity doctype exists
        if frappe.db.exists("DocType", "HD Ticket Activity"):
            activity = frappe.new_doc("HD Ticket Activity")
            activity.reference_ticket = ticket
            activity.action = action
            activity.description = description
            activity.insert(ignore_permissions=True)
        else:
            # Fallback to creating a Comment
            frappe.get_doc(
                {
                    "doctype": "Comment",
                    "comment_type": "Info",
                    "reference_doctype": "ToDo",
                    "reference_name": ticket,
                    "content": f"{action}: {description}",
                }
            ).insert(ignore_permissions=True)
    except Exception as e:
        frappe.logger().error(f"Error creating activity log: {str(e)}")
