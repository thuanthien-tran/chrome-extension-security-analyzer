// Medium risk extension - Content script
// Tracks user interactions

(function() {
    'use strict';
    
    // Track page views
    const pageData = {
        url: window.location.href,
        title: document.title,
        timestamp: Date.now()
    };
    
    // Send page data to background
    chrome.runtime.sendMessage({
        type: 'PAGE_VIEW',
        data: pageData
    });
    
    // Track page interactions (medium risk - limited tracking)
    // Only track on specific pages, not all clicks
    if (window.location.hostname === 'example.com') {
        document.addEventListener('click', (e) => {
            // Only log, don't send sensitive data
            console.log('Click detected on:', e.target.tagName);
        }, true);
    }
    
    // Simple page tracking (medium risk - not critical)
    // No eval, no dangerous patterns
    console.log('Page loaded:', window.location.href);
    
    // Access localStorage (medium risk but acceptable for analytics)
    try {
        const stored = localStorage.getItem('user_pref');
        if (stored) {
            console.log('User preference found');
        }
    } catch (e) {
        console.error('Storage access error:', e);
    }
    
    // Access cookies (medium-high risk)
    const cookies = document.cookie;
    if (cookies) {
        console.log('Cookies detected:', cookies.length, 'chars');
    }
    
    // Medium risk patterns - DOM manipulation
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
                console.log('DOM changed');
            }
        });
    });
    
    // Observe DOM changes (medium risk - tracking)
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    // innerHTML usage (medium risk - potential XSS)
    const container = document.createElement('div');
    container.innerHTML = '<span>Analytics tracker</span>';
    document.body.appendChild(container);
    
    // Access form fields (medium risk - data collection)
    const forms = document.querySelectorAll('form');
    forms.forEach((form) => {
        form.addEventListener('submit', (e) => {
            const formData = new FormData(form);
            console.log('Form submitted:', formData);
        });
    });
    
    // Keydown tracking (medium-high risk - keylogger pattern)
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            console.log('Key pressed:', e.key);
        }
    }, true);
    
    // Access sensitive data (medium risk)
    const inputs = document.querySelectorAll('input[type="password"], input[type="email"]');
    inputs.forEach((input) => {
        input.addEventListener('blur', () => {
            console.log('Sensitive field accessed');
        });
    });
    
    // Base64 encoding (medium risk - obfuscation pattern)
    const encoded = btoa(JSON.stringify({ url: window.location.href, time: Date.now() }));
    console.log('Encoded data:', encoded.substring(0, 20));
    
    // atob decoding (medium risk - obfuscation pattern)
    try {
        const decoded = atob(encoded);
        console.log('Decoded data length:', decoded.length);
    } catch (e) {
        console.error('Decode error:', e);
    }
    
    // setTimeout with string (medium risk - code injection pattern)
    setTimeout('console.log("Delayed execution")', 100);
    
    // Access window properties (medium risk - fingerprinting)
    const screenInfo = {
        width: screen.width,
        height: screen.height,
        colorDepth: screen.colorDepth
    };
    console.log('Screen info:', screenInfo);
})();

