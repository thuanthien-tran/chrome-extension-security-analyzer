============ Chrome Extension Security Analyzer (MV3) ============
- Hệ thống giám sát & đánh giá rủi ro extension độc hại trên Google Chrome bằng cách kết hợp:
- Phân tích tĩnh (Static Analysis): manifest, permissions, JS patterns, CSP, fingerprinting, minify/obfuscation…
- Quan sát runtime (Runtime Observation): phát hiện hành vi như DOM injection, keystroke capture, form hijacking…
- Phân tích mạng (Network Analysis): domain/tld đáng ngờ, dấu hiệu exfiltration, payload bất thường
- Correlation Layer: ghép chuỗi “manifest → code → hành vi → mạng” để nhận diện attack chain
- Hybrid Risk Scoring: chấm điểm rủi ro & phân loại SAFE → MALICIOUS (theo mô hình trọng số)

TÍNH NĂNG CHÍNH:
1. Quét extension theo 2 kiểu: Upload thư mục/ZIP extension để phân tích và Quét extension đã cài trên Chrome
2. Báo cáo kết quả dễ đọc: Risk score / risk level, Risk breakdown, Top findings + Evidence + Mitigation recommendations
3. Runtime detection (trên extension_scanner): Form hijacking / DOM injection, Keystroke capture (đếm sự kiện bàn phím bất thường)
4. Auto-scan & blacklist (Service Worker): Quét khi cài/upgrade analyzer, Quét khi Chrome startup, Tự kiểm tra blacklist và disable extension bị đưa vào blacklist khi khởi động

HYBRID RISK SCORING:
Hệ thống áp dụng “Google Standard Scoring” theo mô hình trọng số:
- Manifest: 35%
- Code patterns: 30%
- RCE/Exfil: 20%
- Obfuscation: 10%
- API abuse: 5%
→ trả về riskScore và riskLevel (SAFE → MALICIOUS)
