# Extension Security Analyzer

Chrome Extension để phân tích bảo mật các extensions đã cài đặt, phát hiện mã độc và hành vi nguy hiểm.

## 🏗️ Kiến Trúc Theo Từng Lớp

### 🔹 Lớp 1: Extension Discovery Layer
- **API**: `chrome.management.getAll()`
- **Chức năng**: Thu thập danh sách extensions và metadata
- **Thu thập**:
  - `id`, `name`, `version`
  - `installType` → ⚠️ sideload/unpacked = +risk
  - `permissions`, `hostPermissions`
  - `enabled`
- **⚠️ Lưu ý**: Analyzer không truy cập source code extension khác do giới hạn sandbox của Chrome

### 🔹 Lớp 2: Static Analysis - Manifest-based
- **Phân tích**:
  - Permissions nguy hiểm: `webRequestBlocking` (+30), `debugger` (+40), `proxy` (+25), `cookies` (+15)
  - Host permissions: `<all_urls>` (+25)
  - Install source: sideloaded/unpacked (+10)
  - Excessive permissions: >10 permissions (+5 mỗi 5 permissions)
  - Dangerous combinations: cookies + `<all_urls>` (+10), webRequest + `<all_urls>` (+10)
- **Rule-based scoring**: Chấm điểm dựa trên quy tắc bảo mật chuẩn

### 🔹 Lớp 3: Runtime Observation
- **Không vi phạm Chrome**: Không đọc code extension khác
- **Quan sát hành vi trên trang web**:
  - DOM injection (script tags, iframes)
  - Keystroke capture (keydown, input events)
  - Network monitoring (fetch, XMLHttpRequest)
  - Log domain gửi dữ liệu
  - Tần suất & pattern
- **Correlation**: "Chỉ extension có quyền X mới làm được hành vi Y"

### 🔹 Lớp 4: Behavior Normalization
- **Chuẩn hóa hành vi thành vector**:
  ```javascript
  {
    dom_injection: true/false,
    keystroke_capture: true/false,
    external_post: true/false,
    fetch_domains: [],
    xhr_domains: [],
    suspicious_domains: [],
    frequency: 'low' | 'medium' | 'high',
    data_exfiltration: true/false
  }
  ```
- **Scoring**:
  - DOM Injection: +20
  - Keystroke Capture: +25
  - External POST: +30
  - Suspicious domains: +15 mỗi domain (max +30)
  - High frequency: +10

### 🔹 Lớp 5: Risk Correlation Engine
- **Kết hợp**:
  - Static score (70%)
  - Runtime score (30%)
  - Install source bonus (+5 nếu sideloaded/unpacked)
- **Final Risk Score**:
  - **LOW** (0-30)
  - **MEDIUM** (31-60)
  - **HIGH** (61-80)
  - **CRITICAL** (81-100)
- **Recommendations**: Tự động tạo khuyến nghị dựa trên risk level và findings

## 📦 Cài Đặt

1. Mở Chrome và vào `chrome://extensions/`
2. Bật "Developer mode"
3. Click "Load unpacked"
4. Chọn thư mục `test_extensions/extension_scanner`
5. Extension sẽ được cài đặt

## 🚀 Sử Dụng

1. Click vào icon Extension Security Analyzer
2. Click nút "🔍 Quét Extensions"
3. Xem kết quả phân tích:
   - **Risk Badge**: Màu sắc và mức độ rủi ro
   - **Permissions**: Danh sách quyền (đánh dấu nguy hiểm)
   - **Host Permissions**: Quyền truy cập websites
   - **Hành Vi Phát Hiện**: DOM injection, keystroke capture, etc.
   - **Lý Do Đánh Giá**: Giải thích tại sao extension nguy hiểm
   - **Khuyến Nghị**: Hành động nên thực hiện

## 🎯 Actions

- **⏸️ Tắt**: Tắt extension (có thể bật lại)
- **🗑️ Gỡ**: Gỡ cài đặt extension (không thể hoàn tác)
- **⚠️ Giữ**: Giữ extension và bỏ qua cảnh báo

## 🔒 Bảo Mật

- **Không truy cập source code**: Tuân thủ sandbox của Chrome
- **Chỉ quan sát hành vi**: Phân tích dựa trên manifest và runtime behavior
- **Privacy-first**: Không gửi dữ liệu ra ngoài (chạy local)

## 📊 Scoring Details

### Static Analysis Scoring
- `webRequestBlocking`: +30
- `debugger`: +40
- `proxy`: +25
- `cookies`: +15
- `<all_urls>`: +25
- Sideloaded/Unpacked: +10
- Excessive permissions: +5 mỗi 5 permissions (max +15)
- Cookie theft risk: +10
- Data exfiltration risk: +10

### Runtime Analysis Scoring
- DOM Injection: +20
- Keystroke Capture: +25
- External POST: +30
- Suspicious domains: +15 mỗi domain (max +30)
- High frequency: +10

## 🛠️ Development

### File Structure
```
extension_scanner/
├── manifest.json          # Extension manifest
├── background.js          # Service worker (Discovery, Static Analysis, Correlation)
├── content-observer.js    # Content script (Runtime Observation)
├── popup.html             # UI
├── popup.js               # UI logic
└── icons/                 # Extension icons
```

### Testing
1. Cài đặt extension
2. Cài một số test extensions (safe, medium, high, critical)
3. Chạy scan và kiểm tra kết quả

## 📝 Notes

- Extension này **không cần backend server** - chạy hoàn toàn local
- Runtime observation cần thời gian để thu thập dữ liệu (30 giây)
- Kết quả được lưu trong `chrome.storage.local`

## 🎓 Giải Thích Cho Báo Cáo

> **"Analyzer không truy cập source code extension khác do giới hạn sandbox của Chrome. Thay vào đó, hệ thống phân tích dựa trên manifest (permissions, host permissions) và quan sát hành vi runtime trên trang web. Cách tiếp cận này tuân thủ nguyên tắc bảo mật của Chrome và vẫn đạt được độ chính xác cao trong việc phát hiện mã độc."**

```
extension_scanner/
├── manifest.json          # Extension manifest
├── background.js          # Service worker (Discovery, Static Analysis, Correlation)
├── content-observer.js    # Content script (Runtime Observation)
├── popup.html             # UI
├── popup.js               # UI logic
└── icons/                 # Extension icons
```

### Testing
1. Cài đặt extension
2. Cài một số test extensions (safe, medium, high, critical)
3. Chạy scan và kiểm tra kết quả

## 📝 Notes

- Extension này **không cần backend server** - chạy hoàn toàn local
- Runtime observation cần thời gian để thu thập dữ liệu (30 giây)
- Kết quả được lưu trong `chrome.storage.local`

## 🎓 Giải Thích Cho Báo Cáo

> **"Analyzer không truy cập source code extension khác do giới hạn sandbox của Chrome. Thay vào đó, hệ thống phân tích dựa trên manifest (permissions, host permissions) và quan sát hành vi runtime trên trang web. Cách tiếp cận này tuân thủ nguyên tắc bảo mật của Chrome và vẫn đạt được độ chính xác cao trong việc phát hiện mã độc."**
