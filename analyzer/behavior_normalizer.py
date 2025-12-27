#!/usr/bin/env python3
"""
Behavior Normalization Layer
Validates and normalizes behaviors from MongoDB before analysis
Google Standard - Anti-noise, Context Validation
"""

import re
import logging
from typing import Dict, Any, List, Optional, Set
from urllib.parse import urlparse
from datetime import datetime, timedelta

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class BehaviorNormalizer:
    """Normalize and validate behaviors before analysis"""
    
    # Valid URL patterns
    VALID_URL_PATTERNS = [
        r'^https?://',
        r'^chrome-extension://',
        r'^moz-extension://',
        r'^data:',
        r'^blob:'
    ]
    
    # Legitimate domains (allowlist for false positive reduction)
    LEGITIMATE_DOMAINS = [
        'google.com', 'googleapis.com', 'gstatic.com', 'googleusercontent.com',
        'youtube.com', 'youtu.be', 'ytimg.com',
        'gmail.com', 'googlemail.com',
        'facebook.com', 'fbcdn.net',
        'github.com', 'githubusercontent.com',
        'microsoft.com', 'live.com', 'office.com',
        'amazon.com', 'amazonaws.com',
        'cloudflare.com', 'cloudflare.net',
        'lastpass.com', 'bitwarden.com', '1password.com',
        'grammarly.com', 'grammarly.io'
    ]
    
    # Password manager patterns (legitimate autofill)
    PASSWORD_MANAGER_PATTERNS = [
        'autofill', 'password-manager', 'lastpass', 'bitwarden', 
        '1password', 'dashlane', 'keeper', 'nordpass'
    ]
    
    # Suspicious payload keys (indicators of sensitive data)
    SENSITIVE_KEYS = [
        'token', 'cookie', 'session', 'password', 'passwd', 'pwd',
        'credit_card', 'creditcard', 'cc_number', 'cvv', 'ssn',
        'api_key', 'apikey', 'secret', 'auth', 'authorization',
        'private_key', 'privatekey', 'access_token', 'refresh_token'
    ]
    
    # Context validation rules
    CONTEXT_RULES = {
        'KEYLOGGING': {
            'required_context': ['keydown', 'keypress', 'input', 'keyup'],
            'invalid_context': ['mouse', 'scroll', 'resize'],
            'min_data_fields': 1
        },
        'FORM_DATA_CAPTURE': {
            'required_context': ['form', 'input', 'submit'],
            'invalid_context': [],
            'min_data_fields': 1
        },
        'COOKIE_ACCESS': {
            'required_context': ['cookie', 'document.cookie', 'chrome.cookies'],
            'invalid_context': [],
            'min_data_fields': 1
        },
        'DATA_EXFILTRATION': {
            'required_context': ['fetch', 'xhr', 'send', 'post', 'beacon'],
            'invalid_context': [],
            'min_data_fields': 2  # Must have destination + payload
        }
    }
    
    def __init__(self):
        """Initialize behavior normalizer"""
        self.compiled_url_patterns = [re.compile(pattern) for pattern in self.VALID_URL_PATTERNS]
    
    def normalize_behaviors(self, behaviors: List[Dict], static_analysis: Optional[Dict] = None) -> List[Dict]:
        """
        Normalize and validate behaviors (Google Standard - Enhanced with noise filtering)
        
        Args:
            behaviors: Raw behaviors from MongoDB
            static_analysis: Optional static analysis results for validation
            
        Returns:
            List of validated and normalized behaviors (noise filtered)
        """
        if not behaviors:
            return []
        
        # Step 1: Filter noise logs (spam, natural events)
        filtered = self._filter_noise_logs(behaviors)
        logger.info(f"Noise filter: {len(filtered)}/{len(behaviors)} behaviors passed")
        
        # Step 2: Deduplicate similar behaviors (same type, same data within 1 second)
        deduplicated = self._deduplicate_behaviors(filtered)
        logger.info(f"Deduplication: {len(deduplicated)}/{len(filtered)} unique behaviors")
        
        # Step 3: Validate and normalize
        normalized = []
        for behavior in deduplicated:
            validated = self._validate_behavior(behavior, static_analysis)
            if validated:
                normalized.append(validated)
            else:
                logger.debug(f"Behavior filtered out: {behavior.get('type', 'UNKNOWN')}")
        
        logger.info(f"Normalized {len(normalized)}/{len(behaviors)} behaviors (filtered {len(behaviors) - len(normalized)} invalid/noise)")
        return normalized
    
    def _validate_behavior(self, behavior: Dict, static_analysis: Optional[Dict] = None) -> Optional[Dict]:
        """
        Validate a single behavior
        
        Returns:
            Validated behavior dict or None if invalid
        """
        behavior_type = behavior.get('type', '')
        if not behavior_type:
            return None
        
        # 0. Check if behavior originates from extension (not website)
        if not self._is_extension_origin(behavior):
            # If behavior doesn't come from extension, it might be website noise
            # But we still validate it if it matches static analysis patterns
            if not static_analysis or not self._check_static_context(behavior_type, static_analysis):
                logger.debug(f"Behavior {behavior_type} not from extension and no static support - likely website noise")
                return None
        
        # 1. Validate URL (if present) and check against dangerous/legitimate hosts
        data = behavior.get('data', {})
        url = data.get('url') or data.get('destination') or data.get('endpoint')
        if url:
            if not self._validate_url(url):
                logger.debug(f"Invalid URL in behavior {behavior_type}: {url}")
                return None
            
            # Check if URL is to legitimate domain (reduce false positives)
            if self._is_legitimate_domain(url):
                # If behavior goes to legitimate domain, check if it's password manager pattern
                if self._is_password_manager_pattern(behavior):
                    logger.debug(f"Behavior {behavior_type} to legitimate domain with password manager pattern - likely legitimate")
                    # Still include but mark as low risk
                    behavior['_low_risk'] = True
                else:
                    # For other behaviors to legitimate domains, be more strict
                    if behavior_type in ['KEYLOGGING', 'FORM_DATA_CAPTURE']:
                        # These behaviors to legitimate domains might be false positives
                        logger.debug(f"Behavior {behavior_type} to legitimate domain - might be false positive")
                        # Only include if static analysis supports it
                        if not static_analysis or not self._check_static_context(behavior_type, static_analysis):
                            return None
            
            # Check if URL is to dangerous host (if static analysis available)
            if static_analysis and 'dangerous_hosts' in static_analysis:
                dangerous_hosts = static_analysis.get('dangerous_hosts', [])
                if dangerous_hosts:
                    from urllib.parse import urlparse
                    try:
                        parsed = urlparse(url if url.startswith('http') else f'http://{url}')
                        domain = parsed.netloc.lower()
                        # If behavior goes to dangerous host, it's more likely valid
                        if any(dh.lower() in domain for dh in dangerous_hosts):
                            # Mark as high confidence
                            behavior['_high_confidence'] = True
                    except:
                        pass
        
        # 2. Validate payload (if present)
        payload = data.get('payload') or data.get('data') or data.get('value')
        if payload and not self._validate_payload(payload, behavior_type):
            logger.debug(f"Invalid payload in behavior {behavior_type}")
            return None
        
        # 3. Validate context (including static analysis)
        if not self._validate_context(behavior, static_analysis):
            logger.debug(f"Invalid context for behavior {behavior_type}")
            return None
        
        # 4. Check if behavior requires risky permissions (if static analysis available)
        if static_analysis and 'risky_permissions' in static_analysis:
            risky_perms = static_analysis.get('risky_permissions', [])
            if risky_perms:
                # If behavior type matches risky permission context, mark as validated
                if behavior_type == 'COOKIE_ACCESS' and any('cookie' in p.lower() for p in risky_perms):
                    behavior['_validated'] = True
                elif behavior_type == 'DATA_EXFILTRATION' and any('webRequest' in p.lower() or 'host_permissions' in str(risky_perms).lower() for p in risky_perms):
                    behavior['_validated'] = True
        
        # 5. Normalize behavior
        normalized = self._normalize_behavior(behavior)
        
        return normalized
    
    def _validate_url(self, url: str) -> bool:
        """Validate URL format"""
        if not isinstance(url, str):
            return False
        
        # Check if matches valid patterns
        for pattern in self.compiled_url_patterns:
            if pattern.match(url):
                try:
                    parsed = urlparse(url)
                    # Must have scheme and netloc (or valid data/blob)
                    if parsed.scheme in ['data', 'blob']:
                        return True
                    if parsed.scheme and parsed.netloc:
                        return True
                except:
                    pass
        
        return False
    
    def _validate_payload(self, payload: Any, behavior_type: str) -> bool:
        """Validate payload content"""
        if payload is None:
            return True  # Payload is optional for some behaviors
        
        # Convert to string for analysis
        if isinstance(payload, dict):
            payload_str = str(payload).lower()
        elif isinstance(payload, (list, tuple)):
            payload_str = str(payload).lower()
        else:
            payload_str = str(payload).lower()
        
        # Check for suspicious patterns
        if behavior_type in ['DATA_EXFILTRATION', 'KEYLOGGING', 'FORM_DATA_CAPTURE']:
            # These behaviors should have meaningful payload
            if len(payload_str) < 3:
                return False
            
            # Check for sensitive data indicators
            has_sensitive = any(key in payload_str for key in self.SENSITIVE_KEYS)
            if has_sensitive:
                return True  # Likely valid
        
        return True
    
    def _validate_context(self, behavior: Dict, static_analysis: Optional[Dict] = None) -> bool:
        """Validate behavior context"""
        behavior_type = behavior.get('type', '')
        data = behavior.get('data', {})
        
        # Get context rules for this behavior type
        rules = self.CONTEXT_RULES.get(behavior_type)
        if not rules:
            return True  # No specific rules, assume valid
        
        # Check required context
        required_context = rules.get('required_context', [])
        if required_context:
            context_str = str(data).lower()
            has_required = any(ctx in context_str for ctx in required_context)
            if not has_required:
                # Check static analysis for code patterns
                if static_analysis:
                    if not self._check_static_context(behavior_type, static_analysis):
                        return False
                else:
                    return False
        
        # Check invalid context
        invalid_context = rules.get('invalid_context', [])
        if invalid_context:
            context_str = str(data).lower()
            has_invalid = any(ctx in context_str for ctx in invalid_context)
            if has_invalid:
                return False
        
        # Check minimum data fields
        min_fields = rules.get('min_data_fields', 0)
        if min_fields > 0:
            data_keys = len([k for k in data.keys() if data.get(k) is not None])
            if data_keys < min_fields:
                return False
        
        return True
    
    def _check_static_context(self, behavior_type: str, static_analysis: Dict) -> bool:
        """Check if behavior is supported by static analysis"""
        # New format: static_analysis contains risky_permissions, risky_apis, dangerous_hosts, code_patterns
        if 'code_patterns' in static_analysis:
            # Check if behavior type matches code patterns
            code_patterns = static_analysis.get('code_patterns', [])
            if behavior_type in code_patterns:
                return True
        
        # Legacy format: check js_code_analysis
        js_analysis = static_analysis.get('js_code_analysis', {})
        if not js_analysis:
            js_analysis = static_analysis.get('hybrid_analysis', {}).get('js_code_analysis', {})
        
        if js_analysis:
            files = js_analysis.get('files', [])
            for file_result in files:
                code = file_result.get('code', '')
                if not code:
                    continue
                
                # Check for matching patterns
                if behavior_type == 'KEYLOGGING':
                    if 'keydown' in code.lower() or 'keypress' in code.lower() or 'addEventListener' in code:
                        return True
                elif behavior_type == 'FORM_DATA_CAPTURE':
                    if 'form' in code.lower() or 'input' in code.lower() or 'submit' in code.lower():
                        return True
                elif behavior_type == 'COOKIE_ACCESS':
                    if 'cookie' in code.lower() or 'chrome.cookies' in code.lower():
                        return True
                elif behavior_type == 'DATA_EXFILTRATION':
                    if 'fetch' in code.lower() or 'xhr' in code.lower() or 'send' in code.lower():
                        return True
        
        return False
    
    def _normalize_behavior(self, behavior: Dict) -> Dict:
        """Normalize behavior structure"""
        normalized = behavior.copy()
        
        # Ensure required fields
        if 'timestamp' not in normalized:
            normalized['timestamp'] = datetime.utcnow()
        elif isinstance(normalized['timestamp'], str):
            try:
                normalized['timestamp'] = datetime.fromisoformat(normalized['timestamp'].replace('Z', '+00:00'))
            except:
                normalized['timestamp'] = datetime.utcnow()
        
        # Normalize severity
        severity = normalized.get('severity', 'LOW')
        if severity not in ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']:
            # Map based on type
            behavior_type = normalized.get('type', '')
            severity = self._infer_severity(behavior_type)
            normalized['severity'] = severity
        
        # Normalize data structure
        if 'data' not in normalized:
            normalized['data'] = {}
        
        return normalized
    
    def _filter_noise_logs(self, behaviors: List[Dict]) -> List[Dict]:
        """
        Filter noise logs (spam, natural events, non-extension events)
        Google Standard: Only count behaviors that are clearly extension-related
        """
        filtered = []
        
        # Noise patterns (behaviors that are likely natural browser events)
        NOISE_PATTERNS = [
            # Natural browser events
            'MOUSE_MOVE', 'SCROLL', 'RESIZE', 'FOCUS', 'BLUR',
            # Low-risk events that occur naturally
            'TAB_SWITCH', 'PAGE_LOAD', 'DOM_READY',
            # Events without meaningful data
            'EMPTY_EVENT', 'HEARTBEAT', 'PING'
        ]
        
        # Spam detection: same behavior type repeated >10 times in 1 second
        behavior_counts_by_second = {}
        for behavior in behaviors:
            behavior_type = behavior.get('type', '')
            timestamp = behavior.get('timestamp')
            
            # Skip noise patterns
            if behavior_type in NOISE_PATTERNS:
                continue
            
            # Check for spam (rapid repetition)
            if isinstance(timestamp, datetime):
                second_key = timestamp.replace(microsecond=0)
                key = f"{second_key}_{behavior_type}"
                behavior_counts_by_second[key] = behavior_counts_by_second.get(key, 0) + 1
                
                # If >10 same behaviors in 1 second = spam
                if behavior_counts_by_second[key] > 10:
                    continue
            
            # Check if behavior has meaningful data
            data = behavior.get('data', {})
            if not data or len(str(data)) < 3:
                # Empty or too small data = likely noise
                continue
            
            filtered.append(behavior)
        
        return filtered
    
    def _deduplicate_behaviors(self, behaviors: List[Dict]) -> List[Dict]:
        """
        Deduplicate similar behaviors (same type + same data within 1 second)
        Google Standard: Don't count duplicate events
        """
        if not behaviors:
            return []
        
        # Sort by timestamp
        sorted_behaviors = sorted(behaviors, key=lambda x: x.get('timestamp', datetime.min))
        
        deduplicated = []
        seen = set()
        
        for behavior in sorted_behaviors:
            behavior_type = behavior.get('type', '')
            timestamp = behavior.get('timestamp')
            data = behavior.get('data', {})
            
            # Create signature: type + data hash + time window (1 second)
            if isinstance(timestamp, datetime):
                time_window = timestamp.replace(microsecond=0)
                data_hash = hash(str(sorted(data.items())) if isinstance(data, dict) else str(data))
                signature = f"{behavior_type}_{time_window}_{data_hash}"
                
                if signature not in seen:
                    seen.add(signature)
                    deduplicated.append(behavior)
            else:
                # No timestamp - include but might be filtered later
                deduplicated.append(behavior)
        
        return deduplicated
    
    def _filter_noise_logs(self, behaviors: List[Dict]) -> List[Dict]:
        """
        Filter noise logs (spam, natural events, non-extension events)
        Google Standard: Only count behaviors that are clearly extension-related
        """
        filtered = []
        
        # Noise patterns (behaviors that are likely natural browser events)
        NOISE_PATTERNS = [
            # Natural browser events
            'MOUSE_MOVE', 'SCROLL', 'RESIZE', 'FOCUS', 'BLUR',
            # Low-risk events that occur naturally
            'TAB_SWITCH', 'PAGE_LOAD', 'DOM_READY',
            # Events without meaningful data
            'EMPTY_EVENT', 'HEARTBEAT', 'PING'
        ]
        
        # Spam detection: same behavior type repeated >10 times in 1 second
        behavior_counts_by_second = {}
        for behavior in behaviors:
            behavior_type = behavior.get('type', '')
            timestamp = behavior.get('timestamp')
            
            # Skip noise patterns
            if behavior_type in NOISE_PATTERNS:
                continue
            
            # Check for spam (rapid repetition)
            if isinstance(timestamp, datetime):
                second_key = timestamp.replace(microsecond=0)
                key = f"{second_key}_{behavior_type}"
                behavior_counts_by_second[key] = behavior_counts_by_second.get(key, 0) + 1
                
                # If >10 same behaviors in 1 second = spam
                if behavior_counts_by_second[key] > 10:
                    continue
            
            # Check if behavior has meaningful data
            data = behavior.get('data', {})
            if not data or len(str(data)) < 3:
                # Empty or too small data = likely noise
                continue
            
            filtered.append(behavior)
        
        return filtered
    
    def _deduplicate_behaviors(self, behaviors: List[Dict]) -> List[Dict]:
        """
        Deduplicate similar behaviors (same type + same data within 1 second)
        Google Standard: Don't count duplicate events
        """
        if not behaviors:
            return []
        
        # Sort by timestamp
        sorted_behaviors = sorted(behaviors, key=lambda x: x.get('timestamp', datetime.min))
        
        deduplicated = []
        seen = set()
        
        for behavior in sorted_behaviors:
            behavior_type = behavior.get('type', '')
            timestamp = behavior.get('timestamp')
            data = behavior.get('data', {})
            
            # Create signature: type + data hash + time window (1 second)
            if isinstance(timestamp, datetime):
                time_window = timestamp.replace(microsecond=0)
                data_hash = hash(str(sorted(data.items())) if isinstance(data, dict) else str(data))
                signature = f"{behavior_type}_{time_window}_{data_hash}"
                
                if signature not in seen:
                    seen.add(signature)
                    deduplicated.append(behavior)
            else:
                # No timestamp - include but might be filtered later
                deduplicated.append(behavior)
        
        return deduplicated
    
    def _infer_severity(self, behavior_type: str) -> str:
        """Infer severity from behavior type"""
        critical_types = ['DATA_EXFILTRATION', 'KEYLOGGING', 'SESSION_HIJACKING', 'CREDENTIAL_THEFT', 'TOKEN_THEFT']
        high_types = ['FORM_DATA_CAPTURE', 'COOKIE_ACCESS', 'SCRIPT_INJECTION', 'EVAL_EXECUTION']
        medium_types = ['REQUEST_INTERCEPTION', 'FETCH_INTERCEPTION', 'DOM_INJECTION']
        
        if behavior_type in critical_types:
            return 'CRITICAL'
        elif behavior_type in high_types:
            return 'HIGH'
        elif behavior_type in medium_types:
            return 'MEDIUM'
        else:
            return 'LOW'
    
    def _is_extension_origin(self, behavior: Dict) -> bool:
        """Check if behavior originates from extension, not website"""
        data = behavior.get('data', {})
        
        # Check origin field
        origin = data.get('origin') or data.get('source') or data.get('frameOrigin')
        if origin:
            if 'chrome-extension://' in str(origin) or 'moz-extension://' in str(origin):
                return True
        
        # Check URL if present
        url = data.get('url') or data.get('destination') or data.get('endpoint')
        if url:
            if 'chrome-extension://' in str(url) or 'moz-extension://' in str(url):
                return True
        
        # Check extensionId in data
        if 'extensionId' in data or 'extension_id' in data:
            return True
        
        # If no clear origin, assume it might be from extension (conservative approach)
        # But mark for further validation
        return True  # Default to True, but will be validated against static analysis
    
    def _is_legitimate_domain(self, url: str) -> bool:
        """Check if domain is in allowlist"""
        try:
            from urllib.parse import urlparse
            parsed = urlparse(url if url.startswith('http') else f'http://{url}')
            domain = parsed.netloc.lower()
            
            # Remove port if present
            if ':' in domain:
                domain = domain.split(':')[0]
            
            # Check against legitimate domains
            for legit_domain in self.LEGITIMATE_DOMAINS:
                if legit_domain.lower() in domain or domain.endswith('.' + legit_domain.lower()):
                    return True
            
            return False
        except:
            return False
    
    def _is_password_manager_pattern(self, behavior: Dict) -> bool:
        """Check if behavior matches password manager pattern"""
        data = behavior.get('data', {})
        behavior_type = behavior.get('type', '')
        
        # Check if behavior type is form-related
        if behavior_type not in ['FORM_DATA_CAPTURE', 'KEYLOGGING']:
            return False
        
        # Check data for password manager indicators
        data_str = str(data).lower()
        for pattern in self.PASSWORD_MANAGER_PATTERNS:
            if pattern.lower() in data_str:
                return True
        
        # Check URL for password manager domains
        url = data.get('url') or data.get('destination') or ''
        if url:
            url_lower = url.lower()
            for pattern in self.PASSWORD_MANAGER_PATTERNS:
                if pattern.lower() in url_lower:
                    return True
        
        return False

