#!/usr/bin/env python3
"""
Signature-Based Analyzer
Detect malicious behaviors using known signatures and patterns
"""

import re
import logging
from typing import Dict, Any, List
from collections import defaultdict
from datetime import datetime, timedelta

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class SignatureAnalyzer:
    """Detect malicious behaviors using signature-based detection"""
    
    # Behavior signatures - indicators of malicious activity
    BEHAVIOR_SIGNATURES = {
        'keylogger_signature': {
            'indicators': [
                'KEYLOGGING',
                'FORM_DATA_CAPTURE',
                'INPUT_EVENT_LISTENER'
            ],
            'threshold': 2,  # Need 2/3 indicators
            'severity': 'CRITICAL',
            'description': 'Keylogger behavior detected'
        },
        'cookie_theft_signature': {
            'indicators': [
                'COOKIE_ACCESS',
                'DATA_EXFILTRATION',
                'SESSION_TOKEN_ACCESS'
            ],
            'threshold': 2,
            'severity': 'HIGH',
            'description': 'Cookie theft behavior detected'
        },
        'credential_harvesting_signature': {
            'indicators': [
                'KEYLOGGING',
                'FORM_DATA_CAPTURE',
                'DATA_EXFILTRATION',
                'PASSWORD_FIELD_ACCESS'
            ],
            'threshold': 3,
            'severity': 'CRITICAL',
            'description': 'Credential harvesting detected'
        },
        'session_hijacking_signature': {
            'indicators': [
                'COOKIE_ACCESS',
                'STORAGE_ACCESS',
                'DATA_EXFILTRATION',
                'TAB_MONITORING'
            ],
            'threshold': 3,
            'severity': 'CRITICAL',
            'description': 'Session hijacking detected'
        },
        'data_exfiltration_signature': {
            'indicators': [
                'DATA_EXFILTRATION',
                'FETCH_INTERCEPTION',
                'XHR_INTERCEPTION',
                'REQUEST_INTERCEPTION'
            ],
            'threshold': 2,
            'severity': 'HIGH',
            'description': 'Data exfiltration detected'
        },
        'code_injection_signature': {
            'indicators': [
                'DOM_INJECTION',
                'SCRIPT_INJECTION',
                'CONTENT_MODIFICATION',
                'EVAL_USAGE'
            ],
            'threshold': 2,
            'severity': 'HIGH',
            'description': 'Code injection detected'
        },
        'privacy_invasion_signature': {
            'indicators': [
                'GEOLOCATION_ACCESS',
                'CLIPBOARD_MONITORING',
                'HISTORY_ACCESS',
                'TAB_MONITORING'
            ],
            'threshold': 3,
            'severity': 'MEDIUM',
            'description': 'Privacy invasion detected'
        },
        'reconnaissance_signature': {
            'indicators': [
                'HISTORY_ACCESS',
                'TAB_MONITORING',
                'STORAGE_ACCESS',
                'BOOKMARK_ACCESS'
            ],
            'threshold': 2,
            'severity': 'MEDIUM',
            'description': 'Reconnaissance activity detected'
        }
    }
    
    # Suspicious domain patterns
    SUSPICIOUS_DOMAINS = [
        r'\.tk$', r'\.ml$', r'\.ga$', r'\.cf$',  # Free TLDs
        r'bit\.ly', r'tinyurl\.com',  # URL shorteners
        r'[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}'  # IP addresses
    ]
    
    def __init__(self):
        """Initialize signature analyzer"""
        self.compiled_domain_patterns = [
            re.compile(pattern, re.IGNORECASE) 
            for pattern in self.SUSPICIOUS_DOMAINS
        ]
    
    def analyze_behaviors(self, behaviors: List[Dict]) -> Dict[str, Any]:
        """
        Analyze behaviors for signature matches
        
        Args:
            behaviors: List of behavior dictionaries
            
        Returns:
            Analysis results dictionary
        """
        if not behaviors:
            return {
                'total_signatures': 0,
                'signatures_found': [],
                'risk_score': 0,
                'risk_level': 'LOW'
            }
        
        # Extract behavior types
        behavior_types = [b.get('type', '') for b in behaviors]
        behavior_types_set = set(behavior_types)
        
        # Check each signature
        signatures_found = []
        total_signatures = 0
        
        for sig_name, sig_def in self.BEHAVIOR_SIGNATURES.items():
            indicators = sig_def['indicators']
            threshold = sig_def['threshold']
            
            # Count matching indicators
            matches = sum(1 for ind in indicators if ind in behavior_types_set)
            
            if matches >= threshold:
                signatures_found.append({
                    'name': sig_name,
                    'severity': sig_def['severity'],
                    'description': sig_def['description'],
                    'indicators_matched': matches,
                    'indicators_total': len(indicators)
                })
                total_signatures += 1
        
        # Calculate risk score
        risk_score = 0
        for sig in signatures_found:
            if sig['severity'] == 'CRITICAL':
                risk_score += 30
            elif sig['severity'] == 'HIGH':
                risk_score += 20
            elif sig['severity'] == 'MEDIUM':
                risk_score += 10
        
        # Check for suspicious domains in behaviors
        suspicious_domains = []
        for behavior in behaviors:
            data = behavior.get('data', {})
            destination = data.get('destination') or data.get('url') or data.get('endpoint')
            if destination:
                for pattern in self.compiled_domain_patterns:
                    if pattern.search(destination):
                        suspicious_domains.append(destination)
                        risk_score += 5
                        break
        
        # Cap at 100
        risk_score = min(risk_score, 100)
        
        # Determine risk level
        if risk_score >= 70:
            risk_level = 'CRITICAL'
        elif risk_score >= 50:
            risk_level = 'HIGH'
        elif risk_score >= 30:
            risk_level = 'MEDIUM'
        else:
            risk_level = 'LOW'
        
        return {
            'total_signatures': total_signatures,
            'signatures_found': signatures_found,
            'suspicious_domains': suspicious_domains,
            'risk_score': risk_score,
            'risk_level': risk_level
        }


if __name__ == '__main__':
    # Test the analyzer
    analyzer = SignatureAnalyzer()
    
    test_behaviors = [
        {'type': 'KEYLOGGING', 'data': {}},
        {'type': 'FORM_DATA_CAPTURE', 'data': {}},
        {'type': 'DATA_EXFILTRATION', 'data': {'destination': 'evil.com.tk'}}
    ]
    
    results = analyzer.analyze_behaviors(test_behaviors)
    print(f"Signatures Found: {results['total_signatures']}")
    print(f"Risk Score: {results['risk_score']}/100")
    print(f"Risk Level: {results['risk_level']}")


