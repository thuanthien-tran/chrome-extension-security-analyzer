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

API ENDPOINTS:
- POST /api/scan-extension (scan thư mục/zip)
- GET /api/list-installed-extensions
- POST /api/analyze-installed-extension
- GET /api/health

============ CÁCH CÀI ĐẬT ============

CÀI ĐẶT:
1. Tạo môi trường ảo (khuyến nghị)
2. Cài dependencies (tùy theo requirements của bạn).
3. Chạy python app.py (Server chạy tại http://localhost:5000)

LOAD EXTENSION SCANNER:
1. Mở chrome://extensions
2. Bật Developer mode
3. Load unpacked → chọn thư mục extension_scanner/
4. Mở popup để xem danh sách/quét/hiển thị breakdown (UI render risk score + permissions + behavior flags…)

TEST NHANH VỚI EXTENSION MẪU (TEST_EXTENSION)
Repo của bạn có file JS “high-risk” chứa nhiều pattern độc hại như:
- cookie/token theft (chrome.cookies + document.cookie + localStorage/sessionStorage)
- exfiltration qua fetch, sendBeacon
- eval(), new Function(), remote script loading, dynamic import…
=> dùng để chứng minh engine phát hiện đúng các dấu hiệu “critical”.
(Lưu ý: Đây là mã mô phỏng hành vi độc hại)

OUTPUT MẪU:
Kết quả trả về thường có:
- riskScore, riskLevel
- breakdown (static/runtime/…)
- top_findings, evidence, mitigation_recommendations
- scan_metadata (tên, version, manifest_version, số JS files…)

HẠN CHẾ HIỆN TẠI/ HƯỚNG PHÁT TRIỂN:
- Chưa có URL reputation nâng cao / sandbox dynamic analysis / ML analyzer chưa kích hoạt đầy đủ
- Phân tích hành vi phụ thuộc dữ liệu runtime logs
- Chưa có auto-remediation hoàn chỉnh






