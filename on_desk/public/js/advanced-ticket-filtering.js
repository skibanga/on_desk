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
            btn.addEventListener('click', (e) => {
                this.applyQuickFilter(btn.dataset.filter, e.target);
            });
        });
    }

    async loadFilterOptions() {
        try {
            console.log('Loading filter options...');

            const response = await frappe.call({
                method: 'on_desk.api.get_filter_options'
            });

            console.log('Filter options response:', response);

            // Handle null/undefined response
            if (!response) {
                console.warn('Filter options response is null or undefined');
                this.useDefaultFilterOptions();
                return;
            }

            // Handle response without message property
            if (!response.hasOwnProperty('message')) {
                console.warn('Filter options response does not have message property:', response);
                this.useDefaultFilterOptions();
                return;
            }

            // Handle response with null message
            if (!response.message) {
                console.warn('Filter options response message is null:', response);
                this.useDefaultFilterOptions();
                return;
            }

            // Handle response without success property
            if (!response.message.hasOwnProperty('success')) {
                console.warn('Filter options response message does not have success property:', response.message);
                this.useDefaultFilterOptions();
                return;
            }

            if (response.message.success) {
                const options = response.message.options || {};
                this.populateFilterOptions(options);
            } else {
                console.warn('Filter options API returned success=false:', response.message);
                this.useDefaultFilterOptions();
            }
        } catch (error) {
            console.error('Error loading filter options:', error);
            console.error('Error stack:', error.stack);
            this.useDefaultFilterOptions();
        }
    }

    useDefaultFilterOptions() {
        console.log('Using default filter options');
        this.populateFilterOptions({
            statuses: [{ "name": "All", "label": "All Statuses" }],
            priorities: [{ "name": "All", "label": "All Priorities" }],
            agent_groups: [{ "name": "All", "label": "All Teams" }],
            ticket_types: [{ "name": "All", "label": "All Types" }],
            customers: [{ "name": "All", "label": "All Customers" }],
            agents: [{ "name": "All", "label": "All Agents" }],
        });
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
            const searchText = this.searchInput ? this.searchInput.value.trim() : '';
            const sortBy = this.sortBy ? this.sortBy.value : 'modified';
            const sortOrder = this.sortOrder ? this.sortOrder.value : 'desc';

            console.log('Making API call with:', {
                filters: JSON.stringify(filters),
                search_text: searchText,
                sort_by: sortBy,
                sort_order: sortOrder,
                page: this.currentPage,
                page_size: this.pageSize
            });

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

            console.log('API response:', response);

            // Handle different response structures
            if (!response) {
                console.warn('Response is null or undefined');
                this.showError('No response from server');
                return;
            }

            // Check if response has message property
            if (!response.hasOwnProperty('message')) {
                console.warn('Response does not have message property:', response);
                this.showError('Invalid response format from server');
                return;
            }

            // Check if message has success property
            if (!response.message || !response.message.hasOwnProperty('success')) {
                console.warn('Response message does not have success property:', response.message);
                this.showError('Invalid response format from server');
                return;
            }

            if (response.message.success) {
                const data = response.message;
                this.totalCount = data.total_count || 0;
                this.totalPages = data.total_pages || 1;
                this.renderTickets(data.tickets || []);
                this.renderPagination();
                this.updateResultsInfo();
            } else {
                const errorMessage = response.message.message || 'Failed to load tickets';
                this.showError(errorMessage);
            }
        } catch (error) {
            console.error('Error loading tickets:', error);
            console.error('Error stack:', error.stack);
            this.showError('Failed to load tickets: ' + (error.message || 'Unknown error'));
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

    applyQuickFilter(filterType, buttonElement = null) {
        // Update button states
        this.quickFilterBtns.forEach(btn => btn.classList.remove('active'));

        // Find the button that was clicked
        if (buttonElement) {
            buttonElement.classList.add('active');
        } else {
            // Find button by data-filter attribute
            const targetButton = document.querySelector(`[data-filter="${filterType}"]`);
            if (targetButton) {
                targetButton.classList.add('active');
            }
        }

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
                if (this.priorityFilter) {
                    this.priorityFilter.value = 'High';
                }
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

                if (response && response.message && response.message.success) {
                    frappe.show_alert({
                        message: `Filter preset "${presetName}" saved successfully`,
                        indicator: 'green'
                    });
                    this.loadFilterPresets(); // Reload presets
                } else {
                    const errorMessage = (response && response.message && response.message.message)
                        ? response.message.message
                        : 'Failed to save filter preset';
                    frappe.show_alert({
                        message: errorMessage,
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
            console.log('Loading filter presets...');

            const response = await frappe.call({
                method: 'on_desk.api.get_filter_presets'
            });

            console.log('Filter presets response:', response);

            // Handle null/undefined response
            if (!response) {
                console.warn('Filter presets response is null or undefined');
                this.renderFilterPresets([]);
                return;
            }

            // Handle response without message property
            if (!response.hasOwnProperty('message')) {
                console.warn('Filter presets response does not have message property:', response);
                this.renderFilterPresets([]);
                return;
            }

            // Handle response with null message
            if (!response.message) {
                console.warn('Filter presets response message is null:', response);
                this.renderFilterPresets([]);
                return;
            }

            // Handle response without success property
            if (!response.message.hasOwnProperty('success')) {
                console.warn('Filter presets response message does not have success property:', response.message);
                this.renderFilterPresets([]);
                return;
            }

            if (response.message.success) {
                this.renderFilterPresets(response.message.presets || []);
            } else {
                console.warn('Filter presets API returned success=false:', response.message);
                this.renderFilterPresets([]);
            }
        } catch (error) {
            console.error('Error loading filter presets:', error);
            console.error('Error stack:', error.stack);
            this.renderFilterPresets([]);
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

            if (response && response.message) {
                const preset = response.message;

                // Parse and apply filters
                let filters = {};
                try {
                    filters = JSON.parse(preset.filters || '{}');
                } catch (e) {
                    console.warn('Failed to parse preset filters:', e);
                    filters = {};
                }

                // Reset all filters first
                this.clearAllFilters();

                // Apply preset filters with null checks
                if (filters.status && this.statusFilter) this.statusFilter.value = filters.status;
                if (filters.priority && this.priorityFilter) this.priorityFilter.value = filters.priority;
                if (filters.agent_group && this.teamFilter) this.teamFilter.value = filters.agent_group;
                if (filters.ticket_type && this.typeFilter) this.typeFilter.value = filters.ticket_type;
                if (filters.customer && this.customerFilter) this.customerFilter.value = filters.customer;
                if (filters.assigned_agent && this.agentFilter) this.agentFilter.value = filters.assigned_agent;

                // Apply date range
                if (filters.date_range) {
                    if (filters.date_range.from_date && this.fromDateFilter) {
                        this.fromDateFilter.value = filters.date_range.from_date;
                    }
                    if (filters.date_range.to_date && this.toDateFilter) {
                        this.toDateFilter.value = filters.date_range.to_date;
                    }
                }

                // Apply search and sort
                if (preset.search_text && this.searchInput) this.searchInput.value = preset.search_text;
                if (preset.sort_by && this.sortBy) this.sortBy.value = preset.sort_by;
                if (preset.sort_order && this.sortOrder) this.sortOrder.value = preset.sort_order;

                // Load tickets with applied preset
                this.currentPage = 1;
                this.loadTickets();

                frappe.show_alert({
                    message: `Applied filter preset: ${preset.preset_name}`,
                    indicator: 'blue'
                });
            } else {
                frappe.show_alert({
                    message: 'Failed to load filter preset',
                    indicator: 'red'
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
