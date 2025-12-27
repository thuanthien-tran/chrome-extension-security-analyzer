/**
 * Extension Security Analyzer - Popup Script
 * UI hiÃ¡Â»Æ’n thÃ¡Â»â€¹ Ã„â€˜Ã¡ÂºÂ§y Ã„â€˜Ã¡Â»Â§ thÃƒÂ´ng tin phÃƒÂ¢n tÃƒÂ­ch
 */
document.addEventListener('DOMContentLoaded', async () => {
  const $ = id => document.getElementById(id);
  const scanButton = $('scanButton');
  const loading = $('loading');
  const results = $('results');
  const error = $('error');
  const summary = $('summary');
  const extensionsList = $('extensionsList');
  const unscannedExtensionsList = $('unscannedExtensionsList');
  const extensionsListUnscanned = $('extensionsListUnscanned');
  const tabsContainer = $('tabsContainer');
  const deepAnalysisBtn = $('deepAnalysisBtn');
  const themeToggleBtn = $('themeToggleBtn');
  const refreshBtn = $('refreshBtn');
  const exportBtn = $('exportBtn');
  const importBtn = $('importBtn');
  const settingsBtn = $('settingsBtn');
  const filterBar = $('filterBar');
  const searchInput = $('searchInput');
  const clearSearchBtn = $('clearSearch');
  const riskFilter = $('riskFilter');
  const statusFilter = $('statusFilter');
  const installTypeFilter = $('installTypeFilter');
  const filterBarUnscanned = $('filterBarUnscanned');
  const searchInputUnscanned = $('searchInputUnscanned');
  const clearSearchBtnUnscanned = $('clearSearchUnscanned');
  const statusFilterUnscanned = $('statusFilterUnscanned');
  const installTypeFilterUnscanned = $('installTypeFilterUnscanned');
  const settingsModal = $('settingsModal');
  const closeSettingsModal = $('closeSettingsModal');
    // Load theme preference
    const stored = await chrome.storage.local.get('theme');
    if (stored.theme === 'light' && themeToggleBtn) {
      document.body.classList.add('light-mode');
      const icon = themeToggleBtn.querySelector('i');
      if (icon) {
        icon.classList.remove('fa-moon');
        icon.classList.add('fa-sun');
      }
    }
    // Deep analysis button
    if (deepAnalysisBtn) {
      deepAnalysisBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: 'http://localhost:5000/' });
      });
    }
    // Theme toggle button
    if (themeToggleBtn) {
      themeToggleBtn.addEventListener('click', async () => {
        const isLightMode = document.body.classList.toggle('light-mode');
        const icon = themeToggleBtn.querySelector('i');
        if (icon) {
          if (isLightMode) {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
            await chrome.storage.local.set({ theme: 'light' });
          } else {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
            await chrome.storage.local.set({ theme: 'dark' });
          }
        }
      });
    }
  // Khai bÃƒÂ¡o biÃ¡ÂºÂ¿n tab trÃ†Â°Ã¡Â»â€ºc khi sÃ¡Â»Â­ dÃ¡Â»Â¥ng
  let currentTab = 'all';
  let currentTabUnscanned = 'all-unscanned';
  // LÃ†Â°u trÃ¡ÂºÂ¡ng thÃƒÂ¡i hiÃ¡Â»â€¡n tÃ¡ÂºÂ¡i (cÃƒÂ³ Ã„â€˜ang hiÃ¡Â»Æ’n thÃ¡Â»â€¹ extension mÃ¡Â»â€ºi khÃƒÂ´ng)
  let isShowingNewExtensionOnly = false;
  // Clear badge khi mÃ¡Â»Å¸ popup
  try {
    await chrome.action.setBadgeText({ text: '' });
    console.log('[Popup] Badge cleared');

  } catch (badgeError) {
    console.error('[Popup] Error clearing badge:', badgeError);

  }
  // KiÃ¡Â»Æ’m tra xem cÃƒÂ³ extension mÃ¡Â»â€ºi cÃ¡ÂºÂ§n hiÃ¡Â»Æ’n thÃ¡Â»â€¹ khÃƒÂ´ng
  const newExtensionInfo = await checkForNewExtension();
  if (newExtensionInfo && newExtensionInfo.showOnlyNew) {
    // CÃƒÂ³ extension mÃ¡Â»â€ºi vÃƒÂ  flag showOnlyNew = true Ã¢â€ â€™ chÃ¡Â»â€° hiÃ¡Â»Æ’n thÃ¡Â»â€¹ extension mÃ¡Â»â€ºi (Ã„â€˜ÃƒÂ£ phÃƒÂ¢n tÃƒÂ­ch)
    console.log('[Popup] New extension detected, showing only new extension:', newExtensionInfo.extensionId);
    isShowingNewExtensionOnly = true;
    // Disable nÃƒÂºt quÃƒÂ©t vÃƒÂ  tabs
    scanButton.disabled = true;
    if (tabsContainer) {
      tabsContainer.classList.add('disabled');
      tabsContainer.querySelectorAll('.tab-button').forEach(btn => btn.disabled = true);
    }
    await loadOnlyNewExtension(newExtensionInfo.extensionId);
    // Ã„ÂÃ¡Â»Â£i DOM render xong
    setTimeout(() => {
      highlightExtensionById(newExtensionInfo.extensionId);
    }, 300);

  } else {
    // KhÃƒÂ´ng cÃƒÂ³ extension mÃ¡Â»â€ºi Ã¢â€ â€™ hiÃ¡Â»Æ’n thÃ¡Â»â€¹ danh sÃƒÂ¡ch extensions chÃ†Â°a phÃƒÂ¢n tÃƒÂ­ch
    console.log('[Popup] Loading unscanned extensions list');
    await loadUnscannedExtensions();

  }
  // LÃ¡ÂºÂ¯ng nghe message tÃ¡Â»Â« background Ã„â€˜Ã¡Â»Æ’ hiÃ¡Â»Æ’n thÃ¡Â»â€¹ extension mÃ¡Â»â€ºi
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'showNewExtension' || request.action === 'showExtension') {
      const extensionId = request.extensionId;
      if (extensionId) {
        // Load vÃƒÂ  hiÃ¡Â»Æ’n thÃ¡Â»â€¹ extension cÃ¡Â»Â¥ thÃ¡Â»Æ’
        loadOnlyNewExtension(extensionId).then(() => {
          setTimeout(() => {
            highlightExtensionById(extensionId);
          }, 300);
        });
      } else {
        // Load lÃ¡ÂºÂ¡i kÃ¡ÂºÂ¿t quÃ¡ÂºÂ£ vÃƒÂ  highlight extension mÃ¡Â»â€ºi
        loadLatestScanResults().then(() => {
          if (request.extensionId) {
            // Ã„ÂÃ¡Â»Â£i DOM render xong
            setTimeout(() => {
              highlightExtensionById(request.extensionId);
            }, 500);
          }
        });
      }
      sendResponse({ success: true });
    }
    return true;

  });
  // LÃ¡ÂºÂ¯ng nghe message tÃ¡Â»Â« external source (tÃ¡Â»Â« URL hoÃ¡ÂºÂ·c extension khÃƒÂ¡c)
  chrome.runtime.onMessageExternal?.addListener((request, sender, sendResponse) => {
    if (request.action === 'showExtension' && request.extensionId) {
      const extensionId = request.extensionId;
      loadOnlyNewExtension(extensionId).then(() => {
        setTimeout(() => {
          highlightExtensionById(extensionId);
        }, 300);
      });
      sendResponse({ success: true });
    }
    return true;

  });
  if (scanButton) {
  scanButton.addEventListener('click', async () => {
    await scanExtensions();

  });

  }
  // Refresh button - quay lÃ¡ÂºÂ¡i danh sÃƒÂ¡ch extension hiÃ¡Â»â€¡n tÃ¡ÂºÂ¡i (unscanned)
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      await refreshExtensionsList();
    });

  }
  // Export/Import functionality
  if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
      await exportResults();
    });

  }
  if (importBtn) {
    importBtn.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (file) {
          await importResults(file);
        }
      };
      input.click();
    });

  }
  // Settings modal
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      if (settingsModal) {
        settingsModal.classList.add('active');
        loadSettings();
      }
    });

  }
  if (closeSettingsModal) {
    closeSettingsModal.addEventListener('click', () => {
      if (settingsModal) {
        settingsModal.classList.remove('active');
      }
    });

  }
  // Click outside to close modal
  if (settingsModal) {
    settingsModal.addEventListener('click', (e) => {
      if (e.target === settingsModal) {
        settingsModal.classList.remove('active');
      }
    });

  }
  // Filter & Search for Scanned Extensions
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const query = searchInput.value.trim();
      if (clearSearchBtn) {
        clearSearchBtn.style.display = query ? 'block' : 'none';
      }
      applyFilters();
    });

  }
  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      if (searchInput) {
        searchInput.value = '';
        clearSearchBtn.style.display = 'none';
        applyFilters();
      }
    });

  }
  if (riskFilter) {
    riskFilter.addEventListener('change', applyFilters);

  }
  if (statusFilter) {
    statusFilter.addEventListener('change', applyFilters);

  }
  if (installTypeFilter) {
    installTypeFilter.addEventListener('change', applyFilters);

  }
  // Filter & Search for Unscanned Extensions
  if (searchInputUnscanned) {
    searchInputUnscanned.addEventListener('input', () => {
      const query = searchInputUnscanned.value.trim();
      if (clearSearchBtnUnscanned) {
        clearSearchBtnUnscanned.style.display = query ? 'block' : 'none';
      }
      applyFiltersUnscanned();
    });

  }
  if (clearSearchBtnUnscanned) {
    clearSearchBtnUnscanned.addEventListener('click', () => {
      if (searchInputUnscanned) {
        searchInputUnscanned.value = '';
        clearSearchBtnUnscanned.style.display = 'none';
        applyFiltersUnscanned();
      }
    });

  }
  if (statusFilterUnscanned) {
    statusFilterUnscanned.addEventListener('change', applyFiltersUnscanned);

  }
  if (installTypeFilterUnscanned) {
    installTypeFilterUnscanned.addEventListener('change', applyFiltersUnscanned);

  }
  // Tab switching cho unscanned list - DISABLED: ChÃ¡Â»â€° hiÃ¡Â»Æ’n thÃ¡Â»â€¹ sÃ¡Â»â€˜ lÃ†Â°Ã¡Â»Â£ng, khÃƒÂ´ng cho click
  // const tabsContainerUnscanned = document.getElementById('tabsContainerUnscanned');
  // const tabButtonsUnscanned = tabsContainerUnscanned ? tabsContainerUnscanned.querySelectorAll('.tab-button') : [];
  //
  // if (tabButtonsUnscanned.length > 0) {
  //   tabButtonsUnscanned.forEach(button => {
  //     button.addEventListener('click', () => {
  //       const tab = button.getAttribute('data-tab');
  //       switchTabUnscanned(tab);
  //     });
  //   });
  // }

  function switchTabUnscanned(tab) {
    currentTabUnscanned = tab;
    // Update active state
    tabButtonsUnscanned.forEach(btn => {
      if (btn.getAttribute('data-tab') === tab) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    // Filter extensions
    filterUnscannedExtensionsByTab(tab);

  }

  async function filterUnscannedExtensionsByTab(tab) {
    const extensionItems = document.querySelectorAll('.extension-item-unscanned');
    let keptCount = 0;
    let disabledCount = 0;
    // Load trÃ¡ÂºÂ¡ng thÃƒÂ¡i "GiÃ¡Â»Â¯" vÃƒÂ  "TÃ¡ÂºÂ¯t" tÃ¡Â»Â« storage
    const stored = await chrome.storage.local.get(null);
    const keptExtensions = new Set();
    Object.keys(stored).forEach(key => {
      if (key.startsWith('ignored_') && stored[key]) {
        const extId = key.replace('ignored_', '');
        keptExtensions.add(extId);
      }
    });
    extensionItems.forEach(item => {
      const extensionId = item.getAttribute('data-extension-id');
      const isKept = keptExtensions.has(extensionId);
      const isDisabled = item.hasAttribute('data-disabled');
      // Count
      if (isKept) keptCount++;
      if (isDisabled) disabledCount++;
      // TÃ¡ÂºÂ¥t cÃ¡ÂºÂ£ extensions Ã„â€˜Ã¡Â»Âu visible (khÃƒÂ´ng filter theo tab nÃ¡Â»Â¯a)
      item.setAttribute('data-tab-visible', 'true');
    });
    // Update counts only (khÃƒÂ´ng filter)
    document.getElementById('count-all-unscanned').textContent = extensionItems.length;
    document.getElementById('count-kept-unscanned').textContent = keptCount;
    document.getElementById('count-disabled-unscanned').textContent = disabledCount;
    // Apply search/filter (khÃƒÂ´ng cÃƒÂ³ tab filter)
    applyFiltersUnscanned();

  }
  /**
   * Load danh sÃƒÂ¡ch extensions chÃ†Â°a phÃƒÂ¢n tÃƒÂ­ch
   */

  async function loadUnscannedExtensions() {
    try {
      // Ã¡ÂºÂ¨n results, hiÃ¡Â»Æ’n thÃ¡Â»â€¹ unscanned list
      if (results) results.style.display = 'none';
      if (extensionsListUnscanned) extensionsListUnscanned.style.display = 'block';
      if (error) error.style.display = 'none';
      console.log('[Popup] Loading unscanned extensions...');
      // LÃ¡ÂºÂ¥y danh sÃƒÂ¡ch extensions tÃ¡Â»Â« Chrome
      let response;
      try {
        response = await chrome.runtime.sendMessage({ action: 'getAllExtensions' });
        console.log('[Popup] Response from getAllExtensions:', response);
      } catch (msgError) {
        console.error('[Popup] Error sending message to background:', msgError);
        throw new Error('KhÃƒÂ´ng thÃ¡Â»Æ’ kÃ¡ÂºÂ¿t nÃ¡Â»â€˜i Ã„â€˜Ã¡ÂºÂ¿n background script: ' + msgError.message);
      }
      if (!response) {
        throw new Error('KhÃƒÂ´ng nhÃ¡ÂºÂ­n Ã„â€˜Ã†Â°Ã¡Â»Â£c phÃ¡ÂºÂ£n hÃ¡Â»â€œi tÃ¡Â»Â« background script');
      }
      if (response.success === false) {
        throw new Error(response.error || 'Lỗi không xác định từ background script');
      }
      if (response && response.success && response.extensions) {
        const extensions = response.extensions;
        console.log('[Popup] Found', extensions.length, 'extensions');
        if (extensions.length === 0) {
          unscannedExtensionsList.innerHTML = `
            <div class="empty-state">
              <p>KhÃƒÂ´ng cÃƒÂ³ extension nÃƒÂ o Ã„â€˜Ã†Â°Ã¡Â»Â£c cÃƒÂ i Ã„â€˜Ã¡ÂºÂ·t.</p>
            </div>
          `;
          // Update tab counts
          document.getElementById('count-all-unscanned').textContent = '0';
          document.getElementById('count-kept-unscanned').textContent = '0';
          document.getElementById('count-disabled-unscanned').textContent = '0';
        } else {
          // Load trÃ¡ÂºÂ¡ng thÃƒÂ¡i "GiÃ¡Â»Â¯" vÃƒÂ  "TÃ¡ÂºÂ¯t" tÃ¡Â»Â« storage
          const stored = await chrome.storage.local.get(null);
          const keptExtensions = new Set();
          Object.keys(stored).forEach(key => {
            if (key.startsWith('ignored_') && stored[key]) {
              const extId = key.replace('ignored_', '');
              keptExtensions.add(extId);
            }
          });
          // KiÃ¡Â»Æ’m tra extensions nÃƒÂ o Ã„â€˜ÃƒÂ£ Ã„â€˜Ã†Â°Ã¡Â»Â£c quÃƒÂ©t
          const scannedExtensionIds = new Set();
          // LÃ¡ÂºÂ¥y tÃ¡Â»Â« lastScan
          if (stored.lastScan && stored.lastScan.results) {
            stored.lastScan.results.forEach(result => {
              if (result.extension && result.extension.id) {
                scannedExtensionIds.add(result.extension.id);
              }
            });
          }
          // LÃ¡ÂºÂ¥y tÃ¡Â»Â« scan_result_*
          Object.keys(stored).forEach(key => {
            if (key.startsWith('scan_result_')) {
              const result = stored[key];
              if (result && result.extension && result.extension.id) {
                scannedExtensionIds.add(result.extension.id);
              }
            }
          });
          // LÃ¡ÂºÂ¥y tÃ¡Â»Â« new_extension_*
          Object.keys(stored).forEach(key => {
            if (key.startsWith('new_extension_')) {
              const result = stored[key];
              if (result && result.extension && result.extension.id) {
                scannedExtensionIds.add(result.extension.id);
              }
            }
          });
          unscannedExtensionsList.innerHTML = extensions.map(ext => {
            const isKept = keptExtensions.has(ext.id);
            const isDisabled = !ext.enabled;
            const isScanned = scannedExtensionIds.has(ext.id);
            // Status indicators
            let statusBadge = '';
            if (isKept && !isDisabled) {
              statusBadge = '<span class="status-badge kept"><i class="fas fa-check-circle"></i> Đang bật</span>';
            } else if (isDisabled) {
              statusBadge = '<span class="status-badge disabled"><i class="fas fa-pause-circle"></i> Đã tắt</span>';
            }
            return `
              <div class="extension-item-unscanned" data-extension-id="${ext.id}" ${isKept ? 'data-kept="true"' : ''} ${isDisabled ? 'data-disabled="true"' : ''}>
                <div class="extension-info">
                  <div class="extension-name">${escapeHtml(ext.name)}</div>
                  <div class="extension-meta">
                    ${statusBadge}
                  </div>
                  <div class="extension-details">
                    <span class="detail-item">
                      <i class="fas fa-tag"></i>
                      Version: ${ext.version}
                    </span>
                    <span class="detail-item">
                      ${ext.enabled ? '<i class="fas fa-check-circle" style="color: var(--success-color);"></i> Đang bật' : '<i class="fas fa-pause-circle" style="color: var(--warning-color);"></i>Đã tắt'}
                    </span>
                    <span class="detail-item">
                      ${ext.installType === 'development' || ext.installType === 'sideload' ? '<i class="fas fa-exclamation-triangle" style="color: var(--warning-color);"></i> Unpacked/Sideloaded' : '<i class="fas fa-store" style="color: var(--success-color);"></i> Chrome Web Store'}
                    </span>
                  </div>
                </div>
                <div class="extension-actions">
                  ${ext.enabled ? `
                    <button class="action-button disable" data-action="disable" data-extension-id="${ext.id}">
                      <i class="fas fa-pause"></i>
                      Tắt
                    </button>
                  ` : `
                    <button class="action-button enable" data-action="enable" data-extension-id="${ext.id}">
                      <i class="fas fa-play"></i>
                      Bật
                    </button>
                  `}
                  <button class="action-button uninstall" data-action="uninstall" data-extension-id="${ext.id}">
                    <i class="fas fa-trash"></i>
                    Gỡ
                  </button>
                  ${isKept ? `
                    <button class="action-button keep in-use" disabled>
                      <i class="fas fa-check-circle"></i>
                      Đang sử dụng
                    </button>
                  ` : `
                    <button class="action-button keep" data-action="keep" data-extension-id="${ext.id}">
                      <i class="fas fa-check"></i>
                      Giữ
                    </button>
                  `}
                </div>
              </div>
            `;
          }).join('');
          // Update tab counts only (khÃƒÂ´ng filter)
          setTimeout(async () => {
            await filterUnscannedExtensionsByTab('all-unscanned');
          }, 100);
        }
      } else {
        const errorMsg = response?.error || 'Không thể tải danh sách extensions';
        console.error('[Popup] Invalid response format:', response);
        throw new Error(errorMsg);
      }
    } catch (loadError) {
      console.error('[Popup] Error loading unscanned extensions:', loadError);
      if (error) {
        error.textContent = 'Lỗi khi tải danh sách extensions: ' + (loadError.message || 'Lỗi không xác định');
        error.style.display = 'block';
      }
      if (unscannedExtensionsList) {
        unscannedExtensionsList.innerHTML = `
          <div class="empty-state">
            <p>Lỗi khi tải danh sách extensions.</p>
            <p style="font-size: 0.75rem; color: #64748b; margin-top: 0.5rem;">${escapeHtml(loadError.message || 'Lỗi không xác định')}</p>
          </div>
        `;
      }
    }

  }
  /**
   * Refresh danh sÃƒÂ¡ch extension - quay lÃ¡ÂºÂ¡i hiÃ¡Â»Æ’n thÃ¡Â»â€¹ danh sÃƒÂ¡ch extension hiÃ¡Â»â€¡n tÃ¡ÂºÂ¡i (unscanned)
   */

  async function refreshExtensionsList() {
    try {
      console.log('[Refresh] Refreshing extensions list...');
      // Clear flags
      await chrome.storage.local.remove(['newExtensionToShow', 'newExtensionTimestamp', 'showOnlyNewExtension']);
      // Reset state
      isShowingNewExtensionOnly = false;
      // Enable scan button and tabs
      scanButton.disabled = false;
      if (tabsContainer) {
        tabsContainer.classList.remove('disabled');
        tabsContainer.querySelectorAll('.tab-button').forEach(btn => btn.disabled = false);
        tabsContainer.style.display = 'flex';
      }
      // Hide results, show unscanned list
      results.style.display = 'none';
      extensionsListUnscanned.style.display = 'block';
      // Show filter bar for unscanned
      if (filterBarUnscanned) {
        filterBarUnscanned.style.display = 'block';
      }
      if (filterBar) {
        filterBar.style.display = 'none';
      }
      // Load unscanned extensions
      await loadUnscannedExtensions();
      console.log('[Refresh] Extensions list refreshed');
    } catch (error) {
      console.error('[Refresh] Error refreshing extensions list:', error);
      alert('Ã¢ÂÅ’ LÃ¡Â»â€”i khi lÃƒÂ m mÃ¡Â»â€ºi danh sÃƒÂ¡ch: ' + error.message);
    }

  }
  /**
   * Reset vÃ¡Â»Â trÃ¡ÂºÂ¡ng thÃƒÂ¡i ban Ã„â€˜Ã¡ÂºÂ§u (chÃ¡Â»â€° hiÃ¡Â»Æ’n thÃ¡Â»â€¹ danh sÃƒÂ¡ch, khÃƒÂ´ng phÃƒÂ¢n tÃƒÂ­ch)
   */

  async function resetToUnscannedView() {
    // XÃƒÂ³a flag showOnlyNewExtension
    await chrome.storage.local.remove(['showOnlyNewExtension', 'newExtensionToShow', 'newExtensionTimestamp']);
    isShowingNewExtensionOnly = false;
    // Enable nÃƒÂºt quÃƒÂ©t vÃƒÂ  tabs
    scanButton.disabled = false;
    if (tabsContainer) {
      tabsContainer.classList.remove('disabled');
      tabsContainer.querySelectorAll('.tab-button').forEach(btn => btn.disabled = false);
    }
    // Load lÃ¡ÂºÂ¡i danh sÃƒÂ¡ch chÃ†Â°a phÃƒÂ¢n tÃƒÂ­ch
    await loadUnscannedExtensions();

  }
  // Tab switching cho scanned results - DISABLED: ChÃ¡Â»â€° hiÃ¡Â»Æ’n thÃ¡Â»â€¹ sÃ¡Â»â€˜ lÃ†Â°Ã¡Â»Â£ng, khÃƒÂ´ng cho click
  // const tabButtons = tabsContainer ? tabsContainer.querySelectorAll('.tab-button') : [];
  // tabButtons.forEach(button => {
  //   button.addEventListener('click', () => {
  //     const tab = button.getAttribute('data-tab');
  //     switchTab(tab);
  //   });
  // });

  function switchTab(tab) {
    currentTab = tab;
    // Update active state
    tabButtons.forEach(btn => {
      if (btn.getAttribute('data-tab') === tab) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
    // Filter extensions
    filterExtensionsByTab(tab);

  }

  function filterExtensionsByTab(tab) {
    const extensionItems = document.querySelectorAll('.extension-item');
    let keptCount = 0;
    let disabledCount = 0;
    extensionItems.forEach(item => {
      const isKept = item.hasAttribute('data-kept');
      const isDisabled = item.hasAttribute('data-disabled');
      // Count only
      if (isKept) keptCount++;
      if (isDisabled) disabledCount++;
      // TÃ¡ÂºÂ¥t cÃ¡ÂºÂ£ extensions Ã„â€˜Ã¡Â»Âu visible (khÃƒÂ´ng filter theo tab nÃ¡Â»Â¯a)
      item.setAttribute('data-tab-visible', 'true');
    });
    // Update counts only (khÃƒÂ´ng filter)
    document.getElementById('count-all').textContent = extensionItems.length;
    document.getElementById('count-kept').textContent = keptCount;
    document.getElementById('count-disabled').textContent = disabledCount;
    // Apply search/filter (khÃƒÂ´ng cÃƒÂ³ tab filter)
    applyFilters();

  }
  /**
   * ChÃ¡Â»â€° load vÃƒÂ  hiÃ¡Â»Æ’n thÃ¡Â»â€¹ extension mÃ¡Â»â€ºi
   */

  async function loadOnlyNewExtension(extensionId) {
    try {
      // LÃ¡ÂºÂ¥y kÃ¡ÂºÂ¿t quÃ¡ÂºÂ£ extension mÃ¡Â»â€ºi
      const stored = await chrome.storage.local.get(`new_extension_${extensionId}`);
      const newExtension = stored[`new_extension_${extensionId}`];
      if (newExtension) {
        console.log('[Popup] Loading new extension only:', extensionId);
        // Ã¡ÂºÂ¨n unscanned list, hiÃ¡Â»Æ’n thÃ¡Â»â€¹ results
        extensionsListUnscanned.style.display = 'none';
        results.style.display = 'block';
        // Ã¡ÂºÂ¨n tabs khi chÃ¡Â»â€° hiÃ¡Â»Æ’n thÃ¡Â»â€¹ extension mÃ¡Â»â€ºi
        if (tabsContainer) {
          tabsContainer.style.display = 'none';
        }
        // HiÃ¡Â»Æ’n thÃ¡Â»â€¹ chÃ¡Â»â€° extension mÃ¡Â»â€ºi
        await displayResults({
          success: true,
          total: 1,
          scanned: 1,
          extensions: [newExtension],
          timestamp: newExtension.scannedAt,
          reason: 'management.onInstalled',
          isNewExtensionOnly: true
        });
        // XÃƒÂ³a flag sau khi Ã„â€˜ÃƒÂ£ hiÃ¡Â»Æ’n thÃ¡Â»â€¹ thÃƒÂ nh cÃƒÂ´ng
        // KHÃƒâ€NG xÃƒÂ³a new_extension_${extensionId} vÃƒÂ¬ cÃ¡ÂºÂ§n dÃƒÂ¹ng Ã„â€˜Ã¡Â»Æ’ hiÃ¡Â»Æ’n thÃ¡Â»â€¹
        // ChÃ¡Â»â€° xÃƒÂ³a cÃƒÂ¡c flag Ã„â€˜iÃ¡Â»Âu khiÃ¡Â»Æ’n
        // await chrome.storage.local.remove(['newExtensionToShow', 'newExtensionTimestamp', 'showOnlyNewExtension']);
      } else {
        console.log('[Popup] New extension result not found, checking storage...');
        // ThÃ¡Â»Â­ kiÃ¡Â»Æ’m tra lÃ¡ÂºÂ¡i sau 500ms
        setTimeout(async () => {
          const retryStored = await chrome.storage.local.get(`new_extension_${extensionId}`);
          if (retryStored[`new_extension_${extensionId}`]) {
            await loadOnlyNewExtension(extensionId);
          } else {
            console.warn('[Popup] New extension result still not found after retry');
          }
        }, 500);
      }
    } catch (loadError) {
      console.error('[Popup] Error loading new extension:', loadError);
    }

  }
  /**
   * TÃ¡Â»Â± Ã„â€˜Ã¡Â»â„¢ng load kÃ¡ÂºÂ¿t quÃ¡ÂºÂ£ scan mÃ¡Â»â€ºi nhÃ¡ÂºÂ¥t tÃ¡Â»Â« storage (khi user click "QuÃƒÂ©t Extensions")
   */

  async function loadLatestScanResults() {
    try {
      // LÃ¡ÂºÂ¥y kÃ¡ÂºÂ¿t quÃ¡ÂºÂ£ scan mÃ¡Â»â€ºi nhÃ¡ÂºÂ¥t
      const stored = await chrome.storage.local.get('lastScan');
      const lastScan = stored.lastScan;
      if (lastScan && lastScan.results && lastScan.results.length > 0) {
        console.log('[Popup] Loading latest scan results:', lastScan.timestamp);
        // HiÃ¡Â»Æ’n thÃ¡Â»â€¹ kÃ¡ÂºÂ¿t quÃ¡ÂºÂ£
        displayResults({
          success: true,
          total: lastScan.total,
          scanned: lastScan.results.length,
          extensions: lastScan.results,
          timestamp: lastScan.timestamp,
          reason: lastScan.reason
        });
      } else {
        console.log('[Popup] No previous scan results found');
      }
    } catch (error) {
      console.error('[Popup] Error loading latest scan results:', error);
    }

  }
  /**
   * KiÃ¡Â»Æ’m tra xem cÃƒÂ³ extension mÃ¡Â»â€ºi cÃ¡ÂºÂ§n hiÃ¡Â»Æ’n thÃ¡Â»â€¹ khÃƒÂ´ng
   */

  async function checkForNewExtension() {
    try {
      const stored = await chrome.storage.local.get(['newExtensionToShow', 'newExtensionTimestamp', 'showOnlyNewExtension']);
      if (stored.newExtensionToShow) {
        const extensionId = stored.newExtensionToShow;
        const timestamp = stored.newExtensionTimestamp || 0;
        const showOnlyNew = stored.showOnlyNewExtension || false;
        const timeDiff = (Date.now() - timestamp) / 1000;
        // ChÃ¡Â»â€° hiÃ¡Â»Æ’n thÃ¡Â»â€¹ nÃ¡ÂºÂ¿u trong vÃƒÂ²ng 5 phÃƒÂºt
        if (timeDiff < 300) {
          console.log('[Popup] New extension to show:', extensionId, 'showOnlyNew:', showOnlyNew);
          // KHÃƒâ€NG xÃƒÂ³a flag Ã¡Â»Å¸ Ã„â€˜ÃƒÂ¢y - sÃ¡ÂºÂ½ xÃƒÂ³a sau khi Ã„â€˜ÃƒÂ£ hiÃ¡Â»Æ’n thÃ¡Â»â€¹ thÃƒÂ nh cÃƒÂ´ng
          return { extensionId, timestamp, showOnlyNew };
        } else {
          // QuÃƒÂ¡ cÃ…Â©, xÃƒÂ³a flag
          await chrome.storage.local.remove(['newExtensionToShow', 'newExtensionTimestamp', 'showOnlyNewExtension']);
        }
      }
      return null;
    } catch (error) {
      console.error('[Popup] Error checking new extension:', error);
      return null;
    }

  }
  /**
   * Highlight extension mÃ¡Â»â€ºi Ã„â€˜Ã†Â°Ã¡Â»Â£c scan
   */

  function highlightNewExtension(extensions) {
    // TÃƒÂ¬m extension cÃƒÂ³ timestamp gÃ¡ÂºÂ§n nhÃ¡ÂºÂ¥t
    const sorted = [...extensions].sort((a, b) => {
      const timeA = a.scannedAt ? new Date(a.scannedAt) : new Date(0);
      const timeB = b.scannedAt ? new Date(b.scannedAt) : new Date(0);
      return timeB - timeA;
    });
    if (sorted.length > 0 && sorted[0].scannedAt) {
      const scanTime = new Date(sorted[0].scannedAt);
      const now = new Date();
      const timeDiff = (now - scanTime) / 1000;
      if (timeDiff < 30) {
        // Extension mÃ¡Â»â€ºi Ã„â€˜Ã†Â°Ã¡Â»Â£c scan trong 30 giÃƒÂ¢y qua
        const extensionId = sorted[0].extension.id;
        setTimeout(() => {
          highlightExtensionById(extensionId);
        }, 100);
      }
    }

  }
  /**
   * Highlight extension theo ID
   */

  function highlightExtensionById(extensionId) {
    const extensionElement = document.querySelector(`[data-extension-id="${extensionId}"]`)?.closest('.extension-item');
    if (extensionElement) {
      // ThÃƒÂªm class Ã„â€˜Ã¡Â»Æ’ highlight
      extensionElement.classList.add('new-scan');
      extensionElement.style.border = '3px solid #2563eb';
      extensionElement.style.animation = 'pulse 2s ease-in-out';
      // Scroll Ã„â€˜Ã¡ÂºÂ¿n extension
      extensionElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Remove highlight sau 5 giÃƒÂ¢y
      setTimeout(() => {
        extensionElement.classList.remove('new-scan');
        extensionElement.style.border = '';
        extensionElement.style.animation = '';
      }, 5000);
      console.log('[Popup] Highlighted extension:', extensionId);
    } else {
      console.warn('[Popup] Extension element not found:', extensionId);
      // Retry sau 500ms nÃ¡ÂºÂ¿u element chÃ†Â°a render
      setTimeout(() => {
        const retryElement = document.querySelector(`[data-extension-id="${extensionId}"]`)?.closest('.extension-item');
        if (retryElement) {
          highlightExtensionById(extensionId);
        }
      }, 500);
    }

  }

  async function scanExtensions() {
    // Show loading
    scanButton.disabled = true;
    loading.style.display = 'block';
    results.style.display = 'none';
    extensionsListUnscanned.style.display = 'none';
    if (error) error.style.display = 'none';
    // XÃƒÂ³a flag showOnlyNewExtension Ã„â€˜Ã¡Â»Æ’ hiÃ¡Â»Æ’n thÃ¡Â»â€¹ tÃ¡ÂºÂ¥t cÃ¡ÂºÂ£
    await chrome.storage.local.remove(['showOnlyNewExtension', 'newExtensionToShow', 'newExtensionTimestamp']);
    isShowingNewExtensionOnly = false;
    // Enable tabs
    if (tabsContainer) {
      tabsContainer.classList.remove('disabled');
      tabsContainer.querySelectorAll('.tab-button').forEach(btn => btn.disabled = false);
      tabsContainer.style.display = 'flex';
    }
    try {
      console.log('[Popup] Sending scanExtensions message...');
      // Send message to background script
      const response = await chrome.runtime.sendMessage({ action: 'scanExtensions' });
      console.log('[Popup] Received response:', response);
      if (response && response.success) {
        console.log('[Popup] Scan successful, displaying results...');
        console.log('[Popup] Extensions count:', response.extensions?.length);
        await displayResults(response);
        // HiÃ¡Â»Æ’n thÃ¡Â»â€¹ nÃƒÂºt hoÃƒÂ n tÃƒÂ¡c
      } else {
        const errorMsg = response?.error || 'LÃ¡Â»â€”i khi quÃƒÂ©t extensions';
        console.error('[Popup] Scan failed:', errorMsg);
        showError(errorMsg);
      }
    } catch (err) {
      console.error('[Popup] Error scanning:', err);
      showError('KhÃƒÂ´ng thÃ¡Â»Æ’ kÃ¡ÂºÂ¿t nÃ¡Â»â€˜i Ã„â€˜Ã¡ÂºÂ¿n analyzer. Vui lÃƒÂ²ng thÃ¡Â»Â­ lÃ¡ÂºÂ¡i: ' + err.message);
    } finally {
      scanButton.disabled = false;
      loading.style.display = 'none';
    }

  }

  async function displayResults(data) {
    console.log('[Popup] displayResults called with data:', data);
    // KiÃ¡Â»Æ’m tra data cÃƒÂ³ hÃ¡Â»Â£p lÃ¡Â»â€¡ khÃƒÂ´ng
    if (!data || !data.extensions || !Array.isArray(data.extensions)) {
      console.error('[Popup] Invalid data format:', data);
      showError('Dữ liệu phân tích không hợp lệ');
      return;
    }
    console.log('[Popup] Displaying', data.extensions.length, 'extensions');
    // Load trÃ¡ÂºÂ¡ng thÃƒÂ¡i "GiÃ¡Â»Â¯" vÃƒÂ  "TÃ¡ÂºÂ¯t" tÃ¡Â»Â« storage
    const stored = await chrome.storage.local.get(null);
    const keptExtensions = new Set();
    const disabledExtensions = new Set();
    // LÃ¡ÂºÂ¥y danh sÃƒÂ¡ch extensions Ã„â€˜ÃƒÂ£ giÃ¡Â»Â¯
    Object.keys(stored).forEach(key => {
      if (key.startsWith('ignored_') && stored[key]) {
        const extId = key.replace('ignored_', '');
        keptExtensions.add(extId);
      }
    });
    // LÃ¡ÂºÂ¥y danh sÃƒÂ¡ch extensions Ã„â€˜ÃƒÂ£ tÃ¡ÂºÂ¯t (tÃ¡Â»Â« extension.enabled = false)
    data.extensions.forEach(ext => {
      if (ext.extension && !ext.extension.enabled) {
        disabledExtensions.add(ext.extension.id);
      }
    });
    // Display summary
    const critical = data.extensions.filter(e => e.riskLevel === 'CRITICAL').length;
    const high = data.extensions.filter(e => e.riskLevel === 'HIGH').length;
    const medium = data.extensions.filter(e => e.riskLevel === 'MEDIUM').length;
    const low = data.extensions.filter(e => e.riskLevel === 'LOW').length;
    summary.innerHTML = `
      <div class="summary-grid">
      <div class="summary-item">
          <div class="summary-item-icon" style="color: var(--text-secondary);">
            <i class="fas fa-box"></i>
          </div>
          <div class="summary-item-label">Tổng số</div>
          <div class="summary-item-value">${data.total}</div>
      </div>
      <div class="summary-item">
          <div class="summary-item-icon" style="color: var(--critical-color);">
            <i class="fas fa-exclamation-circle"></i>
          </div>
          <div class="summary-item-label">Critical</div>
          <div class="summary-item-value" style="color: var(--critical-color);">${critical}</div>
      </div>
      <div class="summary-item">
          <div class="summary-item-icon" style="color: var(--danger-color);">
            <i class="fas fa-exclamation-triangle"></i>
          </div>
          <div class="summary-item-label">High</div>
          <div class="summary-item-value" style="color: var(--danger-color);">${high}</div>
      </div>
      <div class="summary-item">
          <div class="summary-item-icon" style="color: var(--warning-color);">
            <i class="fas fa-exclamation"></i>
          </div>
          <div class="summary-item-label">Medium</div>
          <div class="summary-item-value" style="color: var(--warning-color);">${medium}</div>
      </div>
      <div class="summary-item">
          <div class="summary-item-icon" style="color: var(--success-color);">
            <i class="fas fa-check-circle"></i>
          </div>
          <div class="summary-item-label">Low</div>
          <div class="summary-item-value" style="color: var(--success-color);">${low}</div>
        </div>
      </div>
    `;
    // Display extensions (sorted by: new scan first, then by risk)
    const sortedExtensions = [...data.extensions].sort((a, b) => {
      // Extension mÃ¡Â»â€ºi Ã„â€˜Ã†Â°Ã¡Â»Â£c scan (trong 60 giÃƒÂ¢y) luÃƒÂ´n Ã¡Â»Å¸ Ã„â€˜Ã¡ÂºÂ§u
      const aIsNew = a.scannedAt && (Date.now() - new Date(a.scannedAt).getTime()) < 60000;
      const bIsNew = b.scannedAt && (Date.now() - new Date(b.scannedAt).getTime()) < 60000;
      if (aIsNew && !bIsNew) return -1;
      if (!aIsNew && bIsNew) return 1;
      // NÃ¡ÂºÂ¿u cÃ¡ÂºÂ£ hai Ã„â€˜Ã¡Â»Âu mÃ¡Â»â€ºi hoÃ¡ÂºÂ·c Ã„â€˜Ã¡Â»Âu cÃ…Â©, sort theo risk
      const riskOrder = { 'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1, 'UNKNOWN': 0 };
      return (riskOrder[b.riskLevel] || 0) - (riskOrder[a.riskLevel] || 0);
    });
    if (sortedExtensions.length === 0) {
      console.warn('[Popup] No extensions to display');
      extensionsList.innerHTML = `
        <div class="empty-state">
          <p>KhÃƒÂ´ng tÃƒÂ¬m thÃ¡ÂºÂ¥y extension nÃƒÂ o Ã„â€˜Ã¡Â»Æ’ phÃƒÂ¢n tÃƒÂ­ch.</p>
        </div>
      `;
    } else {
      console.log('[Popup] Rendering', sortedExtensions.length, 'extensions');
      try {
    extensionsList.innerHTML = sortedExtensions.map(ext => {
          const isKept = keptExtensions.has(ext.extension.id);
          const isDisabled = disabledExtensions.has(ext.extension.id);
          return renderExtension(ext, isKept, isDisabled);
        }).join('');
        console.log('[Popup] Extensions rendered successfully');
      } catch (renderError) {
        console.error('[Popup] Error rendering extensions:', renderError);
        showError('LÃ¡Â»â€”i khi hiÃ¡Â»Æ’n thÃ¡Â»â€¹ kÃ¡ÂºÂ¿t quÃ¡ÂºÂ£: ' + renderError.message);
        extensionsList.innerHTML = `
          <div class="empty-state">
            <p>LÃ¡Â»â€”i khi hiÃ¡Â»Æ’n thÃ¡Â»â€¹ kÃ¡ÂºÂ¿t quÃ¡ÂºÂ£ phÃƒÂ¢n tÃƒÂ­ch.</p>
          </div>
        `;
      }
    }
    // HiÃ¡Â»Æ’n thÃ¡Â»â€¹ results container
    results.style.display = 'block';
    extensionsListUnscanned.style.display = 'none';
    console.log('[Popup] Results displayed');
    // Update tab counts only (khÃƒÂ´ng filter)
    filterExtensionsByTab('all');

  }

  function renderExtension(ext, isKept = false, isDisabled = false) {
    try {
      // Validate extension data
      if (!ext || !ext.extension) {
        console.error('[Popup] Invalid extension data:', ext);
        return '<div class="extension-item"><p>Lỗi: Dữ liệu extension không hợp lệ</p></div>';
      }
      const riskClass = (ext.riskLevel || 'UNKNOWN').toLowerCase();
      const riskColor = {
        'critical': '#dc2626',
        'high': '#ef4444',
        'medium': '#f59e0b',
        'low': '#10b981'
      }[riskClass] || '#64748b';
      // Dangerous permissions - handle undefined
      const permissions = ext.permissions || [];
      const dangerousPerms = ['webRequestBlocking', 'debugger', 'proxy', 'cookies', 'webRequest'];
      const dangerousPermissions = permissions.filter(p => dangerousPerms.includes(p));
      // Behaviors detected
      const behaviors = [];
      if (ext.behaviorVector?.dom_injection) behaviors.push('DOM Injection');
      if (ext.behaviorVector?.keystroke_capture) behaviors.push('Keystroke Capture');
      if (ext.behaviorVector?.external_post) behaviors.push('External POST');
      if (ext.behaviorVector?.suspicious_domains?.length > 0) {
        behaviors.push(`Suspicious Domains (${ext.behaviorVector.suspicious_domains.length})`);
      }
      // Status indicators
      let statusBadge = '';
      if (isKept && !isDisabled) {
        statusBadge = '<span class="status-badge kept"><i class="fas fa-check-circle"></i> Đang bật</span>';
      } else if (isDisabled) {
        statusBadge = '<span class="status-badge disabled"><i class="fas fa-pause-circle"></i> Đã tắt</span>';
      }
      return `
      <div class="extension-item" data-extension-id="${ext.extension.id}" ${isKept ? 'data-kept="true"' : ''} ${isDisabled ? 'data-disabled="true"' : ''}>
          <div class="extension-header">
          <div class="extension-header-left">
            <div class="extension-name">${escapeHtml(ext.extension.name)}</div>
            <div class="extension-meta">
              <span class="risk-score">Score: ${ext.riskScore}/100</span>
              ${statusBadge}
          </div>
          </div>
          <span class="risk-badge ${riskClass}">${ext.riskLevel}</span>
          </div>
          <div class="extension-details">
          <span class="detail-item">
            <i class="fas fa-tag"></i>
            Version: ${ext.extension.version}
          </span>
          <span class="detail-item ${!ext.extension.enabled ? 'detail-item-disabled' : ''}">
            ${ext.extension.enabled ? '<i class="fas fa-check-circle" style="color: var(--success-color);"></i> Đang bật' : '<i class="fas fa-pause-circle" style="color: var(--warning-color); font-weight: 700;"></i> <strong style="color: var(--warning-color);">Đã tắt</strong>'}
          </span>
          <span class="detail-item">
            ${ext.extension.installType === 'development' || ext.extension.installType === 'sideload' ? '<i class="fas fa-exclamation-triangle" style="color: var(--warning-color);"></i> Unpacked/Sideloaded' : '<i class="fas fa-store" style="color: var(--success-color);"></i> Chrome Web Store'}
          </span>
          </div>
        <!-- Phần phân tích chi tiết (ẩn mặc định) -->
        <div class="analysis-details" id="analysis-${ext.extension.id}" style="display: none;">
          ${ext.breakdown ? `
            <div class="breakdown">
              <div class="breakdown-item">
                <span>Static Analysis:</span>
                <span>${ext.breakdown.staticScore} điểm</span>
              </div>
              <div class="breakdown-item">
                <span>Runtime Observation:</span>
                <span>${ext.breakdown.runtimeScore} điểm</span>
              </div>
              ${ext.breakdown.installSourceBonus > 0 ? `
                <div class="breakdown-item">
                  <span>Install Source:</span>
                  <span>+${ext.breakdown.installSourceBonus} điểm</span>
            </div>
          ` : ''}
            </div>
          ` : ''}
          ${permissions.length > 0 ? `
            <div class="section-title">Permissions (${ext.permissionCount || permissions.length})</div>
            <div class="permissions-list">
              ${permissions.map(perm => `
                <span class="permission-badge ${dangerousPermissions.includes(perm) ? 'dangerous' : ''}">
                  ${escapeHtml(perm)}
                </span>
              `).join('')}
            </div>
          ` : ''}
          ${ext.hostPermissions && ext.hostPermissions.length > 0 ? `
            <div class="section-title">Host Permissions</div>
            <div class="permissions-list">
              ${ext.hostPermissions.map(perm => `
                <span class="permission-badge ${perm === '<all_urls>' ? 'dangerous' : ''}">
                  ${escapeHtml(perm)}
                </span>
              `).join('')}
          </div>
          ` : ''}
          ${behaviors.length > 0 ? `
            <div class="section-title">Hành Vi Phát Hiện</div>
            <ul class="behaviors-list">
              ${behaviors.map(behavior => `
                <li class="behavior-item">${escapeHtml(behavior)}</li>
              `).join('')}
            </ul>
          ` : ''}
          ${ext.reasons.length > 0 ? `
            <div class="section-title">Lý Do Đánh Giá</div>
            <ul class="reasons-list" id="reasons-${ext.extension.id}">
              ${ext.reasons.slice(0, 3).map(reason => `
                <li class="reason-item">${escapeHtml(reason)}</li>
              `).join('')}
              ${ext.reasons.length > 3 ? ext.reasons.slice(3).map((reason, index) => `
                <li class="reason-item reason-item-more reason-more-${ext.extension.id}" style="display: none;">${escapeHtml(reason)}</li>
              `).join('') : ''}
              ${ext.reasons.length > 3 ? `
                <li class="reason-item-toggle">
                  <button class="toggle-reasons-btn" data-extension-id="${ext.extension.id}" data-count="${ext.reasons.length - 3}">
                    <i class="fas fa-chevron-down"></i>
                    +${ext.reasons.length - 3} lý do khác...
                  </button>
                </li>
              ` : ''}
            </ul>
          ` : ''}
          ${ext.recommendations.length > 0 ? `
            <div class="section-title">Khuyến Nghị</div>
            <div style="font-size: 0.75rem; color: ${riskColor}; font-weight: 600; margin-bottom: 0.5rem;">
              ${escapeHtml(ext.recommendations[0].message)}
            </div>
          ` : ''}
        </div>
          <div class="extension-actions">
          <button class="action-button view-analysis" data-action="view-analysis" data-extension-id="${ext.extension.id}">
            <i class="fas fa-chart-line"></i>
            Xem Phân Tích
          </button>
          ${ext.extension.enabled ? `
            <button class="action-button disable" data-action="disable" data-extension-id="${ext.extension.id}">
              <i class="fas fa-pause"></i>
              Tắt
            </button>
          ` : `
            <button class="action-button enable" data-action="enable" data-extension-id="${ext.extension.id}">
              <i class="fas fa-play"></i>
              Bật
            </button>
          `}
          <button class="action-button uninstall" data-action="uninstall" data-extension-id="${ext.extension.id}">
            <i class="fas fa-trash"></i>
            Gỡ
          </button>
          ${isKept ? `
            <button class="action-button keep in-use" disabled>
              <i class="fas fa-check-circle"></i>
              Đang sử dụng
            </button>
          ` : `
            <button class="action-button keep" data-action="keep" data-extension-id="${ext.extension.id}">
              <i class="fas fa-check"></i>
              Giữ
            </button>
          `}
          </div>
        </div>
      `;
    } catch (renderErr) {
      console.error('[Popup] Error rendering extension:', renderErr, ext);
      return `
        <div class="extension-item">
          <div class="extension-header">
            <div class="extension-name">${escapeHtml(ext?.extension?.name || 'Unknown Extension')}</div>
          </div>
          <div class="error" style="margin-top: 0.5rem; padding: 0.5rem;">
            Lỗi khi hiển thị phân tích: ${renderErr.message || 'Lỗi không xác định'}
          </div>
        </div>
      `;
    }

  }

  function showError(message) {
    if (error) {
    error.textContent = message;
    error.style.display = 'block';
    } else {
      console.error('[Popup] Error element not found. Message:', message);
    }

  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;

  }
  // Event delegation cho action buttons
  document.addEventListener('click', async (event) => {
    // KiÃ¡Â»Æ’m tra toggle reasons button trÃ†Â°Ã¡Â»â€ºc
    const toggleButton = event.target.closest('.toggle-reasons-btn');
    if (toggleButton) {
      const extensionId = toggleButton.getAttribute('data-extension-id');
      if (extensionId) {
        handleToggleReasons(extensionId);
      }
      return;
    }
    // KiÃ¡Â»Æ’m tra action button - chÃ¡Â»â€° xÃ¡Â»Â­ lÃƒÂ½ nÃ¡ÂºÂ¿u cÃƒÂ³ cÃ¡ÂºÂ£ data-action vÃƒÂ  data-extension-id
    const button = event.target.closest('.action-button');
    if (!button) {
      return; // KhÃƒÂ´ng phÃ¡ÂºÂ£i action button, bÃ¡Â»Â qua
    }
    // KIÃ¡Â»â€šM TRA DISABLED TRÃ†Â¯Ã¡Â»Å¡C TIÃƒÅ N - trÃ†Â°Ã¡Â»â€ºc khi lÃ¡ÂºÂ¥y action vÃƒÂ  extensionId
    if (button.disabled || button.hasAttribute('disabled') || button.classList.contains('disabled')) {
      // NÃ¡ÂºÂ¿u lÃƒÂ  nÃƒÂºt "Xem phÃƒÂ¢n tÃƒÂ­ch" bÃ¡Â»â€¹ disabled, hiÃ¡Â»Æ’n thÃ¡Â»â€¹ thÃƒÂ´ng bÃƒÂ¡o
      const action = button.getAttribute('data-action');
      if (action === 'view-analysis-unscanned') {
        event.preventDefault();
        event.stopPropagation();
        alert('Ã¢Å¡Â Ã¯Â¸Â HÃƒÂ£y quÃƒÂ©t extension trÃ†Â°Ã¡Â»â€ºc khi phÃƒÂ¢n tÃƒÂ­ch');
      }
      return; // Button Ã„â€˜ÃƒÂ£ disabled, bÃ¡Â»Â qua
    }
    // KiÃ¡Â»Æ’m tra xem button cÃƒÂ³ phÃ¡ÂºÂ£i lÃƒÂ  extension action button khÃƒÂ´ng
    const action = button.getAttribute('data-action');
    const extensionId = button.getAttribute('data-extension-id');
    // NÃ¡ÂºÂ¿u khÃƒÂ´ng cÃƒÂ³ action hoÃ¡ÂºÂ·c extensionId, cÃƒÂ³ thÃ¡Â»Æ’ lÃƒÂ  button khÃƒÂ¡c (nhÃ†Â° trong settings modal)
    // ChÃ¡Â»â€° xÃ¡Â»Â­ lÃƒÂ½ nÃ¡ÂºÂ¿u cÃƒÂ³ cÃ¡ÂºÂ£ hai
    if (!action || !extensionId) {
      return; // KhÃƒÂ´ng phÃ¡ÂºÂ£i extension action button, bÃ¡Â»Â qua im lÃ¡ÂºÂ·ng
    }
    console.log('[Popup] Action button clicked:', action, 'for extension:', extensionId);
    // Disable button Ã„â€˜Ã¡Â»Æ’ trÃƒÂ¡nh double-click
    button.disabled = true;
    try {
      if (action === 'view-analysis') {
        handleViewAnalysis(extensionId);
      } else if (action === 'view-analysis-unscanned') {
        // Xem phÃƒÂ¢n tÃƒÂ­ch tÃ¡Â»Â« unscanned list - cÃ¡ÂºÂ§n load kÃ¡ÂºÂ¿t quÃ¡ÂºÂ£ scan trÃ†Â°Ã¡Â»â€ºc
        await handleViewAnalysisUnscanned(extensionId);
      } else if (action === 'hide-analysis') {
        handleHideAnalysis(extensionId);
      } else if (action === 'disable') {
        await handleDisableExtension(extensionId);
      } else if (action === 'enable') {
        await handleEnableExtension(extensionId);
      } else if (action === 'uninstall') {
        await handleUninstallExtension(extensionId);
      } else if (action === 'keep') {
        await handleKeepExtension(extensionId);
      } else {
        console.warn('[Popup] Unknown action:', action);
      }
    } catch (err) {
      console.error('[Popup] Error handling action:', err);
      alert('Ã¢ÂÅ’ LÃ¡Â»â€”i khi thÃ¡Â»Â±c hiÃ¡Â»â€¡n hÃƒÂ nh Ã„â€˜Ã¡Â»â„¢ng: ' + err.message);
    } finally {
      // ChÃ¡Â»â€° enable lÃ¡ÂºÂ¡i nÃ¡ÂºÂ¿u button vÃ¡ÂºÂ«n cÃƒÂ²n trong DOM
      if (button && button.parentNode) {
        button.disabled = false;
      }
    }

  });
  console.log('[Popup] Event delegation listener attached');
  // ============================================
  // EXPORT/IMPORT FUNCTIONS
  // ============================================
  /**
   * Export scan results to JSON file
   */

  async function exportResults() {
    try {
      // Thu thÃ¡ÂºÂ­p tÃ¡ÂºÂ¥t cÃ¡ÂºÂ£ kÃ¡ÂºÂ¿t quÃ¡ÂºÂ£ scan tÃ¡Â»Â« storage
      const allStored = await chrome.storage.local.get(null);
      // LÃ¡ÂºÂ¥y tÃ¡Â»Â« lastScan (scan tÃ¡ÂºÂ¥t cÃ¡ÂºÂ£) - chÃ¡Â»â€° lÃ¡ÂºÂ¥y khi Ã„â€˜ÃƒÂ£ quÃƒÂ©t
      const lastScan = allStored.lastScan;
      let allScanResults = [];
      // KiÃ¡Â»Æ’m tra xem cÃƒÂ³ phÃ¡ÂºÂ£i lÃƒÂ  kÃ¡ÂºÂ¿t quÃ¡ÂºÂ£ tÃ¡Â»Â« scan khÃƒÂ´ng (cÃƒÂ³ riskScore, riskLevel, etc.)
      function isValidScanResult(result) {
        if (!result || !result.extension) return false;
        // PhÃ¡ÂºÂ£i cÃƒÂ³ ÃƒÂ­t nhÃ¡ÂºÂ¥t riskScore vÃƒÂ  riskLevel Ã„â€˜Ã¡Â»Æ’ coi lÃƒÂ  kÃ¡ÂºÂ¿t quÃ¡ÂºÂ£ phÃƒÂ¢n tÃƒÂ­ch
        return (
          typeof result.riskScore === 'number' &&
          result.riskLevel &&
          (result.reasons || result.recommendations || result.flags || result.breakdown)
        );
      }
      // CHÃ¡Â»Ë† CHO PHÃƒâ€°P EXPORT KÃ¡ÂºÂ¾T QUÃ¡ÂºÂ¢ TÃ¡Â»Âª MANUAL SCAN (tÃ¡Â»Â« nÃƒÂºt "QuÃƒÂ©t Extensions")
      // KhÃƒÂ´ng export tÃ¡Â»Â« auto-scan (onInstalled, onStartup, management.onInstalled)
      const allowedReasons = ['manual']; // ChÃ¡Â»â€° cho phÃƒÂ©p manual scan
      // Background.js lÃ†Â°u vÃƒÂ o lastScan.results, nhÃ†Â°ng displayResults dÃƒÂ¹ng extensions
      // KiÃ¡Â»Æ’m tra cÃ¡ÂºÂ£ hai Ã„â€˜Ã¡Â»Æ’ tÃ†Â°Ã†Â¡ng thÃƒÂ­ch, nhÃ†Â°ng CHÃ¡Â»Ë† LÃ¡ÂºÂ¤Y KÃ¡ÂºÂ¾T QUÃ¡ÂºÂ¢ TÃ¡Â»Âª MANUAL SCAN
      if (lastScan) {
        // CHÃ¡Â»Ë† LÃ¡ÂºÂ¤Y KÃ¡ÂºÂ¾T QUÃ¡ÂºÂ¢ TÃ¡Â»Âª MANUAL SCAN (reason = 'manual')
        const isManualScan = lastScan.reason && allowedReasons.includes(lastScan.reason) && lastScan.timestamp;
        if (isManualScan) {
          if (lastScan.results && Array.isArray(lastScan.results) && lastScan.results.length > 0) {
            // LÃ¡Â»Âc chÃ¡Â»â€° lÃ¡ÂºÂ¥y kÃ¡ÂºÂ¿t quÃ¡ÂºÂ£ Ã„â€˜ÃƒÂ£ phÃƒÂ¢n tÃƒÂ­ch Ã„â€˜Ã¡ÂºÂ§y Ã„â€˜Ã¡Â»Â§
            const validResults = lastScan.results.filter(isValidScanResult);
            allScanResults = [...validResults];
          } else if (lastScan.extensions && Array.isArray(lastScan.extensions) && lastScan.extensions.length > 0) {
            // LÃ¡Â»Âc chÃ¡Â»â€° lÃ¡ÂºÂ¥y kÃ¡ÂºÂ¿t quÃ¡ÂºÂ£ Ã„â€˜ÃƒÂ£ phÃƒÂ¢n tÃƒÂ­ch Ã„â€˜Ã¡ÂºÂ§y Ã„â€˜Ã¡Â»Â§
            const validResults = lastScan.extensions.filter(isValidScanResult);
            allScanResults = [...validResults];
          }
        }
      }
      console.log('[Export] Found', allScanResults.length, 'valid results from manual scan (lastScan)');
      console.log('[Export] lastScan.reason:', lastScan?.reason);
      // KHÃƒâ€NG LÃ¡ÂºÂ¤Y TÃ¡Â»Âª scan_result_* hoÃ¡ÂºÂ·c new_extension_* vÃƒÂ¬ Ã„â€˜ÃƒÂ³ lÃƒÂ  tÃ¡Â»Â« auto-scan
      // ChÃ¡Â»â€° export kÃ¡ÂºÂ¿t quÃ¡ÂºÂ£ tÃ¡Â»Â« manual scan (nÃƒÂºt "QuÃƒÂ©t Extensions")
      console.log('[Export] Total valid results to export:', allScanResults.length);
      if (allScanResults.length === 0) {
        alert('Không có kết quả quét nào để xuất.\n\nVui lòng click nút "Quét Extensions" để phân tích extensions trước.');
        return;
      }
      // Get whitelist and blacklist
      const whitelist = [];
      const blacklist = [];
      Object.keys(allStored).forEach(key => {
        if (key.startsWith('whitelist_')) {
          whitelist.push(key.replace('whitelist_', ''));
        }
        if (key.startsWith('blacklist_')) {
          blacklist.push(key.replace('blacklist_', ''));
        }
      });
      const exportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        totalExtensions: allScanResults.length,
        scanResults: allScanResults.map(ext => ({
          id: ext.extension.id,
          name: ext.extension.name,
          version: ext.extension.version,
          riskScore: ext.riskScore,
          riskLevel: ext.riskLevel,
          permissions: ext.permissions,
          hostPermissions: ext.hostPermissions,
          behaviors: ext.behaviorVector,
          reasons: ext.reasons,
          recommendations: ext.recommendations,
          scannedAt: ext.scannedAt
        })),
        whitelist: whitelist,
        blacklist: blacklist
      };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `extension_scan_results_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      alert('Ã¢Å“â€¦ Ã„ÂÃƒÂ£ xuÃ¡ÂºÂ¥t kÃ¡ÂºÂ¿t quÃ¡ÂºÂ£ thÃƒÂ nh cÃƒÂ´ng!');
    } catch (error) {
      console.error('[Popup] Error exporting results:', error);
      alert('Ã¢ÂÅ’ LÃ¡Â»â€”i khi xuÃ¡ÂºÂ¥t kÃ¡ÂºÂ¿t quÃ¡ÂºÂ£: ' + error.message);
    }

  }
  /**
   * Import scan results from JSON file
   */

  async function importResults(file) {
    try {
      console.log('[Popup] Starting import...');
      // Ã„ÂÃ¡Â»Âc file
      const text = await file.text();
      console.log('[Popup] File read, parsing JSON...');
      let importData;
      try {
        importData = JSON.parse(text);
      } catch (parseError) {
        throw new Error('File JSON không hợp lệ: ' + parseError.message);
      }
      if (!importData.scanResults || !Array.isArray(importData.scanResults)) {
        throw new Error('File không hợp lệ. Vui lòng chọn file JSON đã xuất từ extension này.');
      }
      if (!confirm(`Bạn có chắc muốn nhập ${importData.scanResults.length} kết quả quét?\n\nDữ liệu hiện tại sẽ được thay thế.`)) {
        console.log('[Popup] User cancelled import');
        return;
      }
      console.log('[Popup] Import confirmed, processing data...');
      // Import whitelist and blacklist
      if (importData.whitelist && Array.isArray(importData.whitelist)) {
        console.log('[Popup] Importing whitelist...');
        // XÃƒÂ³a whitelist cÃ…Â© trÃ†Â°Ã¡Â»â€ºc
        const allStored = await chrome.storage.local.get(null);
        const oldWhitelistKeys = Object.keys(allStored).filter(key => key.startsWith('whitelist_'));
        if (oldWhitelistKeys.length > 0) {
          await chrome.storage.local.remove(oldWhitelistKeys);
        }
        // ThÃƒÂªm whitelist mÃ¡Â»â€ºi (batch Ã„â€˜Ã¡Â»Æ’ trÃƒÂ¡nh quÃƒÂ¡ nhiÃ¡Â»Âu operations)
        const whitelistData = {};
        for (const extId of importData.whitelist) {
          whitelistData[`whitelist_${extId}`] = true;
        }
        if (Object.keys(whitelistData).length > 0) {
          await chrome.storage.local.set(whitelistData);
        }
      }
      if (importData.blacklist && Array.isArray(importData.blacklist)) {
        console.log('[Popup] Importing blacklist...');
        // XÃƒÂ³a blacklist cÃ…Â© trÃ†Â°Ã¡Â»â€ºc
        const allStored = await chrome.storage.local.get(null);
        const oldBlacklistKeys = Object.keys(allStored).filter(key => key.startsWith('blacklist_'));
        if (oldBlacklistKeys.length > 0) {
          await chrome.storage.local.remove(oldBlacklistKeys);
        }
        // ThÃƒÂªm blacklist mÃ¡Â»â€ºi (batch Ã„â€˜Ã¡Â»Æ’ trÃƒÂ¡nh quÃƒÂ¡ nhiÃ¡Â»Âu operations)
        const blacklistData = {};
        for (const extId of importData.blacklist) {
          blacklistData[`blacklist_${extId}`] = true;
        }
        if (Object.keys(blacklistData).length > 0) {
          await chrome.storage.local.set(blacklistData);
        }
      }
      console.log('[Popup] Getting current extensions...');
      // Convert imported data to scan results format
      let extensions;
      try {
        extensions = await chrome.runtime.sendMessage({ action: 'getAllExtensions' });
        if (!extensions || !extensions.success) {
          console.warn('[Popup] Failed to get extensions, using empty array');
          extensions = { extensions: [] };
        }
      } catch (msgError) {
        console.error('[Popup] Error getting extensions:', msgError);
        extensions = { extensions: [] };
      }
      const allExtensions = extensions.extensions || [];
      console.log('[Popup] Processing', importData.scanResults.length, 'scan results...');
      const importedResults = importData.scanResults.map(imported => {
        try {
          const currentExt = allExtensions.find(ext => ext && ext.id === imported.id);
          // NÃ¡ÂºÂ¿u extension khÃƒÂ´ng cÃƒÂ²n tÃ¡Â»â€œn tÃ¡ÂºÂ¡i, vÃ¡ÂºÂ«n giÃ¡Â»Â¯ lÃ¡ÂºÂ¡i data tÃ¡Â»Â« import
          return {
            extension: {
              id: imported.id || imported.extension?.id || 'unknown',
              name: imported.name || imported.extension?.name || (currentExt ? currentExt.name : 'Unknown'),
              version: imported.version || imported.extension?.version || (currentExt ? currentExt.version : '1.0'),
              installType: currentExt ? currentExt.installType : (imported.extension?.installType || 'normal'),
              permissions: imported.permissions || imported.extension?.permissions || (currentExt ? currentExt.permissions : []),
              hostPermissions: imported.hostPermissions || imported.extension?.hostPermissions || (currentExt ? currentExt.hostPermissions : []),
              enabled: currentExt ? currentExt.enabled : (imported.extension?.enabled !== undefined ? imported.extension.enabled : false)
            },
            riskScore: imported.riskScore || 0,
            riskLevel: imported.riskLevel || 'UNKNOWN',
            permissions: imported.permissions || [],
            hostPermissions: imported.hostPermissions || [],
            behaviorVector: imported.behaviors || imported.behaviorVector || {},
            reasons: imported.reasons || [],
            recommendations: imported.recommendations || [],
            flags: imported.flags || [],
            breakdown: imported.breakdown || {},
            scannedAt: imported.scannedAt || new Date().toISOString()
          };
        } catch (mapError) {
          console.error('[Popup] Error mapping imported result:', mapError, imported);
          return null;
        }
      }).filter(ext => ext !== null && ext.extension && ext.extension.id);
      console.log('[Popup] Saving imported results to storage...');
      // LÃ†Â°u vÃƒÂ o lastScan (format Ã„â€˜ÃƒÂºng vÃ¡Â»â€ºi background.js)
      const lastScan = {
        timestamp: importData.exportDate || new Date().toISOString(),
        reason: 'imported',
        total: importedResults.length,
        results: importedResults,
        extensions: importedResults  // ThÃƒÂªm extensions Ã„â€˜Ã¡Â»Æ’ tÃ†Â°Ã†Â¡ng thÃƒÂ­ch vÃ¡Â»â€ºi displayResults
      };
      // Batch lÃ†Â°u tÃ¡ÂºÂ¥t cÃ¡ÂºÂ£ scan_result_* keys cÃƒÂ¹ng lÃƒÂºc Ã„â€˜Ã¡Â»Æ’ trÃƒÂ¡nh quÃƒÂ¡ nhiÃ¡Â»Âu operations
      const scanResultData = {};
      for (const result of importedResults) {
        if (result.extension && result.extension.id) {
          scanResultData[`scan_result_${result.extension.id}`] = {
            ...result,
            scannedAt: result.scannedAt || new Date().toISOString(),
            reason: 'imported'
          };
        }
      }
      // LÃ†Â°u tÃ¡ÂºÂ¥t cÃ¡ÂºÂ£ cÃƒÂ¹ng lÃƒÂºc: lastScan + tÃ¡ÂºÂ¥t cÃ¡ÂºÂ£ scan_result_* keys
      const allDataToSave = {
        lastScan: lastScan,
        ...scanResultData
      };
      try {
        await chrome.storage.local.set(allDataToSave);
        console.log('[Popup] Storage updated successfully');
      } catch (storageError) {
        console.error('[Popup] Error saving to storage:', storageError);
        // ThÃ¡Â»Â­ lÃ†Â°u tÃ¡Â»Â«ng phÃ¡ÂºÂ§n nÃ¡ÂºÂ¿u batch lÃ†Â°u thÃ¡ÂºÂ¥t bÃ¡ÂºÂ¡i
        await chrome.storage.local.set({ lastScan: lastScan });
        // LÃ†Â°u scan_result_* keys theo batch nhÃ¡Â»Â hÃ†Â¡n (10 keys mÃ¡Â»â€”i lÃ¡ÂºÂ§n)
        const keys = Object.keys(scanResultData);
        for (let i = 0; i < keys.length; i += 10) {
          const batch = {};
          for (let j = i; j < Math.min(i + 10, keys.length); j++) {
            batch[keys[j]] = scanResultData[keys[j]];
          }
          await chrome.storage.local.set(batch);
        }
      }
      console.log('[Popup] Import completed, updating UI...');
      // HiÃ¡Â»Æ’n thÃ¡Â»â€¹ thÃƒÂ´ng bÃƒÂ¡o thÃƒÂ nh cÃƒÂ´ng
      alert(`✓ Đã nhập thành công ${importedResults.length} kết quả quét.\n\nGiao diện sẽ được tải lại.`);
      // Reload UI - hiÃ¡Â»Æ’n thÃ¡Â»â€¹ kÃ¡ÂºÂ¿t quÃ¡ÂºÂ£ Ã„â€˜ÃƒÂ£ import
      try {
        await displayResults({
          success: true,
          extensions: importedResults,
          total: importedResults.length,
          scanned: importedResults.length,
          timestamp: lastScan.timestamp,
          reason: 'imported'
        });
        console.log('[Popup] UI updated successfully');
      } catch (displayError) {
        console.error('[Popup] Error displaying results:', displayError);
        // NÃ¡ÂºÂ¿u displayResults lÃ¡Â»â€”i, ÃƒÂ­t nhÃ¡ÂºÂ¥t Ã„â€˜ÃƒÂ£ lÃ†Â°u data, user cÃƒÂ³ thÃ¡Â»Æ’ reload extension
        alert('Đã nhập dữ liệu nhưng gặp lỗi khi hiển thị. Vui lòng reload extension để xem kết quả.');
      }
      console.log('[Popup] Import completed successfully');
    } catch (error) {
      console.error('[Popup] Error importing results:', error);
      const errorMsg = error?.message || error?.toString() || 'LÃ¡Â»â€”i khÃƒÂ´ng xÃƒÂ¡c Ã„â€˜Ã¡Â»â€¹nh';
      alert('Ã¢ÂÅ’ LÃ¡Â»â€”i khi nhÃ¡ÂºÂ­p kÃ¡ÂºÂ¿t quÃ¡ÂºÂ£: ' + errorMsg + '\n\nVui lÃƒÂ²ng kiÃ¡Â»Æ’m tra file JSON vÃƒÂ  thÃ¡Â»Â­ lÃ¡ÂºÂ¡i.');
      // Ã„ÂÃ¡ÂºÂ£m bÃ¡ÂºÂ£o UI vÃ¡ÂºÂ«n hoÃ¡ÂºÂ¡t Ã„â€˜Ã¡Â»â„¢ng sau khi cÃƒÂ³ lÃ¡Â»â€”i
      try {
        await loadUnscannedExtensions();
      } catch (reloadError) {
        console.error('[Popup] Error reloading unscanned extensions after import error:', reloadError);
      }
    }

  }
  // ============================================
  // FILTER & SEARCH FUNCTIONS
  // ============================================
  /**
   * Apply filters and search for scanned extensions
   */

  function applyFilters() {
    console.log('[Popup] applyFilters called');
    if (!searchInput || !riskFilter || !statusFilter || !installTypeFilter) {
      console.warn('[Popup] Filter elements not found:', {
        searchInput: !!searchInput,
        riskFilter: !!riskFilter,
        statusFilter: !!statusFilter,
        installTypeFilter: !!installTypeFilter
      });
      return;
    }
    const searchQuery = searchInput.value.trim().toLowerCase();
    const riskFilterValue = riskFilter.value;
    const statusFilterValue = statusFilter.value;
    const installTypeFilterValue = installTypeFilter.value;
    console.log('[Popup] Filter values:', {
      searchQuery,
      riskFilterValue,
      statusFilterValue,
      installTypeFilterValue
    });
    const extensionItems = document.querySelectorAll('.extension-item');
    console.log('[Popup] Found', extensionItems.length, 'scanned extension items');
    if (extensionItems.length === 0) {
      console.log('[Popup] No scanned extension items found');
      return;
    }
    let visibleCount = 0;
    extensionItems.forEach(item => {
      // Check tab filter first
      const tabVisible = item.getAttribute('data-tab-visible') !== 'false';
      if (!tabVisible) {
        item.classList.add('hidden');
        return;
      }
      const extensionNameEl = item.querySelector('.extension-name');
      const extensionName = extensionNameEl ? extensionNameEl.textContent.toLowerCase() : '';
      const riskBadge = item.querySelector('.risk-badge');
      const riskLevel = riskBadge ? riskBadge.textContent.trim() : '';
      const isKept = item.hasAttribute('data-kept');
      const isDisabled = item.hasAttribute('data-disabled');
      const detailItems = item.querySelectorAll('.detail-item');
      // Get install type from details
      let installType = 'normal';
      detailItems.forEach(detail => {
        const text = detail.textContent;
        if (text.includes('Chrome Web Store')) {
          installType = 'normal';
        } else if (text.includes('Unpacked')) {
          installType = 'development';
        } else if (text.includes('Sideloaded')) {
          installType = 'sideload';
        }
      });
      // Apply search and filters
      let shouldShow = true;
      // Search filter
      if (searchQuery && !extensionName.includes(searchQuery)) {
        shouldShow = false;
      }
      // Risk filter
      if (riskFilterValue !== 'all' && riskLevel !== riskFilterValue) {
        shouldShow = false;
      }
      // Status filter
      if (statusFilterValue === 'enabled' && isDisabled) {
        shouldShow = false;
      } else if (statusFilterValue === 'disabled' && !isDisabled) {
        shouldShow = false;
      } else if (statusFilterValue === 'kept' && !isKept) {
        shouldShow = false;
      }
      // Install type filter
      if (installTypeFilterValue !== 'all') {
        if (installTypeFilterValue === 'normal' && installType !== 'normal') {
          shouldShow = false;
        } else if (installTypeFilterValue === 'development' && installType !== 'development') {
          shouldShow = false;
        } else if (installTypeFilterValue === 'sideload' && installType !== 'sideload') {
          shouldShow = false;
        }
      }
      if (shouldShow) {
        item.classList.remove('hidden');
        visibleCount++;
      } else {
        item.classList.add('hidden');
      }
    });
    console.log('[Popup] Filtered to', visibleCount, 'visible extensions');

  }
  /**
   * Apply filters and search for unscanned extensions
   */

  function applyFiltersUnscanned() {
    if (!searchInputUnscanned || !statusFilterUnscanned || !installTypeFilterUnscanned) {
      console.log('[Popup] Filter elements not found, skipping applyFiltersUnscanned');
      return;
    }
    const searchQuery = searchInputUnscanned.value.trim().toLowerCase();
    const statusFilterValue = statusFilterUnscanned.value;
    const installTypeFilterValue = installTypeFilterUnscanned.value;
    const extensionItems = document.querySelectorAll('.extension-item-unscanned');
    if (extensionItems.length === 0) {
      console.log('[Popup] No unscanned extension items found');
      return;
    }
    let visibleCount = 0;
    extensionItems.forEach(item => {
      const extensionNameEl = item.querySelector('.extension-name');
      const extensionName = extensionNameEl ? extensionNameEl.textContent.toLowerCase() : '';
      const isKept = item.hasAttribute('data-kept');
      const isDisabled = item.hasAttribute('data-disabled');
      const detailItems = item.querySelectorAll('.detail-item');
      // Get install type from details
      let installType = 'normal';
      detailItems.forEach(detail => {
        const text = detail.textContent;
        if (text.includes('Chrome Web Store')) {
          installType = 'normal';
        } else if (text.includes('Unpacked')) {
          installType = 'development';
        } else if (text.includes('Sideloaded')) {
          installType = 'sideload';
        }
      });
      // Apply filters
      let shouldShow = true;
      // Search filter
      if (searchQuery && !extensionName.includes(searchQuery)) {
        shouldShow = false;
      }
      // Status filter
      if (statusFilterValue === 'enabled' && isDisabled) {
        shouldShow = false;
      } else if (statusFilterValue === 'disabled' && !isDisabled) {
        shouldShow = false;
      } else if (statusFilterValue === 'kept' && !isKept) {
        shouldShow = false;
      }
      // Install type filter
      if (installTypeFilterValue !== 'all') {
        if (installTypeFilterValue === 'normal' && installType !== 'normal') {
          shouldShow = false;
        } else if (installTypeFilterValue === 'development' && installType !== 'development') {
          shouldShow = false;
        } else if (installTypeFilterValue === 'sideload' && installType !== 'sideload') {
          shouldShow = false;
        }
      }
      if (shouldShow) {
        item.classList.remove('hidden');
        visibleCount++;
      } else {
        item.classList.add('hidden');
      }
    });
    // Update tab counts only (khÃƒÂ´ng filter)
    filterUnscannedExtensionsByTab('all-unscanned');
    console.log('[Popup] Applied filters to unscanned extensions:', visibleCount, 'visible out of', extensionItems.length);

  }
  // ============================================
  // SETTINGS FUNCTIONS
  // ============================================
  /**
   * Load settings from storage
   */

  async function loadSettings() {
    const stored = await chrome.storage.local.get(['autoScan', 'notifications']);
    // Load toggles
    const autoScanToggle = document.getElementById('autoScanToggle');
    const notificationsToggle = document.getElementById('notificationsToggle');
    if (autoScanToggle) {
      autoScanToggle.classList.toggle('active', stored.autoScan !== false);
    }
    if (notificationsToggle) {
      notificationsToggle.classList.toggle('active', stored.notifications !== false);
    }
    // Load whitelist
    await loadWhitelist();
    // Load blacklist
    await loadBlacklist();

  }
  /**
   * Load whitelist
   */

  async function loadWhitelist() {
    try {
      const container = document.getElementById('whitelistContainer');
      if (!container) {
        console.warn('[Popup] Whitelist container not found');
        return;
      }
      console.log('[Popup] Loading whitelist...');
      // TÃ¡Â»â€˜i Ã†Â°u: ChÃ¡Â»â€° lÃ¡ÂºÂ¥y keys bÃ¡ÂºÂ¯t Ã„â€˜Ã¡ÂºÂ§u vÃ¡Â»â€ºi 'whitelist_' thay vÃƒÂ¬ get(null)
      // LÃ¡ÂºÂ¥y tÃ¡ÂºÂ¥t cÃ¡ÂºÂ£ keys trÃ†Â°Ã¡Â»â€ºc
      const allKeys = await new Promise((resolve) => {
        chrome.storage.local.get(null, (items) => {
          if (chrome.runtime.lastError) {
            console.error('[Popup] Error getting storage keys:', chrome.runtime.lastError);
            resolve([]);
            return;
          }
          resolve(Object.keys(items || {}));
        });
      });
      // LÃ¡Â»Âc chÃ¡Â»â€° whitelist keys
      const whitelistKeys = allKeys.filter(key => key.startsWith('whitelist_'));
      const whitelist = whitelistKeys.map(key => key.replace('whitelist_', ''));
      console.log('[Popup] Found', whitelist.length, 'items in whitelist');
      if (whitelist.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); font-size: 0.8125rem; padding: 0.5rem;">Chưa có extension nào trong whitelist</p>';
        return;
      }
      // Get extension names vÃ¡Â»â€ºi timeout Ã„â€˜Ã¡Â»Æ’ trÃƒÂ¡nh Ã„â€˜Ã¡Â»Â©ng
      let allExtensions = [];
      try {
        const extensionsResponse = await Promise.race([
          chrome.runtime.sendMessage({ action: 'getAllExtensions' }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
        ]);
        if (extensionsResponse && extensionsResponse.success && extensionsResponse.extensions) {
          allExtensions = extensionsResponse.extensions;
        }
      } catch (extError) {
        console.error('[Popup] Error getting extensions for whitelist:', extError);
        // NÃ¡ÂºÂ¿u khÃƒÂ´ng lÃ¡ÂºÂ¥y Ã„â€˜Ã†Â°Ã¡Â»Â£c extensions, vÃ¡ÂºÂ«n hiÃ¡Â»Æ’n thÃ¡Â»â€¹ vÃ¡Â»â€ºi ID
        allExtensions = [];
      }
      container.innerHTML = whitelist.map(extId => {
        const ext = allExtensions.find(e => e && e.id === extId);
        const name = ext ? ext.name : extId.substring(0, 8) + '...';
        return `
          <div class="list-item">
            <span class="list-item-name">${escapeHtml(name)}</span>
            <button class="list-item-remove" data-action="remove-whitelist" data-extension-id="${extId}">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        `;
      }).join('');
      console.log('[Popup] Whitelist loaded successfully');
    } catch (error) {
      console.error('[Popup] Error loading whitelist:', error);
      const container = document.getElementById('whitelistContainer');
      if (container) {
        container.innerHTML = '<p style="color: var(--danger-color); font-size: 0.8125rem; padding: 0.5rem;">Lỗi khi tải whitelist</p>';
      }
    }

  }
  /**
   * Load blacklist
   */

  async function loadBlacklist() {
    try {
      const container = document.getElementById('blacklistContainer');
      if (!container) {
        console.warn('[Popup] Blacklist container not found');
        return;
      }
      console.log('[Popup] Loading blacklist...');
      // TÃ¡Â»â€˜i Ã†Â°u: ChÃ¡Â»â€° lÃ¡ÂºÂ¥y keys bÃ¡ÂºÂ¯t Ã„â€˜Ã¡ÂºÂ§u vÃ¡Â»â€ºi 'blacklist_' thay vÃƒÂ¬ get(null)
      // LÃ¡ÂºÂ¥y tÃ¡ÂºÂ¥t cÃ¡ÂºÂ£ keys trÃ†Â°Ã¡Â»â€ºc
      const allKeys = await new Promise((resolve) => {
        chrome.storage.local.get(null, (items) => {
          if (chrome.runtime.lastError) {
            console.error('[Popup] Error getting storage keys:', chrome.runtime.lastError);
            resolve([]);
            return;
          }
          resolve(Object.keys(items || {}));
        });
      });
      // LÃ¡Â»Âc chÃ¡Â»â€° blacklist keys
      const blacklistKeys = allKeys.filter(key => key.startsWith('blacklist_'));
      const blacklist = blacklistKeys.map(key => key.replace('blacklist_', ''));
      console.log('[Popup] Found', blacklist.length, 'items in blacklist');
      if (blacklist.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); font-size: 0.8125rem; padding: 0.5rem;">Chưa có extension nào trong blacklist</p>';
        return;
      }
      // Get extension names vÃ¡Â»â€ºi timeout Ã„â€˜Ã¡Â»Æ’ trÃƒÂ¡nh Ã„â€˜Ã¡Â»Â©ng
      let allExtensions = [];
      try {
        const extensionsResponse = await Promise.race([
          chrome.runtime.sendMessage({ action: 'getAllExtensions' }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
        ]);
        if (extensionsResponse && extensionsResponse.success && extensionsResponse.extensions) {
          allExtensions = extensionsResponse.extensions;
        }
      } catch (extError) {
        console.error('[Popup] Error getting extensions for blacklist:', extError);
        // NÃ¡ÂºÂ¿u khÃƒÂ´ng lÃ¡ÂºÂ¥y Ã„â€˜Ã†Â°Ã¡Â»Â£c extensions, vÃ¡ÂºÂ«n hiÃ¡Â»Æ’n thÃ¡Â»â€¹ vÃ¡Â»â€ºi ID
        allExtensions = [];
      }
      container.innerHTML = blacklist.map(extId => {
        const ext = allExtensions.find(e => e && e.id === extId);
        const name = ext ? ext.name : extId.substring(0, 8) + '...';
        return `
          <div class="list-item">
            <span class="list-item-name">${escapeHtml(name)}</span>
            <button class="list-item-remove" data-action="remove-blacklist" data-extension-id="${extId}">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        `;
      }).join('');
      console.log('[Popup] Blacklist loaded successfully');
    } catch (error) {
      console.error('[Popup] Error loading blacklist:', error);
      const container = document.getElementById('blacklistContainer');
      if (container) {
        container.innerHTML = '<p style="color: var(--danger-color); font-size: 0.8125rem; padding: 0.5rem;">Lỗi khi tải blacklist</p>';
      }
    }

  }
  // Toggle switches
  document.addEventListener('click', (e) => {
    const toggle = e.target.closest('.toggle-switch');
    if (toggle) {
      toggle.classList.toggle('active');
      const setting = toggle.getAttribute('data-setting');
      chrome.storage.local.set({ [setting]: toggle.classList.contains('active') });
    }
    // Remove from whitelist/blacklist
    const removeBtn = e.target.closest('[data-action="remove-whitelist"], [data-action="remove-blacklist"]');
    if (removeBtn) {
      const action = removeBtn.getAttribute('data-action');
      const extId = removeBtn.getAttribute('data-extension-id');
      if (action === 'remove-whitelist') {
        chrome.storage.local.remove(`whitelist_${extId}`, () => {
          if (chrome.runtime.lastError) {
            console.error('[Popup] Error removing from whitelist:', chrome.runtime.lastError);
            alert('Ã¢ÂÅ’ LÃ¡Â»â€”i khi xÃƒÂ³a khÃ¡Â»Âi Whitelist: ' + chrome.runtime.lastError.message);
            return;
          }
          loadWhitelist().catch(err => {
            console.error('[Popup] Error reloading whitelist after remove:', err);
          });
        });
      } else if (action === 'remove-blacklist') {
        chrome.storage.local.remove(`blacklist_${extId}`, () => {
          if (chrome.runtime.lastError) {
            console.error('[Popup] Error removing from blacklist:', chrome.runtime.lastError);
            alert('Ã¢ÂÅ’ LÃ¡Â»â€”i khi xÃƒÂ³a khÃ¡Â»Âi Blacklist: ' + chrome.runtime.lastError.message);
            return;
          }
          loadBlacklist().catch(err => {
            console.error('[Popup] Error reloading blacklist after remove:', err);
          });
        });
      }
    }

  });
  // Add to whitelist/blacklist - hiÃ¡Â»Æ’n thÃ¡Â»â€¹ dropdown Ã„â€˜Ã¡Â»Æ’ chÃ¡Â»Ân extension
  document.getElementById('addToWhitelist')?.addEventListener('click', async () => {
    try {
      console.log('[Popup] Adding to whitelist...');
      // LÃ¡ÂºÂ¥y danh sÃƒÂ¡ch extensions vÃ¡Â»â€ºi timeout
      const response = await Promise.race([
        chrome.runtime.sendMessage({ action: 'getAllExtensions' }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout khi lÃ¡ÂºÂ¥y danh sÃƒÂ¡ch extensions')), 10000))
      ]);
      if (!response || !response.success || !response.extensions || response.extensions.length === 0) {
        alert('Chọn extension để thêm vào Whitelist');
        return;
      }
      console.log('[Popup] Got', response.extensions.length, 'extensions');
      // LÃ¡ÂºÂ¥y whitelist hiÃ¡Â»â€¡n tÃ¡ÂºÂ¡i - tÃ¡Â»â€˜i Ã†Â°u bÃ¡ÂºÂ±ng cÃƒÂ¡ch chÃ¡Â»â€° lÃ¡ÂºÂ¥y whitelist keys
      const allKeys = await new Promise((resolve) => {
        chrome.storage.local.get(null, (items) => {
          if (chrome.runtime.lastError) {
            console.error('[Popup] Error getting storage:', chrome.runtime.lastError);
            resolve([]);
            return;
          }
          resolve(Object.keys(items || {}));
        });
      });
      const currentWhitelist = new Set();
      allKeys.forEach(key => {
        if (key.startsWith('whitelist_')) {
          currentWhitelist.add(key.replace('whitelist_', ''));
        }
      });
      // LÃ¡Â»Âc extensions chÃ†Â°a cÃƒÂ³ trong whitelist
      const availableExtensions = response.extensions.filter(ext => ext && ext.id && !currentWhitelist.has(ext.id));
      if (availableExtensions.length === 0) {
        alert('Ã¢â€žÂ¹Ã¯Â¸Â TÃ¡ÂºÂ¥t cÃ¡ÂºÂ£ extensions Ã„â€˜ÃƒÂ£ cÃƒÂ³ trong Whitelist');
        return;
      }
      // TÃ¡ÂºÂ¡o dropdown
      const selectedIndex = prompt(`Chọn extension để thêm vào Whitelist:\n\n${availableExtensions.map((ext, idx) => `${idx + 1}. ${ext.name}`).join('\n')}\n\nNhập số thứ tự (1-${availableExtensions.length}):`);
      if (!selectedIndex || isNaN(selectedIndex) || selectedIndex < 1 || selectedIndex > availableExtensions.length) {
        return;
      }
      const selectedExt = availableExtensions[parseInt(selectedIndex) - 1];
      if (!selectedExt || !selectedExt.id) {
        alert('⚠ Extension không hợp lệ');
        return;
      }
      console.log('[Popup] Adding', selectedExt.id, 'to whitelist');
      // LÃ†Â°u vÃƒÂ o storage
      await new Promise((resolve, reject) => {
        chrome.storage.local.set({ [`whitelist_${selectedExt.id}`]: true }, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve();
        });
      });
      // Reload whitelist (khÃƒÂ´ng await Ã„â€˜Ã¡Â»Æ’ trÃƒÂ¡nh block)
      loadWhitelist().catch(err => {
        console.error('[Popup] Error reloading whitelist:', err);
      });
      alert(`Thêm "${selectedExt.name}" vào Whitelist`);
    } catch (error) {
      console.error('[Popup] Error adding to whitelist:', error);
      alert('Lỗi khi thêm vào Whitelist: ' + (error.message || error));
    }

  });
  document.getElementById('addToBlacklist')?.addEventListener('click', async () => {
    try {
      console.log('[Popup] Adding to blacklist...');
      // LÃ¡ÂºÂ¥y danh sÃƒÂ¡ch extensions vÃ¡Â»â€ºi timeout
      const response = await Promise.race([
        chrome.runtime.sendMessage({ action: 'getAllExtensions' }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout khi lÃ¡ÂºÂ¥y danh sÃƒÂ¡ch extensions')), 10000))
      ]);
      if (!response || !response.success || !response.extensions || response.extensions.length === 0) {
        alert('Ã¢Å¡Â Ã¯Â¸Â KhÃƒÂ´ng tÃƒÂ¬m thÃ¡ÂºÂ¥y extension nÃƒÂ o Ã„â€˜Ã¡Â»Æ’ thÃƒÂªm vÃƒÂ o Blacklist');
        return;
      }
      console.log('[Popup] Got', response.extensions.length, 'extensions');
      // LÃ¡ÂºÂ¥y blacklist hiÃ¡Â»â€¡n tÃ¡ÂºÂ¡i - tÃ¡Â»â€˜i Ã†Â°u bÃ¡ÂºÂ±ng cÃƒÂ¡ch chÃ¡Â»â€° lÃ¡ÂºÂ¥y blacklist keys
      const allKeys = await new Promise((resolve) => {
        chrome.storage.local.get(null, (items) => {
          if (chrome.runtime.lastError) {
            console.error('[Popup] Error getting storage:', chrome.runtime.lastError);
            resolve([]);
            return;
          }
          resolve(Object.keys(items || {}));
        });
      });
      const currentBlacklist = new Set();
      allKeys.forEach(key => {
        if (key.startsWith('blacklist_')) {
          currentBlacklist.add(key.replace('blacklist_', ''));
        }
      });
      // LÃ¡Â»Âc extensions chÃ†Â°a cÃƒÂ³ trong blacklist
      const availableExtensions = response.extensions.filter(ext => ext && ext.id && !currentBlacklist.has(ext.id));
      if (availableExtensions.length === 0) {
        alert('Nhập extension để thêm vào Blacklist');
        return;
      }
      // TÃ¡ÂºÂ¡o dropdown
      const selectedIndex = prompt(`Chọn extension để thêm vào Blacklist:\n\n${availableExtensions.map((ext, idx) => `${idx + 1}. ${ext.name}`).join('\n')}\n\nNhập số thứ tự (1-${availableExtensions.length}):`);
      if (!selectedIndex || isNaN(selectedIndex) || selectedIndex < 1 || selectedIndex > availableExtensions.length) {
        return;
      }
      const selectedExt = availableExtensions[parseInt(selectedIndex) - 1];
      if (!selectedExt || !selectedExt.id) {
        alert('⚠ Extension không hợp lệ');
        return;
      }
      if (!confirm(`Bạn có chắc muốn thêm "${selectedExt.name}" vào Blacklist?\n\nExtension này sẽ được tắt khi được cài đặt hoặc bật.`)) {
        return;
      }
      console.log('[Popup] Adding', selectedExt.id, 'to blacklist');
      // LÃ†Â°u vÃƒÂ o storage
      await new Promise((resolve, reject) => {
        chrome.storage.local.set({ [`blacklist_${selectedExt.id}`]: true }, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve();
        });
      });
      // TÃ¡Â»Â± Ã„â€˜Ã¡Â»â„¢ng tÃ¡ÂºÂ¯t extension nÃ¡ÂºÂ¿u Ã„â€˜ang bÃ¡ÂºÂ­t
      if (selectedExt.enabled) {
        try {
          await Promise.race([
            chrome.runtime.sendMessage({
              action: 'disableExtension',
              extensionId: selectedExt.id
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
          ]);
        } catch (disableError) {
          console.error('[Popup] Error disabling blacklisted extension:', disableError);
          // KhÃƒÂ´ng block nÃ¡ÂºÂ¿u disable thÃ¡ÂºÂ¥t bÃ¡ÂºÂ¡i
        }
      }
      // Reload blacklist (khÃƒÂ´ng await Ã„â€˜Ã¡Â»Æ’ trÃƒÂ¡nh block)
      loadBlacklist().catch(err => {
        console.error('[Popup] Error reloading blacklist:', err);
      });
      alert(`Thêm "${selectedExt.name}" vào Blacklist${selectedExt.enabled ? ' và tắt extension' : ''}`);
    } catch (error) {
      console.error('[Popup] Error adding to blacklist:', error);
      alert('Ã¢ÂÅ’ LÃ¡Â»â€”i khi thÃƒÂªm vÃƒÂ o Blacklist: ' + (error.message || error));
    }

  });
  // Override displayResults to show filter bar
  const originalDisplayResults = displayResults;
  displayResults = async function(data) {
    await originalDisplayResults(data);
    if (filterBar) {
      filterBar.style.display = 'block';
    }
    if (filterBarUnscanned) {
      filterBarUnscanned.style.display = 'none';
    }
    applyFilters();

  };
  // Override loadUnscannedExtensions to show filter bar
  const originalLoadUnscannedExtensions = loadUnscannedExtensions;
  loadUnscannedExtensions = async function() {
    await originalLoadUnscannedExtensions();
    if (filterBar) {
      filterBar.style.display = 'none';
    }
    if (filterBarUnscanned) {
      filterBarUnscanned.style.display = 'block';
    }
    applyFiltersUnscanned();

  };
  /**
   * HiÃ¡Â»Æ’n thÃ¡Â»â€¹ phÃƒÂ¢n tÃƒÂ­ch chi tiÃ¡ÂºÂ¿t cÃ¡Â»Â§a extension
   */

  function handleViewAnalysis(extensionId) {
    const analysisDetails = document.getElementById(`analysis-${extensionId}`);
    const viewButton = document.querySelector(`[data-action="view-analysis"][data-extension-id="${extensionId}"]`);
    if (analysisDetails && viewButton) {
      // HiÃ¡Â»Æ’n thÃ¡Â»â€¹ phÃƒÂ¢n tÃƒÂ­ch
      analysisDetails.style.display = 'block';
      // Ã„ÂÃ¡Â»â€¢i nÃƒÂºt thÃƒÂ nh "Ã¡ÂºÂ¨n PhÃƒÂ¢n TÃƒÂ­ch"
      viewButton.innerHTML = '<i class="fas fa-eye-slash"></i> Ẩn Phân Tích';
      viewButton.setAttribute('data-action', 'hide-analysis');
      viewButton.classList.remove('view-analysis');
      viewButton.classList.add('hide-analysis');
      // Scroll Ã„â€˜Ã¡ÂºÂ¿n phÃ¡ÂºÂ§n phÃƒÂ¢n tÃƒÂ­ch
      analysisDetails.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      console.log('[Popup] Analysis shown for extension:', extensionId);
    }

  }
  /**
   * Ã¡ÂºÂ¨n phÃƒÂ¢n tÃƒÂ­ch chi tiÃ¡ÂºÂ¿t cÃ¡Â»Â§a extension
   */

  function handleHideAnalysis(extensionId) {
    const analysisDetails = document.getElementById(`analysis-${extensionId}`);
    const hideButton = document.querySelector(`[data-action="hide-analysis"][data-extension-id="${extensionId}"]`);
    if (analysisDetails && hideButton) {
      // Ã¡ÂºÂ¨n phÃƒÂ¢n tÃƒÂ­ch
      analysisDetails.style.display = 'none';
      // Ã„ÂÃ¡Â»â€¢i nÃƒÂºt thÃƒÂ nh "Xem PhÃƒÂ¢n TÃƒÂ­ch"
      hideButton.innerHTML = '<i class="fas fa-chart-line"></i> Xem Phân Tích';
      hideButton.setAttribute('data-action', 'view-analysis');
      hideButton.classList.remove('hide-analysis');
      hideButton.classList.add('view-analysis');
      console.log('[Popup] Analysis hidden for extension:', extensionId);
    }

  }
  /**
   * Xem phÃƒÂ¢n tÃƒÂ­ch tÃ¡Â»Â« unscanned list - load kÃ¡ÂºÂ¿t quÃ¡ÂºÂ£ scan vÃƒÂ  hiÃ¡Â»Æ’n thÃ¡Â»â€¹ trong modal
   */

  async function handleViewAnalysisUnscanned(extensionId) {
    try {
      console.log('[Popup] Viewing analysis for unscanned extension:', extensionId);
      // LÃ¡ÂºÂ¥y kÃ¡ÂºÂ¿t quÃ¡ÂºÂ£ scan tÃ¡Â»Â« storage
      const stored = await chrome.storage.local.get(null);
      let scanResult = null;
      // TÃƒÂ¬m trong scan_result_*
      const scanResultKey = `scan_result_${extensionId}`;
      if (stored[scanResultKey]) {
        scanResult = stored[scanResultKey];
      } else if (stored.lastScan && stored.lastScan.results) {
        // TÃƒÂ¬m trong lastScan.results
        scanResult = stored.lastScan.results.find(r => r.extension && r.extension.id === extensionId);
      } else {
        // TÃƒÂ¬m trong new_extension_*
        const newExtensionKey = `new_extension_${extensionId}`;
        if (stored[newExtensionKey]) {
          scanResult = stored[newExtensionKey];
        }
      }
      if (!scanResult) {
        alert('Ã¢Å¡Â Ã¯Â¸Â HÃƒÂ£y quÃƒÂ©t extension trÃ†Â°Ã¡Â»â€ºc khi phÃƒÂ¢n tÃƒÂ­ch');
        return;
      }
      // HiÃ¡Â»Æ’n thÃ¡Â»â€¹ phÃƒÂ¢n tÃƒÂ­ch trong modal
      showAnalysisModal(scanResult);
    } catch (error) {
      console.error('[Popup] Error viewing analysis for unscanned extension:', error);
      alert('⚠ Lỗi khi tải phân tích: ' + error.message);
    }

  }
  /**
   * HiÃ¡Â»Æ’n thÃ¡Â»â€¹ modal phÃƒÂ¢n tÃƒÂ­ch cho extension tÃ¡Â»Â« unscanned list
   */

  function showAnalysisModal(scanResult) {
    // TÃ¡ÂºÂ¡o modal element nÃ¡ÂºÂ¿u chÃ†Â°a cÃƒÂ³
    let modal = document.getElementById('analysisModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'analysisModal';
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="modal-content analysis-modal-content">
          <div class="modal-header">
            <h3>PhÃƒÂ¢n TÃƒÂ­ch Extension</h3>
            <button class="modal-close" id="closeAnalysisModal">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="modal-body" id="analysisModalBody"></div>
        </div>
      `;
      document.body.appendChild(modal);
      // Event listener cho nÃƒÂºt Ã„â€˜ÃƒÂ³ng
      document.getElementById('closeAnalysisModal').addEventListener('click', () => {
        modal.classList.remove('active');
      });
      // Ã„ÂÃƒÂ³ng khi click outside
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.remove('active');
        }
      });
    }
    // Render phÃƒÂ¢n tÃƒÂ­ch vÃƒÂ o modal
    const modalBody = document.getElementById('analysisModalBody');
    const ext = scanResult;
    const riskClass = (ext.riskLevel || 'UNKNOWN').toLowerCase();
    const riskColor = {
      'critical': '#dc2626',
      'high': '#ef4444',
      'medium': '#f59e0b',
      'low': '#10b981'
    }[riskClass] || '#64748b';
    const permissions = ext.permissions || [];
    const dangerousPerms = ['webRequestBlocking', 'debugger', 'proxy', 'cookies', 'webRequest'];
    const dangerousPermissions = permissions.filter(p => dangerousPerms.includes(p));
    const behaviors = [];
    if (ext.behaviorVector?.dom_injection) behaviors.push('DOM Injection');
    if (ext.behaviorVector?.keystroke_capture) behaviors.push('Keystroke Capture');
    if (ext.behaviorVector?.external_post) behaviors.push('External POST');
    if (ext.behaviorVector?.suspicious_domains?.length > 0) {
      behaviors.push(`Suspicious Domains (${ext.behaviorVector.suspicious_domains.length})`);
    }
    modalBody.innerHTML = `
      <div class="analysis-modal-header">
        <div class="extension-name-large">${escapeHtml(ext.extension.name)}</div>
        <div class="risk-badge-large ${riskClass}">${ext.riskLevel} - ${ext.riskScore}/100</div>
      </div>
      ${ext.breakdown ? `
        <div class="breakdown-section">
          <h4>Breakdown</h4>
          <div class="breakdown">
            <div class="breakdown-item">
              <span>Static Analysis:</span>
              <span>${ext.breakdown.staticScore} điểm</span>
            </div>
            <div class="breakdown-item">
              <span>Runtime Observation:</span>
              <span>${ext.breakdown.runtimeScore} điểm</span>
            </div>
            ${ext.breakdown.installSourceBonus > 0 ? `
              <div class="breakdown-item">
                <span>Install Source:</span>
                <span>+${ext.breakdown.installSourceBonus} điểm</span>
              </div>
            ` : ''}
          </div>
        </div>
      ` : ''}
      ${permissions.length > 0 ? `
        <div class="section">
          <h4>Permissions (${ext.permissionCount || permissions.length})</h4>
          <div class="permissions-list">
            ${permissions.map(perm => `
              <span class="permission-badge ${dangerousPermissions.includes(perm) ? 'dangerous' : ''}">
                ${escapeHtml(perm)}
              </span>
            `).join('')}
          </div>
        </div>
      ` : ''}
      ${ext.hostPermissions && ext.hostPermissions.length > 0 ? `
        <div class="section">
          <h4>Host Permissions</h4>
          <div class="permissions-list">
            ${ext.hostPermissions.map(perm => `
              <span class="permission-badge ${perm === '<all_urls>' ? 'dangerous' : ''}">
                ${escapeHtml(perm)}
              </span>
            `).join('')}
          </div>
        </div>
      ` : ''}
      ${behaviors.length > 0 ? `
        <div class="section">
          <h4>Hành Vi Phát Hiện</h4>
          <ul class="behaviors-list">
            ${behaviors.map(behavior => `
              <li class="behavior-item">${escapeHtml(behavior)}</li>
            `).join('')}
          </ul>
        </div>
      ` : ''}
      ${ext.reasons && ext.reasons.length > 0 ? `
        <div class="section">
          <h4>Lý Do Đánh Giá</h4>
          <ul class="reasons-list">
            ${ext.reasons.map(reason => `
              <li class="reason-item">${escapeHtml(reason)}</li>
            `).join('')}
          </ul>
        </div>
      ` : ''}
      ${ext.recommendations && ext.recommendations.length > 0 ? `
        <div class="section">
          <h4>Khuyến Nghị</h4>
          <div style="font-size: 0.875rem; color: ${riskColor}; font-weight: 600;">
            ${escapeHtml(typeof ext.recommendations[0] === 'string' ? ext.recommendations[0] : ext.recommendations[0].message || '')}
          </div>
        </div>
      ` : ''}
    `;
    // HiÃ¡Â»Æ’n thÃ¡Â»â€¹ modal
    modal.classList.add('active');

  }
  /**
   * Toggle hiÃ¡Â»Æ’n thÃ¡Â»â€¹/Ã¡ÂºÂ©n cÃƒÂ¡c lÃƒÂ½ do Ã„â€˜ÃƒÂ¡nh giÃƒÂ¡ cÃƒÂ²n lÃ¡ÂºÂ¡i
   */

  function handleToggleReasons(extensionId) {
    const moreReasons = document.querySelectorAll(`.reason-more-${extensionId}`);
    const toggleButton = document.querySelector(`.toggle-reasons-btn[data-extension-id="${extensionId}"]`);
    if (moreReasons.length > 0 && toggleButton) {
      const isExpanded = moreReasons[0].style.display !== 'none';
      if (isExpanded) {
        // Ã¡ÂºÂ¨n cÃƒÂ¡c lÃƒÂ½ do cÃƒÂ²n lÃ¡ÂºÂ¡i
        moreReasons.forEach(item => {
          item.style.display = 'none';
        });
        toggleButton.classList.remove('expanded');
        const count = toggleButton.getAttribute('data-count');
        toggleButton.innerHTML = `<i class="fas fa-chevron-down"></i> +${count} lý do khác...`;
      } else {
        // HiÃ¡Â»Æ’n thÃ¡Â»â€¹ cÃƒÂ¡c lÃƒÂ½ do cÃƒÂ²n lÃ¡ÂºÂ¡i
        moreReasons.forEach(item => {
          item.style.display = 'list-item';
        });
        toggleButton.classList.add('expanded');
        const count = toggleButton.getAttribute('data-count');
        toggleButton.innerHTML = `<i class="fas fa-chevron-up"></i> Ẩn ${count} lý do`;
      }
      console.log('[Popup] Toggled reasons for extension:', extensionId, isExpanded ? 'hidden' : 'shown');
    }

  }

  async function handleDisableExtension(extensionId) {
    console.log('[Popup] handleDisableExtension called for:', extensionId);
    if (!confirm('Bạn có chắc muốn tắt extension này?')) {
      console.log('[Popup] User cancelled disable');
      return;
    }
    try {
      console.log('[Popup] Sending disable message to background...');
      const response = await chrome.runtime.sendMessage({
        action: 'disableExtension',
        extensionId: extensionId
      });
      console.log('[Popup] Response from background:', response);
      if (response && response.success) {
        console.log('[Popup] Extension disabled successfully');
        // KiÃ¡Â»Æ’m tra xem Ã„â€˜ang Ã¡Â»Å¸ danh sÃƒÂ¡ch nÃƒÂ o (unscanned hay scanned)
        const isUnscannedListVisible = extensionsListUnscanned && extensionsListUnscanned.style.display !== 'none';
        const isScannedListVisible = results && results.style.display !== 'block';
        // NÃ¡ÂºÂ¿u Ã„â€˜ang hiÃ¡Â»Æ’n thÃ¡Â»â€¹ chÃ¡Â»â€° extension mÃ¡Â»â€ºi, quay vÃ¡Â»Â trÃ¡ÂºÂ¡ng thÃƒÂ¡i ban Ã„â€˜Ã¡ÂºÂ§u
        if (isShowingNewExtensionOnly) {
          console.log('[Popup] User disabled new extension, resetting to unscanned view...');
          // XÃƒÂ³a flag showOnlyNewExtension
          await chrome.storage.local.remove(['showOnlyNewExtension', 'newExtensionToShow', 'newExtensionTimestamp']);
          isShowingNewExtensionOnly = false;
          // Enable nÃƒÂºt quÃƒÂ©t vÃƒÂ  tabs
          if (scanButton) scanButton.disabled = false;
          if (tabsContainer) {
            tabsContainer.classList.remove('disabled');
            tabsContainer.querySelectorAll('.tab-button').forEach(btn => btn.disabled = false);
          }
          if (tabsContainerUnscanned) {
            tabsContainerUnscanned.classList.remove('disabled');
            tabsContainerUnscanned.querySelectorAll('.tab-button').forEach(btn => btn.disabled = false);
          }
          // Quay vÃ¡Â»Â trÃ¡ÂºÂ¡ng thÃƒÂ¡i ban Ã„â€˜Ã¡ÂºÂ§u (hiÃ¡Â»Æ’n thÃ¡Â»â€¹ danh sÃƒÂ¡ch chÃ†Â°a phÃƒÂ¢n tÃƒÂ­ch)
          await resetToUnscannedView();
        } else if (isUnscannedListVisible || (!isScannedListVisible && !results)) {
          // NÃ¡ÂºÂ¿u Ã„â€˜ang Ã¡Â»Å¸ danh sÃƒÂ¡ch unscanned (chÃ†Â°a scan), reload lÃ¡ÂºÂ¡i danh sÃƒÂ¡ch unscanned
          console.log('[Popup] Reloading unscanned list after disable...');
          await loadUnscannedExtensions();
      } else {
          // NÃ¡ÂºÂ¿u Ã„â€˜ang Ã¡Â»Å¸ danh sÃƒÂ¡ch scanned (Ã„â€˜ÃƒÂ£ scan), refresh lÃ¡ÂºÂ¡i danh sÃƒÂ¡ch scanned
          console.log('[Popup] Refreshing scanned list after disable...');
          await scanExtensions();
        }
        alert('Extension đã được tắt!');
      } else {
        // XÃ¡Â»Â­ lÃƒÂ½ error message Ã„â€˜ÃƒÂºng cÃƒÂ¡ch
        let errorMsg = 'Unknown error';
        if (response && response.error) {
          if (typeof response.error === 'string') {
            errorMsg = response.error;
          } else if (response.error.message) {
            errorMsg = response.error.message;
          } else {
            errorMsg = JSON.stringify(response.error);
          }
        }
        alert('Ã¢ÂÅ’ LÃ¡Â»â€”i: ' + errorMsg);
        console.error('[Popup] Disable extension error:', response);
      }
    } catch (err) {
      console.error('[Popup] Error disabling extension:', err);
      const errorMsg = err?.message || err?.toString() || 'Lỗi không xác định';
      alert('⚠ Lỗi khi tắt extension: ' + errorMsg);
      // Ã„ÂÃ¡ÂºÂ£m bÃ¡ÂºÂ£o UI vÃ¡ÂºÂ«n hoÃ¡ÂºÂ¡t Ã„â€˜Ã¡Â»â„¢ng sau khi cÃƒÂ³ lÃ¡Â»â€”i
      scanButton.disabled = false;
      if (tabsContainer) {
        tabsContainer.classList.remove('disabled');
        tabsContainer.querySelectorAll('.tab-button').forEach(btn => btn.disabled = false);
      }
      if (tabsContainerUnscanned) {
        tabsContainerUnscanned.classList.remove('disabled');
        tabsContainerUnscanned.querySelectorAll('.tab-button').forEach(btn => btn.disabled = false);
      }
    }

  }

  async function handleEnableExtension(extensionId) {
    console.log('[Popup] handleEnableExtension called for:', extensionId);
    if (!confirm('Bạn có chắc muốn bật extension này?')) {
      console.log('[Popup] User cancelled enable');
      return;
    }
    try {
      console.log('[Popup] Sending enable message to background...');
      const response = await chrome.runtime.sendMessage({
        action: 'enableExtension',
        extensionId: extensionId
      });
      console.log('[Popup] Response from background:', response);
      if (response && response.success) {
        // KiÃ¡Â»Æ’m tra xem Ã„â€˜ang Ã¡Â»Å¸ danh sÃƒÂ¡ch nÃƒÂ o (unscanned hay scanned)
        const isUnscannedListVisible = extensionsListUnscanned && extensionsListUnscanned.style.display !== 'none';
        const isScannedListVisible = results && results.style.display !== 'block';
        // NÃ¡ÂºÂ¿u Ã„â€˜ang hiÃ¡Â»Æ’n thÃ¡Â»â€¹ chÃ¡Â»â€° extension mÃ¡Â»â€ºi, quay vÃ¡Â»Â trÃ¡ÂºÂ¡ng thÃƒÂ¡i ban Ã„â€˜Ã¡ÂºÂ§u
        if (isShowingNewExtensionOnly) {
          console.log('[Popup] User enabled new extension, resetting to unscanned view...');
          // XÃƒÂ³a flag showOnlyNewExtension
          await chrome.storage.local.remove(['showOnlyNewExtension', 'newExtensionToShow', 'newExtensionTimestamp']);
          isShowingNewExtensionOnly = false;
          // Enable nÃƒÂºt quÃƒÂ©t vÃƒÂ  tabs
          if (scanButton) scanButton.disabled = false;
          if (tabsContainer) {
            tabsContainer.classList.remove('disabled');
            tabsContainer.querySelectorAll('.tab-button').forEach(btn => btn.disabled = false);
          }
          if (tabsContainerUnscanned) {
            tabsContainerUnscanned.classList.remove('disabled');
            tabsContainerUnscanned.querySelectorAll('.tab-button').forEach(btn => btn.disabled = false);
          }
          // Quay vÃ¡Â»Â trÃ¡ÂºÂ¡ng thÃƒÂ¡i ban Ã„â€˜Ã¡ÂºÂ§u (hiÃ¡Â»Æ’n thÃ¡Â»â€¹ danh sÃƒÂ¡ch chÃ†Â°a phÃƒÂ¢n tÃƒÂ­ch)
          await resetToUnscannedView();
        } else if (isUnscannedListVisible || (!isScannedListVisible && !results)) {
          // NÃ¡ÂºÂ¿u Ã„â€˜ang Ã¡Â»Å¸ danh sÃƒÂ¡ch unscanned (chÃ†Â°a scan), reload lÃ¡ÂºÂ¡i danh sÃƒÂ¡ch unscanned
          console.log('[Popup] Reloading unscanned list after enable...');
          await loadUnscannedExtensions();
        } else {
          // NÃ¡ÂºÂ¿u Ã„â€˜ang Ã¡Â»Å¸ danh sÃƒÂ¡ch scanned (Ã„â€˜ÃƒÂ£ scan), refresh lÃ¡ÂºÂ¡i danh sÃƒÂ¡ch scanned
          console.log('[Popup] Refreshing scanned list after enable...');
          // Ã„ÂÃƒÂ¡nh dÃ¡ÂºÂ¥u extension lÃƒÂ  "Ã„â€˜ÃƒÂ£ bÃ¡ÂºÂ­t" (xÃƒÂ³a data-disabled)
          const extensionElement = document.querySelector(`[data-extension-id="${extensionId}"]`);
          if (extensionElement) {
            extensionElement.removeAttribute('data-disabled');
          }
          await scanExtensions();
        }
        alert('✓ Extension đã được bật');
      } else {
        // XÃ¡Â»Â­ lÃƒÂ½ error message Ã„â€˜ÃƒÂºng cÃƒÂ¡ch
        let errorMsg = 'Unknown error';
        if (response && response.error) {
          if (typeof response.error === 'string') {
            errorMsg = response.error;
          } else if (response.error.message) {
            errorMsg = response.error.message;
      } else {
            errorMsg = JSON.stringify(response.error);
          }
        }
        alert('Ã¢ÂÅ’ LÃ¡Â»â€”i: ' + errorMsg);
        console.error('[Popup] Enable extension error:', response);
      }
    } catch (err) {
      console.error('[Popup] Error enabling extension:', err);
      const errorMsg = err?.message || err?.toString() || 'Lỗi không xác định';
      alert('⚠ Lỗi khi bật extension: ' + errorMsg);
      // Ã„ÂÃ¡ÂºÂ£m bÃ¡ÂºÂ£o UI vÃ¡ÂºÂ«n hoÃ¡ÂºÂ¡t Ã„â€˜Ã¡Â»â„¢ng sau khi cÃƒÂ³ lÃ¡Â»â€”i
      scanButton.disabled = false;
      if (tabsContainer) {
        tabsContainer.classList.remove('disabled');
        tabsContainer.querySelectorAll('.tab-button').forEach(btn => btn.disabled = false);
      }
      if (tabsContainerUnscanned) {
        tabsContainerUnscanned.classList.remove('disabled');
        tabsContainerUnscanned.querySelectorAll('.tab-button').forEach(btn => btn.disabled = false);
      }
    }

  }

  async function handleUninstallExtension(extensionId) {
    console.log('[Popup] handleUninstallExtension called for:', extensionId);
    if (!confirm('⚠️ Bạn có chắc muốn GỠ CÀI ĐẶT extension này?\n\nHành động này không thể hoàn tác.')) {
      console.log('[Popup] User cancelled uninstall');
      return;
    }
    try {
      console.log('[Popup] Sending uninstall message to background...');
      const response = await chrome.runtime.sendMessage({
        action: 'uninstallExtension',
        extensionId: extensionId
      });
      console.log('[Popup] Response from background:', response);
      if (response && response.success) {
        console.log('[Popup] Extension uninstalled, resetting to unscanned view...');
        // XÃƒÂ³a flag showOnlyNewExtension nÃ¡ÂºÂ¿u cÃƒÂ³
        await chrome.storage.local.remove(['showOnlyNewExtension', 'newExtensionToShow', 'newExtensionTimestamp']);
        isShowingNewExtensionOnly = false;
        // Enable nÃƒÂºt quÃƒÂ©t vÃƒÂ  tabs
        scanButton.disabled = false;
        if (tabsContainer) {
          tabsContainer.classList.remove('disabled');
          tabsContainer.querySelectorAll('.tab-button').forEach(btn => btn.disabled = false);
        }
        if (tabsContainerUnscanned) {
          tabsContainerUnscanned.classList.remove('disabled');
          tabsContainerUnscanned.querySelectorAll('.tab-button').forEach(btn => btn.disabled = false);
        }
        // LuÃƒÂ´n quay vÃ¡Â»Â trÃ¡ÂºÂ¡ng thÃƒÂ¡i ban Ã„â€˜Ã¡ÂºÂ§u (hiÃ¡Â»Æ’n thÃ¡Â»â€¹ danh sÃƒÂ¡ch chÃ†Â°a phÃƒÂ¢n tÃƒÂ­ch)
        await resetToUnscannedView();
        alert('Ã¢Å“â€¦ Extension Ã„â€˜ÃƒÂ£ Ã„â€˜Ã†Â°Ã¡Â»Â£c gÃ¡Â»Â¡ cÃƒÂ i Ã„â€˜Ã¡ÂºÂ·t');
      } else {
        // XÃ¡Â»Â­ lÃƒÂ½ error message Ã„â€˜ÃƒÂºng cÃƒÂ¡ch
        let errorMsg = 'Unknown error';
        if (response && response.error) {
          if (typeof response.error === 'string') {
            errorMsg = response.error;
          } else if (response.error.message) {
            errorMsg = response.error.message;
      } else {
            errorMsg = JSON.stringify(response.error);
          }
        }
        alert('Ã¢ÂÅ’ LÃ¡Â»â€”i: ' + errorMsg);
        console.error('[Popup] Uninstall extension error:', response);
      }
    } catch (err) {
      console.error('[Popup] Error uninstalling extension:', err);
      const errorMsg = err?.message || err?.toString() || 'Lỗi không xác định';
      alert('⚠ Lỗi khi gỡ cài đặt extension: ' + errorMsg);
      // Ã„ÂÃ¡ÂºÂ£m bÃ¡ÂºÂ£o UI vÃ¡ÂºÂ«n hoÃ¡ÂºÂ¡t Ã„â€˜Ã¡Â»â„¢ng sau khi cÃƒÂ³ lÃ¡Â»â€”i
      scanButton.disabled = false;
      if (tabsContainer) {
        tabsContainer.classList.remove('disabled');
        tabsContainer.querySelectorAll('.tab-button').forEach(btn => btn.disabled = false);
      }
      if (tabsContainerUnscanned) {
        tabsContainerUnscanned.classList.remove('disabled');
        tabsContainerUnscanned.querySelectorAll('.tab-button').forEach(btn => btn.disabled = false);
      }
    }

  }

  async function handleKeepExtension(extensionId) {
    console.log('[Popup] handleKeepExtension called for:', extensionId);
    if (!confirm('Bạn có muốn giữ extension này và bỏ qua cảnh báo?')) {
      console.log('[Popup] User cancelled keep');
      return;
    }
    try {
      console.log('[Popup] Sending keep message to background...');
      const response = await chrome.runtime.sendMessage({
        action: 'keepExtension',
        extensionId: extensionId
      });
      console.log('[Popup] Response from background:', response);
      if (response && response.success) {
        console.log('[Popup] Extension kept, resetting to unscanned view...');
        // XÃƒÂ³a flag showOnlyNewExtension nÃ¡ÂºÂ¿u cÃƒÂ³
        await chrome.storage.local.remove(['showOnlyNewExtension', 'newExtensionToShow', 'newExtensionTimestamp']);
        isShowingNewExtensionOnly = false;
        // Enable nÃƒÂºt quÃƒÂ©t vÃƒÂ  tabs
        scanButton.disabled = false;
        if (tabsContainer) {
          tabsContainer.classList.remove('disabled');
          tabsContainer.querySelectorAll('.tab-button').forEach(btn => btn.disabled = false);
        }
        if (tabsContainerUnscanned) {
          tabsContainerUnscanned.classList.remove('disabled');
          tabsContainerUnscanned.querySelectorAll('.tab-button').forEach(btn => btn.disabled = false);
        }
        // LuÃƒÂ´n quay vÃ¡Â»Â trÃ¡ÂºÂ¡ng thÃƒÂ¡i ban Ã„â€˜Ã¡ÂºÂ§u (hiÃ¡Â»Æ’n thÃ¡Â»â€¹ danh sÃƒÂ¡ch chÃ†Â°a phÃƒÂ¢n tÃƒÂ­ch)
        await resetToUnscannedView();
        alert('Extension đã được giữ!');
      } else {
        const errorMsg = response?.error || 'Unknown error';
        alert('⚠ Lỗi: ' + errorMsg);
        console.error('[Popup] Keep extension error:', response);
      }
    } catch (err) {
      console.error('[Popup] Error keeping extension:', err);
      alert('⚠ Lỗi khi đánh dấu extension: ' + err.message);
    }

  }

});