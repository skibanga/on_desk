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
    context.page_title = "Tickets"

    # Check if we should use advanced filtering
    use_advanced = frappe.form_dict.get("advanced", "0") == "1"

    if use_advanced:
        # Use new advanced filtering system
        context.use_advanced_filtering = True
        context.tickets = []  # Will be loaded via AJAX
        context.filter_options = get_filter_options_for_context()
    else:
        # Use legacy filtering for backward compatibility
        context.use_advanced_filtering = False

        # Get tickets
        context.tickets = get_tickets()

        # Get ticket statuses for filtering
        context.statuses = get_ticket_statuses()

        # Get ticket priorities for filtering
        context.priorities = get_ticket_priorities()

        # Default filters
        context.current_filter = frappe.form_dict.get("status", "All")

        # Apply filters if provided
        if context.current_filter != "All":
            context.tickets = [
                t for t in context.tickets if t.status == context.current_filter
            ]

        # Sort tickets by creation date (newest first)
        context.tickets.sort(key=lambda x: x.creation, reverse=True)

    return context


def get_filter_options_for_context():
    """Get filter options for the frontend context"""
    try:
        from on_desk.api import get_filter_options

        result = get_filter_options()
        if result.get("success"):
            return result.get("options", {})
        return {}
    except Exception:
        return {
            "statuses": [{"name": "All", "label": "All Statuses"}],
            "priorities": [{"name": "All", "label": "All Priorities"}],
            "agent_groups": [{"name": "All", "label": "All Teams"}],
            "ticket_types": [{"name": "All", "label": "All Types"}],
            "customers": [{"name": "All", "label": "All Customers"}],
            "agents": [{"name": "All", "label": "All Agents"}],
        }


def get_tickets():
    """Get tickets for the current user"""
    try:
        # Check if HD Ticket DocType exists
        if not frappe.db.exists("DocType", "HD Ticket"):
            # Return sample data if DocType doesn't exist
            return get_sample_tickets()

        user_roles = frappe.get_roles(frappe.session.user)

        # Different query based on user role
        if any(
            role in user_roles
            for role in ["Administrator", "System Manager", "Helpdesk Manager"]
        ):
            # Admins and managers can see all tickets
            tickets = frappe.get_all(
                "HD Ticket",
                fields=[
                    "name",
                    "subject",
                    "status",
                    "priority",
                    "creation",
                    "modified",
                    "raised_by",
                    "contact",
                    "customer",
                ],
                order_by="creation desc",
            )
        elif "Helpdesk Agent" in user_roles:
            # Agents can see tickets assigned to them or their team
            agent_groups = []
            if frappe.db.exists("DocType", "HD Agent Group Member"):
                agent_groups = frappe.get_all(
                    "HD Agent Group Member",
                    filters={"user": frappe.session.user},
                    fields=["parent"],
                )
            agent_group_names = [d.parent for d in agent_groups]

            if agent_group_names:
                tickets = frappe.get_all(
                    "HD Ticket",
                    filters=[
                        ["HD Ticket", "agent_group", "in", agent_group_names],
                        ["HD Ticket", "_assign", "like", f"%{frappe.session.user}%"],
                    ],
                    fields=[
                        "name",
                        "subject",
                        "status",
                        "priority",
                        "creation",
                        "modified",
                        "raised_by",
                        "contact",
                        "customer",
                    ],
                    order_by="creation desc",
                )
            else:
                tickets = frappe.get_all(
                    "HD Ticket",
                    filters=[
                        ["HD Ticket", "_assign", "like", f"%{frappe.session.user}%"],
                    ],
                    fields=[
                        "name",
                        "subject",
                        "status",
                        "priority",
                        "creation",
                        "modified",
                        "raised_by",
                        "contact",
                        "customer",
                    ],
                    order_by="creation desc",
                )
        else:
            # Regular users can only see their own tickets
            tickets = frappe.get_all(
                "HD Ticket",
                filters={"raised_by": frappe.session.user},
                fields=[
                    "name",
                    "subject",
                    "status",
                    "priority",
                    "creation",
                    "modified",
                    "raised_by",
                    "contact",
                    "customer",
                ],
                order_by="creation desc",
            )

        # Enhance ticket data
        for ticket in tickets:
            ticket.creation_formatted = pretty_date(ticket.creation)
            ticket.modified_formatted = pretty_date(ticket.modified)

            # Get status color
            ticket.status_color = get_status_color(ticket.status)

            # Get priority color
            ticket.priority_color = get_priority_color(ticket.priority)

            # Get customer name if available
            if ticket.customer and frappe.db.exists("DocType", "HD Customer"):
                try:
                    customer_doc = frappe.get_cached_doc("HD Customer", ticket.customer)
                    ticket.customer_name = customer_doc.name
                except:
                    ticket.customer_name = ticket.raised_by
            else:
                ticket.customer_name = ticket.raised_by

        return tickets
    except Exception as e:
        frappe.log_error(f"Error fetching tickets: {str(e)}")
        return get_sample_tickets()


def get_sample_tickets():
    """Return sample ticket data for demonstration"""
    import datetime
    from frappe.utils import add_to_date

    now = datetime.datetime.now()

    # Create sample tickets
    tickets = [
        {
            "name": "TICKET-001",
            "subject": "Network connectivity issue",
            "status": "Open",
            "priority": "High",
            "creation": add_to_date(now, days=-2),
            "modified": add_to_date(now, hours=-5),
            "raised_by": frappe.session.user,
            "customer_name": frappe.session.user,
        },
        {
            "name": "TICKET-002",
            "subject": "Email configuration problem",
            "status": "In Progress",
            "priority": "Medium",
            "creation": add_to_date(now, days=-5),
            "modified": add_to_date(now, hours=-12),
            "raised_by": frappe.session.user,
            "customer_name": frappe.session.user,
        },
        {
            "name": "TICKET-003",
            "subject": "Software installation request",
            "status": "Resolved",
            "priority": "Low",
            "creation": add_to_date(now, days=-10),
            "modified": add_to_date(now, days=-1),
            "raised_by": frappe.session.user,
            "customer_name": frappe.session.user,
        },
    ]

    # Add formatted dates and colors
    for ticket in tickets:
        ticket["creation_formatted"] = pretty_date(ticket["creation"])
        ticket["modified_formatted"] = pretty_date(ticket["modified"])
        ticket["status_color"] = get_status_color(ticket["status"])
        ticket["priority_color"] = get_priority_color(ticket["priority"])

    return tickets


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
