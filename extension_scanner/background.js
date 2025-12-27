/**
 * Extension Security Analyzer - Background Service Worker
 * Kiến trúc theo từng lớp:
 * 1. Extension Discovery Layer
 * 2. Static Analysis (Manifest-based)
 * 3. Runtime Observation (qua content script)
 * 4. Behavior Normalization
 * 5. Risk Correlation Engine
 */

// ============================================
// AUTO-SCAN EVENT LISTENERS
// ============================================

/**
 * 1) Quét toàn bộ khi extension Analyzer vừa được cài / update
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[Analyzer] Extension installed/updated:', details.reason);
  
  // Tạo context menu item
  chrome.contextMenus.create({
    id: 'analyze-extension',
    title: 'Phân tích với Extension Risk Analyzer',
    contexts: ['action']
  });
  
  await scanAllExtensions('onInstalled');
});

/**
 * 2) Quét khi Chrome khởi động lại (service worker không chạy liên tục)
 */
chrome.runtime.onStartup.addListener(async () => {
  console.log('[Analyzer] Chrome startup - checking blacklist and scanning extensions');
  
  // Kiểm tra và tắt extensions trong blacklist khi khởi động
  try {
    const allStored = await chrome.storage.local.get(null);
    const blacklist = [];
    Object.keys(allStored).forEach(key => {
      if (key.startsWith('blacklist_')) {
        blacklist.push(key.replace('blacklist_', ''));
      }
    });
    
    if (blacklist.length > 0) {
      console.log(`[Analyzer][STARTUP] Checking ${blacklist.length} blacklisted extensions...`);
      const allExtensions = await chrome.management.getAll();
      
      for (const extId of blacklist) {
        const ext = allExtensions.find(e => e.id === extId);
        if (ext && ext.enabled) {
          try {
            await chrome.management.setEnabled(extId, false);
            console.log(`[Analyzer][STARTUP] ✅ Disabled blacklisted extension: ${ext.name}`);
          } catch (disableError) {
            console.error(`[Analyzer][STARTUP] Error disabling ${ext.name}:`, disableError);
          }
        }
      }
    }
  } catch (error) {
    console.error('[Analyzer][STARTUP] Error checking blacklist:', error);
  }
  
  // Quét extensions (sẽ tự động bỏ qua whitelist)
  await scanAllExtensions('onStartup');
});

/**
 * 3) Quét NGAY khi phát hiện có extension khác được cài mới
 */
chrome.management.onInstalled.addListener(async (extInfo) => {
  try {
    // Bỏ qua chính extension này
    if (extInfo.id === chrome.runtime.id) {
      console.log('[Analyzer][AUTO-SCAN] Ignoring self installation');
      return;
    }
    
    // Kiểm tra autoScan setting
    const stored = await chrome.storage.local.get(['autoScan']);
    if (stored.autoScan === false) {
      console.log('[Analyzer][AUTO-SCAN] Auto-scan is disabled, skipping');
      return;
    }
    
    console.log(`[Analyzer][AUTO-SCAN] ⚡ New extension installed:`, extInfo.name, extInfo.id);
    console.log(`[Analyzer][AUTO-SCAN] Install type:`, extInfo.installType);
    
    // Kiểm tra blacklist - tự động tắt nếu trong blacklist
    const allStored = await chrome.storage.local.get(null);
    if (allStored[`blacklist_${extInfo.id}`]) {
      console.log(`[Analyzer][AUTO-SCAN] ⚠️ Extension ${extInfo.name} is in blacklist, disabling...`);
      try {
        // Đợi một chút để extension hoàn tất cài đặt trước khi tắt
        await new Promise(resolve => setTimeout(resolve, 500));
        await chrome.management.setEnabled(extInfo.id, false);
        console.log(`[Analyzer][AUTO-SCAN] ✅ Extension ${extInfo.name} has been disabled (blacklist)`);
      } catch (disableError) {
        console.error(`[Analyzer][AUTO-SCAN] Error disabling blacklisted extension:`, disableError);
        // Thử lại sau 1 giây nếu lần đầu thất bại
        setTimeout(async () => {
          try {
            await chrome.management.setEnabled(extInfo.id, false);
            console.log(`[Analyzer][AUTO-SCAN] ✅ Extension ${extInfo.name} has been disabled (blacklist, retry)`);
          } catch (retryError) {
            console.error(`[Analyzer][AUTO-SCAN] Error disabling blacklisted extension (retry):`, retryError);
          }
        }, 1000);
      }
      return; // Không scan extension trong blacklist
    }
    
    // Kiểm tra whitelist - bỏ qua scan nếu trong whitelist
    if (allStored[`whitelist_${extInfo.id}`]) {
      console.log(`[Analyzer][AUTO-SCAN] ✅ Extension ${extInfo.name} is in whitelist, skipping scan`);
      return;
    }
    
    // Đợi một chút để extension hoàn tất cài đặt
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Quét extension mới
    const result = await scanOneExtension(extInfo.id, 'management.onInstalled');
    
    if (result) {
      console.log(`[Analyzer][AUTO-SCAN] ✅ Scan completed for ${extInfo.name}`);
      
      // Lưu riêng extension mới (không merge vào lastScan)
      await saveNewExtensionResult(result);
      
      // Hiển thị notification popup cho extension mới cài (như trước)
      // Kiểm tra notifications setting trong showExtensionScanNotification
      await showExtensionScanNotification(extInfo, result);
      
      // Thêm badge trên icon
      await updateExtensionBadge(result);
      
      // Đánh dấu extension mới cần hiển thị khi popup mở
      await chrome.storage.local.set({
        newExtensionToShow: extInfo.id,
        newExtensionTimestamp: Date.now(),
        showOnlyNewExtension: true // Flag để chỉ hiển thị extension mới
      });
    } else {
      console.warn(`[Analyzer][AUTO-SCAN] ⚠️ Scan failed for ${extInfo.name}`);
    }
  } catch (error) {
    console.error('[Analyzer][AUTO-SCAN] Error in onInstalled listener:', error);
  }
});

/**
 * 4) Quét khi extension được enable
 */
chrome.management.onEnabled.addListener(async (extInfo) => {
  try {
    if (extInfo.id === chrome.runtime.id) {
      return;
    }
    
    // Kiểm tra autoScan setting
    const stored = await chrome.storage.local.get(['autoScan']);
    if (stored.autoScan === false) {
      return;
    }
    
    // Kiểm tra blacklist - tự động tắt lại nếu trong blacklist
    const allStored = await chrome.storage.local.get(null);
    if (allStored[`blacklist_${extInfo.id}`]) {
      console.log(`[Analyzer][AUTO-SCAN] ⚠️ Extension ${extInfo.name} is in blacklist, disabling...`);
      try {
        // Đợi một chút để đảm bảo extension đã enable hoàn toàn
        await new Promise(resolve => setTimeout(resolve, 200));
        await chrome.management.setEnabled(extInfo.id, false);
        console.log(`[Analyzer][AUTO-SCAN] ✅ Extension ${extInfo.name} has been disabled (blacklist)`);
      } catch (disableError) {
        console.error(`[Analyzer][AUTO-SCAN] Error disabling blacklisted extension:`, disableError);
        // Thử lại sau 1 giây nếu lần đầu thất bại
        setTimeout(async () => {
          try {
            await chrome.management.setEnabled(extInfo.id, false);
            console.log(`[Analyzer][AUTO-SCAN] ✅ Extension ${extInfo.name} has been disabled (blacklist, retry)`);
          } catch (retryError) {
            console.error(`[Analyzer][AUTO-SCAN] Error disabling blacklisted extension (retry):`, retryError);
          }
        }, 1000);
      }
      return; // Không scan extension trong blacklist
    }
    
    // Kiểm tra whitelist - bỏ qua scan nếu trong whitelist
    if (allStored[`whitelist_${extInfo.id}`]) {
      console.log(`[Analyzer][AUTO-SCAN] ✅ Extension ${extInfo.name} is in whitelist, skipping scan`);
      return;
    }
    
    console.log(`[Analyzer][AUTO-SCAN] Extension enabled:`, extInfo.name, extInfo.id);
    await scanOneExtension(extInfo.id, 'management.onEnabled');
  } catch (error) {
    console.error('[Analyzer][AUTO-SCAN] Error in onEnabled listener:', error);
  }
});

/**
 * 5) Fallback: Kiểm tra extensions định kỳ (mỗi 30 giây)
 * Đảm bảo không bỏ sót extension nào
 */
let lastExtensionCount = 0;
let extensionCheckInterval = null;

async function checkForNewExtensions() {
  try {
    const allExtensions = await chrome.management.getAll();
    const userExtensions = allExtensions.filter(ext => 
      ext.type === 'extension' && 
      ext.id !== chrome.runtime.id &&
      !ext.isApp
    );
    
    const currentCount = userExtensions.length;
    
    if (currentCount !== lastExtensionCount) {
      console.log(`[Analyzer][PERIODIC] Extension count changed: ${lastExtensionCount} → ${currentCount}`);
      
      if (currentCount > lastExtensionCount) {
        // Có extension mới được cài - quét tất cả để đảm bảo không bỏ sót
        console.log(`[Analyzer][PERIODIC] New extension(s) detected, scanning all...`);
        
        // Lấy whitelist để bỏ qua
        const allStored = await chrome.storage.local.get(null);
        const whitelist = new Set();
        Object.keys(allStored).forEach(key => {
          if (key.startsWith('whitelist_')) {
            whitelist.add(key.replace('whitelist_', ''));
          }
        });
        
        for (const ext of userExtensions) {
          // Bỏ qua extension trong whitelist
          if (whitelist.has(ext.id)) {
            console.log(`[Analyzer][PERIODIC] Skipping ${ext.name} (in whitelist)`);
            continue;
          }
          
          // Kiểm tra xem extension này đã được scan chưa
          const storageKey = `scan_result_${ext.id}`;
          const stored = await chrome.storage.local.get(storageKey);
          
          if (!stored[storageKey]) {
            // Extension chưa được scan
            console.log(`[Analyzer][PERIODIC] Scanning new extension: ${ext.name}`);
            await scanOneExtension(ext.id, 'periodic-check');
          }
        }
      }
      
      lastExtensionCount = currentCount;
    }
  } catch (error) {
    console.error('[Analyzer][PERIODIC] Error checking extensions:', error);
  }
}

// Khởi động periodic check khi service worker start
async function initializePeriodicCheck() {
  try {
    const allExtensions = await chrome.management.getAll();
    const userExtensions = allExtensions.filter(ext => 
      ext.type === 'extension' && 
      ext.id !== chrome.runtime.id &&
      !ext.isApp
    );
    lastExtensionCount = userExtensions.length;
    console.log(`[Analyzer][INIT] Initial extension count: ${lastExtensionCount}`);
    
    // Kiểm tra mỗi 30 giây
    if (extensionCheckInterval) {
      clearInterval(extensionCheckInterval);
    }
    extensionCheckInterval = setInterval(checkForNewExtensions, 30000);
    console.log('[Analyzer][INIT] Periodic check started (every 30s)');
  } catch (error) {
    console.error('[Analyzer][INIT] Error initializing periodic check:', error);
  }
}

// Khởi động khi service worker được load
initializePeriodicCheck();

// ============================================
// LỚP 1: EXTENSION DISCOVERY LAYER
// ============================================

/**
 * Lấy danh sách tất cả extensions đã cài đặt
 * Sử dụng chrome.management.getAll() - không truy cập source code
 */
async function discoverExtensions() {
  try {
    console.log('[Background] discoverExtensions: Starting...');
    const allExtensions = await chrome.management.getAll();
    console.log('[Background] discoverExtensions: Got', allExtensions.length, 'total extensions from Chrome');
    
    // Lọc bỏ Chrome extensions mặc định và extension này
    const userExtensions = allExtensions.filter(ext => {
      return ext.type === 'extension' && 
             ext.id !== chrome.runtime.id &&
             !ext.isApp;
    });
    
    console.log('[Background] discoverExtensions: Filtered to', userExtensions.length, 'user extensions');
    
    // Thu thập metadata
    const extensionsMetadata = userExtensions.map(ext => ({
      id: ext.id,
      name: ext.name,
      version: ext.version,
      installType: ext.installType || 'normal',
      permissions: ext.permissions || [],
      hostPermissions: ext.hostPermissions || [],
      enabled: ext.enabled,
      description: ext.description || '',
      homepageUrl: ext.homepageUrl || '',
      // ⚠️ sideload / unpacked = +risk
      isSideloaded: ext.installType === 'sideload' || ext.installType === 'development',
      isUnpacked: ext.installType === 'development'
    }));
    
    console.log('[Background] discoverExtensions: Returning', extensionsMetadata.length, 'extensions');
    return extensionsMetadata;
  } catch (error) {
    console.error('[Background] Error discovering extensions:', error);
    console.error('[Background] Error stack:', error.stack);
    throw error;
  }
}

// ============================================
// LỚP 2: STATIC ANALYSIS - MANIFEST-BASED
// ============================================

/**
 * Phân tích manifest và tính điểm rủi ro tĩnh
 * Rule-based scoring theo chuẩn bảo mật
 */
function analyzeManifestStatic(extension) {
  let riskScore = 0;
  const flags = [];
  const suspiciousPatterns = [];
  const reasons = [];
  
  // === PERMISSIONS NGUY HIỂM ===
  
  // webRequestBlocking: +30 (có thể chặn/modify requests)
  if (extension.permissions.includes('webRequestBlocking')) {
    riskScore += 30;
    flags.push('DANGEROUS_PERMISSION_WEBREQUESTBLOCKING');
    reasons.push('Có quyền chặn và sửa đổi network requests');
  }
  
  // debugger: +40 (có thể debug và inject code)
  if (extension.permissions.includes('debugger')) {
    riskScore += 40;
    flags.push('CRITICAL_PERMISSION_DEBUGGER');
    reasons.push('Có quyền debugger - có thể inject code vào bất kỳ trang nào');
  }
  
  // proxy: +25 (có thể redirect traffic)
  if (extension.permissions.includes('proxy')) {
    riskScore += 25;
    flags.push('DANGEROUS_PERMISSION_PROXY');
    reasons.push('Có quyền proxy - có thể redirect network traffic');
  }
  
  // cookies: +15 (có thể đọc cookies)
  if (extension.permissions.includes('cookies')) {
    riskScore += 15;
    flags.push('COOKIE_ACCESS');
    reasons.push('Có quyền đọc cookies - nguy cơ cookie theft');
  }
  
  // === HOST PERMISSIONS ===
  
  // <all_urls>: +25 (truy cập tất cả websites)
  const hasUniversalAccess = extension.hostPermissions.some(perm => 
    perm === '<all_urls>' || perm === '*://*/*' || perm === 'http://*/*' || perm === 'https://*/*'
  );
  
  if (hasUniversalAccess) {
    riskScore += 25;
    flags.push('UNIVERSAL_HOST_ACCESS');
    reasons.push('Có quyền truy cập tất cả websites (<all_urls>)');
  }
  
  // === INSTALL SOURCE ===
  
  // Sideloaded/Unpacked: +10 (không qua Chrome Web Store review)
  if (extension.isSideloaded || extension.isUnpacked) {
    riskScore += 10;
    flags.push('UNVERIFIED_SOURCE');
    reasons.push('Extension không được cài từ Chrome Web Store (sideloaded/unpacked)');
  }
  
  // === EXCESSIVE PERMISSIONS ===
  
  // Quá nhiều permissions: +5 mỗi 5 permissions
  const permissionCount = extension.permissions.length + extension.hostPermissions.length;
  if (permissionCount > 10) {
    const excessScore = Math.floor((permissionCount - 10) / 5) * 5;
    riskScore += Math.min(excessScore, 15); // Max +15
    flags.push('EXCESSIVE_PERMISSIONS');
    reasons.push(`Yêu cầu ${permissionCount} quyền - quá nhiều so với chức năng thông thường`);
  }
  
  // === DANGEROUS PERMISSION COMBINATIONS ===
  
  // Cookies + Universal Access = Cookie Theft risk
  if (extension.permissions.includes('cookies') && hasUniversalAccess) {
    riskScore += 10;
    flags.push('COOKIE_THEFT_RISK');
    reasons.push('Kết hợp cookies + <all_urls> = nguy cơ cookie theft cao');
  }
  
  // webRequest + <all_urls> = Data Exfiltration risk
  if (extension.permissions.includes('webRequest') && hasUniversalAccess) {
    riskScore += 10;
    flags.push('DATA_EXFILTRATION_RISK');
    reasons.push('Kết hợp webRequest + <all_urls> = nguy cơ data exfiltration');
  }
  
  // === XÁC ĐỊNH RISK LEVEL ===
  
  let riskLevel = 'LOW';
  if (riskScore >= 81) riskLevel = 'CRITICAL';
  else if (riskScore >= 61) riskLevel = 'HIGH';
  else if (riskScore >= 31) riskLevel = 'MEDIUM';
    
    return {
    riskScore: Math.min(riskScore, 100),
    riskLevel: riskLevel,
    flags: flags,
    suspiciousPatterns: suspiciousPatterns,
    reasons: reasons,
    permissionCount: permissionCount,
    hasUniversalAccess: hasUniversalAccess
  };
}

// ============================================
// LỚP 3: RUNTIME OBSERVATION
// ============================================

/**
 * Lấy dữ liệu runtime observation từ content script
 * Content script quan sát hành vi trên trang web
 */
async function getRuntimeObservations(extensionId) {
  try {
    // Lấy dữ liệu từ storage (content script lưu vào đây)
    const result = await chrome.storage.local.get(`runtime_obs_${extensionId}`);
    const observations = result[`runtime_obs_${extensionId}`] || {
      dom_injection: false,
      keystroke_capture: false,
      external_post: false,
      fetch_domains: [],
      xhr_domains: [],
      frequency: 'low',
      timestamp: null
    };
    
    return observations;
  } catch (error) {
    console.error(`Error getting runtime observations for ${extensionId}:`, error);
    return {
      dom_injection: false,
      keystroke_capture: false,
      external_post: false,
      fetch_domains: [],
      xhr_domains: [],
      frequency: 'low',
      timestamp: null
    };
  }
}

// ============================================
// LỚP 4: BEHAVIOR NORMALIZATION
// ============================================

/**
 * Chuẩn hóa hành vi thành vector
 * Vector này dùng để correlate với permissions
 */
function normalizeBehavior(observations) {
  const behaviorVector = {
    dom_injection: observations.dom_injection || false,
    form_hijacking: observations.form_hijacking || false,
    keystroke_capture: observations.keystroke_capture || false,
    external_post: observations.external_post || false,
    fetch_domains: observations.fetch_domains || [],
    xhr_domains: observations.xhr_domains || [],
    frequency: observations.frequency || 'low',
    suspicious_domains: [],
    data_exfiltration: false
  };
  
  // Phát hiện domain đáng ngờ
  const allDomains = [...(observations.fetch_domains || []), ...(observations.xhr_domains || [])];
  const suspiciousTLDs = ['.tk', '.ml', '.ga', '.cf', '.xyz', '.top'];
  behaviorVector.suspicious_domains = allDomains.filter(domain => 
    suspiciousTLDs.some(tld => domain.endsWith(tld))
  );
  
  // Phát hiện data exfiltration
  behaviorVector.data_exfiltration = 
    behaviorVector.external_post || 
    behaviorVector.fetch_domains.length > 0 || 
    behaviorVector.xhr_domains.length > 0;
  
  return behaviorVector;
}

/**
 * Tính điểm runtime dựa trên behavior vector
 * Theo chuẩn Analyzer: Form hijacking là CRITICAL behavior
 */
function calculateRuntimeScore(behaviorVector, staticAnalysis) {
  let runtimeScore = 0;
  const runtimeReasons = [];
  
  // Form Hijacking: +50 (CRITICAL - credential theft)
  if (behaviorVector.form_hijacking) {
    runtimeScore += 50;
    runtimeReasons.push('⚠️ CRITICAL: Phát hiện Form Hijacking - extension đang chuyển hướng form để đánh cắp thông tin đăng nhập');
  }
  
  // DOM Injection: +20 (nếu không phải form hijacking)
  if (behaviorVector.dom_injection && !behaviorVector.form_hijacking) {
    runtimeScore += 20;
    runtimeReasons.push('Phát hiện DOM injection - extension đang inject code vào trang web');
  }
  
  // Keystroke Capture: +25
  if (behaviorVector.keystroke_capture) {
    runtimeScore += 25;
    runtimeReasons.push('Phát hiện keystroke capture - extension đang theo dõi phím gõ');
  }
  
  // External POST: +30
  if (behaviorVector.external_post) {
    runtimeScore += 30;
    runtimeReasons.push('Phát hiện gửi dữ liệu ra ngoài qua POST request');
  }
  
  // Suspicious domains: +15 mỗi domain
  if (behaviorVector.suspicious_domains.length > 0) {
    runtimeScore += Math.min(behaviorVector.suspicious_domains.length * 15, 30);
    runtimeReasons.push(`Gửi dữ liệu đến ${behaviorVector.suspicious_domains.length} domain đáng ngờ`);
  }
  
  // Data exfiltration với frequency cao: +10
  if (behaviorVector.data_exfiltration && behaviorVector.frequency === 'high') {
    runtimeScore += 10;
    runtimeReasons.push('Tần suất gửi dữ liệu cao - nguy cơ data exfiltration');
  }
  
  // CORRELATION: Chỉ extension có quyền mới làm được hành vi này
  // Nếu có hành vi nhưng không có permission tương ứng → có thể là bypass
  if (behaviorVector.keystroke_capture && !staticAnalysis.hasUniversalAccess) {
    runtimeScore += 5;
    runtimeReasons.push('⚠️ Keystroke capture nhưng không có <all_urls> - có thể bypass permission');
  }
  
  // Form hijacking + external POST = CRITICAL combination
  if (behaviorVector.form_hijacking && behaviorVector.external_post) {
    runtimeScore += 20;
    runtimeReasons.push('⚠️ CRITICAL: Form hijacking kết hợp với external POST - nguy cơ credential theft cực cao');
  }
  
  return {
    score: Math.min(runtimeScore, 100), // Tăng max lên 100 để phát hiện CRITICAL behaviors
    reasons: runtimeReasons
  };
}

// ============================================
// LỚP 5: RISK CORRELATION ENGINE
// ============================================

/**
 * Gọi API Analyzer để phân tích manifest
 * Fallback về local analysis nếu API không khả dụng
 */
async function analyzeWithAnalyzerAPI(extension) {
  try {
    // Tạo manifest_data từ metadata có sẵn
    const manifestData = {
      manifest_version: 3, // Default, có thể là 2
      name: extension.name,
      version: extension.version,
      permissions: extension.permissions || [],
      host_permissions: extension.hostPermissions || []
    };
    
    // Gọi API Analyzer
    const response = await fetch('http://localhost:5000/api/analyze-manifest', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        extension_id: extension.id,
        manifest_data: manifestData
      })
    });
    
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }
    
    const apiResult = await response.json();
    
    if (apiResult.success && apiResult.data) {
      console.log(`[Analyzer API] ✅ Analyzed ${extension.name} via API`);
      const data = apiResult.data;
      
      // Tạo reasons từ permissions_analysis và host_permissions_analysis
      const reasons = [];
      
      // Thêm reasons từ permissions analysis
      if (data.permissions_analysis) {
        const permAnalysis = data.permissions_analysis;
        if (permAnalysis.risky_permissions && permAnalysis.risky_permissions.length > 0) {
          permAnalysis.risky_permissions.forEach(perm => {
            reasons.push(`Quyền nguy hiểm: ${perm}`);
          });
        }
        if (permAnalysis.total_permissions > 10) {
          reasons.push(`Yêu cầu ${permAnalysis.total_permissions} quyền - quá nhiều so với chức năng thông thường`);
        }
      }
      
      // Thêm reasons từ host permissions analysis
      if (data.host_permissions_analysis) {
        const hostAnalysis = data.host_permissions_analysis;
        if (hostAnalysis.universal_access) {
          reasons.push('Có quyền truy cập tất cả websites (<all_urls>)');
        }
        if (hostAnalysis.suspicious_domains && hostAnalysis.suspicious_domains.length > 0) {
          hostAnalysis.suspicious_domains.forEach(domain => {
            reasons.push(`Domain đáng ngờ: ${domain}`);
          });
        }
      }
      
      // Thêm reasons từ permission fingerprints
      if (data.permission_fingerprints && data.permission_fingerprints.total_matches > 0) {
        reasons.push(`Phát hiện ${data.permission_fingerprints.total_matches} permission fingerprint nguy hiểm`);
      }
      
      // Nếu không có reasons, dùng recommendations
      if (reasons.length === 0 && data.recommendations) {
        reasons.push(...data.recommendations);
      }
      
      return {
        success: true,
        manifestAnalysis: {
          risk_score: data.risk_score || 0,
          risk_level: data.risk_level || 'LOW',
          flags: data.flags || [],
          reasons: reasons,
          suspicious_patterns: data.suspicious_patterns || [],
          permissions_analysis: data.permissions_analysis || {},
          host_permissions_analysis: data.host_permissions_analysis || {},
          content_scripts_analysis: data.content_scripts_analysis || {},
          permission_fingerprints: data.permission_fingerprints || {}
        },
        recommendations: data.recommendations || []
      };
    } else {
      throw new Error(apiResult.error || 'API analysis failed');
    }
  } catch (error) {
    console.warn(`[Analyzer API] ⚠️ API call failed for ${extension.name}:`, error.message);
    console.log(`[Analyzer API] Falling back to local analysis`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Kết hợp tất cả để tính Final Risk Score
 * LOW (0-30), MEDIUM (31-60), HIGH (61-80), CRITICAL (81-100)
 * 
 * Sử dụng Analyzer API nếu có, fallback về local analysis
 */
async function correlateRisk(extension) {
  // 1. Thử gọi Analyzer API trước
  const apiResult = await analyzeWithAnalyzerAPI(extension);
  
  let staticAnalysis;
  let apiRecommendations = [];
  
  if (apiResult.success && apiResult.manifestAnalysis) {
    // Sử dụng kết quả từ Analyzer API
    const analyzerManifest = apiResult.manifestAnalysis;
    staticAnalysis = {
      riskScore: analyzerManifest.risk_score || 0,
      riskLevel: analyzerManifest.risk_level || 'LOW',
      flags: analyzerManifest.flags || [],
      reasons: analyzerManifest.reasons || [],
      suspiciousPatterns: [],
      permissionCount: extension.permissions.length + extension.hostPermissions.length,
      hasUniversalAccess: analyzerManifest.host_permissions_analysis?.universal_access || false
    };
    apiRecommendations = apiResult.recommendations || [];
    console.log(`[Analyzer] Using API result: ${staticAnalysis.riskLevel} (${staticAnalysis.riskScore}/100)`);
  } else {
    // Fallback về local analysis
    staticAnalysis = analyzeManifestStatic(extension);
    console.log(`[Analyzer] Using local analysis: ${staticAnalysis.riskLevel} (${staticAnalysis.riskScore}/100)`);
  }
  
  // 2. Runtime Observations
  const observations = await getRuntimeObservations(extension.id);
  
  // 3. Behavior Normalization
  const behaviorVector = normalizeBehavior(observations);
  
  // 4. Runtime Score
  const runtimeAnalysis = calculateRuntimeScore(behaviorVector, staticAnalysis);
  
  // 5. Final Risk Score
  // Nếu có CRITICAL runtime behavior (form hijacking), ưu tiên runtime score
  // Ngược lại, dùng tỷ lệ Static (60%) + Runtime (40%) để cân bằng hơn
  let finalScore;
  if (behaviorVector.form_hijacking) {
    // Form hijacking là CRITICAL - runtime score chiếm ưu thế
    finalScore = Math.round(
      staticAnalysis.riskScore * 0.3 + runtimeAnalysis.score * 0.7
    );
  } else {
    // Bình thường: Static 60% + Runtime 40%
    finalScore = Math.round(
      staticAnalysis.riskScore * 0.6 + runtimeAnalysis.score * 0.4
    );
  }
  
  // 6. Install Source Bonus
  let installSourceBonus = 0;
  if (extension.isSideloaded || extension.isUnpacked) {
    installSourceBonus = 5;
  }
  
  const finalRiskScore = Math.min(finalScore + installSourceBonus, 100);
  
  // 7. Xác định Risk Level
  let finalRiskLevel = 'LOW';
  if (finalRiskScore >= 81) finalRiskLevel = 'CRITICAL';
  else if (finalRiskScore >= 61) finalRiskLevel = 'HIGH';
  else if (finalRiskScore >= 31) finalRiskLevel = 'MEDIUM';
  
  // 8. Tổng hợp lý do
  const allReasons = [
    ...staticAnalysis.reasons,
    ...runtimeAnalysis.reasons
  ];
  
  // 9. Recommendations (ưu tiên từ API, sau đó local)
  const localRecommendations = generateRecommendations(finalRiskLevel, staticAnalysis.flags, behaviorVector);
  const recommendations = apiRecommendations.length > 0 
    ? [...apiRecommendations, ...localRecommendations]
    : localRecommendations;
  
  return {
    extension: {
      id: extension.id,
      name: extension.name,
      version: extension.version,
      enabled: extension.enabled,
      installType: extension.installType
    },
    riskScore: finalRiskScore,
    riskLevel: finalRiskLevel,
    breakdown: {
      staticScore: staticAnalysis.riskScore,
      runtimeScore: runtimeAnalysis.score,
      installSourceBonus: installSourceBonus,
      usingAnalyzerAPI: apiResult.success
    },
    flags: staticAnalysis.flags,
    behaviorVector: behaviorVector,
    reasons: allReasons,
    recommendations: recommendations,
    permissions: extension.permissions,
    hostPermissions: extension.hostPermissions,
    permissionCount: staticAnalysis.permissionCount
  };
}

/**
 * Tạo recommendations dựa trên risk level và findings
 */
function generateRecommendations(riskLevel, flags, behaviorVector) {
  const recommendations = [];
  
  if (riskLevel === 'CRITICAL') {
    recommendations.push({
      level: 'CRITICAL',
      action: 'uninstall',
      message: 'Extension có nguy cơ cực cao. Nên gỡ cài đặt ngay lập tức.'
    });
  } else if (riskLevel === 'HIGH') {
    recommendations.push({
      level: 'HIGH',
      action: 'disable',
      message: 'Extension có nguy cơ cao. Nên tắt hoặc gỡ cài đặt.'
    });
  } else if (riskLevel === 'MEDIUM') {
    recommendations.push({
      level: 'MEDIUM',
      action: 'monitor',
      message: 'Extension có một số rủi ro. Nên theo dõi và xem xét.'
    });
  }
  
  if (flags.includes('CRITICAL_PERMISSION_DEBUGGER')) {
    recommendations.push({
      level: 'CRITICAL',
      action: 'uninstall',
      message: '⚠️ Extension có quyền debugger - có thể inject code vào bất kỳ trang nào'
    });
  }
  
  if (behaviorVector.form_hijacking) {
    recommendations.push({
      level: 'CRITICAL',
      action: 'uninstall',
      message: '🚨 CRITICAL: Phát hiện Form Hijacking - extension đang chuyển hướng form để đánh cắp thông tin đăng nhập. Gỡ cài đặt ngay!'
    });
  }
  
  if (behaviorVector.keystroke_capture) {
    recommendations.push({
      level: 'HIGH',
      action: 'disable',
      message: '⚠️ Phát hiện keystroke capture - extension đang theo dõi phím gõ của bạn'
    });
  }
  
  if (behaviorVector.suspicious_domains.length > 0) {
    recommendations.push({
      level: 'HIGH',
      action: 'disable',
      message: `⚠️ Extension gửi dữ liệu đến ${behaviorVector.suspicious_domains.length} domain đáng ngờ`
    });
  }
  
  return recommendations;
}

// ============================================
// MAIN SCAN FUNCTION
// ============================================

/**
 * Quét và phân tích tất cả extensions
 * @param {string} reason - Lý do scan (onInstalled, onStartup, manual, etc.)
 */
async function scanAllExtensions(reason = 'manual') {
  try {
    console.log(`[SCAN][${reason}] Starting scan...`);
    
    // 1. Discovery
    const extensions = await discoverExtensions();
    
    console.log(`[SCAN][${reason}] Found ${extensions.length} extensions to analyze`);
    
    // 2. Lọc bỏ extensions trong whitelist (nếu không phải manual scan từ user)
    // Lấy whitelist từ storage
    const allStored = await chrome.storage.local.get(null);
    const whitelist = new Set();
    Object.keys(allStored).forEach(key => {
      if (key.startsWith('whitelist_')) {
        whitelist.add(key.replace('whitelist_', ''));
      }
    });
    
    // Lọc extensions - bỏ qua những extension trong whitelist
    const extensionsToScan = extensions.filter(ext => !whitelist.has(ext.id));
    
    if (whitelist.size > 0) {
      console.log(`[SCAN][${reason}] Skipping ${extensions.length - extensionsToScan.length} extensions in whitelist`);
    }
    
    console.log(`[SCAN][${reason}] Analyzing ${extensionsToScan.length} extensions (${extensions.length - extensionsToScan.length} in whitelist)`);
    
    // 3. Analyze từng extension (chỉ những extension không trong whitelist)
    const results = await Promise.all(
      extensionsToScan.map(ext => correlateRisk(ext))
    );
    
    // 3. Lưu kết quả vào storage
    await chrome.storage.local.set({
      lastScan: {
        timestamp: new Date().toISOString(),
        reason: reason,
        total: extensions.length,
        results: results
      }
    });
    
    // 4. Kiểm tra và thông báo extensions nguy hiểm
    const criticalExtensions = results.filter(r => r.riskLevel === 'CRITICAL');
    const highExtensions = results.filter(r => r.riskLevel === 'HIGH');
    
    if (criticalExtensions.length > 0 || highExtensions.length > 0) {
      console.warn(`[SCAN][${reason}] ⚠️ Found ${criticalExtensions.length} CRITICAL and ${highExtensions.length} HIGH risk extensions`);
      
      // Có thể thêm notification ở đây nếu cần
      // chrome.notifications.create({...})
    }
    
    console.log(`[SCAN][${reason}] Scan completed`);
    
    return {
      success: true,
      total: extensions.length,
      scanned: results.length,
      extensions: results,
      timestamp: new Date().toISOString(),
      reason: reason
    };
  } catch (error) {
    console.error(`[SCAN][${reason}] Error scanning extensions:`, error);
    return {
      success: false,
      error: error.message,
      extensions: [],
      reason: reason
    };
  }
}

/**
 * Quét một extension cụ thể (khi phát hiện extension mới được cài)
 * @param {string} extensionId - ID của extension cần scan
 * @param {string} reason - Lý do scan (management.onInstalled, management.onEnabled, etc.)
 */
async function scanOneExtension(extensionId, reason = 'manual') {
  try {
    console.log(`[SCAN][${reason}] Scanning extension: ${extensionId}`);
    
    // Lấy thông tin extension
    const extInfo = await chrome.management.get(extensionId);
    
    if (!extInfo) {
      console.warn(`[SCAN][${reason}] Extension ${extensionId} not found`);
      return null;
    }
    
    // Bỏ qua chính extension này
    if (extInfo.id === chrome.runtime.id) {
      return null;
    }
    
    // Kiểm tra blacklist - bỏ qua scan nếu trong blacklist (đã được tắt tự động)
    const allStored = await chrome.storage.local.get(null);
    if (allStored[`blacklist_${extensionId}`]) {
      console.log(`[SCAN][${reason}] ⚠️ Extension ${extInfo.name} is in blacklist, skipping scan`);
      return null; // Trả về null để báo rằng extension này không được scan
    }
    
    // Kiểm tra whitelist - bỏ qua scan nếu trong whitelist
    if (allStored[`whitelist_${extensionId}`]) {
      console.log(`[SCAN][${reason}] ✅ Extension ${extInfo.name} is in whitelist, skipping scan`);
      return null; // Trả về null để báo rằng extension này không được scan
    }
    
    // Chuẩn bị metadata
    const extension = {
      id: extInfo.id,
      name: extInfo.name,
      version: extInfo.version,
      installType: extInfo.installType || 'normal',
      permissions: extInfo.permissions || [],
      hostPermissions: extInfo.hostPermissions || [],
      enabled: extInfo.enabled,
      description: extInfo.description || '',
      homepageUrl: extInfo.homepageUrl || '',
      isSideloaded: extInfo.installType === 'sideload' || extInfo.installType === 'development',
      isUnpacked: extInfo.installType === 'development'
    };
    
    // Phân tích
    const result = await correlateRisk(extension);
    
    console.log(`[SCAN][${reason}] Extension "${extension.name}" - Risk: ${result.riskLevel} (${result.riskScore}/100)`);
    
    // Lưu kết quả vào storage
    await chrome.storage.local.set({
      [`scan_result_${extensionId}`]: {
        ...result,
        scannedAt: new Date().toISOString(),
        reason: reason
      }
    });
    
    // Nếu nguy hiểm, thông báo
    if (result.riskLevel === 'CRITICAL' || result.riskLevel === 'HIGH') {
      console.warn(`[SCAN][${reason}] ⚠️ DANGEROUS EXTENSION DETECTED: ${extension.name}`);
      console.warn(`[SCAN][${reason}] Risk Level: ${result.riskLevel}, Score: ${result.riskScore}/100`);
      console.warn(`[SCAN][${reason}] Reasons:`, result.reasons);
      
      // Có thể thêm notification ở đây
      // chrome.notifications.create({
      //   type: 'basic',
      //   iconUrl: 'icons/icon48.png',
      //   title: '⚠️ Dangerous Extension Detected',
      //   message: `${extension.name} has ${result.riskLevel} risk level`
      // });
    }
    
    return result;
  } catch (error) {
    console.error(`[SCAN][${reason}] Error scanning extension ${extensionId}:`, error);
    return null;
  }
}

/**
 * Phân tích một extension cụ thể
 */
async function analyzeSingleExtension(extensionId) {
  try {
    const extensions = await discoverExtensions();
    const extension = extensions.find(ext => ext.id === extensionId);
    
    if (!extension) {
      throw new Error(`Extension ${extensionId} not found`);
    }
    
    const result = await correlateRisk(extension);
    return {
      success: true,
      data: result
    };
  } catch (error) {
    console.error(`Error analyzing extension ${extensionId}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

// ============================================
// MESSAGE HANDLERS
// ============================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scanExtensions') {
    // Gọi với reason = 'manual' để đánh dấu đây là scan thủ công từ user
    scanAllExtensions('manual')
      .then(results => sendResponse(results))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }
  
  if (request.action === 'analyzeExtension') {
    analyzeSingleExtension(request.extensionId)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (request.action === 'disableExtension') {
    chrome.management.setEnabled(request.extensionId, false)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (request.action === 'enableExtension') {
    chrome.management.setEnabled(request.extensionId, true)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (request.action === 'uninstallExtension') {
    chrome.management.uninstall(request.extensionId)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (request.action === 'keepExtension') {
    // Lưu vào storage để không cảnh báo lại
    chrome.storage.local.set({ [`ignored_${request.extensionId}`]: true })
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (request.action === 'getExtensionInfo') {
    chrome.management.get(request.extensionId)
      .then(info => sendResponse({ success: true, data: info }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (request.action === 'saveRuntimeObservations') {
    // Lưu observations từ content script
    // Correlate với extensions có permissions phù hợp
    handleRuntimeObservations(request.observations, request.url, request.timestamp)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
  
  if (request.action === 'getAllExtensions') {
    // Lấy danh sách tất cả extensions (chưa phân tích)
    console.log('[Background] getAllExtensions requested');
    discoverExtensions()
      .then(extensions => {
        console.log('[Background] Found', extensions.length, 'extensions');
        sendResponse({ success: true, extensions: extensions });
      })
      .catch(error => {
        console.error('[Background] Error in getAllExtensions:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep channel open for async response
  }
  
  if (request.action === 'showExtension') {
    // Hiển thị extension cụ thể trong popup
    const extensionId = request.extensionId;
    console.log('[Background] showExtension requested for:', extensionId);
    
    // Quét extension nếu chưa có kết quả
    scanOneExtension(extensionId, 'showExtension')
      .then(result => {
        if (result) {
          // Lưu kết quả
          chrome.storage.local.set({
            [`new_extension_${extensionId}`]: result
          });
          
          // Đánh dấu extension cần hiển thị
          chrome.storage.local.set({
            newExtensionToShow: extensionId,
            newExtensionTimestamp: Date.now(),
            showOnlyNewExtension: true
          });
          
          // Mở popup
          chrome.action.openPopup().catch(() => {
            console.log('[Background] Cannot open popup automatically, will show when user opens');
          });
          
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: 'Extension not found or cannot be scanned' });
        }
      })
      .catch(error => {
        console.error('[Background] Error showing extension:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
});

// Context menu click handler
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'analyze-extension') {
    // Lấy extension ID từ tab hoặc từ info
    // Nếu click vào extension icon, có thể lấy từ tab
    try {
      // Thử lấy extension ID từ URL nếu đang ở chrome://extensions
      if (tab && tab.url && tab.url.startsWith('chrome://extensions')) {
        // Không thể lấy extension ID trực tiếp từ chrome://extensions
        // Mở popup và để user chọn extension
        chrome.action.openPopup();
      } else {
        // Mở popup bình thường
        chrome.action.openPopup();
      }
    } catch (error) {
      console.error('[Background] Error opening popup from context menu:', error);
    }
  }
});

/**
 * Xử lý runtime observations từ content script
 * Correlate với extensions có permissions phù hợp
 */
async function handleRuntimeObservations(observations, url, timestamp) {
  try {
    // Lấy tất cả extensions
    const extensions = await discoverExtensions();
    
    // Tìm extensions có thể thực hiện hành vi này
    // (có <all_urls> hoặc host permission match với URL)
    const urlObj = new URL(url);
    const matchingExtensions = extensions.filter(ext => {
      if (!ext.enabled) return false;
      
      // Check host permissions
      const hasUniversalAccess = ext.hostPermissions.some(perm => 
        perm === '<all_urls>' || perm === '*://*/*' || 
        perm === 'http://*/*' || perm === 'https://*/*'
      );
      
      if (hasUniversalAccess) return true;
      
      // Check specific host permission
      const hasHostPermission = ext.hostPermissions.some(perm => {
        try {
          const permPattern = perm.replace(/\*/g, '.*');
          const regex = new RegExp(`^${permPattern}$`);
          return regex.test(`${urlObj.protocol}//${urlObj.hostname}/*`);
        } catch (e) {
          return false;
        }
      });
      
      return hasHostPermission;
    });
    
    // Lưu observations cho mỗi matching extension
    for (const ext of matchingExtensions) {
      const key = `runtime_obs_${ext.id}`;
      await chrome.storage.local.set({ [key]: observations });
    }
    
    console.log(`Saved runtime observations for ${matchingExtensions.length} extensions`);
  } catch (error) {
    console.error('Error handling runtime observations:', error);
  }
}

// ============================================
// NOTIFICATION & BADGE FUNCTIONS
// ============================================

/**
 * Hiển thị notification khi phát hiện extension mới
 */
async function showExtensionScanNotification(extInfo, scanResult) {
  try {
    // Kiểm tra notifications setting
    const stored = await chrome.storage.local.get(['notifications']);
    if (stored.notifications === false) {
      console.log('[Analyzer][NOTIFICATION] Notifications disabled, skipping');
      return;
    }
    
    const riskEmoji = {
      'CRITICAL': '🔴',
      'HIGH': '🟠',
      'MEDIUM': '🟡',
      'LOW': '🟢'
    }[scanResult.riskLevel] || '⚪';
    
    const riskText = {
      'CRITICAL': 'CỰC KỲ NGUY HIỂM',
      'HIGH': 'NGUY HIỂM',
      'MEDIUM': 'CẢNH BÁO',
      'LOW': 'AN TOÀN'
    }[scanResult.riskLevel] || 'KHÔNG XÁC ĐỊNH';
    
    const title = `${riskEmoji} Extension Mới Được Phát Hiện`;
    const message = `${extInfo.name}\nRisk: ${riskText} (${scanResult.riskScore}/100)`;
    
    // Tạo notification
    const notificationId = await chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: title,
      message: message,
      priority: scanResult.riskLevel === 'CRITICAL' || scanResult.riskLevel === 'HIGH' ? 2 : 1,
      buttons: [
        { title: 'Xem Chi Tiết' }
      ]
    });
    
    console.log(`[Analyzer][NOTIFICATION] Notification shown for ${extInfo.name} (ID: ${notificationId})`);
    
    // Lưu extension ID vào notification data để có thể mở popup sau
    await chrome.storage.local.set({
      [`notification_${notificationId}`]: extInfo.id
    });
  } catch (error) {
    console.error('[Analyzer][NOTIFICATION] Error showing notification:', error);
    // Fallback: chỉ log nếu notification không hoạt động
  }
}

/**
 * Cập nhật badge trên icon extension
 */
async function updateExtensionBadge(scanResult) {
  try {
    const badgeText = {
      'CRITICAL': '!',
      'HIGH': '!',
      'MEDIUM': '?',
      'LOW': '✓'
    }[scanResult.riskLevel] || '';
    
    const badgeColor = {
      'CRITICAL': '#dc2626', // Red
      'HIGH': '#ef4444',     // Red
      'MEDIUM': '#f59e0b',   // Orange
      'LOW': '#10b981'      // Green
    }[scanResult.riskLevel] || '#64748b';
    
    await chrome.action.setBadgeText({ text: badgeText });
    await chrome.action.setBadgeBackgroundColor({ color: badgeColor });
    
    console.log(`[Analyzer][BADGE] Badge updated: ${badgeText} (${badgeColor})`);
  } catch (error) {
    console.error('[Analyzer][BADGE] Error updating badge:', error);
  }
}

/**
 * Xử lý click vào notification button
 */
chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
  if (buttonIndex === 0) {
    // Lấy extension ID từ storage
    const stored = await chrome.storage.local.get(`notification_${notificationId}`);
    const extensionId = stored[`notification_${notificationId}`];
    
    // Xóa notification data
    await chrome.storage.local.remove(`notification_${notificationId}`);
    chrome.notifications.clear(notificationId);
    
    // Đánh dấu extension cần hiển thị
    if (extensionId) {
      await chrome.storage.local.set({
        newExtensionToShow: extensionId,
        newExtensionTimestamp: Date.now(),
        showOnlyNewExtension: true
      });
    }
    
    // Mở popup extension
    try {
      await chrome.action.openPopup();
      console.log('[Analyzer][NOTIFICATION] Popup opened from notification button');
    } catch (error) {
      // Nếu không mở được popup, user sẽ thấy khi mở popup
      console.log('[Analyzer][NOTIFICATION] Cannot open popup, will show when user opens popup');
    }
  }
});

/**
 * Xử lý click vào notification
 */
chrome.notifications.onClicked.addListener(async (notificationId) => {
  // Lấy extension ID từ storage
  const stored = await chrome.storage.local.get(`notification_${notificationId}`);
  const extensionId = stored[`notification_${notificationId}`];
  
  // Xóa notification data
  if (stored[`notification_${notificationId}`]) {
    await chrome.storage.local.remove(`notification_${notificationId}`);
  }
  
  // Đánh dấu extension cần hiển thị
  if (extensionId) {
    await chrome.storage.local.set({
      newExtensionToShow: extensionId,
      newExtensionTimestamp: Date.now()
    });
  }
  
  // Đóng notification
  chrome.notifications.clear(notificationId);
  
  // Mở popup extension
  try {
    await chrome.action.openPopup();
    console.log('[Analyzer][NOTIFICATION] Popup opened from notification click');
  } catch (error) {
    console.log('[Analyzer][NOTIFICATION] Cannot open popup, will show when user opens popup');
  }
});

/**
 * Lưu kết quả extension mới riêng (không merge vào lastScan)
 */
async function saveNewExtensionResult(newExtensionResult) {
  try {
    // Lưu riêng extension mới
    await chrome.storage.local.set({
      [`new_extension_${newExtensionResult.extension.id}`]: {
        ...newExtensionResult,
        scannedAt: new Date().toISOString(),
        reason: 'management.onInstalled'
      }
    });
    console.log('[Analyzer] Saved new extension result separately');
  } catch (error) {
    console.error('[Analyzer] Error saving new extension result:', error);
  }
}

/**
 * Thử mở popup tự động và hiển thị extension mới
 */
async function tryOpenPopup(extensionId) {
  try {
    // Thử mở popup (Chrome chỉ cho phép mở popup từ user gesture hoặc trong một số trường hợp nhất định)
    try {
      await chrome.action.openPopup();
      console.log('[Analyzer] Popup opened automatically');
      
      // Đợi popup load xong
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Gửi message để popup load và highlight extension mới
      chrome.runtime.sendMessage({
        action: 'showNewExtension',
        extensionId: extensionId
      }).catch(() => {
        // Popup có thể chưa sẵn sàng, sẽ retry
        setTimeout(() => {
          chrome.runtime.sendMessage({
            action: 'showNewExtension',
            extensionId: extensionId
          });
        }, 500);
      });
    } catch (error) {
      // Popup không thể mở tự động (Chrome không cho phép)
      // Lưu flag để popup tự động load và highlight khi user mở
      console.log('[Analyzer] Cannot auto-open popup (Chrome restriction), will show when user opens popup');
      // Flag đã được lưu ở trên (newExtensionToShow)
    }
  } catch (error) {
    console.error('[Analyzer] Error trying to open popup:', error);
  }
}

