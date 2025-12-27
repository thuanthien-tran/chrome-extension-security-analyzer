# Fix CSP Violation Error

## 🔴 Lỗi

```
Executing inline event handler violates the following Content Security Policy directive 'script-src 'self''
```

## ✅ Đã Sửa

1. **Thêm CSP vào manifest.json**:
   ```json
   "content_security_policy": {
     "extension_pages": "script-src 'self'; object-src 'self'"
   }
   ```

2. **Đã xóa tất cả inline event handlers**:
   - Không còn `onclick="..."` trong code
   - Dùng event delegation với `data-action` và `data-extension-id`

## 🔧 Cách Fix

### Bước 1: Clear Cache và Reload Extension

1. **Vào `chrome://extensions/`**
2. **Tìm "Extension Security Analyzer"**
3. **Click "Reload"** (hoặc Remove rồi Load unpacked lại)
4. **Clear Browser Cache** (nếu cần):
   - Press `Ctrl+Shift+Delete`
   - Clear "Cached images and files"

### Bước 2: Kiểm Tra Console

1. **Mở Extension Popup**
2. **Right-click → Inspect** (hoặc F12)
3. **Xem Console tab**
4. **Nếu vẫn thấy CSP error**:
   - Đóng popup
   - Reload extension lại
   - Mở popup lại

### Bước 3: Verify Code

Đảm bảo không có inline handlers:

```bash
# Kiểm tra trong terminal:
grep -r "onclick" test_extensions/extension_scanner/
# Phải không có kết quả (trừ file .md)
```

## 📋 Verification

Sau khi reload, kiểm tra:

1. ✅ **Console không có CSP error**
2. ✅ **Buttons hoạt động** (Tắt/Gỡ/Giữ)
3. ✅ **Event delegation hoạt động** (xem logs trong console)

## ⚠️ Nếu Vẫn Còn Lỗi

### Option 1: Hard Reload
1. Remove extension hoàn toàn
2. Close Chrome
3. Mở Chrome lại
4. Load unpacked extension lại

### Option 2: Check Browser Console
1. Mở `chrome://extensions/`
2. Click "service worker" trên Extension Analyzer
3. Xem có error nào không

### Option 3: Verify Manifest
Đảm bảo manifest.json có:
```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
```

## 🎯 Expected Behavior

Sau khi fix:
- ✅ Không có CSP violation warnings
- ✅ Buttons hoạt động bình thường
- ✅ Console logs hiển thị đúng:
  ```
  [Popup] Event delegation listener attached
  [Popup] Click detected on: <button...>
  [Popup] Action button clicked: <button...>
  ```

## 📝 Notes

- CSP error có thể là từ **cache cũ** của Chrome
- **Reload extension** thường fix được vấn đề này
- Code hiện tại **không có inline handlers** nữa
- Event delegation là cách đúng để handle clicks trong Chrome extensions



## 🔴 Lỗi

```
Executing inline event handler violates the following Content Security Policy directive 'script-src 'self''
```

## ✅ Đã Sửa

1. **Thêm CSP vào manifest.json**:
   ```json
   "content_security_policy": {
     "extension_pages": "script-src 'self'; object-src 'self'"
   }
   ```

2. **Đã xóa tất cả inline event handlers**:
   - Không còn `onclick="..."` trong code
   - Dùng event delegation với `data-action` và `data-extension-id`

## 🔧 Cách Fix

### Bước 1: Clear Cache và Reload Extension

1. **Vào `chrome://extensions/`**
2. **Tìm "Extension Security Analyzer"**
3. **Click "Reload"** (hoặc Remove rồi Load unpacked lại)
4. **Clear Browser Cache** (nếu cần):
   - Press `Ctrl+Shift+Delete`
   - Clear "Cached images and files"

### Bước 2: Kiểm Tra Console

1. **Mở Extension Popup**
2. **Right-click → Inspect** (hoặc F12)
3. **Xem Console tab**
4. **Nếu vẫn thấy CSP error**:
   - Đóng popup
   - Reload extension lại
   - Mở popup lại

### Bước 3: Verify Code

Đảm bảo không có inline handlers:

```bash
# Kiểm tra trong terminal:
grep -r "onclick" test_extensions/extension_scanner/
# Phải không có kết quả (trừ file .md)
```

## 📋 Verification

Sau khi reload, kiểm tra:

1. ✅ **Console không có CSP error**
2. ✅ **Buttons hoạt động** (Tắt/Gỡ/Giữ)
3. ✅ **Event delegation hoạt động** (xem logs trong console)

## ⚠️ Nếu Vẫn Còn Lỗi

### Option 1: Hard Reload
1. Remove extension hoàn toàn
2. Close Chrome
3. Mở Chrome lại
4. Load unpacked extension lại

### Option 2: Check Browser Console
1. Mở `chrome://extensions/`
2. Click "service worker" trên Extension Analyzer
3. Xem có error nào không

### Option 3: Verify Manifest
Đảm bảo manifest.json có:
```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
```

## 🎯 Expected Behavior

Sau khi fix:
- ✅ Không có CSP violation warnings
- ✅ Buttons hoạt động bình thường
- ✅ Console logs hiển thị đúng:
  ```
  [Popup] Event delegation listener attached
  [Popup] Click detected on: <button...>
  [Popup] Action button clicked: <button...>
  ```

## 📝 Notes

- CSP error có thể là từ **cache cũ** của Chrome
- **Reload extension** thường fix được vấn đề này
- Code hiện tại **không có inline handlers** nữa
- Event delegation là cách đúng để handle clicks trong Chrome extensions


