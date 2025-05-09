// On Desk Admin Panel JavaScript

document.addEventListener('DOMContentLoaded', function () {
    // Sidebar Toggle Functionality
    const sidebarToggle = document.querySelector('.navbar-toggler-humburger-icon');
    const navbar = document.querySelector('.navbar-vertical');
    const content = document.querySelector('.content');
    const overlay = document.querySelector('.sidebar-overlay');

    if (sidebarToggle && navbar && content) {
        sidebarToggle.addEventListener('click', function () {
            // For desktop: toggle collapsed state
            if (window.innerWidth >= 992) {
                navbar.classList.toggle('navbar-collapsed');

                // Save the state to localStorage
                const isCollapsed = navbar.classList.contains('navbar-collapsed');
                localStorage.setItem('sidebarCollapsed', isCollapsed);
            }
            // For mobile: toggle show state
            else {
                navbar.classList.toggle('show');
                document.body.classList.toggle('sidebar-open');

                if (overlay) {
                    if (navbar.classList.contains('show')) {
                        overlay.style.opacity = 1;
                        overlay.style.visibility = 'visible';
                    } else {
                        overlay.style.opacity = 0;
                        overlay.style.visibility = 'hidden';
                    }
                }
            }
        });

        // Check localStorage on page load (for desktop only)
        if (window.innerWidth >= 992) {
            const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
            if (isCollapsed) {
                navbar.classList.add('navbar-collapsed');
            }
        }
    }

    // Handle overlay click to close sidebar on mobile
    if (overlay) {
        overlay.addEventListener('click', function () {
            if (navbar && navbar.classList.contains('show')) {
                navbar.classList.remove('show');
                document.body.classList.remove('sidebar-open');
                overlay.style.opacity = 0;
                overlay.style.visibility = 'hidden';
            }
        });
    }

    // Set initial state for mobile
    if (window.innerWidth < 992) {
        if (navbar) {
            navbar.classList.remove('navbar-collapsed');
            navbar.classList.remove('show');
        }
        if (overlay) {
            overlay.style.opacity = 0;
            overlay.style.visibility = 'hidden';
        }
    }

    // Handle window resize
    window.addEventListener('resize', function () {
        if (window.innerWidth < 992) {
            // Mobile view
            if (navbar && navbar.classList.contains('show')) {
                navbar.classList.remove('show');
                document.body.classList.remove('sidebar-open');
                if (overlay) {
                    overlay.style.opacity = 0;
                    overlay.style.visibility = 'hidden';
                }
            }
        } else {
            // Desktop view
            if (navbar) {
                const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
                if (isCollapsed) {
                    navbar.classList.add('navbar-collapsed');
                } else {
                    navbar.classList.remove('navbar-collapsed');
                }
            }
            document.body.classList.remove('sidebar-open');
            if (overlay) {
                overlay.style.opacity = 0;
                overlay.style.visibility = 'hidden';
            }
        }
    });

    // Initialize Feather Icons
    if (typeof feather !== 'undefined') {
        feather.replace();
    }
});
