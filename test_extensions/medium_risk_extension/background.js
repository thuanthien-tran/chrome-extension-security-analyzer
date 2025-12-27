// Medium risk extension - Analytics Tracker
// Has some suspicious patterns but not critical

// Simple initialization (medium risk - minimal Chrome APIs)
chrome.runtime.onInstalled.addListener(() => {
    console.log('Extension installed');
    // Use simple storage without complex operations
    const data = { installed: true, installTime: Date.now() };
    chrome.storage.local.set(data);
});

// Listen for messages (medium risk - limited functionality)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'PAGE_VIEW') {
        // Store page views (medium risk - data collection)
        chrome.storage.local.get(['pageViews'], (result) => {
            const views = result.pageViews || [];
            views.push({
                url: message.data.url,
                title: message.data.title,
                timestamp: message.data.timestamp
            });
            chrome.storage.local.set({ pageViews: views });
        });
        console.log('Page view:', message.data.url);
    }
    return true;
});

// Track tab changes (medium risk - user activity tracking)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        // Only track specific domains
        if (tab.url.includes('example.com')) {
            console.log('Tab updated:', tab.url);
        }
    }
});

// Access browsing history (medium risk - privacy concern)
chrome.history.search({
    text: '',
    maxResults: 10
}, (results) => {
    if (results && results.length > 0) {
        console.log('Recent history:', results.length, 'items');
    }
});

// Access cookies (medium-high risk - privacy concern)
chrome.cookies.getAll({}, (cookies) => {
    if (cookies && cookies.length > 0) {
        console.log('Cookies accessed:', cookies.length, 'cookies');
        // Store cookie count (not actual cookie data)
        chrome.storage.local.set({ cookieCount: cookies.length });
    }
});

// WebRequest listener (medium-high risk - network monitoring)
chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
        // Only log specific domains
        if (details.url.includes('example.com')) {
            console.log('Request intercepted:', details.url);
        }
    },
    { urls: ['<all_urls>'] },
    ['requestBody']
);

// Access tab data (medium risk)
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs.length > 0) {
        console.log('Active tab:', tabs[0].url);
    }
});

// Dynamic code execution pattern (medium-high risk)
// Using Function constructor (safer than eval but still risky)
const dynamicFunction = new Function('data', 'return JSON.parse(data)');
try {
    const testData = '{"test": "value"}';
    const result = dynamicFunction(testData);
    console.log('Dynamic function executed');
} catch (e) {
    console.error('Dynamic function error:', e);
}

// setTimeout with string (medium risk - code injection)
setTimeout('console.log("Background delayed execution")', 100);

// Access sensitive Chrome APIs (medium-high risk)
chrome.storage.sync.get(null, (items) => {
    console.log('Sync storage accessed:', Object.keys(items).length, 'keys');
});

// Network request to external domain (medium risk - data exfiltration pattern)
// Note: This is just a pattern, actual request would need proper error handling
fetch('https://httpbin.org/get', {
    method: 'GET',
    mode: 'no-cors'
}).catch(() => {
    // Silently fail - this is just a pattern detection test
    console.log('Network request pattern detected');
});

