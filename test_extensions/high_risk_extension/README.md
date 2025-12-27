# High Risk Extension - Test Extension

Extension này được thiết kế để test hệ thống tính điểm với **target score ~50-70/100 (HIGH)**.

## Đặc điểm nguy hiểm

### 1. Permissions (High Risk)
- `cookies` (4 điểm)
- `webRequest` (4 điểm)
- `scripting` (3 điểm)
- `tabs` (1 điểm)
- `history` (2 điểm)
- `storage` (1 điểm)
- `webNavigation` (2 điểm)
- **Total: ~17 điểm → Cap at 40**

### 2. Host Permissions (High Risk)
- `<all_urls>` (implicit từ `https://*/*` và `http://*/*`)
- **Score: ~30 điểm**

### 3. Content Script Scope (High Risk)
- `<all_urls>` injection → 4 điểm
- `run_at = document_start` → +1 điểm
- `all_frames: true` → +1 điểm
- **Total: ~6 điểm**

### 4. Code Patterns (High Risk)
- **High (3 điểm):**
  - Keydown tracking (keylogger pattern)
  - Form data capture
  - Cookie access
  - DOM rewrite (innerHTML)
  - Fetch/XHR interception
  - Script injection

- **Medium (1 điểm):**
  - MutationObserver
  - localStorage/sessionStorage access
  - Base64 encoding/decoding
  - Function constructor
  - setTimeout with string

### 5. RCE/Exfiltration Patterns (Medium-High Risk)
- Function constructor → 30 điểm
- setTimeout with string → 20 điểm
- Fetch to external server → 25 điểm
- Data export functionality → 20 điểm
- **Total: ~30-40 điểm**

### 6. Obfuscation (Low-Medium Risk)
- Base64 encoding/decoding → 2 điểm
- Multi-layer encoding → 1 điểm
- **Total: ~3 điểm**

### 7. Chrome API Abuse (High Risk)
- Cookies API (getAll) → 10 điểm
- WebRequest API (monitor all) → 10 điểm
- History API (extensive search) → 5 điểm
- Storage.sync access → 3 điểm
- **Total: ~28 điểm**

## Tính điểm dự kiến (Google Standard)

```
Manifest Risk: ~50/100 × 35% = 17.5
Code Patterns: ~40/100 × 30% = 12.0
RCE/Exfil: ~35/100 × 20% = 7.0
Obfuscation: ~30/100 × 10% = 3.0
Chrome API Abuse: ~28/100 × 5% = 1.4
─────────────────────────────
Total Weighted: ~41/100
```

**Risk Level:** HIGH (50-70) ✅

## Các patterns được thêm:

1. **Universal Host Permissions** - `<all_urls>` access
2. **Universal Content Scripts** - Inject vào tất cả pages
3. **Keylogger Pattern** - Track keydown events
4. **Cookie Theft** - Access và store cookies
5. **Form Data Capture** - Intercept form submissions
6. **Network Monitoring** - WebRequest listener cho tất cả requests
7. **Data Exfiltration** - Fetch to external server
8. **Dynamic Code Execution** - Function constructor, setTimeout string
9. **Fingerprinting** - Collect screen, navigator, timezone info
10. **Script Injection** - Inject script vào page

## Cách test

1. Scan extension này trên Flask Analyzer UI (`http://localhost:5000`)
2. Chọn "Chọn Thư Mục Extension"
3. Chọn thư mục `test_extensions/high_risk_extension/`
4. Click "Quét Extension"
5. Kỳ vọng: Risk Score ~50-70/100, Risk Level = HIGH

## Lưu ý

Extension này chỉ để **test analyzer**, không phải extension thực tế. Không nên cài đặt vào Chrome.

