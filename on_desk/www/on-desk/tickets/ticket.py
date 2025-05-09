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
    context.current_page = "tickets"
    context.page_title = "Ticket Details"

    # Get ticket ID from URL
    ticket_id = frappe.form_dict.get("ticket_id")
    if not ticket_id:
        frappe.local.flags.redirect_location = "/on-desk/tickets"
        raise frappe.Redirect

    # Check if HD Ticket DocType exists
    if not frappe.db.exists("DocType", "HD Ticket"):
        # If the DocType doesn't exist, redirect to tickets list
        frappe.local.flags.redirect_location = "/on-desk/tickets"
        raise frappe.Redirect

    # Get ticket details
    try:
        context.ticket = get_ticket(ticket_id)
        context.page_title = f"Ticket #{ticket_id}"

        # Get ticket comments
        context.comments = get_ticket_comments(ticket_id)

        # Get ticket activities
        context.activities = get_ticket_activities(ticket_id)

        # Get available statuses for updating
        context.statuses = get_ticket_statuses()

        # Get available priorities for updating
        context.priorities = get_ticket_priorities()

        # Get agents for assignment
        context.agents = get_agents()

    except frappe.DoesNotExistError:
        frappe.local.flags.redirect_location = "/on-desk/tickets"
        raise frappe.Redirect
    except Exception as e:
        frappe.log_error(f"Error loading ticket {ticket_id}: {str(e)}")
        frappe.local.flags.redirect_location = "/on-desk/tickets"
        raise frappe.Redirect

    return context


def get_ticket(ticket_id):
    """Get ticket details"""
    ticket = frappe.get_doc("HD Ticket", ticket_id)

    # Check permissions
    user_roles = frappe.get_roles(frappe.session.user)
    is_admin_or_manager = any(
        role in user_roles
        for role in ["Administrator", "System Manager", "Helpdesk Manager"]
    )
    is_agent = "Helpdesk Agent" in user_roles

    if (
        not is_admin_or_manager
        and not is_agent
        and ticket.raised_by != frappe.session.user
    ):
        frappe.throw(_("You don't have permission to access this ticket"))

    # Format dates
    ticket.creation_formatted = pretty_date(ticket.creation)
    ticket.modified_formatted = pretty_date(ticket.modified)

    # Get status color
    ticket.status_color = get_status_color(ticket.status)

    # Get priority color
    ticket.priority_color = get_priority_color(ticket.priority)

    # Get customer details if available
    if ticket.customer:
        customer_doc = frappe.get_cached_doc("HD Customer", ticket.customer)
        ticket.customer_name = customer_doc.name
    else:
        ticket.customer_name = ticket.raised_by

    # Get assignees
    if ticket._assign:
        import json

        assignees = json.loads(ticket._assign)
        ticket.assignees = []
        for assignee in assignees:
            user_doc = frappe.get_cached_doc("User", assignee)
            ticket.assignees.append(
                {
                    "name": assignee,
                    "full_name": user_doc.full_name,
                    "image": user_doc.user_image or get_gravatar(user_doc.email),
                }
            )
    else:
        ticket.assignees = []

    return ticket


def get_ticket_comments(ticket_id):
    """Get comments for a ticket"""
    comments = frappe.get_all(
        "HD Ticket Comment",
        filters={"reference_ticket": ticket_id},
        fields=["name", "comment", "creation", "owner", "is_pinned"],
        order_by="creation",
    )

    for comment in comments:
        comment.creation_formatted = pretty_date(comment.creation)

        # Get user details
        user_doc = frappe.get_cached_doc("User", comment.owner)
        comment.user_full_name = user_doc.full_name
        comment.user_image = user_doc.user_image or get_gravatar(user_doc.email)

    return comments


def get_ticket_activities(ticket_id):
    """Get activity log for a ticket"""
    activities = frappe.get_all(
        "HD Ticket Activity",
        filters={"reference_ticket": ticket_id},
        fields=["name", "action", "creation", "owner", "description"],
        order_by="creation desc",
    )

    for activity in activities:
        activity.creation_formatted = pretty_date(activity.creation)

        # Get user details
        user_doc = frappe.get_cached_doc("User", activity.owner)
        activity.user_full_name = user_doc.full_name
        activity.user_image = user_doc.user_image or get_gravatar(user_doc.email)

    return activities


def get_status_color(status):
    """Get color class for ticket status"""
    status_colors = {
        "Open": "primary",
        "In Progress": "warning",
        "Resolved": "success",
        "Closed": "secondary",
        "On Hold": "info",
        "Reopened": "danger",
    }
    return status_colors.get(status, "secondary")


def get_priority_color(priority):
    """Get color class for ticket priority"""
    priority_colors = {
        "Low": "info",
        "Medium": "warning",
        "High": "danger",
        "Urgent": "danger",
    }
    return priority_colors.get(priority, "secondary")


def get_ticket_statuses():
    """Get all ticket statuses"""
    try:
        if frappe.db.exists("DocType", "HD Ticket Status"):
            statuses = frappe.get_all(
                "HD Ticket Status", fields=["name", "color"], order_by="name"
            )
            return statuses
        else:
            # Return default statuses if DocType doesn't exist
            return [
                {"name": "Open", "color": "blue"},
                {"name": "In Progress", "color": "orange"},
                {"name": "Resolved", "color": "green"},
                {"name": "Closed", "color": "gray"},
                {"name": "On Hold", "color": "yellow"},
            ]
    except Exception as e:
        frappe.log_error(f"Error fetching ticket statuses: {str(e)}")
        return [
            {"name": "Open", "color": "blue"},
            {"name": "In Progress", "color": "orange"},
            {"name": "Resolved", "color": "green"},
            {"name": "Closed", "color": "gray"},
        ]


def get_ticket_priorities():
    """Get all ticket priorities"""
    try:
        if frappe.db.exists("DocType", "HD Ticket Priority"):
            priorities = frappe.get_all(
                "HD Ticket Priority", fields=["name", "color"], order_by="name"
            )
            return priorities
        else:
            # Return default priorities if DocType doesn't exist
            return [
                {"name": "Low", "color": "blue"},
                {"name": "Medium", "color": "orange"},
                {"name": "High", "color": "red"},
                {"name": "Urgent", "color": "purple"},
            ]
    except Exception as e:
        frappe.log_error(f"Error fetching ticket priorities: {str(e)}")
        return [
            {"name": "Low", "color": "blue"},
            {"name": "Medium", "color": "orange"},
            {"name": "High", "color": "red"},
            {"name": "Urgent", "color": "purple"},
        ]


def get_agents():
    """Get all helpdesk agents"""
    agents = []
    agent_role = frappe.db.get_value("Role", {"name": "Helpdesk Agent"}, "name")

    if agent_role:
        agent_users = frappe.get_all(
            "Has Role",
            filters={"role": agent_role, "parenttype": "User"},
            fields=["parent"],
        )

        for agent in agent_users:
            user_doc = frappe.get_cached_doc("User", agent.parent)
            if user_doc.enabled:
                agents.append(
                    {
                        "name": user_doc.name,
                        "full_name": user_doc.full_name,
                        "image": user_doc.user_image or get_gravatar(user_doc.email),
                    }
                )

    return agents
