# Test Notification Khi Phát Hiện Extension Mới

## ✅ Đã Thêm

1. **Notification Permission**: Thêm `"notifications"` vào manifest.json
2. **Auto Notification**: Tự động hiển thị notification khi phát hiện extension mới
3. **Badge trên Icon**: Hiển thị badge (!, ?, ✓) trên icon extension
4. **Click Notification**: Click notification để mở popup xem chi tiết

## 🔧 Cách Test

### Bước 1: Reload Extension Analyzer
1. Vào `chrome://extensions/`
2. Tìm "Extension Security Analyzer"
3. Click **"Reload"**
4. **Quan trọng**: Chrome sẽ hỏi permission "Notifications" → Click **"Allow"**

### Bước 2: Cài Extension Mới
1. Vào Chrome Web Store
2. Cài một extension bất kỳ (ví dụ: "Pinterest", "AdBlock", etc.)
3. **Ngay lập tức** bạn sẽ thấy:
   - ✅ **Notification popup** xuất hiện ở góc màn hình
   - ✅ **Badge** trên icon Extension Analyzer (!, ?, hoặc ✓)

### Bước 3: Kiểm Tra Notification
Notification sẽ hiển thị:
- **Title**: "🔴 Extension Mới Được Phát Hiện" (emoji thay đổi theo risk level)
- **Message**: Tên extension + Risk level + Score
- **Button**: "Xem Chi Tiết"

### Bước 4: Click Notification
1. Click vào notification hoặc button "Xem Chi Tiết"
2. Popup Extension Analyzer sẽ mở
3. Xem kết quả scan chi tiết

## 📋 Badge Colors

- **🔴 CRITICAL/HIGH**: Badge "!" màu đỏ
- **🟡 MEDIUM**: Badge "?" màu cam
- **🟢 LOW**: Badge "✓" màu xanh

## 🎯 Expected Behavior

### Khi Cài Extension Mới:

1. **Immediate Detection**:
   - Event `chrome.management.onInstalled` được trigger
   - Extension được scan tự động

2. **Notification Display**:
   - Notification popup xuất hiện trong vòng 1-2 giây
   - Hiển thị tên extension và risk level

3. **Badge Update**:
   - Badge xuất hiện trên icon Extension Analyzer
   - Màu sắc và text thay đổi theo risk level

4. **Badge Clear**:
   - Badge tự động xóa khi user mở popup

## ⚠️ Troubleshooting

### Nếu Không Thấy Notification:

1. **Kiểm tra Permission**:
   - Vào `chrome://extensions/`
   - Tìm Extension Analyzer
   - Xem "Permissions" → phải có "notifications"
   - Nếu không có, reload extension và cho phép notification

2. **Kiểm tra Chrome Settings**:
   - Vào `chrome://settings/content/notifications`
   - Đảm bảo notifications không bị block

3. **Kiểm tra Service Worker**:
   - Mở Service Worker Console
   - Xem có log `[Analyzer][NOTIFICATION]` không
   - Xem có error nào không

### Nếu Badge Không Hiển Thị:

1. **Kiểm tra Icon**:
   - Icon extension phải có trong toolbar
   - Nếu không thấy, click puzzle icon → pin extension

2. **Kiểm tra Console**:
   - Xem có log `[Analyzer][BADGE]` không
   - Xem có error nào không

### Debug Commands:

Trong Service Worker Console:

```javascript
// Test notification manually
chrome.notifications.create({
  type: 'basic',
  iconUrl: 'icons/icon48.png',
  title: 'Test Notification',
  message: 'This is a test'
});

// Test badge
chrome.action.setBadgeText({ text: '!' });
chrome.action.setBadgeBackgroundColor({ color: '#dc2626' });

// Clear badge
chrome.action.setBadgeText({ text: '' });
```

## 📝 Notes

- **Notification** chỉ hiển thị khi extension mới được cài
- **Badge** sẽ tự động clear khi user mở popup
- **Periodic check** vẫn chạy mỗi 30 giây để đảm bảo không bỏ sót
- **Notification permission** cần được user cho phép lần đầu

## ✅ Verification Checklist

- [ ] Extension Analyzer đã reload
- [ ] Notification permission đã được cho phép
- [ ] Cài extension mới → thấy notification popup
- [ ] Badge xuất hiện trên icon extension
- [ ] Click notification → popup mở
- [ ] Badge tự động clear khi mở popup



## ✅ Đã Thêm

1. **Notification Permission**: Thêm `"notifications"` vào manifest.json
2. **Auto Notification**: Tự động hiển thị notification khi phát hiện extension mới
3. **Badge trên Icon**: Hiển thị badge (!, ?, ✓) trên icon extension
4. **Click Notification**: Click notification để mở popup xem chi tiết

## 🔧 Cách Test

### Bước 1: Reload Extension Analyzer
1. Vào `chrome://extensions/`
2. Tìm "Extension Security Analyzer"
3. Click **"Reload"**
4. **Quan trọng**: Chrome sẽ hỏi permission "Notifications" → Click **"Allow"**

### Bước 2: Cài Extension Mới
1. Vào Chrome Web Store
2. Cài một extension bất kỳ (ví dụ: "Pinterest", "AdBlock", etc.)
3. **Ngay lập tức** bạn sẽ thấy:
   - ✅ **Notification popup** xuất hiện ở góc màn hình
   - ✅ **Badge** trên icon Extension Analyzer (!, ?, hoặc ✓)

### Bước 3: Kiểm Tra Notification
Notification sẽ hiển thị:
- **Title**: "🔴 Extension Mới Được Phát Hiện" (emoji thay đổi theo risk level)
- **Message**: Tên extension + Risk level + Score
- **Button**: "Xem Chi Tiết"

### Bước 4: Click Notification
1. Click vào notification hoặc button "Xem Chi Tiết"
2. Popup Extension Analyzer sẽ mở
3. Xem kết quả scan chi tiết

## 📋 Badge Colors

- **🔴 CRITICAL/HIGH**: Badge "!" màu đỏ
- **🟡 MEDIUM**: Badge "?" màu cam
- **🟢 LOW**: Badge "✓" màu xanh

## 🎯 Expected Behavior

### Khi Cài Extension Mới:

1. **Immediate Detection**:
   - Event `chrome.management.onInstalled` được trigger
   - Extension được scan tự động

2. **Notification Display**:
   - Notification popup xuất hiện trong vòng 1-2 giây
   - Hiển thị tên extension và risk level

3. **Badge Update**:
   - Badge xuất hiện trên icon Extension Analyzer
   - Màu sắc và text thay đổi theo risk level

4. **Badge Clear**:
   - Badge tự động xóa khi user mở popup

## ⚠️ Troubleshooting

### Nếu Không Thấy Notification:

1. **Kiểm tra Permission**:
   - Vào `chrome://extensions/`
   - Tìm Extension Analyzer
   - Xem "Permissions" → phải có "notifications"
   - Nếu không có, reload extension và cho phép notification

2. **Kiểm tra Chrome Settings**:
   - Vào `chrome://settings/content/notifications`
   - Đảm bảo notifications không bị block

3. **Kiểm tra Service Worker**:
   - Mở Service Worker Console
   - Xem có log `[Analyzer][NOTIFICATION]` không
   - Xem có error nào không

### Nếu Badge Không Hiển Thị:

1. **Kiểm tra Icon**:
   - Icon extension phải có trong toolbar
   - Nếu không thấy, click puzzle icon → pin extension

2. **Kiểm tra Console**:
   - Xem có log `[Analyzer][BADGE]` không
   - Xem có error nào không

### Debug Commands:

Trong Service Worker Console:

```javascript
// Test notification manually
chrome.notifications.create({
  type: 'basic',
  iconUrl: 'icons/icon48.png',
  title: 'Test Notification',
  message: 'This is a test'
});

// Test badge
chrome.action.setBadgeText({ text: '!' });
chrome.action.setBadgeBackgroundColor({ color: '#dc2626' });

// Clear badge
chrome.action.setBadgeText({ text: '' });
```

## 📝 Notes

- **Notification** chỉ hiển thị khi extension mới được cài
- **Badge** sẽ tự động clear khi user mở popup
- **Periodic check** vẫn chạy mỗi 30 giây để đảm bảo không bỏ sót
- **Notification permission** cần được user cho phép lần đầu

## ✅ Verification Checklist

- [ ] Extension Analyzer đã reload
- [ ] Notification permission đã được cho phép
- [ ] Cài extension mới → thấy notification popup
- [ ] Badge xuất hiện trên icon extension
- [ ] Click notification → popup mở
- [ ] Badge tự động clear khi mở popup


