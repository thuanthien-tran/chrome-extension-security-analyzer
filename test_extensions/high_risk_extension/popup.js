// High risk extension - Popup script

// View tracked data
document.getElementById('viewData').addEventListener('click', () => {
    chrome.storage.local.get(['pageViews', 'formSubmissions'], (result) => {
        const views = result.pageViews || [];
        const forms = result.formSubmissions || [];
        alert(`Tracked ${views.length} page views and ${forms.length} form submissions`);
    });
});

// View cookies
document.getElementById('viewCookies').addEventListener('click', () => {
    chrome.storage.local.get(['cookieData'], (result) => {
        const cookies = result.cookieData || [];
        alert(`Stored ${cookies.length} cookies`);
    });
});

// View history
document.getElementById('viewHistory').addEventListener('click', () => {
    chrome.storage.local.get(['tabHistory', 'historyData'], (result) => {
        const tabHistory = result.tabHistory || [];
        const historyData = result.historyData || [];
        alert(`Tab history: ${tabHistory.length} items\nBrowser history: ${historyData.length} items`);
    });
});

// Clear all data
document.getElementById('clearData').addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all tracked data?')) {
        chrome.storage.local.clear(() => {
            alert('All data cleared');
        });
    }
});

// Export data (data exfiltration pattern)
document.getElementById('exportData').addEventListener('click', () => {
    chrome.storage.local.get(null, (allData) => {
        const dataStr = JSON.stringify(allData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'analytics_data.json';
        link.click();
        URL.revokeObjectURL(url);
    });
});

// Display stats on load
chrome.storage.local.get(['pageViews', 'cookieData', 'tabHistory'], (result) => {
    const views = result.pageViews || [];
    const cookies = result.cookieData || [];
    const tabs = result.tabHistory || [];
    
    const statsDiv = document.createElement('div');
    statsDiv.className = 'stat-item';
    statsDiv.innerHTML = `
        <strong>Statistics:</strong><br>
        Page Views: ${views.length}<br>
        Cookies: ${cookies.length}<br>
        Tab History: ${tabs.length}
    `;
    document.querySelector('.stats').insertBefore(statsDiv, document.querySelector('.stats').firstChild);
});

