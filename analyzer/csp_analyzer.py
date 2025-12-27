#!/usr/bin/env python3
"""
CSP (Content Security Policy) Analyzer
Analyzes CSP configuration in Chrome extensions for security risks
"""

import json
import logging
import re
from typing import Dict, Any, Optional, List

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class CSPAnalyzer:
    """Analyze Content Security Policy (CSP) in Chrome extensions"""
    
    # CSP violation patterns (Google Standard)
    CSP_VIOLATIONS = {
        'unsafe_eval': {
            'pattern': r"'unsafe-eval'",
            'severity': 'HIGH',
            'score': 30,
            'description': "CSP allows 'unsafe-eval' - enables eval() and similar functions"
        },
        'unsafe_inline': {
            'pattern': r"'unsafe-inline'",
            'severity': 'MEDIUM',
            'score': 25,
            'description': "CSP allows 'unsafe-inline' - enables inline scripts/styles"
        },
        'wildcard_source': {
            'pattern': r"\*\s*['\"]",
            'severity': 'MEDIUM',
            'score': 20,
            'description': "CSP allows wildcard source (*) - too permissive"
        },
        'data_uri': {
            'pattern': r"'data:'",
            'severity': 'LOW',
            'score': 10,
            'description': "CSP allows data: URIs - potential XSS vector"
        },
        'blob_uri': {
            'pattern': r"'blob:'",
            'severity': 'LOW',
            'score': 10,
            'description': "CSP allows blob: URIs - potential code injection"
        },
        'http_source': {
            'pattern': r"http://",
            'severity': 'MEDIUM',
            'score': 15,
            'description': "CSP allows HTTP sources - mixed content risk"
        }
    }
    
    # Safe CSP directives
    SAFE_DIRECTIVES = [
        "'self'",
        "'none'",
        "https:"
    ]
    
    def __init__(self):
        """Initialize CSP analyzer"""
        pass
    
    def analyze_csp(self, manifest_data: Dict) -> Dict[str, Any]:
        """
        Analyze CSP in manifest.json
        
        Args:
            manifest_data: Manifest data dictionary
            
        Returns:
            CSP analysis results
        """
        analysis = {
            'csp_found': False,
            'csp_policies': {},
            'violations': [],
            'risk_score': 0,
            'risk_level': 'LOW',
            'recommendations': []
        }
        
        # Check for CSP in manifest
        csp_policy = manifest_data.get('content_security_policy', {})
        
        if not csp_policy:
            # MV3: CSP is optional in service workers
            # Only flag if CSP is missing in extension_pages (HTML pages)
            analysis['csp_found'] = False
            analysis['recommendations'].append(
                'No CSP found. Consider adding CSP to extension_pages for HTML pages.'
            )
            return analysis
        
        analysis['csp_found'] = True
        analysis['csp_policies'] = csp_policy
        
        # Analyze each CSP directive
        for directive_type, policy_string in csp_policy.items():
            violations = self._analyze_csp_policy(policy_string, directive_type)
            analysis['violations'].extend(violations)
        
        # Calculate risk score (Google Standard: only penalize unsafe-eval/unsafe-inline in extension_pages)
        if 'extension_pages' in csp_policy:
            extension_pages_csp = csp_policy['extension_pages']
            if "'unsafe-eval'" in extension_pages_csp:
                analysis['risk_score'] += 30
            if "'unsafe-inline'" in extension_pages_csp:
                analysis['risk_score'] += 25
        
        # Cap at 100
        analysis['risk_score'] = min(analysis['risk_score'], 100)
        analysis['risk_level'] = self._get_risk_level(analysis['risk_score'])
        
        return analysis
    
    def _analyze_csp_policy(self, policy_string: str, directive_type: str) -> List[Dict[str, Any]]:
        """
        Analyze a single CSP policy string
        
        Args:
            policy_string: CSP policy string
            directive_type: Type of CSP (extension_pages, sandbox, etc.)
            
        Returns:
            List of violations found
        """
        violations = []
        
        # Only analyze extension_pages CSP (Google Standard)
        # MV3 service workers don't use CSP like MV2
        if directive_type != 'extension_pages':
            return violations
        
        for violation_name, violation_def in self.CSP_VIOLATIONS.items():
            pattern = violation_def['pattern']
            if re.search(pattern, policy_string, re.IGNORECASE):
                violations.append({
                    'type': violation_name,
                    'directive': directive_type,
                    'severity': violation_def['severity'],
                    'score': violation_def['score'],
                    'description': violation_def['description'],
                    'pattern_found': re.search(pattern, policy_string, re.IGNORECASE).group(0)
                })
        
        return violations
    
    def _get_risk_level(self, score: int) -> str:
        """Convert risk score to level"""
        if score >= 50:
            return 'HIGH'
        elif score >= 25:
            return 'MEDIUM'
        else:
            return 'LOW'


if __name__ == '__main__':
    # Test CSP analyzer
    analyzer = CSPAnalyzer()
    
    test_manifest = {
        "manifest_version": 3,
        "name": "Test Extension",
        "content_security_policy": {
            "extension_pages": "script-src 'self' 'unsafe-eval'; object-src 'self'"
        }
    }
    
    results = analyzer.analyze_csp(test_manifest)
    print(json.dumps(results, indent=2))




