// Safe extension - Color Picker
// No malicious behavior

document.getElementById('copyBtn').addEventListener('click', () => {
    const color = document.getElementById('colorInput').value;
    navigator.clipboard.writeText(color).then(() => {
        alert('Color code copied: ' + color);
    });
});

console.log('Safe Color Picker extension loaded');


