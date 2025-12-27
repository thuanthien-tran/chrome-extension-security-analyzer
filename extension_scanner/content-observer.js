/**
 * Runtime Observation Content Script
 * Quan sát hành vi của extensions trên trang web
 * 
 * ⚠️ QUAN TRỌNG: Không đọc code extension khác
 * → Chỉ quan sát hành vi trên DOM và network
 */

(function() {
  'use strict';
  
  // ============================================
  // CONFIGURATION
  // ============================================
  
  const OBSERVATION_WINDOW = 30000; // 30 seconds
  const CHECK_INTERVAL = 1000; // Check every 1 second
  
  // ============================================
  // STATE
  // ============================================
  
  let observations = {
    dom_injection: false,
    form_hijacking: false,
    keystroke_capture: false,
    external_post: false,
    fetch_domains: [],
    xhr_domains: [],
    frequency: 'low',
    startTime: Date.now()
  };
  
  // Track để tránh duplicate
  const seenDomains = new Set();
  const seenScripts = new Set();
  
  // ============================================
  // DOM INJECTION DETECTION
  // ============================================
  
  /**
   * Phát hiện DOM injection
   * Kiểm tra script tags và suspicious elements được inject
   */
  function detectDOMInjection() {
    // Kiểm tra script tags được inject
    const scripts = document.querySelectorAll('script[src], script:not([src])');
    scripts.forEach(script => {
      const src = script.getAttribute('src');
      const content = script.textContent || script.innerHTML;
      
      // Phát hiện script từ domain khác (không phải same-origin)
      if (src && !src.startsWith('/') && !src.startsWith(window.location.origin)) {
        if (!seenScripts.has(src)) {
          seenScripts.add(src);
          observations.dom_injection = true;
          console.log('[Analyzer] Detected external script injection:', src);
        }
      }
      
      // Phát hiện suspicious patterns trong inline script
      const suspiciousPatterns = [
        /document\.cookie/i,
        /localStorage/i,
        /sessionStorage/i,
        /XMLHttpRequest/i,
        /fetch\(/i,
        /eval\(/i,
        /Function\(/i
      ];
      
      if (content && suspiciousPatterns.some(pattern => pattern.test(content))) {
        observations.dom_injection = true;
        console.log('[Analyzer] Detected suspicious inline script');
      }
    });
    
    // Kiểm tra iframe được inject
    const iframes = document.querySelectorAll('iframe[src]');
    iframes.forEach(iframe => {
      const src = iframe.getAttribute('src');
      if (src && !src.startsWith(window.location.origin) && !seenScripts.has(src)) {
        seenScripts.add(src);
        observations.dom_injection = true;
        console.log('[Analyzer] Detected iframe injection:', src);
      }
    });
  }
  
  /**
   * Phát hiện Form Hijacking
   * Kiểm tra form action bị thay đổi hoặc form được inject
   */
  function detectFormHijacking() {
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
      const action = form.getAttribute('action');
      const originalAction = form.getAttribute('data-original-action');
      
      // Lưu original action lần đầu
      if (!originalAction && action) {
        form.setAttribute('data-original-action', action);
      }
      
      // Phát hiện form action bị thay đổi
      if (originalAction && action !== originalAction) {
        observations.form_hijacking = true;
        observations.dom_injection = true; // Form hijacking cũng là DOM injection
        console.log('[Analyzer] ⚠️ CRITICAL: Detected form hijacking!', {
          original: originalAction,
          current: action,
          form: form
        });
      }
      
      // Phát hiện form action trỏ đến domain khác hoặc localhost/malicious
      if (action) {
        try {
          const urlObj = new URL(action, window.location.origin);
          const isExternal = urlObj.hostname !== window.location.hostname;
          const isMalicious = urlObj.hostname === '127.0.0.1' || 
                             urlObj.hostname === 'localhost' ||
                             action.includes('malicious') ||
                             action.includes('evil') ||
                             action.includes('steal');
          
          if (isExternal || isMalicious) {
            observations.form_hijacking = true;
            observations.dom_injection = true;
            console.log('[Analyzer] ⚠️ CRITICAL: Form action points to suspicious location:', action);
          }
        } catch (e) {
          // Invalid URL, check if it's a relative path that looks suspicious
          if (action.includes('malicious') || action.includes('evil') || action.includes('steal')) {
            observations.form_hijacking = true;
            observations.dom_injection = true;
            console.log('[Analyzer] ⚠️ CRITICAL: Suspicious form action:', action);
          }
        }
      }
    });
    
    // Monitor form action changes using MutationObserver
    const formObserver = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'action') {
          const form = mutation.target;
          const action = form.getAttribute('action');
          const originalAction = form.getAttribute('data-original-action');
          
          if (originalAction && action !== originalAction) {
            observations.form_hijacking = true;
            observations.dom_injection = true;
            console.log('[Analyzer] ⚠️ CRITICAL: Form action changed dynamically!', {
              original: originalAction,
              new: action
            });
          }
        }
      });
    });
    
    // Observe all forms for action attribute changes
    forms.forEach(form => {
      formObserver.observe(form, {
        attributes: true,
        attributeFilter: ['action']
      });
    });
  }
  
  // ============================================
  // KEYSTROKE CAPTURE DETECTION
  // ============================================
  
  /**
   * Phát hiện keystroke capture
   * Monitor keydown/keypress/keyup events
   */
  let keystrokeCount = 0;
  let keystrokeStartTime = Date.now();
  
  function detectKeystrokeCapture() {
    // Intercept keydown events
    document.addEventListener('keydown', function(event) {
      keystrokeCount++;
      
      // Nếu có quá nhiều keydown events trong thời gian ngắn
      const timeDiff = Date.now() - keystrokeStartTime;
      if (keystrokeCount > 10 && timeDiff < 5000) {
        observations.keystroke_capture = true;
        observations.frequency = 'high';
        console.log('[Analyzer] Detected keystroke capture pattern');
      }
      
      // Reset counter sau 5 giây
      if (timeDiff > 5000) {
        keystrokeCount = 0;
        keystrokeStartTime = Date.now();
      }
    }, true); // Use capture phase
    
    // Intercept input events
    document.addEventListener('input', function(event) {
      if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
        // Phát hiện nếu có listener trên input field
        const hasListeners = event.target.getAttribute('data-analyzer-observed');
        if (!hasListeners) {
          event.target.setAttribute('data-analyzer-observed', 'true');
          observations.keystroke_capture = true;
          console.log('[Analyzer] Detected input field monitoring');
        }
      }
    }, true);
  }
  
  // ============================================
  // NETWORK MONITORING
  // ============================================
  
  /**
   * Intercept fetch requests
   */
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    const url = args[0];
    
    if (typeof url === 'string') {
      try {
        const urlObj = new URL(url, window.location.origin);
        const domain = urlObj.hostname;
        
        // Chỉ track external domains
        if (domain !== window.location.hostname && !seenDomains.has(domain)) {
          seenDomains.add(domain);
          observations.fetch_domains.push(domain);
          observations.external_post = true;
          console.log('[Analyzer] Detected fetch to external domain:', domain);
        }
      } catch (e) {
        // Invalid URL, ignore
      }
    }
    
    return originalFetch.apply(this, args);
  };
  
  /**
   * Intercept XMLHttpRequest
   */
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;
  
  XMLHttpRequest.prototype.open = function(method, url, ...args) {
    this._analyzerUrl = url;
    this._analyzerMethod = method;
    return originalXHROpen.apply(this, [method, url, ...args]);
  };
  
  XMLHttpRequest.prototype.send = function(...args) {
    if (this._analyzerUrl) {
      try {
        const urlObj = new URL(this._analyzerUrl, window.location.origin);
        const domain = urlObj.hostname;
        
        // Chỉ track external domains
        if (domain !== window.location.hostname && !seenDomains.has(domain)) {
          seenDomains.add(domain);
          observations.xhr_domains.push(domain);
          
          // POST request = data exfiltration
          if (this._analyzerMethod === 'POST') {
            observations.external_post = true;
            console.log('[Analyzer] Detected POST to external domain:', domain);
          }
        }
      } catch (e) {
        // Invalid URL, ignore
      }
    }
    
    return originalXHRSend.apply(this, args);
  };
  
  // ============================================
  // FREQUENCY CALCULATION
  // ============================================
  
  function calculateFrequency() {
    const totalRequests = observations.fetch_domains.length + observations.xhr_domains.length;
    const timeDiff = (Date.now() - observations.startTime) / 1000; // seconds
    
    if (timeDiff > 0) {
      const requestsPerSecond = totalRequests / timeDiff;
      
      if (requestsPerSecond > 1) {
        observations.frequency = 'high';
      } else if (requestsPerSecond > 0.5) {
        observations.frequency = 'medium';
      } else {
        observations.frequency = 'low';
      }
    }
  }
  
  // ============================================
  // SAVE OBSERVATIONS
  // ============================================
  
  /**
   * Lưu observations vào storage
   * Gửi về background script để correlate với extension ID
   */
  async function saveObservations() {
    calculateFrequency();
    
    // Lấy extension ID đang active trên trang này
    // Note: Không thể biết chính xác extension nào inject, nên lưu cho tất cả
    // Background script sẽ correlate dựa trên permissions
    
    // Gửi message về background
    try {
      chrome.runtime.sendMessage({
        action: 'saveRuntimeObservations',
        observations: observations,
        url: window.location.href,
        timestamp: Date.now()
      });
    } catch (e) {
      // Extension context invalidated, ignore
    }
  }
  
  // ============================================
  // INITIALIZATION
  // ============================================
  
  function init() {
    console.log('[Analyzer] Runtime Observer initialized on:', window.location.href);
    
    // Start detection
    detectDOMInjection();
    detectFormHijacking();
    detectKeystrokeCapture();
    
    // Periodic check
    const checkInterval = setInterval(() => {
      detectDOMInjection();
      detectFormHijacking();
      calculateFrequency();
    }, CHECK_INTERVAL);
    
    // Save observations periodically
    const saveInterval = setInterval(() => {
      saveObservations();
    }, 5000); // Every 5 seconds
    
    // Final save before page unload
    window.addEventListener('beforeunload', () => {
      saveObservations();
    });
    
    // Cleanup after observation window
    setTimeout(() => {
      clearInterval(checkInterval);
      clearInterval(saveInterval);
      saveObservations(); // Final save
    }, OBSERVATION_WINDOW);
  }
  
  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
})();

