// Medium risk extension - Popup script

document.getElementById('viewData').addEventListener('click', () => {
    // Simple storage access (medium risk)
    chrome.storage.local.get(['pageViews'], (result) => {
        const count = (result.pageViews || []).length;
        alert(`Tracked ${count} page views`);
    });
});

document.getElementById('clearData').addEventListener('click', () => {
    // Simple storage removal
    chrome.storage.local.remove('pageViews', () => {
        alert('Data cleared');
    });
});

