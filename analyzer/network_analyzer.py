#!/usr/bin/env python3
"""
Network Analyzer
Analyze network traffic and data exfiltration patterns
"""

import re
import logging
from typing import Dict, Any, List, Optional
from collections import defaultdict
from datetime import datetime
from urllib.parse import urlparse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class NetworkAnalyzer:
    """Analyze network behaviors for data exfiltration and suspicious activity"""
    
    # Suspicious domain patterns
    SUSPICIOUS_TLDS = ['.tk', '.ml', '.ga', '.cf', '.gq', '.xyz']
    SUSPICIOUS_DOMAINS = ['bit.ly', 'tinyurl.com', 't.co', 'goo.gl']
    
    # Suspicious IP patterns (private IPs used externally)
    PRIVATE_IP_RANGES = [
        r'^10\.',
        r'^172\.(1[6-9]|2[0-9]|3[01])\.',
        r'^192\.168\.',
        r'^127\.'
    ]
    
    # Data exfiltration indicators
    EXFILTRATION_INDICATORS = [
        'DATA_EXFILTRATION',
        'FETCH_INTERCEPTION',
        'XHR_INTERCEPTION',
        'REQUEST_INTERCEPTION'
    ]
    
    # Known good domains (cache for reputation scoring)
    KNOWN_GOOD_DOMAINS = {
        'google.com', 'googleapis.com', 'gstatic.com', 'googleusercontent.com',
        'youtube.com', 'youtu.be', 'ytimg.com',
        'gmail.com', 'googlemail.com',
        'facebook.com', 'fbcdn.net',
        'github.com', 'githubusercontent.com',
        'microsoft.com', 'live.com', 'office.com',
        'amazon.com', 'amazonaws.com',
        'cloudflare.com', 'cloudflare.net'
    }
    
    def __init__(self):
        """Initialize network analyzer"""
        self.compiled_ip_patterns = [re.compile(pattern) for pattern in self.PRIVATE_IP_RANGES]
        # Domain reputation cache (in-memory, can be extended to persistent storage)
        self.domain_reputation_cache = {}
    
    def analyze_network_behaviors(self, behaviors: List[Dict], manifest_analysis: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Analyze network-related behaviors with optional manifest cross-check
        
        Args:
            behaviors: List of behavior dictionaries
            manifest_analysis: Optional manifest analysis for permission validation
            
        Returns:
            Analysis results
        """
        results = {
            'exfiltration_analysis': self._analyze_exfiltration(behaviors),
            'domain_analysis': self._analyze_domains(behaviors),
            'payload_analysis': self._analyze_payloads(behaviors),
            'frequency_analysis': self._analyze_frequency(behaviors),
            'risk_score': 0,
            'flags': []
        }
        
        # Cross-check with manifest if available
        if manifest_analysis:
            permission_mismatches = self._check_permission_mismatches(behaviors, manifest_analysis)
            if permission_mismatches:
                results['permission_mismatches'] = permission_mismatches
                results['flags'].extend(permission_mismatches)
                # Boost risk score for permission mismatches
                mismatch_penalty = len(permission_mismatches) * 15
                results['permission_mismatch_penalty'] = mismatch_penalty
        
        # Calculate overall risk score
        base_risk = self._calculate_network_risk_score(results)
        mismatch_penalty = results.get('permission_mismatch_penalty', 0)
        results['risk_score'] = min(int(base_risk + mismatch_penalty), 100)
        results['risk_level'] = self._get_risk_level(results['risk_score'])
        
        return results
    
    def _analyze_exfiltration(self, behaviors: List[Dict]) -> Dict[str, Any]:
        """Analyze data exfiltration behaviors"""
        analysis = {
            'total_exfiltrations': 0,
            'destinations': [],
            'suspicious_destinations': [],
            'exfiltration_types': defaultdict(int),
            'risk_score': 0
        }
        
        exfil_behaviors = [b for b in behaviors if b.get('type') in self.EXFILTRATION_INDICATORS]
        analysis['total_exfiltrations'] = len(exfil_behaviors)
        
        for behavior in exfil_behaviors:
            behavior_type = behavior.get('type')
            analysis['exfiltration_types'][behavior_type] += 1
            
            # Extract destination from data
            data = behavior.get('data', {})
            destination = data.get('destination') or data.get('url') or data.get('endpoint')
            
            if destination:
                parsed = self._parse_destination(destination)
                analysis['destinations'].append(parsed)
                
                # Check if suspicious
                if self._is_suspicious_destination(parsed):
                    analysis['suspicious_destinations'].append({
                        'destination': destination,
                        'domain': parsed.get('domain', ''),
                        'reason': self._get_suspicious_reason(parsed),
                        'severity': 'HIGH'
                    })
                    analysis['risk_score'] += 10
        
        # High frequency penalty
        if analysis['total_exfiltrations'] > 10:
            analysis['risk_score'] += 15
        elif analysis['total_exfiltrations'] > 5:
            analysis['risk_score'] += 10
        
        analysis['risk_score'] = min(int(analysis['risk_score']), 100)
        
        return analysis
    
    def _analyze_domains(self, behaviors: List[Dict]) -> Dict[str, Any]:
        """Analyze domains from network behaviors with reputation scoring"""
        analysis = {
            'unique_domains': set(),
            'suspicious_domains': [],
            'domain_reputation_scores': {},
            'domain_count': 0,
            'risk_score': 0
        }
        
        for behavior in behaviors:
            data = behavior.get('data', {})
            destination = data.get('destination') or data.get('url') or data.get('endpoint')
            
            if destination:
                parsed = self._parse_destination(destination)
                domain = parsed.get('domain', '')
                
                if domain:
                    analysis['unique_domains'].add(domain)
                    
                    # Calculate domain reputation score
                    reputation_score = self._calculate_domain_reputation(domain)
                    analysis['domain_reputation_scores'][domain] = reputation_score
                    
                    if self._is_suspicious_domain(domain):
                        analysis['suspicious_domains'].append({
                            'domain': domain,
                            'reason': self._get_suspicious_reason(parsed),
                            'severity': 'MEDIUM',
                            'reputation_score': reputation_score
                        })
                        analysis['risk_score'] += 5
        
        analysis['domain_count'] = len(analysis['unique_domains'])
        analysis['unique_domains'] = list(analysis['unique_domains'])
        analysis['risk_score'] = min(int(analysis['risk_score']), 100)
        
        return analysis
    
    def _analyze_payloads(self, behaviors: List[Dict]) -> Dict[str, Any]:
        """
        Analyze payload sizes and patterns (Google Standard - Enhanced)
        Checks: size, entropy, type, suspicious keys
        """
        analysis = {
            'total_payloads': 0,
            'total_size': 0,
            'avg_size': 0,
            'max_size': 0,
            'large_payloads': [],
            'sensitive_payloads': [],
            'high_entropy_payloads': [],
            'binary_payloads': [],
            'risk_score': 0,
            '_payload_entropies': []  # Track for adaptive threshold
        }
        
        # Suspicious payload keys (indicators of sensitive data)
        SENSITIVE_KEYS = [
            'token', 'cookie', 'session', 'password', 'passwd', 'pwd',
            'credit_card', 'creditcard', 'cc_number', 'cvv', 'ssn',
            'api_key', 'apikey', 'secret', 'auth', 'authorization',
            'private_key', 'privatekey', 'access_token', 'refresh_token'
        ]
        
        # First pass: collect all payloads and calculate entropies
        payload_data = []
        for behavior in behaviors:
            if behavior.get('type') in self.EXFILTRATION_INDICATORS:
                data = behavior.get('data', {})
                payload = data.get('payload') or data.get('data') or data.get('value')
                payload_size = data.get('payload_size') or data.get('size') or data.get('length')
                
                # Calculate payload size
                if payload_size:
                    payload_size = int(payload_size) if isinstance(payload_size, (int, float, str)) else 0
                elif payload:
                    # Estimate size from payload
                    payload_str = str(payload)
                    payload_size = len(payload_str.encode('utf-8'))
                else:
                    payload_size = 0
                
                if payload_size > 0:
                    analysis['total_payloads'] += 1
                    analysis['total_size'] += payload_size
                    analysis['max_size'] = max(analysis['max_size'], payload_size)
                    
                    # Flag large payloads (> 1MB)
                    if payload_size > 1000000:
                        analysis['large_payloads'].append({
                            'size': payload_size,
                            'size_mb': round(payload_size / 1000000, 2),
                            'severity': 'HIGH',
                            'description': f'Large payload: {payload_size / 1000000:.2f} MB'
                        })
                        analysis['risk_score'] += 5
                    
                    # Check for sensitive data in payload
                    if payload:
                        payload_str = str(payload).lower()
                        has_sensitive = any(key in payload_str for key in SENSITIVE_KEYS)
                        if has_sensitive:
                            analysis['sensitive_payloads'].append({
                                'size': payload_size,
                                'sensitive_keys_found': [key for key in SENSITIVE_KEYS if key in payload_str],
                                'severity': 'CRITICAL',
                                'description': 'Payload contains sensitive data indicators'
                            })
                            analysis['risk_score'] += 20
                        
                        # Check entropy (adaptive threshold: entropy_avg + 1.5)
                        # Google Standard: Adaptive threshold based on payload set
                        entropy = self._calculate_entropy(payload_str)
                        analysis['_payload_entropies'].append({
                            'entropy': entropy,
                            'size': payload_size,
                            'payload_str': payload_str
                        })
                        
                        # Check if binary (non-text)
                        if self._is_binary_payload(payload):
                            analysis['binary_payloads'].append({
                                'size': payload_size,
                                'severity': 'MEDIUM',
                                'description': 'Binary payload detected (non-text data)'
                            })
                            analysis['risk_score'] += 5
        
        if analysis['total_payloads'] > 0:
            analysis['avg_size'] = analysis['total_size'] / analysis['total_payloads']
        
        # Calculate adaptive entropy threshold (after collecting all entropies)
        if len(analysis['_payload_entropies']) > 0:
            entropies = [e['entropy'] for e in analysis['_payload_entropies']]
            avg_entropy = sum(entropies) / len(entropies)
            adaptive_threshold = avg_entropy + 1.5
            
            # Check each payload against adaptive threshold
            for payload_info in analysis['_payload_entropies']:
                entropy = payload_info['entropy']
                payload_size = payload_info['size']
                
                if entropy > adaptive_threshold:
                    analysis['high_entropy_payloads'].append({
                        'size': payload_size,
                        'entropy': round(entropy, 2),
                        'threshold': round(adaptive_threshold, 2),
                        'severity': 'MEDIUM',
                        'description': f'High entropy payload (adaptive threshold): {entropy:.2f} > {adaptive_threshold:.2f}'
                    })
                    analysis['risk_score'] += 10
        
        # Clean up temporary data
        if '_payload_entropies' in analysis:
            del analysis['_payload_entropies']
        
        # Excessive data transfer (Google Standard thresholds)
        if analysis['total_size'] > 10000000:  # > 10MB
            analysis['risk_score'] += 15
        elif analysis['total_size'] > 5000000:  # > 5MB
            analysis['risk_score'] += 10
        elif analysis['total_size'] > 2000000:  # > 2MB
            analysis['risk_score'] += 5
        
        analysis['risk_score'] = min(int(analysis['risk_score']), 100)
        
        return analysis
    
    def _calculate_entropy(self, data: str) -> float:
        """Calculate Shannon entropy of data"""
        if not data:
            return 0.0
        
        from collections import Counter
        import math
        
        counter = Counter(data)
        length = len(data)
        entropy = 0.0
        
        for count in counter.values():
            probability = count / length
            if probability > 0:
                entropy -= probability * math.log2(probability)
        
        return entropy
    
    def _is_binary_payload(self, payload: Any) -> bool:
        """Check if payload is binary (non-text)"""
        if not payload:
            return False
        
        payload_str = str(payload)
        
        # Check for high ratio of non-printable characters
        if len(payload_str) > 100:
            non_printable = sum(1 for c in payload_str if ord(c) < 32 or ord(c) > 126)
            ratio = non_printable / len(payload_str)
            if ratio > 0.1:  # More than 10% non-printable
                return True
        
        # Check for common binary patterns
        binary_indicators = ['\x00', '\xff', '\xfe', '\xfd']
        if any(indicator in payload_str for indicator in binary_indicators):
            return True
        
        return False
    
    def _analyze_frequency(self, behaviors: List[Dict]) -> Dict[str, Any]:
        """Analyze frequency of network behaviors"""
        analysis = {
            'behaviors_per_minute': 0,
            'peak_frequency': 0,
            'sustained_activity': False,
            'risk_score': 0
        }
        
        network_behaviors = [b for b in behaviors if b.get('type') in self.EXFILTRATION_INDICATORS]
        
        if not network_behaviors:
            return analysis
        
        # Calculate frequency
        timestamps = [b.get('timestamp') for b in network_behaviors if isinstance(b.get('timestamp'), datetime)]
        if len(timestamps) > 1:
            time_span = (max(timestamps) - min(timestamps)).total_seconds() / 60  # minutes
            if time_span > 0:
                analysis['behaviors_per_minute'] = round(len(network_behaviors) / time_span, 2)
        
        # Check for high frequency
        if analysis['behaviors_per_minute'] > 10:
            analysis['peak_frequency'] = analysis['behaviors_per_minute']
            analysis['risk_score'] += 15
        elif analysis['behaviors_per_minute'] > 5:
            analysis['risk_score'] += 10
        
        # Check for sustained activity
        if len(network_behaviors) > 20:
            analysis['sustained_activity'] = True
            analysis['risk_score'] += 10
        
        analysis['risk_score'] = min(int(analysis['risk_score']), 100)
        
        return analysis
    
    def _parse_destination(self, destination: str) -> Dict[str, Any]:
        """Parse destination URL/domain"""
        parsed = {
            'original': destination,
            'domain': '',
            'is_ip': False,
            'is_private_ip': False
        }
        
        try:
            # Try to parse as URL
            parsed_url = urlparse(destination if destination.startswith('http') else f'http://{destination}')
            domain = parsed_url.netloc or parsed_url.path.split('/')[0]
            parsed['domain'] = domain
            
            # Check if it's an IP address
            ip_pattern = r'^(\d{1,3}\.){3}\d{1,3}$'
            if re.match(ip_pattern, domain):
                parsed['is_ip'] = True
                parsed['is_private_ip'] = any(pattern.match(domain) for pattern in self.compiled_ip_patterns)
        except Exception as e:
            logger.debug(f"Error parsing destination {destination}: {e}")
            parsed['domain'] = destination
        
        return parsed
    
    def _is_suspicious_domain(self, domain: str) -> bool:
        """
        Check if domain is suspicious (Google Standard - Enhanced)
        Checks: TLD, domain patterns, length, randomness
        """
        if not domain:
            return False
        
        domain_lower = domain.lower()
        
        # Check suspicious TLDs
        for tld in self.SUSPICIOUS_TLDS:
            if domain_lower.endswith(tld):
                return True
        
        # Check suspicious domain names
        for suspicious in self.SUSPICIOUS_DOMAINS:
            if suspicious in domain_lower:
                return True
        
        # Check for suspicious patterns (Google Standard)
        # 1. Very long domain names (> 50 chars) - often used for evasion
        if len(domain) > 50:
            return True
        
        # 2. High randomness (many random characters)
        if self._has_high_randomness(domain):
            return True
        
        # 3. IP address in domain (suspicious)
        import re
        ip_pattern = r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}'
        if re.search(ip_pattern, domain):
            return True
        
        # 4. Multiple subdomains (often used for evasion)
        subdomain_count = domain.count('.')
        if subdomain_count > 3:
            return True
        
        return False
    
    def _has_high_randomness(self, domain: str) -> bool:
        """Check if domain has high randomness (suspicious)"""
        if len(domain) < 10:
            return False
        
        # Count alphanumeric vs special characters
        alnum_count = sum(1 for c in domain if c.isalnum())
        special_count = len(domain) - alnum_count
        
        # High ratio of special characters = suspicious
        if len(domain) > 0 and special_count / len(domain) > 0.3:
            return True
        
        # Check for random character patterns (e.g., a1b2c3d4)
        # BUT exclude common CDN patterns (e.g., a1b2cdn.com, cdn1.example.com)
        import re
        random_pattern = r'[a-z]\d[a-z]\d'
        if re.search(random_pattern, domain.lower()):
            # Exclude CDN patterns to reduce false positives
            cdn_indicators = ['cdn', 'cloudfront', 'cloudflare', 'fastly', 'akamai', 'edge']
            if not any(indicator in domain.lower() for indicator in cdn_indicators):
                return True
        
        return False
    
    def _is_suspicious_destination(self, parsed: Dict) -> bool:
        """Check if destination is suspicious"""
        domain = parsed.get('domain', '').lower()
        
        # Suspicious domain
        if self._is_suspicious_domain(domain):
            return True
        
        # Private IP used externally
        if parsed.get('is_private_ip'):
            return True
        
        return False
    
    def _get_suspicious_reason(self, parsed: Dict) -> str:
        """Get reason why destination is suspicious"""
        domain = parsed.get('domain', '').lower()
        
        if parsed.get('is_private_ip'):
            return 'Private IP address'
        
        for tld in self.SUSPICIOUS_TLDS:
            if domain.endswith(tld):
                return f'Suspicious TLD: {tld}'
        
        for suspicious in self.SUSPICIOUS_DOMAINS:
            if suspicious in domain:
                return f'Known suspicious domain: {suspicious}'
        
        return 'Unknown reason'
    
    def _calculate_network_risk_score(self, results: Dict) -> int:
        """Calculate overall network risk score"""
        total_score = 0
        
        # Exfiltration score
        total_score += results['exfiltration_analysis'].get('risk_score', 0) * 0.4
        
        # Domain analysis score
        total_score += results['domain_analysis'].get('risk_score', 0) * 0.2
        
        # Payload analysis score
        total_score += results['payload_analysis'].get('risk_score', 0) * 0.2
        
        # Frequency analysis score
        total_score += results['frequency_analysis'].get('risk_score', 0) * 0.2
        
        # Cap at 100
        return min(int(total_score), 100)
    
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
    
    def _calculate_domain_reputation(self, domain: str) -> float:
        """
        Calculate domain reputation score (0.0 = bad, 1.0 = good)
        
        Uses:
        - Known good domains cache
        - TLD analysis
        - Domain age indicators (new domains = lower reputation)
        - Suspicious patterns
        """
        domain_lower = domain.lower()
        
        # Check cache first
        if domain_lower in self.domain_reputation_cache:
            return self.domain_reputation_cache[domain_lower]
        
        reputation = 0.5  # Default neutral score
        
        # Known good domains = high reputation
        if domain_lower in self.KNOWN_GOOD_DOMAINS:
            reputation = 1.0
        # Check if subdomain of known good domain
        elif any(domain_lower.endswith('.' + good_domain) for good_domain in self.KNOWN_GOOD_DOMAINS):
            reputation = 0.9
        
        # Suspicious TLDs = lower reputation
        elif any(domain_lower.endswith(tld) for tld in self.SUSPICIOUS_TLDS):
            reputation = 0.2
        
        # Suspicious domains = very low reputation
        elif any(susp in domain_lower for susp in self.SUSPICIOUS_DOMAINS):
            reputation = 0.1
        
        # New/random-looking domains (short, numeric, random chars) = lower reputation
        elif len(domain_lower.split('.')[0]) < 4 or re.match(r'^[0-9]+$', domain_lower.split('.')[0]):
            reputation = max(reputation - 0.2, 0.1)
        
        # Cache the result
        self.domain_reputation_cache[domain_lower] = reputation
        
        return reputation
    
    def _check_permission_mismatches(self, behaviors: List[Dict], manifest_analysis: Dict) -> List[Dict]:
        """
        Check for permission mismatches between manifest and network behaviors
        
        Returns:
            List of permission mismatch flags
        """
        mismatches = []
        
        if not manifest_analysis or 'error' in manifest_analysis:
            return mismatches
        
        # Get declared permissions and hosts from manifest
        perm_analysis = manifest_analysis.get('permissions_analysis', {})
        host_analysis = manifest_analysis.get('host_permissions_analysis', {})
        
        declared_permissions = perm_analysis.get('declared_permissions', [])
        declared_hosts = host_analysis.get('declared_hosts', [])
        
        # Check if extension has host_permissions
        has_host_permissions = len(declared_hosts) > 0
        has_webrequest_permission = any('webRequest' in str(p).lower() for p in declared_permissions)
        has_webrequestblocking_permission = any('webRequestBlocking' in str(p).lower() for p in declared_permissions)
        
        # Extract destinations from network behaviors
        destinations = set()
        for behavior in behaviors:
            if behavior.get('type') in self.EXFILTRATION_INDICATORS:
                data = behavior.get('data', {})
                destination = data.get('destination') or data.get('url') or data.get('endpoint')
                if destination:
                    parsed = self._parse_destination(destination)
                    domain = parsed.get('domain', '')
                    if domain:
                        destinations.add(domain)
        
        # Check 1: Extension sends data but no host_permissions declared
        if destinations and not has_host_permissions:
            mismatches.append({
                'type': 'PERMISSION_MISMATCH',
                'severity': 'HIGH',
                'message': f'Extension sends data to {len(destinations)} domain(s) but no host_permissions declared',
                'details': {
                    'destinations': list(destinations)[:5],  # Limit to 5 for display
                    'total_destinations': len(destinations),
                    'declared_hosts': []
                }
            })
        
        # Check 2: Extension sends data to undeclared hosts
        if destinations and has_host_permissions:
            undeclared_destinations = []
            for dest in destinations:
                # Check if destination matches any declared host pattern
                is_declared = False
                for declared_host in declared_hosts:
                    # Handle patterns like "*://*/*", "https://example.com/*", etc.
                    if self._matches_host_pattern(dest, declared_host):
                        is_declared = True
                        break
                
                if not is_declared:
                    undeclared_destinations.append(dest)
            
            if undeclared_destinations:
                mismatches.append({
                    'type': 'PERMISSION_MISMATCH',
                    'severity': 'HIGH',
                    'message': f'Extension sends data to {len(undeclared_destinations)} undeclared domain(s)',
                    'details': {
                        'undeclared_destinations': undeclared_destinations[:5],
                        'total_undeclared': len(undeclared_destinations),
                        'declared_hosts': declared_hosts
                    }
                })
        
        # Check 3: Extension intercepts requests but no webRequest permission
        has_request_interception = any(b.get('type') in ['REQUEST_INTERCEPTION', 'FETCH_INTERCEPTION', 'XHR_INTERCEPTION'] 
                                      for b in behaviors)
        if has_request_interception and not has_webrequest_permission:
            mismatches.append({
                'type': 'PERMISSION_MISMATCH',
                'severity': 'CRITICAL',
                'message': 'Extension intercepts network requests but no webRequest permission declared',
                'details': {
                    'interception_types': [b.get('type') for b in behaviors 
                                         if b.get('type') in ['REQUEST_INTERCEPTION', 'FETCH_INTERCEPTION', 'XHR_INTERCEPTION']],
                    'declared_permissions': declared_permissions
                }
            })
        
        # Check 4: Extension uses webRequestBlocking but no permission
        if has_webrequestblocking_permission and not has_webrequest_permission:
            mismatches.append({
                'type': 'PERMISSION_MISMATCH',
                'severity': 'HIGH',
                'message': 'Extension declares webRequestBlocking but not webRequest permission',
                'details': {
                    'declared_permissions': declared_permissions
                }
            })
        
        return mismatches
    
    def _matches_host_pattern(self, domain: str, host_pattern: str) -> bool:
        """Check if domain matches host permission pattern"""
        # Handle patterns like:
        # "*://*/*" -> matches all
        # "https://example.com/*" -> matches example.com
        # "https://*.example.com/*" -> matches subdomains
        
        if host_pattern == "*://*/*" or host_pattern == "<all_urls>":
            return True
        
        # Extract domain from pattern
        if "://" in host_pattern:
            # Pattern like "https://example.com/*"
            pattern_domain = host_pattern.split("://")[1].split("/")[0]
        else:
            pattern_domain = host_pattern
        
        # Remove wildcard prefix
        if pattern_domain.startswith("*."):
            pattern_domain = pattern_domain[2:]
            # Check if domain ends with pattern_domain
            return domain.endswith("." + pattern_domain) or domain == pattern_domain
        else:
            # Exact match or subdomain
            return domain == pattern_domain or domain.endswith("." + pattern_domain)


if __name__ == '__main__':
    # Test the analyzer
    analyzer = NetworkAnalyzer()
    
    test_behaviors = [
        {
            'type': 'DATA_EXFILTRATION',
            'severity': 'CRITICAL',
            'timestamp': datetime.utcnow(),
            'data': {
                'destination': 'https://suspicious-site.tk/api/steal',
                'payload_size': 2000000
            }
        }
    ]
    
    results = analyzer.analyze_network_behaviors(test_behaviors)
    print(f"Risk Score: {results['risk_score']}/100")
    print(f"Risk Level: {results['risk_level']}")



