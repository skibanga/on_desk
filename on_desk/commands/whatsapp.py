# Copyright (c) 2023, Sydney Kibanga and contributors
# For license information, please see license.txt

import frappe
import click
from frappe.commands import pass_context

@click.command('setup-whatsapp')
@pass_context
def setup_whatsapp(context):
    """Setup WhatsApp integration for On Desk"""
    site = context.sites[0]
    frappe.init(site=site)
    frappe.connect()
    
    from on_desk.setup.whatsapp_integration import setup_whatsapp_integration
    setup_whatsapp_integration()
    
    frappe.db.commit()
    click.secho('WhatsApp integration setup completed successfully.', fg='green')

commands = [
    setup_whatsapp
]
