/**
 * Advanced Ticket Filtering System
 * Provides enhanced filtering, search, and pagination for tickets
 */

class AdvancedTicketFilter {
    constructor() {
        this.currentFilters = {};
        this.currentPage = 1;
        this.pageSize = 20;
        this.totalPages = 1;
        this.totalCount = 0;
        this.isLoading = false;
        this.searchTimeout = null;

        this.initializeElements();
        this.bindEvents();
        this.loadFilterOptions();
        this.loadFilterPresets();
        this.loadTickets();
    }

    initializeElements() {
        // Filter elements
        this.searchInput = document.getElementById('searchInput');
        this.statusFilter = document.getElementById('statusFilter');
        this.priorityFilter = document.getElementById('priorityFilter');
        this.teamFilter = document.getElementById('teamFilter');
        this.typeFilter = document.getElementById('typeFilter');
        this.customerFilter = document.getElementById('customerFilter');
        this.agentFilter = document.getElementById('agentFilter');
        this.fromDateFilter = document.getElementById('fromDateFilter');
        this.toDateFilter = document.getElementById('toDateFilter');

        // Action buttons
        this.applyFiltersBtn = document.getElementById('applyFilters');
        this.clearFiltersBtn = document.getElementById('clearFilters');
        this.saveFiltersBtn = document.getElementById('saveFilters');

        // Sort controls
        this.sortBy = document.getElementById('sortBy');
        this.sortOrder = document.getElementById('sortOrder');

        // Results elements
        this.resultsCount = document.getElementById('resultsCount');
        this.ticketsContainer = document.getElementById('ticketsContainer');
        this.paginationContainer = document.getElementById('paginationContainer');

        // Quick filter buttons
        this.quickFilterBtns = document.querySelectorAll('.quick-filter-btn');
    }

    bindEvents() {
        // Search input with debounce
        this.searchInput.addEventListener('input', () => {
            clearTimeout(this.searchTimeout);
            this.searchTimeout = setTimeout(() => {
                this.currentPage = 1;
                this.loadTickets();
            }, 500);
        });

        // Filter change events
        [this.statusFilter, this.priorityFilter, this.teamFilter, this.typeFilter,
        this.customerFilter, this.agentFilter].forEach(filter => {
            filter.addEventListener('change', () => {
                this.currentPage = 1;
                this.loadTickets();
            });
        });

        // Date filters
        this.fromDateFilter.addEventListener('change', () => {
            this.currentPage = 1;
            this.loadTickets();
        });

        this.toDateFilter.addEventListener('change', () => {
            this.currentPage = 1;
            this.loadTickets();
        });

        // Sort controls
        this.sortBy.addEventListener('change', () => {
            this.currentPage = 1;
            this.loadTickets();
        });

        this.sortOrder.addEventListener('change', () => {
            this.currentPage = 1;
            this.loadTickets();
        });

        // Action buttons
        this.applyFiltersBtn.addEventListener('click', () => {
            this.currentPage = 1;
            this.loadTickets();
        });

        this.clearFiltersBtn.addEventListener('click', () => {
            this.clearAllFilters();
        });

        this.saveFiltersBtn.addEventListener('click', () => {
            this.saveFilterPreset();
        });

        // Quick filter buttons
        this.quickFilterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.applyQuickFilter(btn.dataset.filter);
            });
        });
    }

    async loadFilterOptions() {
        try {
            const response = await frappe.call({
                method: 'on_desk.api.get_filter_options'
            });

            if (response.message && response.message.success) {
                const options = response.message.options;
                this.populateFilterOptions(options);
            }
        } catch (error) {
            console.error('Error loading filter options:', error);
            this.showError('Failed to load filter options');
        }
    }

    populateFilterOptions(options) {
        // Populate status filter
        this.populateSelect(this.statusFilter, options.statuses || []);

        // Populate priority filter
        this.populateSelect(this.priorityFilter, options.priorities || []);

        // Populate team filter
        this.populateSelect(this.teamFilter, options.agent_groups || []);

        // Populate type filter
        this.populateSelect(this.typeFilter, options.ticket_types || []);

        // Populate customer filter
        this.populateSelect(this.customerFilter, options.customers || []);

        // Populate agent filter
        this.populateSelect(this.agentFilter, options.agents || []);
    }

    populateSelect(selectElement, options) {
        // Clear existing options except the first one
        while (selectElement.children.length > 1) {
            selectElement.removeChild(selectElement.lastChild);
        }

        // Add new options
        options.forEach(option => {
            if (option.name !== 'All') {
                const optionElement = document.createElement('option');
                optionElement.value = option.name;
                optionElement.textContent = option.label;
                selectElement.appendChild(optionElement);
            }
        });
    }

    buildFilters() {
        const filters = {};

        // Basic filters
        if (this.statusFilter.value !== 'All') {
            filters.status = this.statusFilter.value;
        }

        if (this.priorityFilter.value !== 'All') {
            filters.priority = this.priorityFilter.value;
        }

        if (this.teamFilter.value !== 'All') {
            filters.agent_group = this.teamFilter.value;
        }

        if (this.typeFilter.value !== 'All') {
            filters.ticket_type = this.typeFilter.value;
        }

        if (this.customerFilter.value !== 'All') {
            filters.customer = this.customerFilter.value;
        }

        if (this.agentFilter.value !== 'All') {
            filters.assigned_agent = this.agentFilter.value;
        }

        // Date range filters
        if (this.fromDateFilter.value || this.toDateFilter.value) {
            filters.date_range = {};
            if (this.fromDateFilter.value) {
                filters.date_range.from_date = this.fromDateFilter.value;
            }
            if (this.toDateFilter.value) {
                filters.date_range.to_date = this.toDateFilter.value;
            }
        }

        return filters;
    }

    async loadTickets() {
        if (this.isLoading) return;

        this.isLoading = true;
        this.showLoading();

        try {
            const filters = this.buildFilters();
            const searchText = this.searchInput.value.trim();
            const sortBy = this.sortBy.value;
            const sortOrder = this.sortOrder.value;

            const response = await frappe.call({
                method: 'on_desk.api.get_tickets_advanced',
                args: {
                    filters: JSON.stringify(filters),
                    search_text: searchText,
                    sort_by: sortBy,
                    sort_order: sortOrder,
                    page: this.currentPage,
                    page_size: this.pageSize
                }
            });

            if (response.message && response.message.success) {
                const data = response.message;
                this.totalCount = data.total_count;
                this.totalPages = data.total_pages;
                this.renderTickets(data.tickets);
                this.renderPagination();
                this.updateResultsInfo();
            } else {
                this.showError(response.message?.message || 'Failed to load tickets');
            }
        } catch (error) {
            console.error('Error loading tickets:', error);
            this.showError('Failed to load tickets');
        } finally {
            this.isLoading = false;
        }
    }

    renderTickets(tickets) {
        if (!tickets || tickets.length === 0) {
            this.showEmptyState();
            return;
        }

        const tableHTML = `
            <div class="table-responsive">
                <table class="tickets-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Subject</th>
                            <th>Status</th>
                            <th>Priority</th>
                            <th>Customer</th>
                            <th>Assigned</th>
                            <th>Created</th>
                            <th>Last Updated</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tickets.map(ticket => this.renderTicketRow(ticket)).join('')}
                    </tbody>
                </table>
            </div>
        `;

        this.ticketsContainer.innerHTML = tableHTML;
    }

    renderTicketRow(ticket) {
        return `
            <tr>
                <td><a href="/on-desk/tickets/${ticket.name}" class="ticket-link">${ticket.name}</a></td>
                <td><a href="/on-desk/tickets/${ticket.name}" class="ticket-link">${ticket.subject}</a></td>
                <td><span class="status-badge status-${ticket.status_color}">${ticket.status}</span></td>
                <td><span class="priority-badge status-${ticket.priority_color}">${ticket.priority}</span></td>
                <td>${ticket.customer_name || '-'}</td>
                <td>${ticket.assigned_agents || '-'}</td>
                <td>${ticket.creation_formatted}</td>
                <td>${ticket.modified_formatted}</td>
            </tr>
        `;
    }

    renderPagination() {
        if (this.totalPages <= 1) {
            this.paginationContainer.style.display = 'none';
            return;
        }

        this.paginationContainer.style.display = 'flex';

        let paginationHTML = '';

        // Previous button
        paginationHTML += `
            <button class="pagination-btn" ${this.currentPage === 1 ? 'disabled' : ''}
                    onclick="ticketFilter.goToPage(${this.currentPage - 1})">
                <i class="uil uil-angle-left"></i>
            </button>
        `;

        // Page numbers
        const startPage = Math.max(1, this.currentPage - 2);
        const endPage = Math.min(this.totalPages, this.currentPage + 2);

        if (startPage > 1) {
            paginationHTML += `<button class="pagination-btn" onclick="ticketFilter.goToPage(1)">1</button>`;
            if (startPage > 2) {
                paginationHTML += `<span style="color: #a0aec0;">...</span>`;
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            paginationHTML += `
                <button class="pagination-btn ${i === this.currentPage ? 'active' : ''}"
                        onclick="ticketFilter.goToPage(${i})">${i}</button>
            `;
        }

        if (endPage < this.totalPages) {
            if (endPage < this.totalPages - 1) {
                paginationHTML += `<span style="color: #a0aec0;">...</span>`;
            }
            paginationHTML += `<button class="pagination-btn" onclick="ticketFilter.goToPage(${this.totalPages})">${this.totalPages}</button>`;
        }

        // Next button
        paginationHTML += `
            <button class="pagination-btn" ${this.currentPage === this.totalPages ? 'disabled' : ''}
                    onclick="ticketFilter.goToPage(${this.currentPage + 1})">
                <i class="uil uil-angle-right"></i>
            </button>
        `;

        this.paginationContainer.innerHTML = paginationHTML;
    }

    goToPage(page) {
        if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
            this.currentPage = page;
            this.loadTickets();
        }
    }

    updateResultsInfo() {
        const start = (this.currentPage - 1) * this.pageSize + 1;
        const end = Math.min(this.currentPage * this.pageSize, this.totalCount);

        this.resultsCount.textContent = `Showing ${start}-${end} of ${this.totalCount} tickets`;
    }

    showLoading() {
        this.ticketsContainer.innerHTML = `
            <div class="loading">
                <div class="loading-spinner"></div>
                <p>Loading tickets...</p>
            </div>
        `;
    }

    showEmptyState() {
        this.ticketsContainer.innerHTML = `
            <div class="empty-state">
                <i class="uil uil-ticket"></i>
                <h3>No tickets found</h3>
                <p>No tickets match your current filter criteria.</p>
                <button class="btn btn-secondary" onclick="ticketFilter.clearAllFilters()">
                    Clear Filters
                </button>
            </div>
        `;
        this.paginationContainer.style.display = 'none';
    }

    showError(message) {
        this.ticketsContainer.innerHTML = `
            <div class="empty-state">
                <i class="uil uil-exclamation-triangle"></i>
                <h3>Error Loading Tickets</h3>
                <p>${message}</p>
                <button class="btn btn-primary" onclick="ticketFilter.loadTickets()">
                    Try Again
                </button>
            </div>
        `;
        this.paginationContainer.style.display = 'none';
    }

    clearAllFilters() {
        // Reset all filter controls
        this.searchInput.value = '';
        this.statusFilter.value = 'All';
        this.priorityFilter.value = 'All';
        this.teamFilter.value = 'All';
        this.typeFilter.value = 'All';
        this.customerFilter.value = 'All';
        this.agentFilter.value = 'All';
        this.fromDateFilter.value = '';
        this.toDateFilter.value = '';

        // Reset sort controls
        this.sortBy.value = 'modified';
        this.sortOrder.value = 'desc';

        // Reset pagination
        this.currentPage = 1;

        // Update quick filter buttons
        this.quickFilterBtns.forEach(btn => btn.classList.remove('active'));
        this.quickFilterBtns[0].classList.add('active'); // "All Tickets"

        // Reload tickets
        this.loadTickets();
    }

    applyQuickFilter(filterType) {
        // Update button states
        this.quickFilterBtns.forEach(btn => btn.classList.remove('active'));
        event.target.classList.add('active');

        // Clear existing filters
        this.clearAllFilters();

        // Apply quick filter
        switch (filterType) {
            case 'my-tickets':
                // This would need user context - implement based on your needs
                break;
            case 'unassigned':
                // Filter for unassigned tickets
                break;
            case 'overdue':
                // Filter for overdue tickets
                break;
            case 'high-priority':
                this.priorityFilter.value = 'High';
                break;
        }

        this.loadTickets();
    }

    async saveFilterPreset() {
        const presetName = prompt('Enter a name for this filter preset:');
        if (presetName && presetName.trim()) {
            try {
                const filters = this.buildFilters();

                const response = await frappe.call({
                    method: 'on_desk.api.save_filter_preset',
                    args: {
                        name: presetName.trim(),
                        filters: JSON.stringify(filters),
                        search_text: this.searchInput.value,
                        sort_by: this.sortBy.value,
                        sort_order: this.sortOrder.value
                    }
                });

                if (response.message && response.message.success) {
                    frappe.show_alert({
                        message: `Filter preset "${presetName}" saved successfully`,
                        indicator: 'green'
                    });
                    this.loadFilterPresets(); // Reload presets
                } else {
                    frappe.show_alert({
                        message: response.message?.message || 'Failed to save filter preset',
                        indicator: 'red'
                    });
                }
            } catch (error) {
                console.error('Error saving filter preset:', error);
                frappe.show_alert({
                    message: 'Failed to save filter preset',
                    indicator: 'red'
                });
            }
        }
    }

    async loadFilterPresets() {
        try {
            const response = await frappe.call({
                method: 'on_desk.api.get_filter_presets'
            });

            if (response.message && response.message.success) {
                this.renderFilterPresets(response.message.presets);
            }
        } catch (error) {
            console.error('Error loading filter presets:', error);
        }
    }

    renderFilterPresets(presets) {
        // Add preset dropdown to filter actions if not exists
        let presetDropdown = document.getElementById('presetDropdown');
        if (!presetDropdown && presets.length > 0) {
            const presetHTML = `
                <div class="filter-control" style="min-width: 200px;">
                    <label class="filter-label">Saved Presets</label>
                    <select id="presetDropdown" class="filter-select">
                        <option value="">Select a preset...</option>
                    </select>
                </div>
            `;

            // Insert before the filter actions
            const filterActions = document.querySelector('.filter-actions');
            filterActions.insertAdjacentHTML('beforebegin', presetHTML);

            presetDropdown = document.getElementById('presetDropdown');
            presetDropdown.addEventListener('change', (e) => {
                if (e.target.value) {
                    this.applyFilterPreset(e.target.value);
                }
            });
        }

        if (presetDropdown) {
            // Clear existing options except first
            while (presetDropdown.children.length > 1) {
                presetDropdown.removeChild(presetDropdown.lastChild);
            }

            // Add preset options
            presets.forEach(preset => {
                const option = document.createElement('option');
                option.value = preset.name;
                option.textContent = preset.preset_name;
                if (preset.is_default) {
                    option.textContent += ' (Default)';
                }
                presetDropdown.appendChild(option);
            });
        }
    }

    async applyFilterPreset(presetId) {
        try {
            const response = await frappe.call({
                method: 'frappe.client.get',
                args: {
                    doctype: 'OD Filter Preset',
                    name: presetId
                }
            });

            if (response.message) {
                const preset = response.message;

                // Parse and apply filters
                const filters = JSON.parse(preset.filters || '{}');

                // Reset all filters first
                this.clearAllFilters();

                // Apply preset filters
                if (filters.status) this.statusFilter.value = filters.status;
                if (filters.priority) this.priorityFilter.value = filters.priority;
                if (filters.agent_group) this.teamFilter.value = filters.agent_group;
                if (filters.ticket_type) this.typeFilter.value = filters.ticket_type;
                if (filters.customer) this.customerFilter.value = filters.customer;
                if (filters.assigned_agent) this.agentFilter.value = filters.assigned_agent;

                // Apply date range
                if (filters.date_range) {
                    if (filters.date_range.from_date) this.fromDateFilter.value = filters.date_range.from_date;
                    if (filters.date_range.to_date) this.toDateFilter.value = filters.date_range.to_date;
                }

                // Apply search and sort
                if (preset.search_text) this.searchInput.value = preset.search_text;
                if (preset.sort_by) this.sortBy.value = preset.sort_by;
                if (preset.sort_order) this.sortOrder.value = preset.sort_order;

                // Load tickets with applied preset
                this.currentPage = 1;
                this.loadTickets();

                frappe.show_alert({
                    message: `Applied filter preset: ${preset.preset_name}`,
                    indicator: 'blue'
                });
            }
        } catch (error) {
            console.error('Error applying filter preset:', error);
            frappe.show_alert({
                message: 'Failed to apply filter preset',
                indicator: 'red'
            });
        }
    }
}

// Initialize the advanced filtering system
function initializeAdvancedFiltering() {
    window.ticketFilter = new AdvancedTicketFilter();
}
