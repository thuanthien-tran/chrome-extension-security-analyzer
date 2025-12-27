/**
 * Extension Analyzer Web Interface - JavaScript
 */

const API_BASE = '/api';

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
});

function initializeApp() {
  // DOM Elements
  const scanForm = document.getElementById('scanForm');
  const analyzeForm = document.getElementById('analyzeForm');
  const scanBtn = document.getElementById('scanBtn');
  const analyzeBtn = document.getElementById('analyzeBtn');
  const loadingIndicator = document.getElementById('loadingIndicator');
  const resultsSection = document.getElementById('resultsSection');
  const errorMessage = document.getElementById('errorMessage');
  const listExtensionsBtn = document.getElementById('listExtensionsBtn');
  const includeManifestCheckbox = document.getElementById('includeManifest');
  const manifestGroup = document.getElementById('manifestGroup');
  const extensionsModal = document.getElementById('extensionsModal');
  const closeModal = document.getElementById('closeModal');
  const scanTabButtons = document.querySelectorAll('.scan-tab-btn');
  const extensionFolder = document.getElementById('extensionFolder');
  const extensionFile = document.getElementById('extensionFile');
  const extensionFolderPicker = document.getElementById('extensionFolderPicker');
  const uploadTabButtons = document.querySelectorAll('.upload-tab-btn');
  const scanInstalledBtn = document.getElementById('scanInstalledBtn');
  const refreshBtn = document.getElementById('refreshBtn');

  // Check if elements exist
  if (!scanForm || !analyzeForm) {
    console.error('Required form elements not found');
    return;
  }

  // Refresh button
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      const icon = refreshBtn.querySelector('i');
      if (icon) {
        refreshBtn.classList.add('spinning');
        setTimeout(() => {
          window.location.reload();
        }, 300);
      } else {
        window.location.reload();
      }
    });
  }

  // Installed extensions button
  if (scanInstalledBtn) {
    scanInstalledBtn.addEventListener('click', async () => {
      await scanInstalledExtensions();
    });
  }

  // Scan mode tabs
  if (scanTabButtons.length > 0) {
    scanTabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-scan-mode');
        switchScanMode(mode);
      });
    });
  }

  // Upload mode tabs
  if (uploadTabButtons.length > 0) {
    uploadTabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-upload-mode');
        switchUploadMode(mode);
      });
    });
  }

  // Switch upload mode function (needs to be accessible)
  window.switchUploadMode = function(mode) {
    const uploadTabButtons = document.querySelectorAll('.upload-tab-btn');
    uploadTabButtons.forEach(btn => {
      btn.classList.remove('active');
      if (btn.getAttribute('data-upload-mode') === mode) {
        btn.classList.add('active');
        btn.style.borderBottomColor = 'var(--primary-color)';
        btn.style.color = 'var(--primary-color)';
      } else {
        btn.style.borderBottomColor = 'transparent';
        btn.style.color = 'var(--text-secondary)';
      }
    });
    
    // Hide all groups
    const zipGroup = document.getElementById('zipUploadGroup');
    const folderGroup = document.getElementById('folderPickerGroup');
    const pathGroup = document.getElementById('pathInputGroup');
    
    if (zipGroup) zipGroup.style.display = 'none';
    if (folderGroup) folderGroup.style.display = 'none';
    if (pathGroup) pathGroup.style.display = 'none';
    
    // Show selected group
    if (mode === 'zip' && zipGroup) {
      zipGroup.style.display = 'block';
    } else if (mode === 'folder' && folderGroup) {
      folderGroup.style.display = 'block';
    } else if (mode === 'path' && pathGroup) {
      pathGroup.style.display = 'block';
    }
  };

  // Tab functionality
  const tabButtons = document.querySelectorAll('.tab-btn');
  if (tabButtons.length > 0) {
    tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tabName = btn.getAttribute('data-tab');
        switchTab(tabName);
      });
    });
  }

  // Manifest checkbox toggle
  if (includeManifestCheckbox && manifestGroup) {
    includeManifestCheckbox.addEventListener('change', (e) => {
      manifestGroup.style.display = e.target.checked ? 'grid' : 'none';
    });
  }

  // Form submission
  scanForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    await scanExtension();
  });

  if (analyzeForm) {
    analyzeForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await performAnalysis();
    });
  }

  if (listExtensionsBtn) {
    listExtensionsBtn.addEventListener('click', async () => {
      await listExtensions();
    });
  }

  if (closeModal && extensionsModal) {
    closeModal.addEventListener('click', () => {
      extensionsModal.style.display = 'none';
    });

    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
      if (e.target === extensionsModal) {
        extensionsModal.style.display = 'none';
      }
    });
  }
}

/**
 * Switch scan mode
 */
function switchScanMode(mode) {
  const scanTabButtons = document.querySelectorAll('.scan-tab-btn');
  const scanForm = document.getElementById('scanForm');
  const analyzeForm = document.getElementById('analyzeForm');
  const installedExtensionsForm = document.getElementById('installedExtensionsForm');
  
  if (scanTabButtons.length === 0 || !scanForm || !analyzeForm) {
    console.error('Required elements for switchScanMode not found');
    return;
  }
  
  scanTabButtons.forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.querySelector(`[data-scan-mode="${mode}"]`);
  if (activeBtn) {
    activeBtn.classList.add('active');
  }
  
  if (mode === 'folder') {
    scanForm.style.display = 'block';
    analyzeForm.style.display = 'none';
    if (installedExtensionsForm) installedExtensionsForm.style.display = 'none';
  } else if (mode === 'database') {
    scanForm.style.display = 'none';
    analyzeForm.style.display = 'block';
    if (installedExtensionsForm) installedExtensionsForm.style.display = 'none';
  } else if (mode === 'installed') {
    scanForm.style.display = 'none';
    analyzeForm.style.display = 'none';
    if (installedExtensionsForm) installedExtensionsForm.style.display = 'block';
  }
}

/**
 * Scan extension from folder
 */
async function scanExtension() {
  const extensionFolder = document.getElementById('extensionFolder');
  const extensionFile = document.getElementById('extensionFile');
  const extensionFolderPicker = document.getElementById('extensionFolderPicker');
  
  const folderPath = extensionFolder ? extensionFolder.value.trim() : '';
  const file = extensionFile ? extensionFile.files[0] : null;
  const folderPicker = extensionFolderPicker ? extensionFolderPicker.files : null;
  
  // Determine which input is being used
  let hasInput = false;
  let formData = new FormData();
  
  if (file) {
    // ZIP file upload
    formData.append('extension_file', file);
    hasInput = true;
  } else if (folderPicker && folderPicker.length > 0) {
    // Folder picker - create ZIP from selected files
    try {
      showLoading(true);
      hideError();
      hideResults();
      
      // Create ZIP file from folder files
      const JSZip = window.JSZip || await loadJSZip();
      const zip = new JSZip();
      
      // Add all files to ZIP
      for (let i = 0; i < folderPicker.length; i++) {
        const file = folderPicker[i];
        const relativePath = file.webkitRelativePath || file.name;
        // Remove the root folder name from path
        const pathParts = relativePath.split('/');
        if (pathParts.length > 1) {
          pathParts.shift(); // Remove first part (folder name)
        }
        const zipPath = pathParts.join('/');
        
        const fileData = await file.arrayBuffer();
        zip.file(zipPath, fileData);
      }
      
      // Generate ZIP blob
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const zipFile = new File([zipBlob], 'extension.zip', { type: 'application/zip' });
      
      formData.append('extension_file', zipFile);
      hasInput = true;
    } catch (error) {
      console.error('Error creating ZIP from folder:', error);
      showError('Lỗi khi tạo ZIP từ thư mục. Vui lòng thử upload ZIP file hoặc nhập đường dẫn.');
      showLoading(false);
      return;
    }
  } else if (folderPath) {
    // Path input
    formData.append('extension_folder', folderPath);
    hasInput = true;
  }
  
  if (!hasInput) {
    showError('Vui lòng chọn thư mục extension, upload file ZIP, hoặc nhập đường dẫn');
    return;
  }
  
  // Show loading (if not already shown for folder picker)
  let loadingShown = false;
  if (folderPicker && folderPicker.length > 0) {
    loadingShown = true; // Already shown above
  } else {
    showLoading(true);
    hideError();
    hideResults();
    loadingShown = true;
  }
  
  try {
    const response = await fetch(`${API_BASE}/scan-extension`, {
      method: 'POST',
      body: formData
    });
    
    // Check if response is OK
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Server error:', response.status, errorText);
      showError(`Lỗi server (${response.status}): ${errorText || 'Unknown error'}`);
      return;
    }
    
    // Try to parse JSON
    let result;
    try {
      const text = await response.text();
      console.log('Response text:', text.substring(0, 500)); // Log first 500 chars for debugging
      result = JSON.parse(text);
      console.log('Parsed result:', result);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Response text (first 1000 chars):', text ? text.substring(0, 1000) : 'No text');
      showError('Lỗi khi đọc phản hồi từ server. Kiểm tra console để biết thêm chi tiết.');
      return;
    }
    
    console.log('Result success:', result.success);
    console.log('Result data:', result.data ? 'Has data' : 'No data');
    console.log('Result error:', result.error);
    
    if (result.success && result.data) {
      console.log('Calling displayResults with data');
      console.log('Data structure:', {
        riskScore: result.data.riskScore,
        riskLevel: result.data.riskLevel,
        risk_score: result.data.risk_score,
        risk_level: result.data.risk_level,
        behaviorCount: result.data.behaviorCount,
        hasHybridAnalysis: !!result.data.hybrid_analysis
      });
      displayResults(result.data);
    } else {
      console.error('Result not successful or no data:', result);
      showError(result.error || 'Lỗi khi quét extension');
    }
  } catch (error) {
    console.error('Network error:', error);
    showError('Không thể kết nối đến server. Đảm bảo analyzer đang chạy.');
  } finally {
    showLoading(false);
  }
}

// Helper function to load JSZip if not available
async function loadJSZip() {
  if (window.JSZip) {
    return window.JSZip;
  }
  
  // Try to load from CDN
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    script.onload = () => resolve(window.JSZip);
    script.onerror = () => reject(new Error('Failed to load JSZip library'));
    document.head.appendChild(script);
  });
}

/**
 * Perform analysis
 */
async function performAnalysis() {
  const extensionIdInput = document.getElementById('extensionId');
  const hoursInput = document.getElementById('hours');
  const includeManifestCheckbox = document.getElementById('includeManifest');
  const manifestPathInput = document.getElementById('manifestPath');
  
  if (!extensionIdInput) {
    showError('Extension ID input not found');
    return;
  }
  
  const extensionId = extensionIdInput.value.trim();
  const hours = hoursInput ? parseInt(hoursInput.value) || 24 : 24;
  const includeManifest = includeManifestCheckbox ? includeManifestCheckbox.checked : false;
  const manifestPath = manifestPathInput ? manifestPathInput.value.trim() : '';
  
  if (!extensionId) {
    showError('Vui lòng nhập Extension ID');
    return;
  }
  
  // Show loading
  showLoading(true);
  hideError();
  hideResults();
  
  try {
    const payload = {
      extension_id: extensionId,
      hours: hours,
      include_manifest: includeManifest
    };
    
    if (includeManifest && manifestPath) {
      payload.manifest_path = manifestPath;
    }
    
    const response = await fetch(`${API_BASE}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    const result = await response.json();
    
    if (result.success && result.data) {
      displayResults(result.data);
    } else {
      // Enhanced error message for database analysis
      const errorMsg = result.error || 'Lỗi khi phân tích extension';
      if (errorMsg.includes('No behaviors') || errorMsg.includes('not found')) {
        showError(
          `Không tìm thấy behaviors cho extension "${extensionId}" trong database.\n\n` +
          `⚠️ Lưu ý: Behavior analysis chỉ áp dụng cho extension mô phỏng đã gửi log về backend.\n\n` +
          `Để phân tích extension này, vui lòng:\n` +
          `1. Đảm bảo extension đã được cài và đang chạy\n` +
          `2. Extension phải có code gửi behaviors về backend server\n` +
          `3. Hoặc sử dụng tab "Chọn Thư Mục Extension" để phân tích static (manifest + JS code)`
        );
      } else {
        showError(errorMsg);
      }
    }
  } catch (error) {
    console.error('Error:', error);
    showError('Không thể kết nối đến server. Đảm bảo analyzer đang chạy.');
  } finally {
    showLoading(false);
  }
}

/**
 * List extensions
 */
async function listExtensions() {
  try {
    const response = await fetch(`${API_BASE}/extensions`);
    const result = await response.json();
    
    if (result.success) {
      displayExtensionsModal(result.extensions);
    } else {
      showError(result.error || 'Lỗi khi lấy danh sách extensions');
    }
  } catch (error) {
    console.error('Error:', error);
    showError('Không thể lấy danh sách extensions');
  }
}

/**
 * Display extensions modal
 */
function displayExtensionsModal(extensions) {
  const listContainer = document.getElementById('extensionsList');
  
  if (extensions.length === 0) {
    listContainer.innerHTML = '<p>Không có extension nào trong database.</p>';
  } else {
    listContainer.innerHTML = `
      <ul class="extensions-list">
        ${extensions.map(ext => `
          <li class="extension-item" onclick="selectExtension('${ext.extension_id}')">
            <strong>${ext.extension_id}</strong>
            <span style="color: #64748b; margin-left: 1rem;">${ext.behavior_count} behaviors</span>
          </li>
        `).join('')}
      </ul>
    `;
  }
  
  extensionsModal.style.display = 'flex';
}

/**
 * Select extension from modal
 */
function selectExtension(extensionId) {
  document.getElementById('extensionId').value = extensionId;
  extensionsModal.style.display = 'none';
}

/**
 * Display analysis results
 */
function displayResults(data) {
  console.log('displayResults called with data:', data);
  console.log('Data keys:', Object.keys(data));
  
  try {
    // Hide error message first
    hideError();
    
    // Display risk summary
    console.log('Calling displayRiskSummary...');
    displayRiskSummary(data);
    
    // Display overview
    console.log('Calling displayOverview...');
    displayOverview(data);
    
    // Display patterns
    console.log('Calling displayPatterns...');
    displayPatterns(data);
    
    // Display anomalies
    console.log('Calling displayAnomalies...');
    displayAnomalies(data);
    
    // Display hybrid analysis
    console.log('Calling displayHybridAnalysis...');
    displayHybridAnalysis(data);
    
    
    // Display recommendations
    console.log('Calling displayRecommendations...');
    displayRecommendations(data);
    
    // Show results section
    console.log('Calling showResults...');
    showResults();
    
    console.log('displayResults completed successfully');
  } catch (error) {
    console.error('Error in displayResults:', error);
    console.error('Error stack:', error.stack);
    showError('Lỗi khi hiển thị kết quả: ' + error.message);
  }
}

/**
 * Display risk summary
 */
function displayRiskSummary(data) {
  const riskSummary = document.getElementById('riskSummary');
  if (!riskSummary) {
    console.error('riskSummary element not found!');
    return;
  }
  
  const riskLevel = data.riskLevel || data.risk_level || 'UNKNOWN';
  const riskScore = data.riskScore || data.risk_score || 0;
  const scanMetadata = data.scan_metadata || {};
  
  console.log('displayRiskSummary - riskLevel:', riskLevel, 'riskScore:', riskScore);
  
  let html = `
    <div class="risk-card score">
      <h3>Risk Score</h3>
      <div class="value">${riskScore}/100</div>
    </div>
    <div class="risk-card level ${riskLevel.toLowerCase()}">
      <h3>Risk Level</h3>
      <div class="value">${riskLevel}</div>
    </div>
    <div class="risk-card">
      <h3>Total Behaviors</h3>
      <div class="value">${data.behaviorCount || 0}</div>
    </div>
  `;
  
  // Add scan metadata if available
  if (scanMetadata.extension_name) {
    html += `
      <div class="risk-card">
        <h3>Extension Name</h3>
        <div class="value" style="font-size: 1.2rem;">${scanMetadata.extension_name}</div>
      </div>
      <div class="risk-card">
        <h3>Version</h3>
        <div class="value">${scanMetadata.extension_version || 'N/A'}</div>
      </div>
      <div class="risk-card">
        <h3>Số File JS Đã Phân Tích</h3>
        <div class="value">${scanMetadata.js_files_analyzed || 0}/${scanMetadata.js_files_found || 0}</div>
      </div>
    `;
  } else {
    html += `
      <div class="risk-card">
        <h3>Time Window</h3>
        <div class="value">${data.timeWindow || 'N/A'}</div>
      </div>
    `;
  }
  
  riskSummary.innerHTML = html;
}

/**
 * Display overview
 */
function displayOverview(data) {
  const overviewContent = document.getElementById('overviewContent');
  if (!overviewContent) {
    console.error('overviewContent element not found!');
    return;
  }
  
  const severityDist = data.severityDistribution || {};
  // Ensure typeDist is always an array
  let typeDist = data.typeDistribution;
  if (!Array.isArray(typeDist)) {
    // If it's an object/dict, convert to array format
    if (typeDist && typeof typeDist === 'object') {
      typeDist = Object.entries(typeDist).map(([type, count]) => ({
        type: type,
        count: count
      }));
    } else {
      typeDist = [];
    }
  }
  
  // Check if we have static analysis data (no behaviors)
  const hasBehaviors = (data.behaviorCount || 0) > 0;
  const hybrid = data.hybrid_analysis || {};
  const manifestAnalysis = hybrid.manifest_analysis || {};
  const jsCodeAnalysis = hybrid.js_code_analysis || {};
  
  // If no behaviors, show static analysis overview
  if (!hasBehaviors && (manifestAnalysis.risk_score !== undefined || jsCodeAnalysis.risk_score !== undefined)) {
    overviewContent.innerHTML = `
      <div class="content-section">
        <h3>Tổng Quan Phân Tích Tĩnh</h3>
        <div class="stats-grid">
          ${manifestAnalysis.risk_score !== undefined ? `
            <div class="stat-item">
              <div class="label">Rủi Ro Manifest</div>
              <div class="value">${manifestAnalysis.risk_score}/100</div>
            </div>
          ` : ''}
          ${jsCodeAnalysis.risk_score !== undefined ? `
            <div class="stat-item">
              <div class="label">Rủi Ro JS Code</div>
              <div class="value">${jsCodeAnalysis.risk_score}/100</div>
            </div>
          ` : ''}
          ${jsCodeAnalysis.files_analyzed !== undefined ? `
            <div class="stat-item">
              <div class="label">Số File Đã Phân Tích</div>
              <div class="value">${jsCodeAnalysis.files_analyzed}</div>
            </div>
          ` : ''}
        </div>
      </div>
      
      <div class="content-section">
        <h3>Phát Hiện Chính</h3>
        <div class="stats-grid">
          ${manifestAnalysis.permissions_analysis ? `
            <div class="stat-item">
              <div class="label">Quyền Nguy Hiểm</div>
              <div class="value">${manifestAnalysis.permissions_analysis.dangerous_permissions?.length || manifestAnalysis.permissions_analysis.risky_permissions?.length || 0}</div>
            </div>
          ` : ''}
          ${manifestAnalysis.host_permissions_analysis ? `
            <div class="stat-item">
              <div class="label">Truy Cập Toàn Cục</div>
              <div class="value">${manifestAnalysis.host_permissions_analysis.universal_access ? 'Có' : 'Không'}</div>
            </div>
          ` : ''}
          ${jsCodeAnalysis.total_patterns !== undefined ? `
            <div class="stat-item">
              <div class="label">Mẫu Đáng Ngờ</div>
              <div class="value">${jsCodeAnalysis.total_patterns}</div>
            </div>
          ` : ''}
          ${jsCodeAnalysis.obfuscated_files !== undefined ? `
            <div class="stat-item">
              <div class="label">File Bị Làm Rối</div>
              <div class="value">${jsCodeAnalysis.obfuscated_files}</div>
            </div>
          ` : ''}
        </div>
      </div>
      
      ${displayProfessionalReportSections(data)}
    `;
    return;
  }
  
  // Original behavior-based overview
  overviewContent.innerHTML = `
    <div class="content-section">
      <h3>Phân Bố Mức Độ Nghiêm Trọng</h3>
      <div class="stats-grid">
        ${Object.entries(severityDist).length > 0 ? Object.entries(severityDist).map(([severity, count]) => {
          // Determine colors based on severity
          let bgColor = '#f8fafc';
          let borderColor = '#e2e8f0';
          let labelColor = '#64748b';
          let valueColor = '#1e293b';
          
          if (severity === 'CRITICAL') {
            bgColor = '#fef2f2';
            borderColor = '#ef4444';
            labelColor = '#991b1b';
            valueColor = '#dc2626';
          } else if (severity === 'HIGH') {
            bgColor = '#fff1f2';
            borderColor = '#f43f5e';
            labelColor = '#be123c';
            valueColor = '#e11d48';
          } else if (severity === 'MEDIUM') {
            bgColor = '#fffbeb';
            borderColor = '#f59e0b';
            labelColor = '#92400e';
            valueColor = '#d97706';
          } else if (severity === 'LOW') {
            bgColor = '#f0fdf4';
            borderColor = '#10b981';
            labelColor = '#065f46';
            valueColor = '#059669';
          }
          
          return `
          <div class="stat-item" style="background: ${bgColor}; border-left: 4px solid ${borderColor};">
            <div class="label" style="color: ${labelColor};">${severity}</div>
            <div class="value" style="color: ${valueColor};">${count}</div>
          </div>
        `;
        }).join('') : '<p>Không có dữ liệu phân bố mức độ nghiêm trọng.</p>'}
      </div>
    </div>
    
    <div class="content-section">
      <h3>Các Loại Hành Vi Hàng Đầu</h3>
      <div class="stats-grid">
        ${typeDist.length > 0 ? typeDist.slice(0, 5).map(item => `
          <div class="stat-item">
            <div class="label">${item.type || item[0] || 'UNKNOWN'}</div>
            <div class="value">${item.count || item[1] || 0}</div>
          </div>
        `).join('') : '<p>Không có dữ liệu behavior types.</p>'}
      </div>
    </div>
    
    ${displayProfessionalReportSections(data)}
  `;
}

/**
 * Display professional report sections (verdict, risk breakdown, top findings, etc.)
 */
function displayProfessionalReportSections(data) {
  console.log('displayProfessionalReportSections called with data:', data);
  console.log('Has verdict:', !!data.verdict);
  console.log('Has risk_breakdown:', !!data.risk_breakdown);
  console.log('Has top_findings:', !!data.top_findings);
  console.log('Has correlation_report:', !!data.correlation_report);
  console.log('Has evidence:', !!data.evidence);
  console.log('Has mitigation_recommendations:', !!data.mitigation_recommendations);
  
  let html = '';
  
  // 1. Verdict Classification
  if (data.verdict) {
    const verdict = data.verdict;
    // Translate verdict classification
    let verdictText = verdict.classification;
    if (verdictText.includes('SAFE')) verdictText = 'AN TOÀN';
    else if (verdictText.includes('HIGH-RISK')) verdictText = 'RỦI RO CAO';
    else if (verdictText.includes('MALICIOUS')) verdictText = 'PHÁT HIỆN HÀNH VI ĐỘC HẠI';
    else if (verdictText.includes('Needs Warning')) verdictText = 'CẦN CẢNH BÁO';
    else if (verdictText.includes('Moderate Risk')) verdictText = 'RỦI RO TRUNG BÌNH';
    
    // Translate recommendation
    let recommendationText = verdict.recommendation;
    if (recommendationText.includes('BLOCK RECOMMENDED')) recommendationText = 'KHUYẾN NGHỊ CHẶN - Phát hiện nhiều vấn đề bảo mật nghiêm trọng';
    else if (recommendationText.includes('REVIEW REQUIRED')) recommendationText = 'YÊU CẦU XEM XÉT - Extension có các mối quan ngại bảo mật đáng kể';
    else if (recommendationText.includes('CAUTION ADVISED')) recommendationText = 'KHUYẾN NGHỊ THẬN TRỌNG - Extension có một số mối quan ngại bảo mật';
    else if (recommendationText.includes('appears safe')) recommendationText = 'Extension có vẻ an toàn dựa trên phân tích hiện tại';
    
    // Get risk level colors based on verdict (dark theme compatible)
    const getVerdictColors = (riskScore) => {
      if (riskScore >= 90) return { bg: 'rgba(239, 68, 68, 0.15)', border: '#ef4444', text: '#fca5a5', label: '#ef4444' };
      if (riskScore >= 70) return { bg: 'rgba(244, 63, 94, 0.15)', border: '#f43f5e', text: '#fb7185', label: '#f43f5e' };
      if (riskScore >= 50) return { bg: 'rgba(245, 158, 11, 0.15)', border: '#f59e0b', text: '#fbbf24', label: '#f59e0b' };
      if (riskScore >= 30) return { bg: 'rgba(234, 179, 8, 0.15)', border: '#eab308', text: '#fcd34d', label: '#eab308' };
      return { bg: 'rgba(16, 185, 129, 0.15)', border: '#10b981', text: '#6ee7b7', label: '#10b981' };
    };
    
    const colors = getVerdictColors(verdict.risk_score);
    
    html += `
      <div class="content-section" style="margin-top: 2rem; padding: 1.5rem; background: ${colors.bg}; border-left: 4px solid ${colors.border}; border-radius: 8px;">
        <h3 style="margin: 0 0 1rem 0; color: ${colors.label};">
          Kết Luận: ${verdictText}
        </h3>
        <p style="margin: 0; color: var(--text-primary); font-size: 1.1rem;">
          ${recommendationText}
        </p>
        ${verdict.auto_reject ? `
        <div style="margin-top: 1rem; padding: 0.75rem; background: rgba(239, 68, 68, 0.1); border-radius: 4px;">
          <strong style="color: #ef4444;">⚠️ Phát Hiện Điều Kiện Tự Động Từ Chối</strong>
        </div>
        ` : ''}
      </div>
    `;
  }
  
  // 2. Risk Factor Breakdown
  if (data.risk_breakdown) {
    const breakdown = data.risk_breakdown;
    // Translate component names
    const translateComponentName = (name) => {
      if (name.includes('Manifest')) return 'Rủi Ro Manifest';
      if (name.includes('Code Pattern')) return 'Rủi Ro Mẫu Code';
      if (name.includes('RCE/Exfil')) return 'Rủi Ro RCE/Exfil';
      if (name.includes('Obfuscation')) return 'Rủi Ro Làm Rối';
      if (name.includes('API Abuse')) return 'Rủi Ro Lạm Dụng API';
      if (name.includes('Network')) return 'Rủi Ro Mạng';
      return name;
    };
    
    // Get risk level color based on score (dark theme compatible)
    const getRiskLevelColor = (score) => {
      if (score >= 70) return { bg: 'rgba(239, 68, 68, 0.15)', border: '#ef4444', text: '#fca5a5', label: 'NGHIÊM TRỌNG', labelColor: '#ef4444' };
      if (score >= 50) return { bg: 'rgba(244, 63, 94, 0.15)', border: '#f43f5e', text: '#fb7185', label: 'CAO', labelColor: '#f43f5e' };
      if (score >= 30) return { bg: 'rgba(245, 158, 11, 0.15)', border: '#f59e0b', text: '#fbbf24', label: 'TRUNG BÌNH', labelColor: '#f59e0b' };
      return { bg: 'rgba(16, 185, 129, 0.15)', border: '#10b981', text: '#6ee7b7', label: 'THẤP', labelColor: '#10b981' };
    };
    
    html += `
      <div class="content-section" style="margin-top: 2rem;">
        <h3>Phân Tích Phân Bố Rủi Ro</h3>
        <div style="margin-top: 1rem;">
          <div style="font-size: 1.2rem; margin-bottom: 1rem;">
            <strong>Điểm Rủi Ro Cuối Cùng: ${breakdown.total_score}/100</strong>
          </div>
          <div class="stats-grid">
            ${breakdown.components.map(comp => {
              const riskColors = getRiskLevelColor(comp.score);
              return `
              <div class="stat-item" style="position: relative; background: ${riskColors.bg}; border-left: 4px solid ${riskColors.border}; border-radius: 4px; padding: 1rem;">
                <div class="label" style="color: var(--text-primary); font-weight: 600;">${translateComponentName(comp.name)}</div>
                <div class="value" style="color: ${riskColors.labelColor}; font-weight: 700; font-size: 1.5rem;">${comp.percentage}%</div>
                <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.25rem;">
                  Điểm: <span style="color: ${riskColors.text};">${comp.score}/100</span> (<span style="color: ${riskColors.labelColor}; font-weight: 600;">${riskColors.label}</span>) | Trọng số: ${(comp.weight * 100).toFixed(0)}%
                </div>
                <div style="margin-top: 0.5rem; height: 4px; background: rgba(255, 255, 255, 0.1); border-radius: 2px; overflow: hidden;">
                  <div style="height: 100%; width: ${comp.percentage}%; background: ${riskColors.border}; transition: width 0.3s;"></div>
                </div>
              </div>
            `;
            }).join('')}
          </div>
        </div>
      </div>
    `;
  }
  
  // 3. Top 5 Most Dangerous Findings
  if (data.top_findings && data.top_findings.length > 0) {
    // Translate severity
    const translateSeverity = (severity) => {
      if (severity === 'CRITICAL') return 'NGHIÊM TRỌNG';
      if (severity === 'HIGH') return 'CAO';
      if (severity === 'MEDIUM') return 'TRUNG BÌNH';
      if (severity === 'LOW') return 'THẤP';
      return severity;
    };
    
    // Get risk level colors based on severity (dark theme compatible)
    const getSeverityRiskColors = (severity) => {
      if (severity === 'CRITICAL') return { bg: 'rgba(239, 68, 68, 0.15)', border: '#ef4444', text: '#fca5a5', label: '#ef4444' };
      if (severity === 'HIGH') return { bg: 'rgba(244, 63, 94, 0.15)', border: '#f43f5e', text: '#fb7185', label: '#f43f5e' };
      if (severity === 'MEDIUM') return { bg: 'rgba(245, 158, 11, 0.15)', border: '#f59e0b', text: '#fbbf24', label: '#f59e0b' };
      return { bg: 'rgba(16, 185, 129, 0.15)', border: '#10b981', text: '#6ee7b7', label: '#10b981' };
    };
    
    html += `
      <div class="content-section" style="margin-top: 2rem;">
        <h3>Các Phát Hiện Nguy Hiểm Nhất</h3>
        <div style="margin-top: 1rem;">
          ${data.top_findings.map((finding, index) => {
            const colors = getSeverityRiskColors(finding.severity);
            return `
            <div style="margin-bottom: 1rem; padding: 1rem; background: ${colors.bg}; border-left: 4px solid ${colors.border}; border-radius: 4px;">
              <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; flex-wrap: wrap;">
                <span style="font-weight: bold; color: ${colors.label};">#${index + 1}</span>
                <span style="font-weight: bold; color: var(--text-primary);">${finding.title}</span>
                <span style="padding: 0.25rem 0.5rem; background: ${colors.border}; color: white; border-radius: 4px; font-size: 0.85rem; font-weight: 600;">
                  ${translateSeverity(finding.severity)}
                </span>
                <span style="margin-left: auto; font-weight: bold; color: ${colors.label};">
                  ${finding.score} điểm
                </span>
              </div>
              <p style="margin: 0; color: var(--text-secondary);">${finding.description}</p>
              ${finding.file ? `<div style="margin-top: 0.5rem; font-size: 0.9rem; color: var(--text-muted); font-family: monospace;">${finding.file}</div>` : ''}
            </div>
          `;
          }).join('')}
        </div>
      </div>
    `;
  }
  
  // 4. Correlation Report (Attack Chains)
  if (data.correlation_report && (data.correlation_report.attack_chains.length > 0 || data.correlation_report.cross_correlations.length > 0)) {
    const corr = data.correlation_report;
    html += `
      <div class="content-section" style="margin-top: 2rem;">
        <h3>Tương Quan Mối Đe Dọa Thống Nhất</h3>
        ${corr.attack_chains.length > 0 ? `
          <div style="margin-top: 1rem;">
            <h4 style="margin-bottom: 0.5rem;">Chuỗi Tấn Công Đã Phát Hiện (${corr.total_chains})</h4>
            ${corr.attack_chains.map(chain => {
              // Translate step names
              const translateStep = (step) => {
                if (step === 'KEYLOGGING') return 'Ghi Lại Phím';
                if (step === 'FORM_DATA_CAPTURE') return 'Bắt Dữ Liệu Form';
                if (step === 'DATA_EXFILTRATION') return 'Rò Rỉ Dữ Liệu';
                if (step === 'COOKIE_ACCESS') return 'Truy Cập Cookie';
                if (step === 'STORAGE_ACCESS') return 'Truy Cập Storage';
                if (step === 'SCRIPT_INJECTION') return 'Tiêm Script';
                if (step === 'EVAL_EXECUTION') return 'Thực Thi Eval';
                if (step === 'SESSION_HIJACKING') return 'Chiếm Quyền Phiên';
                if (step === 'TOKEN_ACCESS') return 'Truy Cập Token';
                if (step === 'TOKEN_THEFT') return 'Đánh Cắp Token';
                return step;
              };
              const translatedSteps = chain.steps.map(translateStep);
              return `
              <div style="margin-bottom: 1rem; padding: 1rem; background: rgba(239, 68, 68, 0.1); border-left: 4px solid #ef4444; border-radius: 4px;">
                <div style="font-weight: bold; color: #ef4444; margin-bottom: 0.5rem;">${chain.name}</div>
                <div style="color: var(--text-primary); margin-bottom: 0.5rem;">${chain.description}</div>
                <div style="font-size: 0.9rem; color: var(--text-secondary);">
                  <div>Các bước: ${translatedSteps.join(' → ')}</div>
                  <div>Thời lượng: ${chain.duration_seconds}s | Độ tin cậy: ${(chain.confidence * 100).toFixed(0)}% | Tăng rủi ro: +${chain.risk_boost} điểm</div>
                </div>
              </div>
            `;
            }).join('')}
          </div>
        ` : ''}
        ${corr.cross_correlations.length > 0 ? `
          <div style="margin-top: 1rem;">
            <h4 style="margin-bottom: 0.5rem;">Tương Quan Chéo</h4>
            ${corr.cross_correlations.map(corr_item => `
              <div style="padding: 0.75rem; background: rgba(245, 158, 11, 0.1); border-left: 4px solid #f59e0b; border-radius: 4px; margin-bottom: 0.5rem;">
                <div style="font-weight: bold; color: #f59e0b;">Tương Quan Tĩnh-Động</div>
                <div style="color: var(--text-secondary); font-size: 0.9rem;">${corr_item.description} (Tăng rủi ro: +${corr_item.boost} điểm)</div>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }
  
  // 5. Evidence Section
  if (data.evidence) {
    const evidence = data.evidence;
    const hasEvidence = evidence.code_snippets.length > 0 || evidence.payloads.length > 0 || 
                       evidence.domains.length > 0 || evidence.behavior_logs.length > 0;
    
    if (hasEvidence) {
      html += `
        <div class="content-section" style="margin-top: 2rem;">
          <h3>Bằng Chứng</h3>
          ${evidence.code_snippets.length > 0 ? `
            <div style="margin-top: 1rem;">
              <h4>Đoạn Code</h4>
              ${evidence.code_snippets.map(snippet => `
                <div style="margin-bottom: 1rem; padding: 1rem; background: #1e293b; border-radius: 4px; font-family: 'Courier New', monospace;">
                  <div style="color: #94a3b8; font-size: 0.85rem; margin-bottom: 0.5rem;">
                    ${snippet.file}:${snippet.line} - ${snippet.pattern}
                  </div>
                  <pre style="margin: 0; color: #e2e8f0; white-space: pre-wrap; word-wrap: break-word; font-size: 0.9rem;">${escapeHtml(snippet.code)}</pre>
                </div>
              `).join('')}
            </div>
          ` : ''}
          ${evidence.domains.length > 0 ? `
            <div style="margin-top: 1rem;">
              <h4>Domain Đáng Ngờ</h4>
              ${evidence.domains.map(domain => `
                <div style="padding: 0.75rem; background: rgba(239, 68, 68, 0.1); border-left: 4px solid #ef4444; border-radius: 4px; margin-bottom: 0.5rem;">
                  <div style="font-weight: bold; color: #ef4444;">${domain.domain}</div>
                  <div style="color: var(--text-secondary); font-size: 0.9rem;">${domain.reason}</div>
                </div>
              `).join('')}
            </div>
          ` : ''}
          ${evidence.payloads.length > 0 ? `
            <div style="margin-top: 1rem;">
              <h4>Mẫu Payload</h4>
              ${evidence.payloads.map(payload => `
                <div style="margin-bottom: 1rem; padding: 1rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px;">
                  <div style="font-weight: bold; margin-bottom: 0.5rem;">Đến: ${payload.destination}</div>
                  <pre style="margin: 0; color: var(--text-secondary); white-space: pre-wrap; word-wrap: break-word; font-size: 0.85rem; max-height: 200px; overflow-y: auto;">${escapeHtml(payload.payload)}</pre>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      `;
    }
  }
  
  // 6. Mitigation Recommendations - Removed from Overview (as requested)
  
  // If no professional sections were added, show a message
  if (html === '') {
    html = `
      <div class="content-section" style="margin-top: 2rem; padding: 1rem; background: rgba(100, 116, 139, 0.1); border-radius: 4px;">
        <p style="color: var(--text-secondary); margin: 0;">
          Các phần báo cáo chuyên nghiệp sẽ xuất hiện ở đây sau khi phân tích hoàn tất.
        </p>
      </div>
    `;
  }
  
  console.log('displayProfessionalReportSections returning html length:', html.length);
  return html;
}

// Helper functions
function getRiskColor(score) {
  if (score >= 70) return '#ef4444';
  if (score >= 50) return '#f59e0b';
  if (score >= 30) return '#eab308';
  return '#22c55e';
}

function getSeverityColor(severity) {
  if (severity === 'CRITICAL') return '#ef4444';
  if (severity === 'HIGH') return '#f59e0b';
  if (severity === 'MEDIUM') return '#eab308';
  return '#64748b';
}

function getSeverityBgColor(severity) {
  if (severity === 'CRITICAL') return 'rgba(239, 68, 68, 0.1)';
  if (severity === 'HIGH') return 'rgba(245, 158, 11, 0.1)';
  if (severity === 'MEDIUM') return 'rgba(234, 179, 8, 0.1)';
  return 'rgba(100, 116, 139, 0.1)';
}

function getPriorityColor(priority) {
  if (priority === 'CRITICAL') return '#ef4444';
  if (priority === 'HIGH') return '#f59e0b';
  if (priority === 'MEDIUM') return '#eab308';
  return '#64748b';
}

function getPriorityBgColor(priority) {
  if (priority === 'CRITICAL') return 'rgba(239, 68, 68, 0.1)';
  if (priority === 'HIGH') return 'rgba(245, 158, 11, 0.1)';
  if (priority === 'MEDIUM') return 'rgba(234, 179, 8, 0.1)';
  return 'rgba(100, 116, 139, 0.1)';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Display patterns
 */
function displayPatterns(data) {
  const patternsContent = document.getElementById('patternsContent');
  if (!patternsContent) {
    console.error('patternsContent element not found!');
    return;
  }
  
  const patterns = data.patterns || [];
  const hybrid = data.hybrid_analysis || {};
  const manifestAnalysis = hybrid.manifest_analysis || {};
  const jsCodeAnalysis = hybrid.js_code_analysis || {};
  const hasBehaviors = data.behaviorCount > 0;
  
  // If no behaviors, show static analysis patterns
  if (!hasBehaviors) {
    const staticPatterns = [];
    
    // Manifest patterns
    if (manifestAnalysis.suspicious_patterns && manifestAnalysis.suspicious_patterns.length > 0) {
      manifestAnalysis.suspicious_patterns.forEach(pattern => {
        staticPatterns.push({
          name: pattern.type || 'Mẫu Đáng Ngờ',
          severity: pattern.severity || 'MEDIUM',
          description: pattern.description || 'Phát hiện mẫu đáng ngờ trong manifest',
          source: 'Manifest'
        });
      });
    }
    
    // CSP violations
    if (manifestAnalysis.csp_analysis && manifestAnalysis.csp_analysis.violations) {
      manifestAnalysis.csp_analysis.violations.forEach(violation => {
        staticPatterns.push({
          name: 'Vi Phạm CSP',
          severity: violation.severity || 'HIGH',
          description: violation.description || violation.pattern,
          source: 'CSP'
        });
      });
    }
    
    // Permission abuse
    if (manifestAnalysis.permission_abuse_analysis && manifestAnalysis.permission_abuse_analysis.abuse_patterns) {
      manifestAnalysis.permission_abuse_analysis.abuse_patterns.forEach(pattern => {
        staticPatterns.push({
          name: pattern.type || 'Lạm Dụng Quyền',
          severity: pattern.severity || 'MEDIUM',
          description: pattern.description || 'Phát hiện lạm dụng quyền',
          source: 'Permissions'
        });
      });
    }
    
    // JS code patterns
    if (jsCodeAnalysis.files) {
      jsCodeAnalysis.files.forEach((file, idx) => {
        const filePatterns = file.pattern_detection || {};
        if (filePatterns.patterns && filePatterns.patterns.length > 0) {
          filePatterns.patterns.forEach(pattern => {
            staticPatterns.push({
              name: pattern.pattern || 'Mẫu Mã',
              severity: pattern.severity || 'MEDIUM',
              description: `${pattern.description} (trong ${file.filename || `file ${idx + 1}`})`,
              source: 'JS Code'
            });
          });
        }
      });
    }
    
    if (staticPatterns.length === 0) {
      patternsContent.innerHTML = '<p>Không phát hiện pattern đáng ngờ nào từ phân tích tĩnh.</p>';
      return;
    }
    
    patternsContent.innerHTML = `
      <ul class="pattern-list">
        ${staticPatterns.map(pattern => `
          <li class="pattern-item">
            <div class="item-header">
              <span class="item-title">${pattern.name}</span>
              <span class="badge ${pattern.severity.toLowerCase()}">${pattern.severity}</span>
            </div>
            <p>${pattern.description}</p>
            <p style="margin-top: 0.5rem; font-size: 0.875rem; color: #64748b;">
              Nguồn: ${pattern.source}
            </p>
          </li>
        `).join('')}
      </ul>
    `;
    return;
  }
  
  // Original behavior-based patterns
  if (patterns.length === 0) {
    patternsContent.innerHTML = '<p>Không phát hiện pattern nào.</p>';
    return;
  }
  
  let html = `
    <ul class="pattern-list">
      ${patterns.map(pattern => `
        <li class="pattern-item">
          <div class="item-header">
            <span class="item-title">${pattern.name}</span>
            <span class="badge ${pattern.severity.toLowerCase()}">${pattern.severity}</span>
          </div>
          <p>${pattern.description}</p>
          <p style="margin-top: 0.5rem; font-size: 0.875rem; color: #64748b;">
            Độ Tin Cậy: ${(pattern.confidence * 100).toFixed(0)}% | 
            Hành Vi: ${pattern.behaviors.join(', ')}
          </p>
        </li>
      `).join('')}
    </ul>
  `;
  
  // Add Top Findings section
  if (data.top_findings && data.top_findings.length > 0) {
    const translateSeverity = (severity) => {
      if (severity === 'CRITICAL') return 'NGHIÊM TRỌNG';
      if (severity === 'HIGH') return 'CAO';
      if (severity === 'MEDIUM') return 'TRUNG BÌNH';
      if (severity === 'LOW') return 'THẤP';
      return severity;
    };
    
    // Get risk level colors based on severity (dark theme compatible)
    const getSeverityRiskColors = (severity) => {
      if (severity === 'CRITICAL') return { bg: 'rgba(239, 68, 68, 0.15)', border: '#ef4444', text: '#fca5a5', label: '#ef4444' };
      if (severity === 'HIGH') return { bg: 'rgba(244, 63, 94, 0.15)', border: '#f43f5e', text: '#fb7185', label: '#f43f5e' };
      if (severity === 'MEDIUM') return { bg: 'rgba(245, 158, 11, 0.15)', border: '#f59e0b', text: '#fbbf24', label: '#f59e0b' };
      return { bg: 'rgba(16, 185, 129, 0.15)', border: '#10b981', text: '#6ee7b7', label: '#10b981' };
    };
    
    html += `
      <div class="content-section" style="margin-top: 2rem;">
        <h3>Top ${data.top_findings.length} Phát Hiện Nguy Hiểm Nhất</h3>
        <div style="margin-top: 1rem;">
          ${data.top_findings.map((finding, index) => {
            const colors = getSeverityRiskColors(finding.severity);
            return `
            <div style="margin-bottom: 1rem; padding: 1rem; background: ${colors.bg}; border-left: 4px solid ${colors.border}; border-radius: 4px;">
              <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; flex-wrap: wrap;">
                <span style="font-weight: bold; color: ${colors.label};">#${index + 1}</span>
                <span style="font-weight: bold; color: var(--text-primary);">${finding.title}</span>
                <span style="padding: 0.25rem 0.5rem; background: ${colors.border}; color: white; border-radius: 4px; font-size: 0.85rem; font-weight: 600;">
                  ${translateSeverity(finding.severity)}
                </span>
                <span style="margin-left: auto; font-weight: bold; color: ${colors.label};">
                  ${finding.score} điểm
                </span>
              </div>
              <p style="margin: 0; color: var(--text-secondary);">${finding.description}</p>
              ${finding.file ? `<div style="margin-top: 0.5rem; font-size: 0.9rem; color: var(--text-muted); font-family: monospace;">${finding.file}</div>` : ''}
            </div>
          `;
          }).join('')}
        </div>
      </div>
    `;
  }
  
  // Add Attack Chains section
  if (data.correlation_report && data.correlation_report.attack_chains.length > 0) {
    const corr = data.correlation_report;
    const translateStep = (step) => {
      if (step === 'KEYLOGGING') return 'Ghi Lại Phím';
      if (step === 'FORM_DATA_CAPTURE') return 'Bắt Dữ Liệu Form';
      if (step === 'DATA_EXFILTRATION') return 'Rò Rỉ Dữ Liệu';
      if (step === 'COOKIE_ACCESS') return 'Truy Cập Cookie';
      if (step === 'STORAGE_ACCESS') return 'Truy Cập Storage';
      if (step === 'SCRIPT_INJECTION') return 'Tiêm Script';
      if (step === 'EVAL_EXECUTION') return 'Thực Thi Eval';
      if (step === 'SESSION_HIJACKING') return 'Chiếm Quyền Phiên';
      if (step === 'TOKEN_ACCESS') return 'Truy Cập Token';
      if (step === 'TOKEN_THEFT') return 'Đánh Cắp Token';
      return step;
    };
    
    html += `
      <div class="content-section" style="margin-top: 2rem;">
        <h3>Chuỗi Tấn Công Đã Phát Hiện</h3>
        <div style="margin-top: 1rem;">
          ${corr.attack_chains.map(chain => {
            const translatedSteps = chain.steps.map(translateStep);
            return `
              <div style="margin-bottom: 1rem; padding: 1rem; background: rgba(239, 68, 68, 0.1); border-left: 4px solid #ef4444; border-radius: 4px;">
                <div style="font-weight: bold; color: #ef4444; margin-bottom: 0.5rem;">${chain.name}</div>
                <div style="color: var(--text-primary); margin-bottom: 0.5rem;">${chain.description}</div>
                <div style="font-size: 0.9rem; color: var(--text-secondary);">
                  <div>Các bước: ${translatedSteps.join(' → ')}</div>
                  <div>Thời lượng: ${chain.duration_seconds}s | Độ tin cậy: ${(chain.confidence * 100).toFixed(0)}% | Tăng rủi ro: +${chain.risk_boost} điểm</div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }
  
  patternsContent.innerHTML = html;
}

/**
 * Display anomalies
 */
function displayAnomalies(data) {
  const anomaliesContent = document.getElementById('anomaliesContent');
  if (!anomaliesContent) {
    console.error('anomaliesContent element not found!');
    return;
  }
  const anomalies = data.anomalies || [];
  
  if (anomalies.length === 0) {
    anomaliesContent.innerHTML = '<p>Không phát hiện anomaly nào.</p>';
    return;
  }
  
  anomaliesContent.innerHTML = `
    <ul class="anomaly-list">
      ${anomalies.map(anomaly => `
        <li class="anomaly-item">
          <div class="item-header">
            <span class="item-title">${anomaly.type}</span>
            <span class="badge ${anomaly.severity.toLowerCase()}">${anomaly.severity}</span>
          </div>
          <p>${anomaly.description}</p>
        </li>
      `).join('')}
    </ul>
  `;
}

/**
 * Get risk level style based on risk level
 */
function getRiskLevelStyle(riskLevel) {
  let bgColor = 'rgba(255, 255, 255, 0.05)';
  let borderColor = '#64748b';
  
  const level = (riskLevel || 'UNKNOWN').toUpperCase();
  
  if (level === 'CRITICAL') {
    bgColor = 'rgba(239, 68, 68, 0.15)';
    borderColor = '#ef4444';
  } else if (level === 'HIGH') {
    bgColor = 'rgba(244, 63, 94, 0.15)';
    borderColor = '#f43f5e';
  } else if (level === 'MEDIUM') {
    bgColor = 'rgba(245, 158, 11, 0.15)';
    borderColor = '#f59e0b';
  } else if (level === 'LOW') {
    bgColor = 'rgba(16, 185, 129, 0.15)';
    borderColor = '#10b981';
  }
  
  return `background: ${bgColor}; border-left: 4px solid ${borderColor}; border-radius: 4px; padding: 1rem;`;
}

/**
 * Get risk level color for text
 */
function getRiskLevelColor(riskLevel, type) {
  const level = (riskLevel || 'UNKNOWN').toUpperCase();
  
  if (type === 'label') {
    if (level === 'CRITICAL') return '#ef4444';
    if (level === 'HIGH') return '#f43f5e';
    if (level === 'MEDIUM') return '#f59e0b';
    if (level === 'LOW') return '#10b981';
    return '#64748b';
  } else { // value
    if (level === 'CRITICAL') return '#fca5a5';
    if (level === 'HIGH') return '#fb7185';
    if (level === 'MEDIUM') return '#fbbf24';
    if (level === 'LOW') return '#6ee7b7';
    return 'var(--text-primary)';
  }
}

/**
 * Display hybrid analysis
 */
function displayHybridAnalysis(data) {
  const hybridContent = document.getElementById('hybridContent');
  if (!hybridContent) {
    console.error('hybridContent element not found!');
    return;
  }
  
  console.log('displayHybridAnalysis called with data:', data);
  const hybrid = data.hybrid_analysis || {};
  console.log('hybrid_analysis:', hybrid);
  console.log('hybrid keys:', Object.keys(hybrid));
  
  if (!hybrid || Object.keys(hybrid).length === 0) {
    hybridContent.innerHTML = '<p style="padding: 1rem; color: var(--text-secondary);">Phân tích kết hợp không có sẵn. (Hybrid analysis not available)</p>';
    return;
  }
  
  let html = '<div class="content-section">';
  let hasContent = false;
  
  // Signature analysis
  if (hybrid.signature_analysis && !hybrid.signature_analysis.error) {
    const sig = hybrid.signature_analysis;
    hasContent = true;
    html += `
      <h3>Phát Hiện Dựa Trên Chữ Ký</h3>
      <div class="stats-grid">
        <div class="stat-item">
          <div class="label">Chữ Ký Đã Phát Hiện</div>
          <div class="value">${sig.total_signatures || 0}</div>
        </div>
        <div class="stat-item">
          <div class="label">Điểm Rủi Ro</div>
          <div class="value">${sig.risk_score || 0}/100</div>
        </div>
        <div class="stat-item" style="${getRiskLevelStyle(sig.risk_level || 'UNKNOWN')}">
          <div class="label" style="color: var(--text-primary); font-weight: 600;">Mức Độ Rủi Ro</div>
          <div class="value" style="color: ${getRiskLevelColor(sig.risk_level || 'UNKNOWN', 'label')}; font-weight: 700; font-size: 1.5rem;">${sig.risk_level || 'UNKNOWN'}</div>
        </div>
      </div>
    `;
  }
  
  // Behavioral analysis
  if (hybrid.behavioral_analysis && !hybrid.behavioral_analysis.error) {
    const beh = hybrid.behavioral_analysis;
    hasContent = true;
    html += `
      <h3 style="margin-top: 2rem;">Phân Tích Hành Vi</h3>
      <div class="stats-grid">
        <div class="stat-item">
          <div class="label">Điểm Rủi Ro</div>
          <div class="value">${beh.risk_score || 0}/100</div>
        </div>
        <div class="stat-item" style="${getRiskLevelStyle(beh.risk_level || 'UNKNOWN')}">
          <div class="label" style="color: var(--text-primary); font-weight: 600;">Mức Độ Rủi Ro</div>
          <div class="value" style="color: ${getRiskLevelColor(beh.risk_level || 'UNKNOWN', 'label')}; font-weight: 700; font-size: 1.5rem;">${beh.risk_level || 'UNKNOWN'}</div>
        </div>
        ${beh.baseline_comparison ? `
        <div class="stat-item">
          <div class="label">Lệch So Với Baseline</div>
          <div class="value">${beh.baseline_comparison.total_deviations || 0}</div>
        </div>
        ` : ''}
      </div>
    `;
  }
  
  // Network analysis
  if (hybrid.network_analysis && !hybrid.network_analysis.error) {
    const net = hybrid.network_analysis;
    hasContent = true;
    html += `
      <h3 style="margin-top: 2rem;">Phân Tích Mạng</h3>
      <div class="stats-grid">
        <div class="stat-item">
          <div class="label">Điểm Rủi Ro</div>
          <div class="value">${net.risk_score || 0}/100</div>
        </div>
        <div class="stat-item">
          <div class="label">Rò Rỉ Dữ Liệu</div>
          <div class="value">${net.exfiltration_analysis?.total_exfiltrations || 0}</div>
        </div>
        ${net.domain_analysis ? `
        <div class="stat-item">
          <div class="label">Số Domain</div>
          <div class="value">${net.domain_analysis.domain_count || 0}</div>
        </div>
        ` : ''}
      </div>
      ${net.permission_mismatches && net.permission_mismatches.length > 0 ? `
      <div style="margin-top: 1rem; padding: 1rem; background: rgba(239, 68, 68, 0.1); border-left: 4px solid #ef4444; border-radius: 4px;">
        <h4 style="margin: 0 0 0.5rem 0; color: #ef4444;">Lệch Quyền Truy Cập</h4>
        <ul style="margin: 0; padding-left: 1.5rem;">
          ${net.permission_mismatches.map(m => `<li>${m.message || m.type}</li>`).join('')}
        </ul>
      </div>
      ` : ''}
    `;
  }
  
  // Manifest analysis
  if (hybrid.manifest_analysis && !hybrid.manifest_analysis.error) {
    const man = hybrid.manifest_analysis;
    hasContent = true;
    html += `
      <h3 style="margin-top: 2rem;">Phân Tích Manifest</h3>
      <div class="stats-grid">
        <div class="stat-item">
          <div class="label">Điểm Rủi Ro</div>
          <div class="value">${man.risk_score || 0}/100</div>
        </div>
        <div class="stat-item" style="${getRiskLevelStyle(man.risk_level || 'UNKNOWN')}">
          <div class="label" style="color: var(--text-primary); font-weight: 600;">Mức Độ Rủi Ro</div>
          <div class="value" style="color: ${getRiskLevelColor(man.risk_level || 'UNKNOWN', 'label')}; font-weight: 700; font-size: 1.5rem;">${man.risk_level || 'UNKNOWN'}</div>
        </div>
        ${man.permissions_analysis ? `
        <div class="stat-item">
          <div class="label">Quyền Nguy Hiểm</div>
          <div class="value">${man.permissions_analysis.risky_permissions?.length || 0}</div>
        </div>
        ` : ''}
      </div>
    `;
  }
  
  // JS Code analysis
  if (hybrid.js_code_analysis && !hybrid.js_code_analysis.error) {
    const js = hybrid.js_code_analysis;
    hasContent = true;
    html += `
      <h3 style="margin-top: 2rem;">Phân Tích JavaScript Code</h3>
      <div class="stats-grid">
        <div class="stat-item">
          <div class="label">Số File Đã Phân Tích</div>
          <div class="value">${js.files_analyzed || 0}</div>
        </div>
        <div class="stat-item">
          <div class="label">Điểm Rủi Ro</div>
          <div class="value">${js.risk_score || 0}/100</div>
        </div>
        <div class="stat-item">
          <div class="label">Tổng Số Mẫu</div>
          <div class="value">${js.total_patterns || 0}</div>
        </div>
        <div class="stat-item">
          <div class="label">File Bị Làm Rối</div>
          <div class="value">${js.obfuscated_files || 0}</div>
        </div>
      </div>
    `;
  }
  
  // Signature database analysis
  if (hybrid.signature_database_analysis) {
    const sigDb = hybrid.signature_database_analysis;
    hasContent = true;
    html += `
      <h3 style="margin-top: 2rem;">Phân Tích Cơ Sở Dữ Liệu Chữ Ký</h3>
      <div class="stats-grid">
        ${sigDb.permission_fingerprints ? `
        <div class="stat-item">
          <div class="label">Khớp Chữ Ký Quyền</div>
          <div class="value">${sigDb.permission_fingerprints.total_matches || 0}</div>
        </div>
        ` : ''}
        ${sigDb.blacklisted_domains ? `
        <div class="stat-item">
          <div class="label">Domain Trong Danh Sách Đen</div>
          <div class="value">${sigDb.blacklisted_domains.length || 0}</div>
        </div>
        ` : ''}
      </div>
    `;
  }
  
  if (!hasContent) {
    html += '<p style="padding: 1rem; color: var(--text-secondary);">Không có dữ liệu phân tích kết hợp. (No hybrid analysis data available)</p>';
  }
  
  // Add Evidence section to Hybrid Analysis tab
  if (data.evidence) {
    const evidence = data.evidence;
    const hasEvidence = evidence.code_snippets.length > 0 || evidence.payloads.length > 0 || 
                       evidence.domains.length > 0 || evidence.behavior_logs.length > 0;
    
    if (hasEvidence) {
      html += `
        <div class="content-section" style="margin-top: 2rem;">
          <h3>Bằng Chứng</h3>
          ${evidence.code_snippets.length > 0 ? `
            <div style="margin-top: 1rem;">
              <h4>Đoạn Code</h4>
              ${evidence.code_snippets.map(snippet => `
                <div style="margin-bottom: 1rem; padding: 1rem; background: #1e293b; border-radius: 4px; font-family: 'Courier New', monospace;">
                  <div style="color: #94a3b8; font-size: 0.85rem; margin-bottom: 0.5rem;">
                    ${snippet.file}:${snippet.line} - ${snippet.pattern}
                  </div>
                  <pre style="margin: 0; color: #e2e8f0; white-space: pre-wrap; word-wrap: break-word; font-size: 0.9rem;">${escapeHtml(snippet.code)}</pre>
                </div>
              `).join('')}
            </div>
          ` : ''}
          ${evidence.domains.length > 0 ? `
            <div style="margin-top: 1rem;">
              <h4>Domain Đáng Ngờ</h4>
              ${evidence.domains.map(domain => `
                <div style="padding: 0.75rem; background: rgba(239, 68, 68, 0.1); border-left: 4px solid #ef4444; border-radius: 4px; margin-bottom: 0.5rem;">
                  <div style="font-weight: bold; color: #ef4444;">${domain.domain}</div>
                  <div style="color: var(--text-secondary); font-size: 0.9rem;">${domain.reason}</div>
                </div>
              `).join('')}
            </div>
          ` : ''}
          ${evidence.payloads.length > 0 ? `
            <div style="margin-top: 1rem;">
              <h4>Mẫu Payload</h4>
              ${evidence.payloads.map(payload => `
                <div style="margin-bottom: 1rem; padding: 1rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px;">
                  <div style="font-weight: bold; margin-bottom: 0.5rem;">Đến: ${payload.destination}</div>
                  <pre style="margin: 0; color: var(--text-secondary); white-space: pre-wrap; word-wrap: break-word; font-size: 0.85rem; max-height: 200px; overflow-y: auto;">${escapeHtml(payload.payload)}</pre>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      `;
    }
  }
  
  html += '</div>';
  hybridContent.innerHTML = html;
  console.log('Hybrid analysis displayed successfully');
}

/**
 * Generate detailed extension description based on static analysis
 */
function generateDetailedDescription(data) {
  const riskLevel = data.riskLevel || 'UNKNOWN';
  const riskScore = data.riskScore || 0;
  const hybrid = data.hybrid_analysis || {};
  const manifestAnalysis = hybrid.manifest_analysis || {};
  const jsCodeAnalysis = hybrid.js_code_analysis || {};
  const hasBehaviors = data.behaviorCount > 0;
  
  // Only generate for static analysis (no behaviors)
  if (hasBehaviors) {
    return null;
  }
  
  let description = '';
  
  // Overview based on risk level
  if (riskLevel === 'CRITICAL') {
    description += '<div class="risk-description critical"><h3>Mô tả tổng quan cho Risk Level = CRITICAL</h3><p>Extension này có nhiều dấu hiệu nguy hiểm và có khả năng cao là độc hại. <strong>KHÔNG NÊN</strong> cài đặt hoặc sử dụng extension này.</p></div>';
  } else if (riskLevel === 'HIGH') {
    description += '<div class="risk-description high"><h3>Mô tả tổng quan cho Risk Level = HIGH</h3><p>Extension này có nhiều hành vi hoặc cấu hình rủi ro cao. Người dùng nên <strong>rất thận trọng</strong> khi cài đặt hoặc sử dụng extension này.</p></div>';
  } else if (riskLevel === 'MEDIUM') {
    description += '<div class="risk-description medium"><h3>Mô tả tổng quan cho Risk Level = MEDIUM</h3><p>Extension này có một số hành vi hoặc cấu hình tiềm ẩn rủi ro, nhưng chưa đủ để kết luận là độc hại. Người dùng nên <strong>thận trọng</strong> khi cài đặt hoặc sử dụng extension này.</p></div>';
  } else {
    description += '<div class="risk-description low"><h3>Mô tả tổng quan cho Risk Level = LOW</h3><p>Extension này có vẻ an toàn với các cấu hình và mã nguồn hợp lý. Tuy nhiên, vẫn nên cẩn thận khi cài đặt bất kỳ extension nào.</p></div>';
  }
  
  description += '<div class="detailed-analysis"><h3>Phân tích chi tiết</h3>';
  
  // (A) Permission Risk
  if (manifestAnalysis.permissions_analysis) {
    const permAnalysis = manifestAnalysis.permissions_analysis;
    const dangerousPerms = permAnalysis.dangerous_permissions || [];
    const totalPerms = permAnalysis.total_permissions || 0;
    
    if (dangerousPerms.length > 0) {
      const dangerousNames = dangerousPerms.map(p => p.permission || p).join(', ');
      const criticalPerms = ['cookies', 'webRequest', 'debugger', '<all_urls>'];
      const hasCritical = dangerousPerms.some(p => criticalPerms.includes(p.permission || p));
      
      description += `<div class="analysis-section"><h4>(A) Permission Risk (Quyền truy cập)</h4>`;
      description += `<p>Extension yêu cầu <strong>${totalPerms}</strong> quyền, trong đó có <strong>${dangerousPerms.length}</strong> quyền nhạy cảm:</p>`;
      description += `<ul>${dangerousPerms.map(p => `<li><code>${p.permission || p}</code> (${p.risk_score || 0} điểm)</li>`).join('')}</ul>`;
      
      if (!hasCritical) {
        description += `<p>Không có quyền đặc biệt nguy hiểm như: <code>cookies</code>, <code>webRequest</code>, <code>debugger</code>, <code>&lt;all_urls&gt;</code></p>`;
      }
      
      description += `<p><em>Extension yêu cầu một số quyền có khả năng theo dõi hoạt động duyệt web của bạn${hasCritical ? ', bao gồm các quyền truy cập dữ liệu nhạy cảm' : ', nhưng không có quyền truy cập dữ liệu nhạy cảm như cookie, traffic, hoặc toàn bộ URL'}. Rủi ro ở mức ${hasCritical ? 'cao' : 'vừa phải'}.</em></p>`;
      description += `</div>`;
    }
  }
  
  // (B) Host Permissions
  if (manifestAnalysis.host_permissions_analysis) {
    const hostAnalysis = manifestAnalysis.host_permissions_analysis;
    const isUniversal = hostAnalysis.universal_access;
    const hostPerms = hostAnalysis.host_permissions || [];
    
    description += `<div class="analysis-section"><h4>(B) Host Permissions (Quyền truy cập website)</h4>`;
    
    if (isUniversal) {
      description += `<p>Extension có quyền truy cập <strong>tất cả website</strong> (<code>&lt;all_urls&gt;</code> hoặc <code>*://*/*</code>).</p>`;
      description += `<p><em>Điều này cho phép extension theo dõi và can thiệp vào mọi trang web bạn truy cập, làm tăng đáng kể rủi ro về quyền riêng tư.</em></p>`;
    } else if (hostPerms.length > 0) {
      description += `<p>Extension chỉ truy cập <strong>${hostPerms.length}</strong> domain cụ thể:</p>`;
      description += `<ul>${hostPerms.slice(0, 5).map(h => `<li><code>${h}</code></li>`).join('')}</ul>`;
      description += `<p><em>Extension chỉ được phép hoạt động trên một số domain cụ thể, không phải tất cả trang web. Điều này làm giảm khả năng extension theo dõi bạn trên toàn bộ internet.</em></p>`;
    } else {
      description += `<p>Extension không có host permissions đặc biệt.</p>`;
    }
    description += `</div>`;
  }
  
  // (C) Content Script Scope
  if (manifestAnalysis.content_scripts_analysis) {
    const csAnalysis = manifestAnalysis.content_scripts_analysis;
    const totalScripts = csAnalysis.total_scripts || 0;
    const isUniversal = csAnalysis.universal_injection;
    
    if (totalScripts > 0) {
      description += `<div class="analysis-section"><h4>(C) Content Script Scope</h4>`;
      description += `<p>Extension inject script vào <strong>${totalScripts}</strong> ${totalScripts === 1 ? 'trang web' : 'trang web'}.</p>`;
      
      if (isUniversal) {
        description += `<p>Extension inject vào <code>&lt;all_urls&gt;</code> - tất cả trang web.</p>`;
        description += `<p><em>Extension có khả năng chỉnh sửa nội dung trên mọi trang web, làm tăng rủi ro về bảo mật và quyền riêng tư.</em></p>`;
      } else {
        description += `<p>Không có <code>&lt;all_urls&gt;</code> hoặc <code>all_frames: true</code>.</p>`;
        description += `<p><em>Extension có khả năng chỉnh sửa nội dung trên một số trang web cụ thể, nhưng phạm vi injection bị giới hạn nên rủi ro không quá cao.</em></p>`;
      }
      description += `</div>`;
    }
  }
  
  // (D) Code Patterns
  if (jsCodeAnalysis.total_patterns !== undefined && jsCodeAnalysis.total_patterns > 0) {
    description += `<div class="analysis-section"><h4>(D) Code Patterns (Mẫu mã đáng ngờ)</h4>`;
    description += `<p>Phát hiện <strong>${jsCodeAnalysis.total_patterns}</strong> pattern đáng ngờ trong mã JavaScript:</p>`;
    
    // Collect patterns from all files
    const allPatterns = [];
    if (jsCodeAnalysis.files) {
      jsCodeAnalysis.files.forEach(file => {
        const patterns = file.pattern_detection?.patterns || [];
        patterns.forEach(p => {
          allPatterns.push({
            pattern: p.pattern || 'Unknown',
            description: p.description || '',
            severity: p.severity || 'MEDIUM'
          });
        });
      });
    }
    
    if (allPatterns.length > 0) {
      description += `<ul>${allPatterns.slice(0, 5).map(p => `<li><strong>${p.pattern}</strong> (${p.severity}): ${p.description}</li>`).join('')}</ul>`;
    }
    
    description += `<p><em>Extension sử dụng một số đoạn mã có thể gây rủi ro, nhưng chưa thấy bằng chứng cho thấy lạm dụng hoặc tấn công rõ ràng.</em></p>`;
    description += `</div>`;
  }
  
  // (E) Remote Code Execution / Exfiltration
  description += `<div class="analysis-section"><h4>(E) Remote Code Execution / Data Exfiltration</h4>`;
  
  // Collect all patterns from all files
  const allRceExfilPatterns = [];
  if (jsCodeAnalysis.files) {
    jsCodeAnalysis.files.forEach(file => {
      const patterns = file.pattern_detection?.patterns_found || file.pattern_detection?.patterns || [];
      patterns.forEach(p => {
        const patternName = p.name || p.pattern || '';
        // Check for RCE patterns
        if (patternName === 'eval' || patternName === 'eval_fetch' || patternName.includes('eval')) {
          allRceExfilPatterns.push({ type: 'eval', name: patternName, description: p.description || 'eval()' });
        }
        if (patternName === 'function_constructor' || patternName.includes('Function')) {
          allRceExfilPatterns.push({ type: 'function', name: patternName, description: p.description || 'new Function()' });
        }
        if (patternName === 'loading_remote_script' || patternName === 'external_import' || patternName === 'dynamic_import' || 
            patternName.includes('remote') || patternName.includes('import')) {
          allRceExfilPatterns.push({ type: 'remote', name: patternName, description: p.description || 'Remote script loading' });
        }
        // Check for Exfiltration patterns
        if (patternName === 'cookie_remote' || patternName.includes('cookie')) {
          allRceExfilPatterns.push({ type: 'cookie', name: patternName, description: p.description || 'Cookie theft' });
        }
        if (patternName === 'token_remote' || patternName.includes('token')) {
          allRceExfilPatterns.push({ type: 'token', name: patternName, description: p.description || 'Token theft' });
        }
        if (patternName === 'keylog_remote' || patternName.includes('keylog')) {
          allRceExfilPatterns.push({ type: 'keylog', name: patternName, description: p.description || 'Keylogging' });
        }
      });
    });
  }
  
  // Check if patterns were found
  const hasEval = allRceExfilPatterns.some(p => p.type === 'eval');
  const hasFunction = allRceExfilPatterns.some(p => p.type === 'function');
  const hasRemoteLoad = allRceExfilPatterns.some(p => p.type === 'remote');
  const hasCookieTheft = allRceExfilPatterns.some(p => p.type === 'cookie');
  const hasTokenTheft = allRceExfilPatterns.some(p => p.type === 'token');
  const hasKeylog = allRceExfilPatterns.some(p => p.type === 'keylog');
  
  if (!hasEval && !hasFunction && !hasRemoteLoad && !hasCookieTheft && !hasTokenTheft && !hasKeylog) {
    description += `<p>Không tìm thấy:</p>`;
    description += `<ul>`;
    description += `<li><code>eval()</code></li>`;
    description += `<li><code>new Function()</code></li>`;
    description += `<li>Remote script loading</li>`;
    description += `<li>Token/cookie theft patterns</li>`;
    description += `</ul>`;
    description += `<p><em>Điều này giải thích tại sao risk không phải HIGH hoặc CRITICAL.</em></p>`;
  } else {
    description += `<p class="warning"><strong>Phát hiện các pattern nguy hiểm:</strong></p>`;
    description += `<ul>`;
    if (hasEval) {
      const evalPatterns = allRceExfilPatterns.filter(p => p.type === 'eval');
      description += `<li><code>eval()</code> - Code injection risk (${evalPatterns.length} instances)</li>`;
    }
    if (hasFunction) {
      const funcPatterns = allRceExfilPatterns.filter(p => p.type === 'function');
      description += `<li><code>new Function()</code> - Dynamic code execution (${funcPatterns.length} instances)</li>`;
    }
    if (hasRemoteLoad) {
      const remotePatterns = allRceExfilPatterns.filter(p => p.type === 'remote');
      description += `<li>Remote script loading - External code execution (${remotePatterns.length} instances)</li>`;
    }
    if (hasCookieTheft) {
      const cookiePatterns = allRceExfilPatterns.filter(p => p.type === 'cookie');
      description += `<li>Cookie theft patterns - Data exfiltration (${cookiePatterns.length} instances)</li>`;
    }
    if (hasTokenTheft) {
      const tokenPatterns = allRceExfilPatterns.filter(p => p.type === 'token');
      description += `<li>Token theft patterns - Data exfiltration (${tokenPatterns.length} instances)</li>`;
    }
    if (hasKeylog) {
      const keylogPatterns = allRceExfilPatterns.filter(p => p.type === 'keylog');
      description += `<li>Keylogging patterns - Data exfiltration (${keylogPatterns.length} instances)</li>`;
    }
    description += `</ul>`;
    description += `<p class="warning"><strong>CẢNH BÁO:</strong> Extension này có khả năng thực hiện Remote Code Execution (RCE) và Data Exfiltration, rất nguy hiểm!</p>`;
  }
  description += `</div>`;
  
  // (F) Obfuscation
  if (jsCodeAnalysis.obfuscated_files !== undefined && jsCodeAnalysis.obfuscated_files > 0) {
    description += `<div class="analysis-section"><h4>(F) Mức độ Obfuscation</h4>`;
    description += `<p>Phát hiện <strong>${jsCodeAnalysis.obfuscated_files}</strong> file có dấu hiệu obfuscation.</p>`;
    
    // Get entropy info
    const obfuscatedFiles = jsCodeAnalysis.files?.filter(f => f.obfuscation_analysis?.is_likely_obfuscated) || [];
    if (obfuscatedFiles.length > 0) {
      const avgEntropy = obfuscatedFiles.reduce((sum, f) => sum + (f.obfuscation_analysis?.entropy || 0), 0) / obfuscatedFiles.length;
      description += `<p>Entropy trung bình: <strong>${avgEntropy.toFixed(2)}</strong></p>`;
      
      if (avgEntropy >= 3.5 && avgEntropy <= 4.2) {
        description += `<p><em>Extension có một số đoạn mã được mã hóa hoặc rút gọn, nhưng mức độ không cao và không có dấu hiệu tải mã độc từ bên ngoài.</em></p>`;
      } else if (avgEntropy > 4.2) {
        description += `<p><em>Extension có mức độ obfuscation cao, có thể là dấu hiệu của mã độc.</em></p>`;
      }
    }
    description += `</div>`;
  }
  
  description += `</div>`;
  
  return description;
}

/**
 * Display recommendations
 */

function displayRecommendations(data) {
  const recommendationsContent = document.getElementById('recommendationsContent');
  if (!recommendationsContent) {
    console.error('recommendationsContent element not found!');
    return;
  }
  
  const recommendations = data.recommendations || [];
  const hasBehaviors = data.behaviorCount > 0;
  
  // Generate detailed description for static analysis
  const detailedDesc = generateDetailedDescription(data);
  
  let html = '';
  
  // Show detailed description if available (static analysis)
  if (detailedDesc) {
    html += detailedDesc;
  }
  
  // Show recommendations
  if (recommendations.length > 0) {
    html += `<div class="recommendations-section"><h3>Khuyến Nghị</h3>`;
    html += `<ul class="recommendation-list">`;
    html += recommendations.map((rec, index) => {
      // Remove emoji icons from recommendation text
      let cleanRec = rec.replace(/[🚨⚠️📊✅❌🟡]/g, '').trim();
      
      // Determine risk level and background color
      let riskClass = 'recommendation-item';
      let bgColor = '#f0fdf4'; // default (low/safe)
      let borderColor = '#10b981'; // default green
      
      if (cleanRec.includes('NGUY HIỂM') || cleanRec.includes('CRITICAL')) {
        riskClass = 'recommendation-item critical';
        bgColor = '#fef2f2';
        borderColor = '#ef4444';
      } else if (cleanRec.includes('CAO') || cleanRec.includes('HIGH')) {
        riskClass = 'recommendation-item high';
        bgColor = '#fff1f2';
        borderColor = '#f43f5e';
      } else if (cleanRec.includes('TRUNG BÌNH') || cleanRec.includes('MEDIUM')) {
        riskClass = 'recommendation-item medium';
        bgColor = '#fffbeb';
        borderColor = '#f59e0b';
      } else if (cleanRec.includes('THẤP') || cleanRec.includes('LOW')) {
        riskClass = 'recommendation-item low';
        bgColor = '#f0fdf4';
        borderColor = '#10b981';
      }
      
      return `
      <li class="${riskClass}" style="background: ${bgColor}; border-left-color: ${borderColor};">
        <div class="item-header">
          <span class="item-title">Khuyến Nghị ${index + 1}</span>
        </div>
        <p>${cleanRec}</p>
      </li>
    `;
    }).join('');
    html += `</ul></div>`;
  } else if (!detailedDesc) {
    html = '<p>Không có recommendation nào.</p>';
  }
  
  recommendationsContent.innerHTML = html;
}

/**
 * Switch tabs
 */
function switchTab(tabName) {
  const tabButtons = document.querySelectorAll('.tab-btn');
  // Remove active class from all tabs and contents
  tabButtons.forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  
  // Add active class to selected tab and content
  const activeTab = document.querySelector(`[data-tab="${tabName}"]`);
  const activeContent = document.getElementById(`${tabName}Tab`);
  if (activeTab) activeTab.classList.add('active');
  if (activeContent) activeContent.classList.add('active');
}

/**
 * Scan installed Chrome extensions
 */
async function scanInstalledExtensions() {
  const scanInstalledBtn = document.getElementById('scanInstalledBtn');
  const extensionsContainer = document.getElementById('extensionsContainer');
  const installedExtensionsList = document.getElementById('installedExtensionsList');
  
  if (!scanInstalledBtn || !extensionsContainer) {
    console.error('Required elements not found');
    return;
  }
  
  try {
    showLoading(true);
    hideError();
    scanInstalledBtn.disabled = true;
    scanInstalledBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang quét...';
    
    const url = `${API_BASE}/list-installed-extensions`;
    console.log('Fetching URL:', url);
    console.log('API_BASE:', API_BASE);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Response status:', response.status);
    console.log('Response OK:', response.ok);
    console.log('Response URL:', response.url);
    
    // Check if response is OK
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Server response (error):', errorText);
      console.error('Response headers:', [...response.headers.entries()]);
      throw new Error(`Server error: ${response.status} ${response.statusText}`);
    }
    
    // Check content type
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const errorText = await response.text();
      console.error('Non-JSON response:', errorText.substring(0, 200));
      throw new Error('Server returned non-JSON response. Please check server logs.');
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Không thể quét extension');
    }
    
    const extensions = data.extensions || [];
    const profilesScanned = data.profiles_scanned || [];
    const totalProfiles = data.total_profiles || 0;
    
    // Display profile scan info
    let profileInfoHtml = '';
    if (totalProfiles > 0) {
      profileInfoHtml = `
        <div style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
          <h4 style="margin: 0 0 0.75rem 0; color: var(--text-primary);">
            <i class="fas fa-users"></i> Đã quét ${totalProfiles} profile:
          </h4>
          <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
            ${profilesScanned.map(profile => `
              <span style="background: var(--primary-color); color: white; padding: 0.25rem 0.75rem; border-radius: 4px; font-size: 0.85rem;">
                ${escapeHtml(profile.name)} (${profile.count} extension${profile.count !== 1 ? 's' : ''})
              </span>
            `).join('')}
          </div>
        </div>
      `;
    }
    
    if (extensions.length === 0) {
      extensionsContainer.innerHTML = profileInfoHtml + '<p style="color: var(--text-secondary); padding: 1rem;">Không tìm thấy extension nào đã cài đặt.</p>';
      if (installedExtensionsList) installedExtensionsList.style.display = 'block';
      return;
    }
    
    // Display extensions
    extensionsContainer.innerHTML = profileInfoHtml + extensions.map(ext => `
      <div class="extension-card" style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem; margin-bottom: 0.75rem;">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.75rem;">
          <div style="flex: 1;">
            <h4 style="margin: 0 0 0.5rem 0; color: var(--text-primary);">${escapeHtml(ext.name)}</h4>
            <div style="font-size: 0.85rem; color: var(--text-secondary); font-family: monospace; margin-bottom: 0.25rem;">
              ID: ${ext.id}
            </div>
            <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.25rem;">
              Version: ${ext.version}
            </div>
            ${ext.profile ? `
              <div style="font-size: 0.85rem; color: var(--primary-color); font-weight: 500;">
                <i class="fas fa-user"></i> Profile: ${escapeHtml(ext.profile)}
              </div>
            ` : ''}
          </div>
          <button 
            class="btn-primary" 
            onclick="analyzeInstalledExtension('${ext.id}', '${escapeHtml(ext.name)}')"
            style="white-space: nowrap; padding: 0.5rem 1rem; font-size: 0.9rem;"
          >
            <i class="fas fa-search"></i> Phân Tích
          </button>
        </div>
      </div>
    `).join('');
    
    if (installedExtensionsList) installedExtensionsList.style.display = 'block';
    
  } catch (error) {
    console.error('Error scanning installed extensions:', error);
    showError('Lỗi khi quét extension: ' + error.message);
  } finally {
    showLoading(false);
    if (scanInstalledBtn) {
      scanInstalledBtn.disabled = false;
      scanInstalledBtn.innerHTML = '<i class="fas fa-search"></i> Quét Extension Đã Cài Đặt';
    }
  }
}

/**
 * Analyze a specific installed extension
 */
async function analyzeInstalledExtension(extensionId, extensionName) {
  try {
    console.log('Analyzing extension:', extensionId, extensionName);
    showLoading(true);
    hideError();
    hideResults();
    
    const response = await fetch(`${API_BASE}/analyze-installed-extension`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        extension_id: extensionId
      })
    });
    
    // Check response
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Server response error:', errorText);
      throw new Error(`Server error: ${response.status} ${response.statusText}`);
    }
    
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const errorText = await response.text();
      console.error('Non-JSON response:', errorText.substring(0, 200));
      throw new Error('Server returned non-JSON response');
    }
    
    const data = await response.json();
    console.log('Analysis response:', data);
    
    if (!data.success) {
      throw new Error(data.error || 'Không thể phân tích extension');
    }
    
    // Display results using existing displayResults function
    if (data.results) {
      console.log('Displaying results...');
      displayResults(data.results);
      console.log('Results displayed successfully');
    } else {
      throw new Error('Không có kết quả phân tích');
    }
    
  } catch (error) {
    console.error('Error analyzing installed extension:', error);
    showError('Lỗi khi phân tích extension: ' + error.message);
  } finally {
    showLoading(false);
  }
}

// Expose function to global scope for onclick handlers
window.analyzeInstalledExtension = analyzeInstalledExtension;

/**
 * Utility functions
 */
function showLoading(show) {
  const loadingIndicator = document.getElementById('loadingIndicator');
  const scanBtn = document.getElementById('scanBtn');
  const analyzeBtn = document.getElementById('analyzeBtn');
  
  if (loadingIndicator) loadingIndicator.style.display = show ? 'block' : 'none';
  if (scanBtn) scanBtn.disabled = show;
  if (analyzeBtn) analyzeBtn.disabled = show;
}

function showResults() {
  const resultsSection = document.getElementById('resultsSection');
  if (resultsSection) {
    console.log('Showing results section');
    resultsSection.style.display = 'block';
    resultsSection.scrollIntoView({ behavior: 'smooth' });
  } else {
    console.error('resultsSection element not found!');
  }
}

function hideResults() {
  const resultsSection = document.getElementById('resultsSection');
  if (resultsSection) resultsSection.style.display = 'none';
}

function showError(message) {
  const errorMessage = document.getElementById('errorMessage');
  const errorText = document.getElementById('errorText');
  if (errorMessage) errorMessage.style.display = 'flex';
  if (errorText) errorText.textContent = message;
}

function hideError() {
  const errorMessage = document.getElementById('errorMessage');
  if (errorMessage) errorMessage.style.display = 'none';
}


