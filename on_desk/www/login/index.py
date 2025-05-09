import frappe
from frappe import _
from frappe.utils import cint, get_url
import datetime


def get_context(context):
    context.no_cache = 1

    # If user is already logged in, redirect to our custom admin panel
    if frappe.session.user != "Guest":
        frappe.local.flags.redirect_location = "/on-desk"
        raise frappe.Redirect

    # Set On Desk branding explicitly
    context.app_name = "ON DESK"
    context.app_logo = "/assets/on_desk/img/icons/logo1.png"

    # Get social login providers - fixed to avoid the error
    context.social_login = False
    providers = get_oauth_providers()
    if providers:
        context.social_login = True
        context.providers = providers

    # Get language settings
    context.language = frappe.local.lang
    context.languages = get_languages()

    # Get signup settings
    context.allow_signup = cint(frappe_get_website_settings("allow_signup") or 0)

    # Get redirect URL
    redirect_to = frappe.local.request.args.get("redirect-to")
    if redirect_to:
        context.redirect_to = redirect_to

    # Add current year for copyright
    context.now_year = datetime.datetime.now().year

    return context


def get_oauth_providers():
    """Get enabled OAuth providers list"""
    providers = []

    # Check if social login is enabled - fixed to avoid the error
    try:
        if not frappe.db.get_single_value("Website Settings", "enable_social_login"):
            return providers
    except:
        # If the field doesn't exist, just continue
        pass

    # Get providers from Social Login Keys
    try:
        provider_list = frappe.get_all(
            "Social Login Key",
            filters={"enable_social_login": 1},
            fields=[
                "name",
                "provider_name",
                "icon",
                "base_url",
                "client_id",
                "client_secret",
            ],
        )

        for provider in provider_list:
            if provider.client_id and provider.client_secret:
                providers.append(
                    {
                        "name": provider.name,
                        "provider_name": provider.provider_name,
                        "auth_url": get_url(
                            f"/api/method/frappe.integrations.oauth2_logins.login_via_{provider.name}"
                        ),
                        "icon": provider.icon or "fab fa-openid",
                        "color": get_provider_color(provider.name),
                        "text_color": get_provider_text_color(provider.name),
                    }
                )
    except:
        frappe.log_error("Error fetching OAuth providers")

    return providers


def get_languages():
    """Get list of languages for the language selector"""
    languages = []

    # Get languages from Language doctype
    try:
        lang_list = frappe.get_all(
            "Language", fields=["language_name", "language_code"]
        )

        for lang in lang_list:
            languages.append({"label": lang.language_name, "code": lang.language_code})
    except:
        pass

    # If no languages found, add default ones
    if not languages:
        languages = [
            {"label": "English", "code": "en"},
            {"label": "Español", "code": "es"},
            {"label": "Français", "code": "fr"},
            {"label": "Deutsch", "code": "de"},
            {"label": "Português", "code": "pt"},
        ]

    return languages


def frappe_get_website_settings(key):
    """Helper function to get website settings"""
    try:
        return frappe.db.get_single_value("Website Settings", key)
    except:
        return None


def get_provider_color(provider_name):
    """Get brand color for provider"""
    colors = {
        "google": "#ffffff",
        "github": "#24292e",
        "facebook": "#3b5998",
        "twitter": "#1da1f2",
        "microsoft": "#2f2f2f",
        "apple": "#000000",
        "linkedin": "#0077b5",
    }
    return colors.get(provider_name.lower(), "#f8f9fa")


def get_provider_text_color(provider_name):
    """Get text color for provider button"""
    dark_background = [
        "github",
        "facebook",
        "twitter",
        "microsoft",
        "apple",
        "linkedin",
    ]
    return "#ffffff" if provider_name.lower() in dark_background else "#333333"
