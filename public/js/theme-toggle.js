/**
 * Theme Toggle Utility
 * Handles dark/light mode switching with localStorage persistence
 * Must be loaded before other scripts for flash prevention
 */

(function () {
    'use strict';

    const THEME_KEY = 'fmcg-theme-preference';
    const DARK_CLASS = 'dark-mode';
    const LIGHT_CLASS = 'light-mode';

    /**
     * Get saved theme preference or default to 'auto'
     * @returns {'dark' | 'light' | 'auto'}
     */
    function getSavedTheme() {
        return localStorage.getItem(THEME_KEY) || 'auto';
    }

    /**
     * Detect system color scheme preference
     * @returns {'dark' | 'light'}
     */
    function getSystemTheme() {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    /**
     * Get effective theme (resolved from auto)
     * @returns {'dark' | 'light'}
     */
    function getEffectiveTheme() {
        const saved = getSavedTheme();
        return saved === 'auto' ? getSystemTheme() : saved;
    }

    /**
     * Apply theme to document
     * @param {'dark' | 'light'} theme
     */
    function applyTheme(theme) {
        const html = document.documentElement;

        if (theme === 'dark') {
            html.classList.add(DARK_CLASS);
            html.classList.remove(LIGHT_CLASS);
        } else {
            html.classList.add(LIGHT_CLASS);
            html.classList.remove(DARK_CLASS);
        }

        // Update toggle button icon if exists
        updateToggleButton(theme);
    }

    /**
     * Update toggle button appearance
     * @param {'dark' | 'light'} theme
     */
    function updateToggleButton(theme) {
        const btn = document.getElementById('themeToggle');
        if (!btn) return;

        const icon = btn.querySelector('.theme-icon');
        const label = btn.querySelector('.theme-label');

        if (icon) {
            icon.textContent = theme === 'dark' ? '☀️' : '🌙';
        }
        if (label) {
            label.textContent = theme === 'dark' ? 'Light' : 'Dark';
        }

        btn.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
    }

    /**
     * Toggle between dark and light mode
     */
    function toggleTheme() {
        const current = getEffectiveTheme();
        const next = current === 'dark' ? 'light' : 'dark';

        localStorage.setItem(THEME_KEY, next);
        applyTheme(next);

        // Dispatch custom event for other components
        window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: next } }));
    }

    /**
     * Initialize theme on page load
     */
    function initTheme() {
        const theme = getEffectiveTheme();
        applyTheme(theme);

        // Listen for system theme changes (when set to auto)
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (getSavedTheme() === 'auto') {
                applyTheme(e.matches ? 'dark' : 'light');
            }
        });
    }

    /**
     * Create and inject toggle button
     * @param {HTMLElement} container - Element to append button to
     */
    function createToggleButton(container) {
        if (!container || document.getElementById('themeToggle')) return;

        const theme = getEffectiveTheme();
        const btn = document.createElement('button');
        btn.id = 'themeToggle';
        btn.className = 'theme-toggle-btn';
        btn.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
        btn.innerHTML = `
            <span class="theme-icon">${theme === 'dark' ? '☀️' : '🌙'}</span>
        `;
        btn.addEventListener('click', toggleTheme);

        container.appendChild(btn);
    }

    // Apply theme immediately to prevent flash
    initTheme();

    // Expose API globally
    window.ThemeManager = {
        toggle: toggleTheme,
        get: getEffectiveTheme,
        set: (theme) => {
            localStorage.setItem(THEME_KEY, theme);
            applyTheme(theme === 'auto' ? getSystemTheme() : theme);
        },
        createToggleButton: createToggleButton
    };

    // Auto-inject toggle button when DOM is ready - DISABLED
    // document.addEventListener('DOMContentLoaded', () => {
    //     // Look for existing theme toggle container or nav
    //     const nav = document.querySelector('.nav-right') || document.querySelector('.navbar-actions');
    //     if (nav) {
    //         createToggleButton(nav);
    //     }
    // });
})();
