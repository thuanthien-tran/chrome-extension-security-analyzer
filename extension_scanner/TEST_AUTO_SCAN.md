# Hướng Dẫn Test Auto-Scan

## ✅ Đã Thêm Auto-Scan

Extension sẽ tự động quét khi:
1. **Extension Analyzer được cài/update** → `chrome.runtime.onInstalled`
2. **Chrome khởi động lại** → `chrome.runtime.onStartup`
3. **Extension khác được cài mới** → `chrome.management.onInstalled` ⭐
4. **Extension khác được enable** → `chrome.management.onEnabled`

## 🧪 Cách Test (5 giây)

### Bước 1: Load Extension Analyzer
1. Mở `chrome://extensions/`
2. Bật **"Developer mode"**
3. Click **"Load unpacked"**
4. Chọn thư mục `test_extensions/extension_scanner`
5. Extension sẽ tự động scan tất cả extensions hiện có

### Bước 2: Mở Service Worker Console
1. Vào `chrome://extensions/`
2. Tìm **"Extension Security Analyzer"**
3. Click **"service worker"** (hoặc "Inspect views: service worker")
4. Console sẽ mở ra → đây là nơi xem logs

### Bước 3: Test Auto-Scan
1. **Cài một extension test mới**:
   - Load unpacked một extension test (ví dụ: `critical_risk_extension`)
   - **Ngay lập tức** xem Service Worker Console
   - Sẽ thấy log: `[Analyzer][AUTO-SCAN] New extension installed: ...`

2. **Enable một extension**:
   - Tắt một extension bất kỳ
   - Bật lại extension đó
   - Xem Console → sẽ thấy log: `[Analyzer][AUTO-SCAN] Extension enabled: ...`

## 📋 Logs Mẫu

Khi cài extension mới, bạn sẽ thấy:

```
[Analyzer][AUTO-SCAN] New extension installed: Critical Risk Extension - Malicious Tracker abc123...
[SCAN][management.onInstalled] Scanning extension: abc123...
[SCAN][management.onInstalled] Extension "Critical Risk Extension - Malicious Tracker" - Risk: CRITICAL (95/100)
[SCAN][management.onInstalled] ⚠️ DANGEROUS EXTENSION DETECTED: Critical Risk Extension - Malicious Tracker
[SCAN][management.onInstalled] Risk Level: CRITICAL, Score: 95/100
[SCAN][management.onInstalled] Reasons: [...]
```

## 🔍 Kiểm Tra Kết Quả

Kết quả scan được lưu trong `chrome.storage.local`:
- Key: `scan_result_{extensionId}`
- Chứa: risk score, risk level, reasons, recommendations, etc.

Để xem:
1. Mở Service Worker Console
2. Chạy:
```javascript
chrome.storage.local.get(null, (items) => {
  console.log('All scan results:', items);
});
```

## ⚠️ Troubleshooting

### Không thấy logs?
1. **Kiểm tra permission "management"**:
   - Vào `chrome://extensions/`
   - Tìm Extension Analyzer
   - Xem "Permissions" → phải có "management"

2. **Kiểm tra Service Worker**:
   - Service Worker phải đang chạy (không bị "inactive")
   - Nếu inactive, reload extension

3. **Kiểm tra Console**:
   - Đảm bảo đang xem đúng Service Worker Console
   - Không phải Popup Console hay Content Script Console

### Extension không tự động scan?
1. **Reload Extension Analyzer**:
   - Vào `chrome://extensions/`
   - Click nút "Reload" trên Extension Analyzer

2. **Kiểm tra manifest.json**:
   - Phải có `"permissions": ["management", "storage"]`
   - Phải có `"background": {"service_worker": "background.js"}`

3. **Test thủ công**:
   - Mở popup extension
   - Click "Quét Extensions"
   - Nếu hoạt động → auto-scan sẽ hoạt động sau khi reload

## ✅ Checklist

- [ ] Extension Analyzer đã load thành công
- [ ] Service Worker Console mở được
- [ ] Thấy log `[Analyzer] Extension installed/updated` khi reload
- [ ] Cài extension test mới → thấy log `[Analyzer][AUTO-SCAN] New extension installed`
- [ ] Kết quả scan được lưu trong storage

## 🎯 Expected Behavior

1. **Khi cài extension mới**:
   - Tự động scan ngay lập tức
   - Log trong Service Worker Console
   - Kết quả lưu vào storage

2. **Khi Chrome khởi động**:
   - Tự động scan tất cả extensions
   - Log: `[SCAN][onStartup] Starting scan...`

3. **Khi Analyzer được update**:
   - Tự động scan tất cả extensions
   - Log: `[SCAN][onInstalled] Starting scan...`



## ✅ Đã Thêm Auto-Scan

Extension sẽ tự động quét khi:
1. **Extension Analyzer được cài/update** → `chrome.runtime.onInstalled`
2. **Chrome khởi động lại** → `chrome.runtime.onStartup`
3. **Extension khác được cài mới** → `chrome.management.onInstalled` ⭐
4. **Extension khác được enable** → `chrome.management.onEnabled`

## 🧪 Cách Test (5 giây)

### Bước 1: Load Extension Analyzer
1. Mở `chrome://extensions/`
2. Bật **"Developer mode"**
3. Click **"Load unpacked"**
4. Chọn thư mục `test_extensions/extension_scanner`
5. Extension sẽ tự động scan tất cả extensions hiện có

### Bước 2: Mở Service Worker Console
1. Vào `chrome://extensions/`
2. Tìm **"Extension Security Analyzer"**
3. Click **"service worker"** (hoặc "Inspect views: service worker")
4. Console sẽ mở ra → đây là nơi xem logs

### Bước 3: Test Auto-Scan
1. **Cài một extension test mới**:
   - Load unpacked một extension test (ví dụ: `critical_risk_extension`)
   - **Ngay lập tức** xem Service Worker Console
   - Sẽ thấy log: `[Analyzer][AUTO-SCAN] New extension installed: ...`

2. **Enable một extension**:
   - Tắt một extension bất kỳ
   - Bật lại extension đó
   - Xem Console → sẽ thấy log: `[Analyzer][AUTO-SCAN] Extension enabled: ...`

## 📋 Logs Mẫu

Khi cài extension mới, bạn sẽ thấy:

```
[Analyzer][AUTO-SCAN] New extension installed: Critical Risk Extension - Malicious Tracker abc123...
[SCAN][management.onInstalled] Scanning extension: abc123...
[SCAN][management.onInstalled] Extension "Critical Risk Extension - Malicious Tracker" - Risk: CRITICAL (95/100)
[SCAN][management.onInstalled] ⚠️ DANGEROUS EXTENSION DETECTED: Critical Risk Extension - Malicious Tracker
[SCAN][management.onInstalled] Risk Level: CRITICAL, Score: 95/100
[SCAN][management.onInstalled] Reasons: [...]
```

## 🔍 Kiểm Tra Kết Quả

Kết quả scan được lưu trong `chrome.storage.local`:
- Key: `scan_result_{extensionId}`
- Chứa: risk score, risk level, reasons, recommendations, etc.

Để xem:
1. Mở Service Worker Console
2. Chạy:
```javascript
chrome.storage.local.get(null, (items) => {
  console.log('All scan results:', items);
});
```

## ⚠️ Troubleshooting

### Không thấy logs?
1. **Kiểm tra permission "management"**:
   - Vào `chrome://extensions/`
   - Tìm Extension Analyzer
   - Xem "Permissions" → phải có "management"

2. **Kiểm tra Service Worker**:
   - Service Worker phải đang chạy (không bị "inactive")
   - Nếu inactive, reload extension

3. **Kiểm tra Console**:
   - Đảm bảo đang xem đúng Service Worker Console
   - Không phải Popup Console hay Content Script Console

### Extension không tự động scan?
1. **Reload Extension Analyzer**:
   - Vào `chrome://extensions/`
   - Click nút "Reload" trên Extension Analyzer

2. **Kiểm tra manifest.json**:
   - Phải có `"permissions": ["management", "storage"]`
   - Phải có `"background": {"service_worker": "background.js"}`

3. **Test thủ công**:
   - Mở popup extension
   - Click "Quét Extensions"
   - Nếu hoạt động → auto-scan sẽ hoạt động sau khi reload

## ✅ Checklist

- [ ] Extension Analyzer đã load thành công
- [ ] Service Worker Console mở được
- [ ] Thấy log `[Analyzer] Extension installed/updated` khi reload
- [ ] Cài extension test mới → thấy log `[Analyzer][AUTO-SCAN] New extension installed`
- [ ] Kết quả scan được lưu trong storage

## 🎯 Expected Behavior

1. **Khi cài extension mới**:
   - Tự động scan ngay lập tức
   - Log trong Service Worker Console
   - Kết quả lưu vào storage

2. **Khi Chrome khởi động**:
   - Tự động scan tất cả extensions
   - Log: `[SCAN][onStartup] Starting scan...`

3. **Khi Analyzer được update**:
   - Tự động scan tất cả extensions
   - Log: `[SCAN][onInstalled] Starting scan...`


