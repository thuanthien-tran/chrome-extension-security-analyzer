#!/usr/bin/env python3
"""
Manifest Analyzer
Static analysis of Chrome extension manifest.json files
"""

import json
import logging
import os
from typing import Dict, Any, List, Optional
from pathlib import Path

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ManifestAnalyzer:
    """Analyze Chrome extension manifest.json for security risks (Google Standard)"""
    
    def __init__(self, risk_model_path: Optional[str] = None):
        """
        Initialize manifest analyzer with Google risk model
        
        Args:
            risk_model_path: Path to google_risk_model.json (default: same directory)
        """
        # Load Google risk model
        if risk_model_path is None:
            # Default to google_risk_model.json in same directory
            current_dir = os.path.dirname(os.path.abspath(__file__))
            risk_model_path = os.path.join(current_dir, 'google_risk_model.json')
        
        self.risk_model = self._load_risk_model(risk_model_path)
        
        # Load permission scores from JSON
        self.PERMISSION_SCORES = self.risk_model.get('permission_scores', {})
        
        # Legacy support
        self.DANGEROUS_PERMISSIONS = self.PERMISSION_SCORES
    
    def _load_risk_model(self, model_path: str) -> Dict[str, Any]:
        """Load Google risk model from JSON file"""
        try:
            if os.path.exists(model_path):
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
            'permission_scores': {
                'debugger': 30,
                'webRequestBlocking': 25,
                'webRequest': 20,
                'cookies': 20,
                'proxy': 20,
                'history': 10,
                'scripting': 10,
                'tabs': 3,
                'activeTab': 0,
                'storage': 0
            },
            'host_permissions': {
                '<all_urls>': 30,
                'http_wildcard': 20,
                '10_plus_domains': 10,
                '3_to_10_domains': 5,
                '1_to_2_domains': 1,
                'single_domain': 0
            },
            'content_scripts': {
                'all_urls': 20,
                'ten_plus': 10,
                'few_domains': 2,
                'all_frames': 5,
                'document_start': 5
            }
        }
    
    # Suspicious permission combinations
    SUSPICIOUS_COMBINATIONS = [
        ['cookies', 'webRequest', '<all_urls>'],  # C2 / exfiltration risk
        ['cookies', 'webRequestBlocking', '<all_urls>'],  # Very dangerous
        ['history', 'tabs', 'webNavigation'],
        ['scripting', '<all_urls>', 'webRequest'],
        ['cookies', 'storage', 'webRequest'],
        ['proxy', 'webRequest'],  # Can intercept all traffic
        ['debugger', 'scripting'],  # Can debug and inject code
        ['management', 'tabs'],  # Can manage extensions and tabs
        ['downloads', 'webRequest'],  # Can download malicious files
        ['cookies', 'webRequestBlocking', 'proxy']  # Ultimate control
    ]
    
    # High-risk content script patterns
    RISKY_CONTENT_SCRIPT_PATTERNS = [
        {'matches': ['<all_urls>']},
        {'matches': ['http://*/*', 'https://*/*']},
        {'all_frames': True, 'match_about_blank': True}
    ]
    
    def analyze_manifest(self, manifest_path: Optional[str] = None, 
                        manifest_data: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Analyze manifest.json file or data
        
        Args:
            manifest_path: Path to manifest.json file
            manifest_data: Direct manifest data dictionary
            
        Returns:
            Analysis results dictionary
        """
        if manifest_data:
            manifest = manifest_data
        elif manifest_path:
            manifest = self._load_manifest(manifest_path)
        else:
            return {'error': 'No manifest path or data provided'}
        
        if not manifest:
            return {'error': 'Failed to load manifest'}
        
        # Google Standard: Only calculate perm + host + content
        # Other analyses (background, web_accessible_resources, CSP, permission_abuse, suspicious_patterns)
        # are for flags/info only, NOT included in risk_score
        results = {
            'risk_score': 0,
            'flags': [],
            'permissions_analysis': self._analyze_permissions(manifest),
            'host_permissions_analysis': self._analyze_host_permissions(manifest),
            'content_scripts_analysis': self._analyze_content_scripts(manifest),
            # Info only (not scored):
            'background_analysis': self._analyze_background(manifest),
            'web_accessible_resources': self._analyze_web_accessible_resources(manifest),
            'csp_analysis': self._analyze_csp(manifest),
            'permission_abuse_analysis': self._analyze_permission_abuse(manifest),
            'suspicious_patterns': self._detect_suspicious_patterns(manifest)
        }
        
        # Calculate overall risk score (Google Standard: perm + host + content only)
        results['risk_score'] = self._calculate_manifest_risk_score(results)
        results['risk_level'] = self._get_risk_level(results['risk_score'])
        
        return results
    
    def _load_manifest(self, manifest_path: str) -> Optional[Dict]:
        """Load manifest.json from file"""
        try:
            with open(manifest_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Error loading manifest: {e}")
            return None
    
    def _analyze_permissions(self, manifest: Dict) -> Dict[str, Any]:
        """
        Analyze permissions in manifest (Google Standard)
        Returns score 0-40 points (max), capped at 40
        """
        permissions = manifest.get('permissions', [])
        # Don't include host_permissions here - they're analyzed separately
        
        analysis = {
            'total_permissions': len(permissions),
            'dangerous_permissions': [],
            'permission_scores': {},
            'risk_score': 0,
            'flags': []
        }
        
        # Calculate permission scores (Google standard)
        for perm in permissions:
            if perm in self.PERMISSION_SCORES:
                score = self.PERMISSION_SCORES[perm]
                analysis['dangerous_permissions'].append({
                    'permission': perm,
                    'risk_score': score
                })
                analysis['permission_scores'][perm] = score
                analysis['risk_score'] += score
        
        # Cap at 40 points (Google standard: Permission Score = min(sum, 40))
        analysis['risk_score'] = min(analysis['risk_score'], 40)
        
        # Check for suspicious combinations (for flags only, not scoring)
        perm_set = set(permissions)
        for combo in self.SUSPICIOUS_COMBINATIONS:
            if all(p in perm_set for p in combo):
                analysis['flags'].append({
                    'type': 'SUSPICIOUS_PERMISSION_COMBINATION',
                    'permissions': combo,
                    'severity': 'HIGH'
                })
        
        return analysis
    
    def _analyze_host_permissions(self, manifest: Dict) -> Dict[str, Any]:
        """
        Analyze host permissions (Google Standard - from JSON model)
        Returns score 0-30 points (max)
        """
        host_permissions = manifest.get('host_permissions', [])
        host_scores = self.risk_model.get('host_permissions', {})
        
        analysis = {
            'total_host_permissions': len(host_permissions),
            'universal_access': False,
            'specific_domains': [],
            'risk_score': 0
        }
        
        # Count unique domains
        unique_domains = set()
        has_http_wildcard = False
        
        for host_perm in host_permissions:
            if host_perm == '<all_urls>':
                analysis['universal_access'] = True
                analysis['risk_score'] = host_scores.get('<all_urls>', 30)  # From JSON
                break  # <all_urls> is the highest risk
            elif host_perm == 'http://*/*':
                has_http_wildcard = True
                analysis['risk_score'] = host_scores.get('http_wildcard', 20)  # From JSON
            elif host_perm.startswith('https://') or host_perm.startswith('http://'):
                # Extract domain
                domain = host_perm.replace('https://', '').replace('http://', '').replace('/*', '').split('/')[0]
                if domain and '*' not in domain:
                    unique_domains.add(domain)
                analysis['specific_domains'].append(host_perm)
        
        # If not <all_urls> or http_wildcard, score based on domain count (from JSON)
        if not analysis['universal_access'] and not has_http_wildcard:
            domain_count = len(unique_domains)
            if domain_count >= 10:
                analysis['risk_score'] = host_scores.get('10_plus_domains', 10)
            elif domain_count >= 3:
                analysis['risk_score'] = host_scores.get('3_to_10_domains', 5)
            elif domain_count >= 1:
                analysis['risk_score'] = host_scores.get('1_to_2_domains', 1)
            else:
                analysis['risk_score'] = host_scores.get('single_domain', 0)
        
        return analysis
    
    def _analyze_content_scripts(self, manifest: Dict) -> Dict[str, Any]:
        """
        Analyze content scripts configuration (Google Standard - from JSON model)
        Returns score 0-30 points (max)
        """
        content_scripts = manifest.get('content_scripts', [])
        content_scores = self.risk_model.get('content_scripts', {})
        
        analysis = {
            'total_scripts': len(content_scripts),
            'universal_injection': False,
            'all_frames_injection': False,
            'risk_score': 0,
            'scripts': []
        }
        
        total_domains = set()
        has_document_start = False
        has_all_frames = False
        
        for script in content_scripts:
            matches = script.get('matches', [])
            all_frames = script.get('all_frames', False)
            run_at = script.get('run_at', 'document_idle')
            
            script_info = {
                'matches': matches,
                'all_frames': all_frames,
                'run_at': run_at
            }
            
            # Check for <all_urls>
            for match in matches:
                if match == '<all_urls>':
                    analysis['universal_injection'] = True
                    analysis['risk_score'] = content_scores.get('all_urls', 20)  # From JSON
                    break
                elif match not in ['http://*/*', 'https://*/*']:
                    # Count specific domains
                    domain = match.replace('https://', '').replace('http://', '').replace('/*', '').split('/')[0]
                    if domain and '*' not in domain:
                        total_domains.add(domain)
            
            if all_frames:
                has_all_frames = True
            
            if run_at == 'document_start':
                has_document_start = True
            
            analysis['scripts'].append(script_info)
        
        # If not <all_urls>, score based on domain count (from JSON)
        if not analysis['universal_injection']:
            domain_count = len(total_domains)
            if domain_count >= 10:
                analysis['risk_score'] = content_scores.get('ten_plus', 10)
            elif domain_count >= 1:
                analysis['risk_score'] = content_scores.get('few_domains', 2)
            else:
                analysis['risk_score'] = 0
        
        # Add modifiers (from JSON)
        if has_all_frames:
            analysis['all_frames_injection'] = True
            analysis['risk_score'] += content_scores.get('all_frames', 5)
        
        if has_document_start:
            analysis['risk_score'] += content_scores.get('document_start', 5)
        
        # Cap at 30 points (Google standard: Content Script Max = 30)
        analysis['risk_score'] = min(analysis['risk_score'], 30)
        
        return analysis
    
    def _analyze_background(self, manifest: Dict) -> Dict[str, Any]:
        """Analyze background service worker/page"""
        background = manifest.get('background', {})
        
        analysis = {
            'has_background': bool(background),
            'persistent': background.get('persistent', False),
            'type': background.get('type', 'service_worker'),
            'risk_score': 0
        }
        
        # Persistent background pages are deprecated but still risky
        if analysis['persistent']:
            analysis['risk_score'] += 5
        
        # Service workers are generally safer
        if analysis['type'] == 'service_worker':
            analysis['risk_score'] += 2
        
        return analysis
    
    def _analyze_web_accessible_resources(self, manifest: Dict) -> Dict[str, Any]:
        """Analyze web accessible resources"""
        war = manifest.get('web_accessible_resources', [])
        
        analysis = {
            'has_war': bool(war),
            'total_resources': len(war) if isinstance(war, list) else 0,
            'risk_score': 0
        }
        
        if analysis['has_war']:
            # Having web accessible resources can be a security risk
            analysis['risk_score'] += 5
            
            # Check for wildcard resources
            if isinstance(war, list):
                for resource in war:
                    if '*' in str(resource):
                        analysis['risk_score'] += 5
                        analysis['flags'] = analysis.get('flags', [])
                        analysis['flags'].append({
                            'type': 'WILDCARD_WEB_ACCESSIBLE_RESOURCE',
                            'resource': resource,
                            'severity': 'MEDIUM'
                        })
        
        return analysis
    
    def _detect_suspicious_patterns(self, manifest: Dict) -> List[Dict[str, Any]]:
        """Detect suspicious patterns in manifest"""
        patterns = []
        
        # Check for obfuscated names
        name = manifest.get('name', '')
        if not name or len(name) < 3:
            patterns.append({
                'type': 'SUSPICIOUS_NAME',
                'description': 'Extension name is too short or missing',
                'severity': 'LOW'
            })
        
        # Check for missing description
        if not manifest.get('description'):
            patterns.append({
                'type': 'MISSING_DESCRIPTION',
                'description': 'No description provided',
                'severity': 'LOW'
            })
        
        # Check for excessive permissions
        all_perms = len(manifest.get('permissions', [])) + len(manifest.get('host_permissions', []))
        if all_perms > 10:
            patterns.append({
                'type': 'EXCESSIVE_PERMISSIONS',
                'description': f'Extension requests {all_perms} permissions',
                'severity': 'MEDIUM'
            })
        
        # Check for version
        version = manifest.get('version', '')
        if not version:
            patterns.append({
                'type': 'MISSING_VERSION',
                'description': 'No version specified',
                'severity': 'LOW'
            })
        
        return patterns
    
    def _analyze_csp(self, manifest: Dict) -> Dict[str, Any]:
        """
        Analyze Content Security Policy (CSP) - Google Standard
        IMPORTANT: Only penalize unsafe-eval/unsafe-inline in HTML pages (extension_pages)
        MV3 service workers don't use CSP, so missing CSP is NOT a penalty
        """
        analysis = {
            'has_csp': False,
            'csp_policy': None,
            'violations': [],
            'risk_score': 0,
            'flags': []
        }
        
        # Get CSP from manifest (only extension_pages, not service worker)
        csp = manifest.get('content_security_policy', {})
        
        if isinstance(csp, dict):
            # Manifest V3 format - only check extension_pages (HTML pages)
            csp_string = csp.get('extension_pages', '')
            analysis['csp_policy'] = csp_string
        elif isinstance(csp, str):
            # Legacy format
            analysis['csp_policy'] = csp
        
        # Only penalize if CSP exists and has unsafe directives
        # Missing CSP is NOT penalized (MV3 service workers don't need CSP)
        if analysis['csp_policy']:
            analysis['has_csp'] = True
            csp_policy = analysis['csp_policy'].lower()
            
            # Only check for unsafe-eval and unsafe-inline (Google standard)
            # These are the only CSP violations that matter for extension_pages
            unsafe_patterns = [
                ("'unsafe-eval'", "CSP allows eval() - enables code injection in HTML pages"),
                ("'unsafe-inline'", "CSP allows inline scripts - XSS risk in HTML pages")
            ]
            
            for pattern, description in unsafe_patterns:
                if pattern in csp_policy:
                    analysis['violations'].append({
                        'pattern': pattern,
                        'severity': 'HIGH',
                        'description': description
                    })
                    # Note: CSP violations are flagged but not scored separately
                    # They are considered in permission abuse analysis
        
        # IMPORTANT: Missing CSP is NOT penalized
        # MV3 service workers don't use CSP, so this is normal and safe
        
        return analysis
    
    def _analyze_permission_abuse(self, manifest: Dict) -> Dict[str, Any]:
        """
        Analyze permission abuse patterns - Chrome Web Store review criteria
        
        Detects when extensions request permissions that don't match their declared functionality.
        """
        analysis = {
            'abuse_patterns': [],
            'risk_score': 0,
            'flags': []
        }
        
        permissions = manifest.get('permissions', [])
        host_permissions = manifest.get('host_permissions', [])
        all_permissions = set(permissions + host_permissions)
        
        name = manifest.get('name', '').lower()
        description = manifest.get('description', '').lower()
        
        # Permission abuse patterns based on Chrome Web Store review
        abuse_rules = [
            # Excessive permissions for simple extensions
            {
                'condition': lambda p: '<all_urls>' in p and len(p) > 5,
                'check': lambda n, d: 'simple' in n or 'basic' in n or 'tool' in n,
                'score': 20,
                'description': 'Simple extension requests excessive permissions'
            },
            # Privacy-invading permissions without justification
            {
                'condition': lambda p: 'history' in p or 'bookmarks' in p or 'topSites' in p,
                'check': lambda n, d: 'history' not in d and 'bookmark' not in d and 'top' not in d,
                'score': 25,
                'description': 'Privacy-invading permissions without clear justification'
            },
            # Network permissions for non-network extensions
            {
                'condition': lambda p: 'webRequest' in p or 'proxy' in p,
                'check': lambda n, d: 'network' not in d and 'proxy' not in d and 'vpn' not in d and 'block' not in d,
                'score': 30,
                'description': 'Network interception permissions without network-related functionality'
            },
            # Cookie access without cookie-related functionality
            {
                'condition': lambda p: 'cookies' in p,
                'check': lambda n, d: 'cookie' not in d and 'session' not in d and 'login' not in d,
                'score': 20,
                'description': 'Cookie access permission without cookie-related functionality'
            },
            # Debugger permission (extremely dangerous)
            {
                'condition': lambda p: 'debugger' in p,
                'check': lambda n, d: 'debug' not in d and 'developer' not in d,
                'score': 40,
                'description': 'Debugger permission - can debug other extensions/pages'
            },
            # Management permission without management functionality
            {
                'condition': lambda p: 'management' in p,
                'check': lambda n, d: 'manage' not in d and 'extension' not in d,
                'score': 30,
                'description': 'Management permission without extension management functionality'
            }
        ]
        
        for rule in abuse_rules:
            if rule['condition'](all_permissions):
                if rule['check'](name, description):
                    analysis['abuse_patterns'].append({
                        'type': 'PERMISSION_ABUSE',
                        'description': rule['description'],
                        'severity': 'HIGH' if rule['score'] >= 30 else 'MEDIUM',
                        'score': rule['score']
                    })
                    analysis['risk_score'] += rule['score']
        
        # Check for suspicious permission combinations
        if 'cookies' in all_permissions and 'webRequest' in all_permissions and '<all_urls>' in all_permissions:
            # This combination is often used for data exfiltration
            if 'cookie' not in description and 'session' not in description:
                analysis['abuse_patterns'].append({
                    'type': 'SUSPICIOUS_COMBINATION',
                    'description': 'Cookies + webRequest + all_urls without clear justification',
                    'severity': 'CRITICAL',
                    'score': 35
                })
                analysis['risk_score'] += 35
        
        if analysis['abuse_patterns']:
            analysis['flags'].append({
                'type': 'PERMISSION_ABUSE_DETECTED',
                'severity': 'HIGH',
                'description': f'Found {len(analysis["abuse_patterns"])} permission abuse patterns'
            })
        
        return analysis
    
    def _calculate_manifest_risk_score(self, results: Dict) -> int:
        """
        Calculate overall manifest risk score (Google Standard)
        
        Formula: Manifest Risk Final = (perm + host + content) capped at 100
        - Permission Risk: 0-40 points (capped)
        - Host Permissions: 0-30 points (capped)
        - Content Script Scope: 0-30 points (capped)
        
        NOTE: Only perm + host + content are included.
        Other analyses (background, web_accessible_resources, CSP, permission_abuse, suspicious_patterns)
        are for flags/info only and NOT included in risk_score.
        
        This score will be weighted by 35% in analyzer.py
        """
        # Get component scores (already capped at their max)
        # ONLY these 3 components are included (Google Standard)
        perm_score = results['permissions_analysis'].get('risk_score', 0)  # 0-40
        host_score = results['host_permissions_analysis'].get('risk_score', 0)  # 0-30
        cs_score = results['content_scripts_analysis'].get('risk_score', 0)  # 0-30
        
        # Sum and cap at 100 (Google standard)
        manifest_risk = perm_score + host_score + cs_score
        manifest_risk = min(manifest_risk, 100)
        
        return int(manifest_risk)
    
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
    analyzer = ManifestAnalyzer()
    
    # Example manifest
    test_manifest = {
        "manifest_version": 3,
        "name": "Test Extension",
        "version": "1.0.0",
        "permissions": ["cookies", "history", "webRequest"],
        "host_permissions": ["<all_urls>"],
        "content_scripts": [{
            "matches": ["<all_urls>"],
            "js": ["content.js"],
            "all_frames": True
        }]
    }
    
    results = analyzer.analyze_manifest(manifest_data=test_manifest)
    print(json.dumps(results, indent=2))

