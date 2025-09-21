class DebtTracker {
    constructor() {
        this.debtors = this.loadFromStorage();
        this.filteredDebtors = [...this.debtors];
        this.editingId = null;
        this.autoSaveTimer = null;
        this.lastSaveTime = Date.now();
        this.searchTerm = '';
        this.initializeEventListeners();
        this.renderDebtors();
        this.updateTotal();
        this.startAutoSaveMonitoring();
    }

    // Load data from localStorage
    loadFromStorage() {
        const saved = localStorage.getItem('dzair-debtors');
        return saved ? JSON.parse(saved) : [];
    }

    // Save data to localStorage with auto-save indicator
    saveToStorage() {
        localStorage.setItem('dzair-debtors', JSON.stringify(this.debtors));
        localStorage.setItem('dzair-debtors-timestamp', Date.now().toString());
        this.showAutoSaveIndicator();
        this.lastSaveTime = Date.now();
    }

    // Show auto-save indicator
    showAutoSaveIndicator() {
        const indicator = document.getElementById('autoSaveIndicator');
        indicator.classList.add('show');
        
        // Hide after 2 seconds
        setTimeout(() => {
            indicator.classList.remove('show');
        }, 2000);
    }

    // Start monitoring for auto-save
    startAutoSaveMonitoring() {
        // Auto-save every 30 seconds if there are changes
        setInterval(() => {
            if (this.debtors.length > 0) {
                this.saveToStorage();
            }
        }, 30000);

        // Save on page visibility change (when user switches tabs or minimizes)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.debtors.length > 0) {
                this.saveToStorage();
            }
        });

        // Save before page unload
        window.addEventListener('beforeunload', () => {
            if (this.debtors.length > 0) {
                this.saveToStorage();
            }
        });
    }

    // Generate unique ID
    generateId() {
        return Math.random().toString(36).substring(2) + Date.now().toString(36);
    }

    // Format currency in Algerian Dinar
    formatCurrency(amount) {
        return new Intl.NumberFormat('ar-DZ', {
            style: 'currency',
            currency: 'DZD',
            minimumFractionDigits: 2
        }).format(amount);
    }

    // Format number with thousands separator
    formatNumber(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    // Parse formatted number input
    parseFormattedNumber(value) {
        // Remove all non-digit characters except decimal point
        const cleaned = value.replace(/[^\d.]/g, '');
        return parseFloat(cleaned) || 0;
    }

    // Format amount input as user types
    formatAmountInput(value) {
        // Remove all non-digit characters
        const digitsOnly = value.replace(/\D/g, '');
        
        if (!digitsOnly) return '';
        
        // Convert to number and format with commas
        const number = parseInt(digitsOnly);
        return this.formatNumber(number);
    }

    // Initialize event listeners
    initializeEventListeners() {
        // Form submission
        document.getElementById('debtorForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addDebtor();
        });

        // Search functionality
        const searchInput = document.getElementById('searchInput');
        const clearSearch = document.getElementById('clearSearch');
        
        searchInput.addEventListener('input', (e) => {
            this.handleSearch(e.target.value);
        });

        clearSearch.addEventListener('click', () => {
            searchInput.value = '';
            this.handleSearch('');
        });

        // Enhanced amount input handling
        const amountInput = document.getElementById('debtAmount');
        const amountDisplay = document.getElementById('amountDisplay');

        amountInput.addEventListener('input', (e) => {
            const rawValue = e.target.value;
            const formattedValue = this.formatAmountInput(rawValue);
            
            // Update input with formatted value
            e.target.value = formattedValue;
            
            // Show formatted currency in display
            const numericValue = this.parseFormattedNumber(formattedValue);
            if (numericValue > 0) {
                amountDisplay.textContent = this.formatCurrency(numericValue);
                amountDisplay.style.display = 'block';
            } else {
                amountDisplay.style.display = 'none';
            }
            
            this.scheduleAutoSave();
        });

        amountInput.addEventListener('keydown', (e) => {
            // Allow: backspace, delete, tab, escape, enter
            if ([8, 9, 27, 13, 46].indexOf(e.keyCode) !== -1 ||
                // Allow: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
                (e.keyCode === 65 && e.ctrlKey === true) ||
                (e.keyCode === 67 && e.ctrlKey === true) ||
                (e.keyCode === 86 && e.ctrlKey === true) ||
                (e.keyCode === 88 && e.ctrlKey === true)) {
                return;
            }
            // Ensure that it is a number and stop the keypress
            if ((e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) && (e.keyCode < 96 || e.keyCode > 105)) {
                e.preventDefault();
            }
        });

        // Quick amount buttons
        document.querySelectorAll('.quick-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const amount = e.target.dataset.amount;
                const formattedAmount = this.formatNumber(parseInt(amount));
                
                amountInput.value = formattedAmount;
                amountDisplay.textContent = this.formatCurrency(parseInt(amount));
                amountDisplay.style.display = 'block';
                
                // Visual feedback
                document.querySelectorAll('.quick-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
            });
        });

        // Auto-save on input changes
        document.getElementById('debtorName').addEventListener('input', () => {
            this.scheduleAutoSave();
        });
    }

    // Handle search functionality
    handleSearch(searchTerm) {
        this.searchTerm = searchTerm.toLowerCase().trim();
        
        if (!this.searchTerm) {
            this.filteredDebtors = [...this.debtors];
            document.getElementById('searchResults').style.display = 'none';
        } else {
            this.filteredDebtors = this.debtors.filter(debtor => 
                debtor.name.toLowerCase().includes(this.searchTerm)
            );
            
            // Show search results summary
            const resultsDiv = document.getElementById('searchResults');
            const resultCount = this.filteredDebtors.length;
            const totalAmount = this.filteredDebtors.reduce((sum, debtor) => sum + debtor.amount, 0);
            
            resultsDiv.innerHTML = `
                <p>نتائج البحث: ${resultCount} مدين - إجمالي: ${this.formatCurrency(totalAmount)}</p>
            `;
            resultsDiv.style.display = 'block';
        }
        
        this.renderDebtors();
        this.updateSearchHighlight();
    }

    // Update search highlight
    updateSearchHighlight() {
        if (!this.searchTerm) return;
        
        // Highlight search terms in debtor names
        document.querySelectorAll('.debtor-info h3').forEach(nameElement => {
            const originalText = nameElement.textContent.replace(' ✏️', '');
            const highlightedText = originalText.replace(
                new RegExp(`(${this.searchTerm})`, 'gi'),
                '<mark>$1</mark>'
            );
            nameElement.innerHTML = highlightedText + ' ✏️';
        });
    }

    // Schedule auto-save with debouncing
    scheduleAutoSave() {
        if (this.autoSaveTimer) {
            clearTimeout(this.autoSaveTimer);
        }
        
        this.autoSaveTimer = setTimeout(() => {
            // Only save if there are actual debtors
            if (this.debtors.length > 0) {
                this.saveToStorage();
            }
        }, 1000); // Save 1 second after user stops typing
    }

    // Add new debtor
    addDebtor() {
        const nameInput = document.getElementById('debtorName');
        const amountInput = document.getElementById('debtAmount');
        
        const name = nameInput.value.trim();
        const amount = this.parseFormattedNumber(amountInput.value);

        if (!name || isNaN(amount) || amount <= 0) {
            this.showNotification('يرجى إدخال اسم صحيح ومبلغ صالح', 'error');
            return;
        }

        const newDebtor = {
            id: this.generateId(),
            name: name,
            amount: amount,
            date: new Date().toISOString(),
            lastModified: new Date().toISOString()
        };

        this.debtors.push(newDebtor);
        this.sortDebtors();
        this.saveToStorage();
        
        // Update filtered list if search is active
        if (this.searchTerm) {
            this.handleSearch(this.searchTerm);
        } else {
            this.filteredDebtors = [...this.debtors];
        }
        
        this.renderDebtors();
        this.updateTotal();

        // Clear form
        nameInput.value = '';
        amountInput.value = '';
        document.getElementById('amountDisplay').style.display = 'none';
        document.querySelectorAll('.quick-btn').forEach(btn => btn.classList.remove('active'));

        this.showNotification('تم إضافة المدين بنجاح وحفظه تلقائياً', 'success');
    }

    // Sort debtors by amount (highest first)
    sortDebtors() {
        this.debtors.sort((a, b) => b.amount - a.amount);
    }

    // Update debtor amount
    updateAmount(id, change) {
        const debtorIndex = this.debtors.findIndex(d => d.id === id);
        if (debtorIndex !== -1) {
            const newAmount = Math.max(0, this.debtors[debtorIndex].amount + change);
            this.debtors[debtorIndex].amount = newAmount;
            this.debtors[debtorIndex].lastModified = new Date().toISOString();
            
            if (newAmount === 0) {
                this.showNotification('تم سداد الدين بالكامل وحفظه تلقائياً!', 'success');
            }
            
            this.sortDebtors();
            this.saveToStorage();
            
            // Update filtered list if search is active
            if (this.searchTerm) {
                this.handleSearch(this.searchTerm);
            } else {
                this.filteredDebtors = [...this.debtors];
            }
            
            this.renderDebtors();
            this.updateTotal();
        }
    }

    // Delete debtor
    deleteDebtor(id) {
        if (confirm('هل أنت متأكد من حذف هذا المدين؟')) {
            this.debtors = this.debtors.filter(d => d.id !== id);
            this.saveToStorage();
            
            // Update filtered list if search is active
            if (this.searchTerm) {
                this.handleSearch(this.searchTerm);
            } else {
                this.filteredDebtors = [...this.debtors];
            }
            
            this.renderDebtors();
            this.updateTotal();
            this.showNotification('تم حذف المدين وحفظ التغييرات تلقائياً', 'info');
        }
    }

    // Show custom amount input
    showCustomInput(id) {
        this.editingId = id;
        this.renderDebtors();
    }

    // Hide custom amount input
    hideCustomInput() {
        this.editingId = null;
        this.renderDebtors();
    }

    // Handle custom amount submission
    handleCustomAmount(id, isIncrease) {
        const input = document.querySelector(`#custom-${id}`);
        const amount = this.parseFormattedNumber(input.value);
        
        if (isNaN(amount) || amount <= 0) {
            this.showNotification('يرجى إدخال مبلغ صالح', 'error');
            return;
        }

        this.updateAmount(id, isIncrease ? amount : -amount);
        this.hideCustomInput();
    }

    // Edit debtor name
    editDebtorName(id) {
        const debtor = this.debtors.find(d => d.id === id);
        if (!debtor) return;

        const newName = prompt('تعديل اسم المدين:', debtor.name);
        if (newName && newName.trim() !== debtor.name) {
            debtor.name = newName.trim();
            debtor.lastModified = new Date().toISOString();
            this.saveToStorage();
            
            // Update filtered list if search is active
            if (this.searchTerm) {
                this.handleSearch(this.searchTerm);
            } else {
                this.filteredDebtors = [...this.debtors];
            }
            
            this.renderDebtors();
            this.showNotification('تم تعديل الاسم وحفظه تلقائياً', 'success');
        }
    }

    // Render all debtors
    renderDebtors() {
        const container = document.getElementById('debtorsList');
        const noDebtors = document.getElementById('noDebtors');

        if (this.filteredDebtors.length === 0) {
            if (this.searchTerm && this.debtors.length > 0) {
                noDebtors.innerHTML = '<p>لا توجد نتائج للبحث المحدد</p>';
            } else {
                noDebtors.innerHTML = '<p>لم يتم إضافة أي مدين بعد</p>';
            }
            noDebtors.style.display = 'block';
            container.innerHTML = '';
            return;
        }

        noDebtors.style.display = 'none';
        container.innerHTML = this.filteredDebtors.map(debtor => this.renderDebtorCard(debtor)).join('');

        // Add event listeners to new elements
        this.attachDebtorEventListeners();
        
        // Apply search highlighting
        setTimeout(() => this.updateSearchHighlight(), 100);
    }

    // Render individual debtor card
    renderDebtorCard(debtor) {
        const isEditing = this.editingId === debtor.id;
        const formattedDate = new Date(debtor.date).toLocaleDateString('ar-DZ');
        const lastModified = debtor.lastModified ? 
            new Date(debtor.lastModified).toLocaleDateString('ar-DZ') : formattedDate;
        
        return `
            <div class="debtor-card fade-in">
                <div class="debtor-header">
                    <div class="debtor-info">
                        <h3 onclick="debtTracker.editDebtorName('${debtor.id}')" class="editable-name" title="انقر لتعديل الاسم">
                            ${debtor.name} ✏️
                        </h3>
                        <div class="debtor-amount">${this.formatCurrency(debtor.amount)}</div>
                        <div class="debtor-date">تم الإضافة في ${formattedDate}</div>
                        ${debtor.lastModified && debtor.lastModified !== debtor.date ? 
                            `<div class="debtor-modified">آخر تعديل: ${lastModified}</div>` : ''}
                    </div>
                </div>

                <div class="debtor-controls">
                    <!-- Quick Control Buttons -->
                    <div class="quick-controls">
                        <button class="control-btn decrease-btn" onclick="debtTracker.updateAmount('${debtor.id}', -50)" title="تقليل 50 دج">
                            -50
                        </button>
                        <button class="control-btn decrease-btn" onclick="debtTracker.updateAmount('${debtor.id}', -100)" title="تقليل 100 دج">
                            -100
                        </button>
                        <button class="control-btn decrease-btn" onclick="debtTracker.updateAmount('${debtor.id}', -500)" title="تقليل 500 دج">
                            -500
                        </button>
                        <button class="control-btn increase-btn" onclick="debtTracker.updateAmount('${debtor.id}', 50)" title="زيادة 50 دج">
                            +50
                        </button>
                        <button class="control-btn increase-btn" onclick="debtTracker.updateAmount('${debtor.id}', 100)" title="زيادة 100 دج">
                            +100
                        </button>
                        <button class="control-btn increase-btn" onclick="debtTracker.updateAmount('${debtor.id}', 500)" title="زيادة 500 دج">
                            +500
                        </button>
                    </div>

                    ${isEditing ? this.renderCustomInput(debtor.id) : this.renderActionButtons(debtor.id)}
                </div>
            </div>
        `;
    }

    // Render custom amount input
    renderCustomInput(id) {
        return `
            <div class="custom-input">
                <input type="text" id="custom-${id}" placeholder="أدخل المبلغ" class="custom-amount-input" autofocus>
                <button class="action-btn decrease-action" onclick="debtTracker.handleCustomAmount('${id}', false)" title="تقليل">
                    ➖
                </button>
                <button class="action-btn increase-action" onclick="debtTracker.handleCustomAmount('${id}', true)" title="زيادة">
                    ➕
                </button>
                <button class="action-btn cancel-action" onclick="debtTracker.hideCustomInput()" title="إلغاء">
                    ❌
                </button>
            </div>
        `;
    }

    // Render action buttons
    renderActionButtons(id) {
        return `
            <div class="action-buttons">
                <button class="custom-btn" onclick="debtTracker.showCustomInput('${id}')" title="مبلغ مخصص">
                    ✏️ مخصص
                </button>
                <button class="delete-btn" onclick="debtTracker.deleteDebtor('${id}')" title="حذف المدين">
                    🗑️
                </button>
            </div>
        `;
    }

    // Attach event listeners to debtor cards
    attachDebtorEventListeners() {
        // Handle Enter key in custom input
        document.querySelectorAll('[id^="custom-"]').forEach(input => {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const id = e.target.id.replace('custom-', '');
                    this.handleCustomAmount(id, true);
                }
            });

            // Format custom amount input
            input.addEventListener('input', (e) => {
                const formattedValue = this.formatAmountInput(e.target.value);
                e.target.value = formattedValue;
                this.scheduleAutoSave();
            });

            // Restrict input to numbers only
            input.addEventListener('keydown', (e) => {
                if ([8, 9, 27, 13, 46].indexOf(e.keyCode) !== -1 ||
                    (e.keyCode === 65 && e.ctrlKey === true) ||
                    (e.keyCode === 67 && e.ctrlKey === true) ||
                    (e.keyCode === 86 && e.ctrlKey === true) ||
                    (e.keyCode === 88 && e.ctrlKey === true)) {
                    return;
                }
                if ((e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) && (e.keyCode < 96 || e.keyCode > 105)) {
                    e.preventDefault();
                }
            });
        });
    }

    // Update total debt display
    updateTotal() {
        const total = this.debtors.reduce((sum, debtor) => sum + debtor.amount, 0);
        const count = this.debtors.length;
        
        document.getElementById('totalAmount').textContent = this.formatCurrency(total);
        document.getElementById('debtorCount').textContent = count;
    }

    // Show notification
    showNotification(message, type = 'info') {
        // Remove existing notifications
        const existing = document.querySelector('.notification');
        if (existing) {
            existing.remove();
        }

        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // Style the notification
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '15px 25px',
            borderRadius: '10px',
            color: 'white',
            fontWeight: '600',
            zIndex: '1000',
            animation: 'slideIn 0.3s ease-out',
            maxWidth: '300px',
            textAlign: 'center'
        });

        // Set background color based on type
        const colors = {
            success: '#4caf50',
            error: '#f44336',
            info: '#2196f3',
            warning: '#ff9800'
        };
        notification.style.backgroundColor = colors[type] || colors.info;

        // Add to page
        document.body.appendChild(notification);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-in forwards';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // Export data as JSON
    exportData() {
        const exportData = {
            debtors: this.debtors,
            exportDate: new Date().toISOString(),
            totalDebt: this.debtors.reduce((sum, debtor) => sum + debtor.amount, 0),
            debtorCount: this.debtors.length
        };
        
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `dzair-debt-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
        this.showNotification('تم تصدير البيانات بنجاح', 'success');
    }

    // Import data from JSON
    importData(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                
                // Handle both old and new format
                const debtorsArray = importedData.debtors || importedData;
                
                if (Array.isArray(debtorsArray)) {
                    // Add lastModified field if missing
                    const processedDebtors = debtorsArray.map(debtor => ({
                        ...debtor,
                        lastModified: debtor.lastModified || debtor.date
                    }));
                    
                    this.debtors = processedDebtors;
                    this.filteredDebtors = [...this.debtors];
                    this.saveToStorage();
                    this.renderDebtors();
                    this.updateTotal();
                    
                    // Clear search if active
                    if (this.searchTerm) {
                        document.getElementById('searchInput').value = '';
                        this.handleSearch('');
                    }
                    
                    this.showNotification('تم استيراد البيانات وحفظها تلقائياً بنجاح', 'success');
                } else {
                    throw new Error('Invalid data format');
                }
            } catch (error) {
                this.showNotification('خطأ في تنسيق الملف', 'error');
            }
        };
        reader.readAsText(file);
        
        // Reset file input
        event.target.value = '';
    }

    // Clear all data
    clearAllData() {
        if (confirm('هل أنت متأكد من حذف جميع البيانات؟ لا يمكن التراجع عن هذا الإجراء.')) {
            this.debtors = [];
            this.filteredDebtors = [];
            this.saveToStorage();
            this.renderDebtors();
            this.updateTotal();
            
            // Clear search
            if (this.searchTerm) {
                document.getElementById('searchInput').value = '';
                this.handleSearch('');
            }
            
            this.showNotification('تم حذف جميع البيانات', 'info');
        }
    }

    // Get backup status
    getBackupInfo() {
        const timestamp = localStorage.getItem('dzair-debtors-timestamp');
        if (timestamp) {
            const lastSave = new Date(parseInt(timestamp));
            return {
                lastSave: lastSave,
                timeSinceLastSave: Date.now() - parseInt(timestamp)
            };
        }
        return null;
    }
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }

    @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.05); }
        100% { transform: scale(1); }
    }

    mark {
        background-color: #ffeb3b;
        color: #000;
        padding: 2px 4px;
        border-radius: 3px;
        font-weight: bold;
    }
`;
document.head.appendChild(style);

// Initialize the application
let debtTracker;
document.addEventListener('DOMContentLoaded', () => {
    debtTracker = new DebtTracker();
});

// Add keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl+N or Cmd+N to focus on name input
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        document.getElementById('debtorName').focus();
    }
    
    // Ctrl+F or Cmd+F to focus on search
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        document.getElementById('searchInput').focus();
    }
    
    // Ctrl+S or Cmd+S to manually save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        debtTracker.saveToStorage();
        debtTracker.showNotification('تم الحفظ يدوياً', 'success');
    }
    
    // Escape to cancel editing or clear search
    if (e.key === 'Escape') {
        if (debtTracker.editingId) {
            debtTracker.hideCustomInput();
        } else if (debtTracker.searchTerm) {
            document.getElementById('searchInput').value = '';
            debtTracker.handleSearch('');
        }
    }
});