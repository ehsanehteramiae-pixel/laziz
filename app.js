// کلاس مدیریت پرتال
class PortalManager {
    constructor() {
        this.data = null;
        this.filteredData = null;
        this.storageKey = 'portal-state';
        this.searchTimeout = null;
        this.init();
    }

    // مقداردهی اولیه
    async init() {
        try {
            this.showLoading(true);
            await this.loadData();
            this.setupEventListeners();
            this.render();
            this.restoreState();
            this.updateYear();
        } catch (error) {
            this.showError(error.message);
        } finally {
            this.showLoading(false);
        }
    }

    // بارگذاری داده‌ها از JSON
    async loadData() {
        try {
            const response = await fetch('data.json');
            if (!response.ok) {
                throw new Error('خطا در بارگذاری داده‌ها');
            }
            this.data = await response.json();
            this.filteredData = this.data;
            
            // اضافه کردن ID به هر آیتم
            this.addIdsToItems(this.data.items);
        } catch (error) {
            console.error('Error loading data:', error);
            throw new Error('عدم امکان بارگذاری داده‌ها. لطفاً اتصال اینترنت را بررسی کنید.');
        }
    }

    // اضافه کردن شناسه یکتا به آیتم‌ها
    addIdsToItems(items, prefix = '') {
        items.forEach((item, index) => {
            item.id = `${prefix}item-${index}`;
            if (item.children) {
                this.addIdsToItems(item.children, `${item.id}-`);
            }
        });
    }

    // راه‌اندازی رویدادها
    setupEventListeners() {
        const searchInput = document.getElementById('searchInput');
        searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
        searchInput.addEventListener('search', (e) => this.handleSearch(e.target.value));
    }

    // مدیریت جستجو
    handleSearch(query) {
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => {
            this.performSearch(query);
        }, 300);
    }

    // انجام جستجو
    performSearch(query) {
        const searchResults = document.getElementById('searchResults');
        
        if (!query.trim()) {
            this.filteredData = this.data;
            searchResults.textContent = '';
            this.render();
            return;
        }

        const results = this.searchInItems(this.data.items, query.toLowerCase());
        this.filteredData = { ...this.data, items: results.items };
        
        // نمایش تعداد نتایج
        const count = results.count;
        searchResults.textContent = count > 0 ? `${count} مورد یافت شد` : '';
        
        this.render();
        
        if (count > 0) {
            this.expandMatchingCategories(query);
        } else {
            this.showNoResults(true);
        }
    }

    // جستجو در آیتم‌ها
    searchInItems(items, query) {
        let totalCount = 0;
        const filteredItems = [];

        for (const item of items) {
            if (item.type === 'link') {
                if (item.title.toLowerCase().includes(query)) {
                    filteredItems.push(item);
                    totalCount++;
                }
            } else if (item.type === 'category') {
                const childResults = this.searchInItems(item.children || [], query);
                const titleMatch = item.title.toLowerCase().includes(query);
                
                if (titleMatch || childResults.count > 0) {
                    filteredItems.push({
                        ...item,
                        children: childResults.items,
                        matched: titleMatch
                    });
                    totalCount += titleMatch ? 1 : 0;
                    totalCount += childResults.count;
                }
            }
        }

        return { items: filteredItems, count: totalCount };
    }

    // باز کردن دسته‌های منطبق
    expandMatchingCategories(query) {
        setTimeout(() => {
            const categories = document.querySelectorAll('.portal-category');
            categories.forEach(category => {
                const hasMatch = category.textContent.toLowerCase().includes(query.toLowerCase());
                if (hasMatch) {
                    category.open = true;
                }
            });
        }, 100);
    }

    // رندر محتوا
    render() {
        const container = document.getElementById('portalContent');
        const noResults = document.getElementById('noResultsMessage');
        
        if (!this.filteredData || !this.filteredData.items || this.filteredData.items.length === 0) {
            container.innerHTML = '';
            this.showNoResults(true);
            return;
        }
        
        this.showNoResults(false);
        container.innerHTML = this.renderItems(this.filteredData.items);
        this.attachItemListeners();
    }

    // رندر آیتم‌ها
    renderItems(items, level = 0) {
        return items.map(item => {
            if (item.type === 'category') {
                return this.renderCategory(item, level);
            } else if (item.type === 'link' && item.url) {
                return this.renderLink(item);
            }
            return '';
        }).join('');
    }

    // رندر دسته‌بندی
    renderCategory(category, level) {
        const hasChildren = category.children && category.children.length > 0;
        const title = this.highlightText(category.title);
        
        return `
            <details class="portal-category portal-item" data-id="${category.id}" data-level="${level}">
                <summary role="button" aria-expanded="false" aria-controls="${category.id}-content">
                    <svg class="icon" width="20" height="20">
                        <use href="#icon-folder"></use>
                    </svg>
                    <span class="title">${title}</span>
                    <svg class="chevron" width="20" height="20">
                        <use href="#icon-chevron"></use>
                    </svg>
                </summary>
                ${hasChildren ? `
                    <div class="portal-category__children" id="${category.id}-content">
                        ${this.renderItems(category.children, level + 1)}
                    </div>
                ` : ''}
            </details>
        `;
    }

    // رندر لینک
    renderLink(link) {
        const title = this.highlightText(link.title);
        return `
            <a href="${link.url}" 
               target="_blank" 
               rel="noopener noreferrer" 
               class="portal-link portal-item"
               data-id="${link.id}"
               role="link"
               aria-label="${link.title} - باز شدن در تب جدید">
                <svg class="icon" width="20" height="20">
                    <use href="#icon-link"></use>
                </svg>
                <span class="title">${title}</span>
            </a>
        `;
    }

    // هایلایت متن جستجو
    highlightText(text) {
        const searchInput = document.getElementById('searchInput');
        const query = searchInput.value.trim();
        
        if (!query) return text;
        
        const regex = new RegExp(`(${query})`, 'gi');
        return text.replace(regex, '<mark class="highlight">$1</mark>');
    }

    // اتصال رویدادها به آیتم‌ها
    attachItemListeners() {
        const categories = document.querySelectorAll('.portal-category');
        categories.forEach(category => {
            category.addEventListener('toggle', () => {
                this.saveState();
                this.updateBreadcrumb();
            });
        });
    }

    // ذخیره وضعیت
    saveState() {
        const state = {};
        const categories = document.querySelectorAll('.portal-category');
        categories.forEach(category => {
            const id = category.dataset.id;
            state[id] = category.open;
        });
        localStorage.setItem(this.storageKey, JSON.stringify(state));
    }

    // بازیابی وضعیت
    restoreState() {
        try {
            const savedState = localStorage.getItem(this.storageKey);
            if (!savedState) return;
            
            const state = JSON.parse(savedState);
            Object.keys(state).forEach(id => {
                const category = document.querySelector(`[data-id="${id}"]`);
                if (category && state[id]) {
                    category.open = true;
                }
            });
        } catch (error) {
            console.warn('Error restoring state:', error);
        }
    }

    // به‌روزرسانی بردکرامب
    updateBreadcrumb() {
        const openCategories = document.querySelectorAll('.portal-category[open]');
        const breadcrumb = document.getElementById('breadcrumb');
        const list = breadcrumb.querySelector('.breadcrumb__list');
        
        if (openCategories.length === 0) {
            breadcrumb.hidden = true;
            return;
        }
        
        const path = ['صفحه اصلی'];
        openCategories.forEach(category => {
            const title = category.querySelector('.title').textContent;
            path.push(title);
        });
        
        list.innerHTML = path.map(item => `<li>${item}</li>`).join('');
        breadcrumb.hidden = false;
    }

    // نمایش/مخفی کردن لودینگ
    showLoading(show) {
        document.getElementById('loadingMessage').hidden = !show;
        document.getElementById('portalContent').hidden = show;
    }

    // نمایش خطا
    showError(message) {
        const errorElement = document.getElementById('errorMessage');
        errorElement.querySelector('span').textContent = message;
        errorElement.hidden = false;
        document.getElementById('portalContent').hidden = true;
    }

    // نمایش پیام عدم نتیجه
    showNoResults(show) {
        document.getElementById('noResultsMessage').hidden = !show;
    }

    // به‌روزرسانی سال در فوتر
    updateYear() {
        document.getElementById('currentYear').textContent = new Date().getFullYear();
    }
}

// شروع برنامه
document.addEventListener('DOMContentLoaded', () => {
    new PortalManager();
});

// Service Worker برای کش (اختیاری)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(() => {
            // Service worker is optional
        });
    });
}