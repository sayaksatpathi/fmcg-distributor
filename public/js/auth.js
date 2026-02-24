// Authentication and session management
// Simple, no-loop design

let currentUser = null;
let authToken = null;

// Determine page type ONCE at load - no functions, no recalculation
const PAGE_INFO = (function () {
    const path = window.location.pathname.toLowerCase();
    const filename = path.split('/').pop() || '';

    // Simple check: if filename is empty, index.html, or just "/" - it's login
    const isLogin = (filename === '' || filename === 'index.html' || path === '/');

    return {
        isLogin: isLogin,
        filename: filename
    };
})();

// For backwards compatibility
function isLoginPage() {
    return PAGE_INFO.isLogin;
}

// Read auth state ONCE
authToken = localStorage.getItem('authToken');
const storedUser = localStorage.getItem('userData');
if (storedUser) {
    try {
        currentUser = JSON.parse(storedUser);
    } catch (e) {
        currentUser = null;
    }
}

// Determine if we need to redirect - but only do it ONCE
const needsRedirect = (function () {
    // Already redirecting? Stop.
    if (sessionStorage.getItem('redirecting')) {
        sessionStorage.removeItem('redirecting');
        return null;
    }

    const isLoggedIn = !!(authToken && currentUser);

    if (isLoggedIn && PAGE_INFO.isLogin) {
        // Logged in but on login page - go to dashboard
        return 'dashboard.html';
    }

    if (!isLoggedIn && !PAGE_INFO.isLogin) {
        // Not logged in and not on login page - go to login
        return 'index.html';
    }

    return null;
})();

// Execute redirect if needed
if (needsRedirect) {
    sessionStorage.setItem('redirecting', 'true');
    window.location.replace(needsRedirect);
} else {
    // No redirect needed - show the page
    document.addEventListener('DOMContentLoaded', function () {
        // Show login container if on login page
        if (PAGE_INFO.isLogin) {
            const container = document.getElementById('loginContainer');
            if (container) {
                container.classList.add('ready');
            }

            // Setup login form
            const form = document.getElementById('loginForm');
            if (form) {
                form.addEventListener('submit', handleLogin);
            }
        } else if (currentUser) {
            updateUIForUser();
        }
    });
}

// Login handler
async function handleLogin(e) {
    e.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('loginError');
    const errorText = document.getElementById('loginErrorText');
    const loginBtn = document.querySelector('.btn-login');

    if (loginBtn) loginBtn.classList.add('loading');
    if (errorDiv) errorDiv.style.display = 'none';

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('authToken', data.token);
            localStorage.setItem('userData', JSON.stringify(data.user));
            window.location.href = 'dashboard.html';
        } else {
            if (errorDiv && errorText) {
                errorText.textContent = data.error || 'Login failed';
                errorDiv.style.display = 'flex';
            } else if (errorDiv) {
                errorDiv.textContent = data.error || 'Login failed';
                errorDiv.style.display = 'block';
            }
            if (loginBtn) loginBtn.classList.remove('loading');
        }
    } catch (error) {
        if (errorDiv && errorText) {
            errorText.textContent = 'Network error. Please try again.';
            errorDiv.style.display = 'flex';
        } else if (errorDiv) {
            errorDiv.textContent = 'Network error. Please try again.';
            errorDiv.style.display = 'block';
        }
        if (loginBtn) loginBtn.classList.remove('loading');
    }
}

// Logout
function logout() {
    const token = localStorage.getItem('authToken');
    if (token) {
        fetch('/api/logout', {
            method: 'POST',
            headers: { 'Authorization': token }
        }).catch(() => { });
    }
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    sessionStorage.removeItem('redirecting');
    window.location.href = 'index.html';
}

// Update UI for logged in user
function updateUIForUser() {
    if (!currentUser) return;

    const userDisplay = document.getElementById('userDisplay');
    if (userDisplay) {
        userDisplay.textContent = currentUser.username || 'User';
    }
}

// API helper
async function apiRequest(url, options = {}) {
    const token = localStorage.getItem('authToken');
    if (!token) {
        if (!PAGE_INFO.isLogin) {
            window.location.href = 'index.html';
        }
        return null;
    }

    const config = {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': token,
            ...(options.headers || {})
        }
    };

    try {
        const response = await fetch(url, config);

        if (response.status === 401) {
            localStorage.removeItem('authToken');
            localStorage.removeItem('userData');
            if (!PAGE_INFO.isLogin) {
                window.location.href = 'index.html';
            }
            return null;
        }

        return response;
    } catch (error) {
        console.error('API request failed:', error);
        throw error;
    }
}

