# Hướng Dẫn Debug Actions (Tắt/Gỡ/Giữ)

## ✅ Đã Sửa

1. **Thay `onclick` bằng Event Delegation**: 
   - Không dùng `onclick="function()"` trong HTML động
   - Dùng `data-action` và `data-extension-id` attributes
   - Event listener bắt tất cả clicks trên `.action-button`

2. **Cải thiện Error Handling**:
   - Log chi tiết lỗi vào console
   - Hiển thị error message rõ ràng

## 🧪 Cách Test

### Bước 1: Mở Popup Console
1. Click vào icon Extension Analyzer
2. Right-click vào popup → "Inspect" (hoặc F12)
3. Chuyển sang tab "Console"

### Bước 2: Test Actions
1. Quét extensions
2. Click vào button "Tắt", "Gỡ", hoặc "Giữ"
3. Xem Console để kiểm tra:
   - Có log nào không?
   - Có error nào không?

### Bước 3: Kiểm Tra Background Service Worker
1. Vào `chrome://extensions/`
2. Tìm "Extension Security Analyzer"
3. Click "service worker" để mở console
4. Thử action lại → xem có log trong service worker console không

## 🔍 Debug Checklist

### Nếu Button Không Phản Ứng:

1. **Kiểm tra Event Listener**:
   ```javascript
   // Trong Popup Console, chạy:
   document.querySelectorAll('.action-button').forEach(btn => {
     console.log('Button:', btn.getAttribute('data-action'), btn.getAttribute('data-extension-id'));
   });
   ```
   - Phải thấy các buttons với data attributes đúng

2. **Kiểm tra Click Event**:
   ```javascript
   // Trong Popup Console, chạy:
   document.addEventListener('click', (e) => {
     console.log('Click detected:', e.target);
   });
   ```
   - Click button → phải thấy log

### Nếu Có Error:

1. **Error: "Extension context invalidated"**:
   - Reload extension (`chrome://extensions/` → Reload)
   - Đóng và mở lại popup

2. **Error: "Cannot access chrome.management"**:
   - Kiểm tra manifest.json có `"permissions": ["management"]`
   - Reload extension

3. **Error: "sendResponse is not a function"**:
   - Background service worker có vấn đề
   - Kiểm tra background.js console

### Nếu Action Không Thực Hiện:

1. **Kiểm tra Background Message Handler**:
   ```javascript
   // Trong Service Worker Console, chạy:
   chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
     console.log('Message received:', request);
     return true;
   });
   ```

2. **Test Manual**:
   ```javascript
   // Trong Popup Console, chạy:
   chrome.runtime.sendMessage({
     action: 'disableExtension',
     extensionId: 'YOUR_EXTENSION_ID'
   }).then(response => {
     console.log('Response:', response);
   });
   ```

## 📋 Expected Logs

### Khi Click "Tắt":
```
[Popup Console]
Click detected: <button class="action-button disable"...>
[Service Worker Console]
Message received: {action: "disableExtension", extensionId: "..."}
```

### Khi Click "Gỡ":
```
[Popup Console]
Click detected: <button class="action-button uninstall"...>
[Service Worker Console]
Message received: {action: "uninstallExtension", extensionId: "..."}
```

### Khi Click "Giữ":
```
[Popup Console]
Click detected: <button class="action-button keep"...>
[Service Worker Console]
Message received: {action: "keepExtension", extensionId: "..."}
```

## ⚠️ Common Issues

### Issue 1: Button Click Không Hoạt Động
**Nguyên nhân**: Event listener chưa được attach
**Giải pháp**: 
- Đảm bảo `popup.js` được load đúng
- Kiểm tra `DOMContentLoaded` event

### Issue 2: Message Không Đến Background
**Nguyên nhân**: Service worker bị inactive
**Giải pháp**:
- Reload extension
- Kiểm tra service worker console có mở không

### Issue 3: Permission Denied
**Nguyên nhân**: Thiếu permission "management"
**Giải pháp**:
- Kiểm tra manifest.json
- Reload extension

## 🔧 Quick Fix

Nếu vẫn không hoạt động, thử:

1. **Reload Extension**:
   - Vào `chrome://extensions/`
   - Click "Reload" trên Extension Analyzer

2. **Clear Storage**:
   ```javascript
   // Trong Service Worker Console:
   chrome.storage.local.clear();
   ```

3. **Reinstall Extension**:
   - Remove extension
   - Load unpacked lại

## ✅ Verification

Sau khi sửa, test lại:

1. ✅ Click "Tắt" → Extension bị disable
2. ✅ Click "Gỡ" → Extension bị uninstall
3. ✅ Click "Giữ" → Extension được đánh dấu (check storage)

Nếu vẫn không hoạt động, mở Console và copy error message để debug tiếp.



## ✅ Đã Sửa

1. **Thay `onclick` bằng Event Delegation**: 
   - Không dùng `onclick="function()"` trong HTML động
   - Dùng `data-action` và `data-extension-id` attributes
   - Event listener bắt tất cả clicks trên `.action-button`

2. **Cải thiện Error Handling**:
   - Log chi tiết lỗi vào console
   - Hiển thị error message rõ ràng

## 🧪 Cách Test

### Bước 1: Mở Popup Console
1. Click vào icon Extension Analyzer
2. Right-click vào popup → "Inspect" (hoặc F12)
3. Chuyển sang tab "Console"

### Bước 2: Test Actions
1. Quét extensions
2. Click vào button "Tắt", "Gỡ", hoặc "Giữ"
3. Xem Console để kiểm tra:
   - Có log nào không?
   - Có error nào không?

### Bước 3: Kiểm Tra Background Service Worker
1. Vào `chrome://extensions/`
2. Tìm "Extension Security Analyzer"
3. Click "service worker" để mở console
4. Thử action lại → xem có log trong service worker console không

## 🔍 Debug Checklist

### Nếu Button Không Phản Ứng:

1. **Kiểm tra Event Listener**:
   ```javascript
   // Trong Popup Console, chạy:
   document.querySelectorAll('.action-button').forEach(btn => {
     console.log('Button:', btn.getAttribute('data-action'), btn.getAttribute('data-extension-id'));
   });
   ```
   - Phải thấy các buttons với data attributes đúng

2. **Kiểm tra Click Event**:
   ```javascript
   // Trong Popup Console, chạy:
   document.addEventListener('click', (e) => {
     console.log('Click detected:', e.target);
   });
   ```
   - Click button → phải thấy log

### Nếu Có Error:

1. **Error: "Extension context invalidated"**:
   - Reload extension (`chrome://extensions/` → Reload)
   - Đóng và mở lại popup

2. **Error: "Cannot access chrome.management"**:
   - Kiểm tra manifest.json có `"permissions": ["management"]`
   - Reload extension

3. **Error: "sendResponse is not a function"**:
   - Background service worker có vấn đề
   - Kiểm tra background.js console

### Nếu Action Không Thực Hiện:

1. **Kiểm tra Background Message Handler**:
   ```javascript
   // Trong Service Worker Console, chạy:
   chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
     console.log('Message received:', request);
     return true;
   });
   ```

2. **Test Manual**:
   ```javascript
   // Trong Popup Console, chạy:
   chrome.runtime.sendMessage({
     action: 'disableExtension',
     extensionId: 'YOUR_EXTENSION_ID'
   }).then(response => {
     console.log('Response:', response);
   });
   ```

## 📋 Expected Logs

### Khi Click "Tắt":
```
[Popup Console]
Click detected: <button class="action-button disable"...>
[Service Worker Console]
Message received: {action: "disableExtension", extensionId: "..."}
```

### Khi Click "Gỡ":
```
[Popup Console]
Click detected: <button class="action-button uninstall"...>
[Service Worker Console]
Message received: {action: "uninstallExtension", extensionId: "..."}
```

### Khi Click "Giữ":
```
[Popup Console]
Click detected: <button class="action-button keep"...>
[Service Worker Console]
Message received: {action: "keepExtension", extensionId: "..."}
```

## ⚠️ Common Issues

### Issue 1: Button Click Không Hoạt Động
**Nguyên nhân**: Event listener chưa được attach
**Giải pháp**: 
- Đảm bảo `popup.js` được load đúng
- Kiểm tra `DOMContentLoaded` event

### Issue 2: Message Không Đến Background
**Nguyên nhân**: Service worker bị inactive
**Giải pháp**:
- Reload extension
- Kiểm tra service worker console có mở không

### Issue 3: Permission Denied
**Nguyên nhân**: Thiếu permission "management"
**Giải pháp**:
- Kiểm tra manifest.json
- Reload extension

## 🔧 Quick Fix

Nếu vẫn không hoạt động, thử:

1. **Reload Extension**:
   - Vào `chrome://extensions/`
   - Click "Reload" trên Extension Analyzer

2. **Clear Storage**:
   ```javascript
   // Trong Service Worker Console:
   chrome.storage.local.clear();
   ```

3. **Reinstall Extension**:
   - Remove extension
   - Load unpacked lại

## ✅ Verification

Sau khi sửa, test lại:

1. ✅ Click "Tắt" → Extension bị disable
2. ✅ Click "Gỡ" → Extension bị uninstall
3. ✅ Click "Giữ" → Extension được đánh dấu (check storage)

Nếu vẫn không hoạt động, mở Console và copy error message để debug tiếp.


