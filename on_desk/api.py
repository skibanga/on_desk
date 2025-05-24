import frappe
from frappe import _
from frappe.utils import now_datetime, getdate, add_to_date, get_datetime
from frappe.utils.caching import redis_cache
import json


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


# Enhanced Filtering System API Functions


@frappe.whitelist()
def get_tickets_advanced(
    filters=None,
    search_text=None,
    sort_by=None,
    sort_order="desc",
    page=1,
    page_size=20,
):
    """
    Get tickets with advanced filtering, search, and pagination

    Args:
        filters (dict): Advanced filter criteria
        search_text (str): Text to search across multiple fields
        sort_by (str): Field to sort by
        sort_order (str): Sort order (asc/desc)
        page (int): Page number for pagination
        page_size (int): Number of records per page
    """
    try:
        # Parse filters if passed as string
        if isinstance(filters, str):
            filters = json.loads(filters) if filters else {}

        # Check if HD Ticket DocType exists
        if not frappe.db.exists("DocType", "HD Ticket"):
            return get_sample_tickets_advanced(
                filters, search_text, sort_by, sort_order, page, page_size
            )

        # Build base query conditions based on user role
        base_conditions = get_user_ticket_conditions()

        # Build advanced filter conditions
        filter_conditions = build_filter_conditions(filters)

        # Build search conditions
        search_conditions = build_search_conditions(search_text)

        # Combine all conditions
        all_conditions = base_conditions + filter_conditions + search_conditions

        # Build sort order
        order_by = build_sort_order(sort_by, sort_order)

        # Calculate pagination
        start = (int(page) - 1) * int(page_size)

        # Get tickets with all conditions
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
                "agent_group",
                "ticket_type",
                "_assign",
                "response_by",
                "resolution_by",
            ],
            filters=all_conditions,
            order_by=order_by,
            start=start,
            page_length=int(page_size),
        )

        # Get total count for pagination
        total_count = frappe.db.count("HD Ticket", filters=all_conditions)

        # Enhance ticket data
        enhanced_tickets = enhance_ticket_data(tickets)

        return {
            "success": True,
            "tickets": enhanced_tickets,
            "total_count": total_count,
            "page": int(page),
            "page_size": int(page_size),
            "total_pages": (total_count + int(page_size) - 1) // int(page_size),
        }

    except Exception as e:
        frappe.log_error(
            f"Error in get_tickets_advanced: {str(e)}", "Advanced Ticket Filter Error"
        )
        return {"success": False, "message": str(e), "tickets": [], "total_count": 0}


def get_user_ticket_conditions():
    """Get base filter conditions based on user role"""
    user_roles = frappe.get_roles(frappe.session.user)
    conditions = []

    if any(
        role in user_roles
        for role in ["Administrator", "System Manager", "Helpdesk Manager"]
    ):
        # Admins and managers can see all tickets - no additional conditions
        pass
    elif "Helpdesk Agent" in user_roles or "Agent" in user_roles:
        # Agents can see tickets assigned to them or their team
        agent_groups = []
        if frappe.db.exists("DocType", "HD Team Member"):
            agent_groups = frappe.get_all(
                "HD Team Member",
                filters={"user": frappe.session.user},
                fields=["parent"],
            )
        agent_group_names = [d.parent for d in agent_groups]

        if agent_group_names:
            conditions.append(["agent_group", "in", agent_group_names])
        else:
            conditions.append(["_assign", "like", f"%{frappe.session.user}%"])
    else:
        # Regular users can only see their own tickets
        conditions.append(["raised_by", "=", frappe.session.user])

    return conditions


def build_filter_conditions(filters):
    """Build filter conditions from advanced filter criteria"""
    conditions = []

    if not filters:
        return conditions

    # Status filter
    if filters.get("status") and filters["status"] != "All":
        if isinstance(filters["status"], list):
            conditions.append(["status", "in", filters["status"]])
        else:
            conditions.append(["status", "=", filters["status"]])

    # Priority filter
    if filters.get("priority") and filters["priority"] != "All":
        if isinstance(filters["priority"], list):
            conditions.append(["priority", "in", filters["priority"]])
        else:
            conditions.append(["priority", "=", filters["priority"]])

    # Agent Group filter
    if filters.get("agent_group") and filters["agent_group"] != "All":
        if isinstance(filters["agent_group"], list):
            conditions.append(["agent_group", "in", filters["agent_group"]])
        else:
            conditions.append(["agent_group", "=", filters["agent_group"]])

    # Ticket Type filter
    if filters.get("ticket_type") and filters["ticket_type"] != "All":
        if isinstance(filters["ticket_type"], list):
            conditions.append(["ticket_type", "in", filters["ticket_type"]])
        else:
            conditions.append(["ticket_type", "=", filters["ticket_type"]])

    # Customer filter
    if filters.get("customer") and filters["customer"] != "All":
        if isinstance(filters["customer"], list):
            conditions.append(["customer", "in", filters["customer"]])
        else:
            conditions.append(["customer", "=", filters["customer"]])

    # Assigned Agent filter
    if filters.get("assigned_agent") and filters["assigned_agent"] != "All":
        conditions.append(["_assign", "like", f"%{filters['assigned_agent']}%"])

    # Date range filters
    if filters.get("date_range"):
        date_range = filters["date_range"]
        if date_range.get("from_date"):
            conditions.append(["creation", ">=", getdate(date_range["from_date"])])
        if date_range.get("to_date"):
            conditions.append(["creation", "<=", getdate(date_range["to_date"])])

    # Modified date range filters
    if filters.get("modified_date_range"):
        date_range = filters["modified_date_range"]
        if date_range.get("from_date"):
            conditions.append(["modified", ">=", get_datetime(date_range["from_date"])])
        if date_range.get("to_date"):
            conditions.append(["modified", "<=", get_datetime(date_range["to_date"])])

    return conditions


def build_search_conditions(search_text):
    """Build search conditions for text search across multiple fields"""
    conditions = []

    if not search_text or not search_text.strip():
        return conditions

    search_text = search_text.strip()

    # Search across multiple fields using OR conditions
    search_fields = ["name", "subject", "raised_by", "customer"]

    # Build OR conditions for search
    or_conditions = []
    for field in search_fields:
        or_conditions.append([field, "like", f"%{search_text}%"])

    if or_conditions:
        conditions.append(or_conditions)

    return conditions


def build_sort_order(sort_by, sort_order):
    """Build sort order string"""
    if not sort_by:
        sort_by = "modified"

    if sort_order.lower() not in ["asc", "desc"]:
        sort_order = "desc"

    return f"{sort_by} {sort_order}"


def enhance_ticket_data(tickets):
    """Enhance ticket data with additional information"""
    try:
        from on_desk.www.on_desk.tickets.index import (
            pretty_date,
            get_status_color,
            get_priority_color,
        )
    except ImportError:
        # Fallback functions if import fails
        def pretty_date(date):
            return frappe.utils.pretty_date(date)

        def get_status_color(status):
            color_map = {
                "Open": "primary",
                "In Progress": "warning",
                "Resolved": "success",
                "Closed": "secondary",
                "On Hold": "info",
            }
            return color_map.get(status, "secondary")

        def get_priority_color(priority):
            color_map = {"High": "danger", "Medium": "warning", "Low": "success"}
            return color_map.get(priority, "secondary")

    for ticket in tickets:
        # Format dates
        ticket.creation_formatted = pretty_date(ticket.creation)
        ticket.modified_formatted = pretty_date(ticket.modified)

        # Get status and priority colors
        ticket.status_color = get_status_color(ticket.status)
        ticket.priority_color = get_priority_color(ticket.priority)

        # Get customer name if available
        if ticket.customer and frappe.db.exists("DocType", "HD Customer"):
            try:
                customer_doc = frappe.get_cached_doc("HD Customer", ticket.customer)
                ticket.customer_name = customer_doc.customer_name or customer_doc.name
            except:
                ticket.customer_name = ticket.raised_by
        else:
            ticket.customer_name = ticket.raised_by

        # Get assigned agent names
        if ticket._assign:
            try:
                assigned_users = json.loads(ticket._assign) if ticket._assign else []
                agent_names = []
                for user in assigned_users:
                    user_doc = frappe.get_cached_doc("User", user)
                    agent_names.append(user_doc.full_name or user)
                ticket.assigned_agents = ", ".join(agent_names)
            except:
                ticket.assigned_agents = ""
        else:
            ticket.assigned_agents = ""

    return tickets


def get_sample_tickets_advanced(
    filters, search_text, sort_by, sort_order, page, page_size
):
    """Return sample tickets for testing when HD Ticket DocType doesn't exist"""
    from frappe.utils import now, add_to_date

    sample_tickets = [
        {
            "name": "TICKET-001",
            "subject": "Login issue with email authentication",
            "status": "Open",
            "priority": "High",
            "creation": add_to_date(now(), days=-2),
            "modified": add_to_date(now(), hours=-1),
            "raised_by": frappe.session.user,
            "customer_name": frappe.session.user,
            "agent_group": "Technical Support",
            "ticket_type": "Technical",
            "_assign": "",
            "assigned_agents": "",
        },
        {
            "name": "TICKET-002",
            "subject": "Feature request for dashboard customization",
            "status": "In Progress",
            "priority": "Medium",
            "creation": add_to_date(now(), days=-5),
            "modified": add_to_date(now(), hours=-3),
            "raised_by": frappe.session.user,
            "customer_name": frappe.session.user,
            "agent_group": "Product Team",
            "ticket_type": "Feature Request",
            "_assign": "",
            "assigned_agents": "",
        },
        {
            "name": "TICKET-003",
            "subject": "Software installation request",
            "status": "Resolved",
            "priority": "Low",
            "creation": add_to_date(now(), days=-10),
            "modified": add_to_date(now(), days=-1),
            "raised_by": frappe.session.user,
            "customer_name": frappe.session.user,
            "agent_group": "IT Support",
            "ticket_type": "Request",
            "_assign": "",
            "assigned_agents": "",
        },
    ]

    # Apply search filter
    if search_text:
        filtered_tickets = []
        for ticket in sample_tickets:
            if (
                search_text.lower() in ticket["name"].lower()
                or search_text.lower() in ticket["subject"].lower()
            ):
                filtered_tickets.append(ticket)
        sample_tickets = filtered_tickets

    # Apply status filter
    if filters and filters.get("status") and filters["status"] != "All":
        sample_tickets = [t for t in sample_tickets if t["status"] == filters["status"]]

    # Enhance ticket data
    enhanced_tickets = enhance_ticket_data(sample_tickets)

    # Apply pagination
    start = (int(page) - 1) * int(page_size)
    end = start + int(page_size)
    paginated_tickets = enhanced_tickets[start:end]

    return {
        "success": True,
        "tickets": paginated_tickets,
        "total_count": len(enhanced_tickets),
        "page": int(page),
        "page_size": int(page_size),
        "total_pages": (len(enhanced_tickets) + int(page_size) - 1) // int(page_size),
    }


@frappe.whitelist()
def get_filter_options():
    """Get all available filter options for tickets"""
    try:
        options = {
            "statuses": get_ticket_statuses_for_filter(),
            "priorities": get_ticket_priorities_for_filter(),
            "agent_groups": get_agent_groups_for_filter(),
            "ticket_types": get_ticket_types_for_filter(),
            "customers": get_customers_for_filter(),
            "agents": get_agents_for_filter(),
        }
        return {"success": True, "options": options}
    except Exception as e:
        frappe.log_error(
            f"Error getting filter options: {str(e)}", "Filter Options Error"
        )
        return {"success": False, "message": str(e)}


def get_ticket_statuses_for_filter():
    """Get ticket statuses for filtering"""
    try:
        if frappe.db.exists("DocType", "HD Ticket"):
            # Get unique statuses from tickets
            statuses = frappe.db.sql(
                """
                SELECT DISTINCT status as name, status as label
                FROM `tabHD Ticket`
                WHERE status IS NOT NULL AND status != ''
                ORDER BY status
            """,
                as_dict=True,
            )
        else:
            # Default statuses
            statuses = [
                {"name": "Open", "label": "Open"},
                {"name": "In Progress", "label": "In Progress"},
                {"name": "Resolved", "label": "Resolved"},
                {"name": "Closed", "label": "Closed"},
                {"name": "On Hold", "label": "On Hold"},
            ]

        # Add "All" option at the beginning
        statuses.insert(0, {"name": "All", "label": "All Statuses"})
        return statuses
    except Exception:
        return [{"name": "All", "label": "All Statuses"}]


def get_ticket_priorities_for_filter():
    """Get ticket priorities for filtering"""
    try:
        if frappe.db.exists("DocType", "HD Ticket Priority"):
            priorities = frappe.get_all(
                "HD Ticket Priority",
                fields=["name", "name as label"],
                order_by="integer_value",
            )
        elif frappe.db.exists("DocType", "HD Ticket"):
            # Get unique priorities from tickets
            priorities = frappe.db.sql(
                """
                SELECT DISTINCT priority as name, priority as label
                FROM `tabHD Ticket`
                WHERE priority IS NOT NULL AND priority != ''
                ORDER BY priority
            """,
                as_dict=True,
            )
        else:
            # Default priorities
            priorities = [
                {"name": "High", "label": "High"},
                {"name": "Medium", "label": "Medium"},
                {"name": "Low", "label": "Low"},
            ]

        # Add "All" option at the beginning
        priorities.insert(0, {"name": "All", "label": "All Priorities"})
        return priorities
    except Exception:
        return [{"name": "All", "label": "All Priorities"}]


def get_agent_groups_for_filter():
    """Get agent groups for filtering"""
    try:
        if frappe.db.exists("DocType", "HD Team"):
            groups = frappe.get_all(
                "HD Team", fields=["name", "team_name as label"], order_by="team_name"
            )
        else:
            groups = []

        # Add "All" option at the beginning
        groups.insert(0, {"name": "All", "label": "All Teams"})
        return groups
    except Exception:
        return [{"name": "All", "label": "All Teams"}]


def get_ticket_types_for_filter():
    """Get ticket types for filtering"""
    try:
        if frappe.db.exists("DocType", "HD Ticket Type"):
            types = frappe.get_all(
                "HD Ticket Type", fields=["name", "name as label"], order_by="name"
            )
        else:
            types = []

        # Add "All" option at the beginning
        types.insert(0, {"name": "All", "label": "All Types"})
        return types
    except Exception:
        return [{"name": "All", "label": "All Types"}]


def get_customers_for_filter():
    """Get customers for filtering"""
    try:
        if frappe.db.exists("DocType", "HD Customer"):
            customers = frappe.get_all(
                "HD Customer",
                fields=["name", "customer_name as label"],
                order_by="customer_name",
                limit=100,  # Limit to avoid too many options
            )
        else:
            customers = []

        # Add "All" option at the beginning
        customers.insert(0, {"name": "All", "label": "All Customers"})
        return customers
    except Exception:
        return [{"name": "All", "label": "All Customers"}]


def get_agents_for_filter():
    """Get agents for filtering"""
    try:
        if frappe.db.exists("DocType", "HD Agent"):
            agents = frappe.get_all(
                "HD Agent",
                fields=["user as name", "agent_name as label"],
                filters={"is_active": 1},
                order_by="agent_name",
            )
        else:
            # Get users with Agent role
            agents = frappe.db.sql(
                """
                SELECT DISTINCT u.name, u.full_name as label
                FROM `tabUser` u
                INNER JOIN `tabHas Role` hr ON hr.parent = u.name
                WHERE hr.role = 'Agent' AND u.enabled = 1
                ORDER BY u.full_name
            """,
                as_dict=True,
            )

        # Add "All" option at the beginning
        agents.insert(0, {"name": "All", "label": "All Agents"})
        return agents
    except Exception:
        return [{"name": "All", "label": "All Agents"}]
