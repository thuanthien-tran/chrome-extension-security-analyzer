#!/usr/bin/env python3
"""
Fingerprinting Detector
Detects browser fingerprinting techniques used by extensions
"""

import re
import json
import logging
import math
from typing import Dict, Any, List, Set
from collections import Counter

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class FingerprintingDetector:
    """Detect browser fingerprinting techniques"""
    
    # Fingerprinting APIs and patterns
    FINGERPRINTING_PATTERNS = {
        'canvas_fingerprinting': {
            'patterns': [
                r'\.getContext\s*\(\s*["\']2d["\']',
                r'\.toDataURL\s*\(',
                r'canvas\.getContext',
                r'HTMLCanvasElement'
            ],
            'severity': 'MEDIUM',
            'score': 15,
            'description': 'Canvas fingerprinting detected'
        },
        'webgl_fingerprinting': {
            'patterns': [
                r'\.getContext\s*\(\s*["\']webgl["\']',
                r'\.getContext\s*\(\s*["\']experimental-webgl["\']',
                r'WebGLRenderingContext',
                r'getParameter\s*\(\s*["\']UNMASKED_VENDOR_WEBGL["\']'
            ],
            'severity': 'MEDIUM',
            'score': 15,
            'description': 'WebGL fingerprinting detected'
        },
        'audio_fingerprinting': {
            'patterns': [
                r'AudioContext\s*\(',
                r'createOscillator\s*\(',
                r'createAnalyser\s*\(',
                r'getFloatFrequencyData\s*\('
            ],
            'severity': 'MEDIUM',
            'score': 15,
            'description': 'Audio fingerprinting detected'
        },
        'font_fingerprinting': {
            'patterns': [
                r'\.offsetWidth',
                r'\.offsetHeight',
                r'measureText\s*\(',
                r'getBoundingClientRect\s*\(',
                r'font.*measure'
            ],
            'severity': 'LOW',
            'score': 10,
            'description': 'Font fingerprinting detected'
        },
        'screen_fingerprinting': {
            'patterns': [
                r'screen\.(width|height|availWidth|availHeight)',
                r'window\.(innerWidth|innerHeight|outerWidth|outerHeight)',
                r'devicePixelRatio',
                r'screen\.colorDepth'
            ],
            'severity': 'LOW',
            'score': 5,
            'description': 'Screen fingerprinting detected'
        },
        'timezone_fingerprinting': {
            'patterns': [
                r'Intl\.DateTimeFormat',
                r'getTimezoneOffset\s*\(',
                r'toLocaleString\s*\(',
                r'Date\.prototype\.getTimezoneOffset'
            ],
            'severity': 'LOW',
            'score': 5,
            'description': 'Timezone fingerprinting detected'
        },
        'plugin_fingerprinting': {
            'patterns': [
                r'navigator\.plugins',
                r'navigator\.mimeTypes',
                r'\.length\s*>\s*0.*plugins',
                r'\.name.*plugin'
            ],
            'severity': 'LOW',
            'score': 5,
            'description': 'Plugin fingerprinting detected'
        },
        'hardware_fingerprinting': {
            'patterns': [
                r'navigator\.hardwareConcurrency',
                r'navigator\.deviceMemory',
                r'navigator\.maxTouchPoints',
                r'getBattery\s*\('
            ],
            'severity': 'LOW',
            'score': 5,
            'description': 'Hardware fingerprinting detected'
        },
        'behavioral_fingerprinting': {
            'patterns': [
                r'performance\.(timing|now)',
                r'requestAnimationFrame',
                r'performance\.mark',
                r'performance\.measure'
            ],
            'severity': 'MEDIUM',
            'score': 10,
            'description': 'Behavioral fingerprinting detected'
        }
    }
    
    # Suspicious combinations (multiple fingerprinting techniques)
    SUSPICIOUS_COMBINATIONS = [
        ['canvas_fingerprinting', 'webgl_fingerprinting', 'audio_fingerprinting'],
        ['canvas_fingerprinting', 'font_fingerprinting', 'screen_fingerprinting'],
        ['canvas_fingerprinting', 'webgl_fingerprinting', 'behavioral_fingerprinting']
    ]
    
    def __init__(self):
        """Initialize fingerprinting detector"""
        # Compile patterns for performance
        self.compiled_patterns = {}
        for fp_name, fp_def in self.FINGERPRINTING_PATTERNS.items():
            self.compiled_patterns[fp_name] = [
                re.compile(pattern, re.IGNORECASE | re.MULTILINE)
                for pattern in fp_def['patterns']
            ]
    
    def detect_fingerprinting(self, code: str) -> Dict[str, Any]:
        """
        Detect fingerprinting techniques in code
        
        Args:
            code: JavaScript code to analyze
            
        Returns:
            Fingerprinting detection results
        """
        detection = {
            'techniques_found': [],
            'total_techniques': 0,
            'risk_score': 0,
            'risk_level': 'LOW',
            'suspicious_combinations': [],
            'flags': []
        }
        
        found_techniques = set()
        
        # Detect each fingerprinting technique
        for fp_name, fp_def in self.FINGERPRINTING_PATTERNS.items():
            compiled = self.compiled_patterns.get(fp_name, [])
            
            for pattern in compiled:
                matches = pattern.findall(code)
                if matches:
                    found_techniques.add(fp_name)
                    detection['techniques_found'].append({
                        'technique': fp_name,
                        'severity': fp_def['severity'],
                        'score': fp_def['score'],
                        'description': fp_def['description'],
                        'matches': len(matches)
                    })
                    # Google Standard: Only count each technique once
                    detection['risk_score'] += fp_def['score']
                    break  # Found technique, move to next
        
        detection['total_techniques'] = len(found_techniques)
        
        # Calculate entropy for fingerprinting code sections
        fingerprinting_code_sections = []
        for fp_name in found_techniques:
            fp_def = self.FINGERPRINTING_PATTERNS.get(fp_name, {})
            compiled = self.compiled_patterns.get(fp_name, [])
            for pattern in compiled:
                matches = pattern.findall(code)
                if matches:
                    # Extract code around matches for entropy calculation
                    for match in matches[:3]:  # Limit to first 3 matches
                        if isinstance(match, tuple):
                            match = match[0] if match else ''
                        if match:
                            fingerprinting_code_sections.append(str(match))
        
        # Calculate entropy if we have fingerprinting code
        entropy_score = 0
        if fingerprinting_code_sections:
            combined_code = ' '.join(fingerprinting_code_sections)
            entropy = self._calculate_entropy(combined_code)
            # High entropy in fingerprinting code = more sophisticated/obfuscated
            if entropy > 4.5:
                entropy_score = 15
            elif entropy > 4.0:
                entropy_score = 10
            elif entropy > 3.5:
                entropy_score = 5
        
        detection['entropy'] = entropy if fingerprinting_code_sections else 0
        detection['entropy_score'] = entropy_score
        
        # Pattern count scoring: more patterns = higher risk
        pattern_count_score = 0
        # 'matches' is already an integer (count), not a list
        total_pattern_matches = sum(d.get('matches', 0) for d in detection['techniques_found'])
        if total_pattern_matches > 20:
            pattern_count_score = 15
        elif total_pattern_matches > 10:
            pattern_count_score = 10
        elif total_pattern_matches > 5:
            pattern_count_score = 5
        
        detection['pattern_count'] = total_pattern_matches
        detection['pattern_count_score'] = pattern_count_score
        
        # Check for suspicious combinations
        for combo in self.SUSPICIOUS_COMBINATIONS:
            if all(tech in found_techniques for tech in combo):
                detection['suspicious_combinations'].append({
                    'techniques': combo,
                    'severity': 'HIGH',
                    'description': f'Multiple fingerprinting techniques detected: {", ".join(combo)}'
                })
                detection['risk_score'] += 20  # Bonus for suspicious combination
        
        # Add entropy and pattern count scores
        detection['risk_score'] += entropy_score + pattern_count_score
        
        # Cap at 100
        detection['risk_score'] = min(detection['risk_score'], 100)
        detection['risk_level'] = self._get_risk_level(detection['risk_score'])
        
        # Add flags for high-risk fingerprinting
        if detection['total_techniques'] >= 3:
            detection['flags'].append({
                'type': 'EXCESSIVE_FINGERPRINTING',
                'severity': 'HIGH',
                'description': f'Found {detection["total_techniques"]} fingerprinting techniques - likely tracking extension'
            })
        
        return detection
    
    def _calculate_entropy(self, text: str) -> float:
        """Calculate Shannon entropy of text"""
        if not text:
            return 0.0
        
        # Count character frequencies
        char_counts = Counter(text)
        text_length = len(text)
        
        # Calculate entropy
        entropy = 0.0
        for count in char_counts.values():
            probability = count / text_length
            if probability > 0:
                entropy -= probability * math.log2(probability)
        
        return entropy
    
    def _get_risk_level(self, score: int) -> str:
        """Convert risk score to level"""
        if score >= 50:
            return 'HIGH'
        elif score >= 25:
            return 'MEDIUM'
        else:
            return 'LOW'


if __name__ == '__main__':
    # Test fingerprinting detector
    detector = FingerprintingDetector()
    
    test_code = """
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.fillText('test', 10, 10);
    const fingerprint = canvas.toDataURL();
    
    const gl = canvas.getContext('webgl');
    const vendor = gl.getParameter(gl.UNMASKED_VENDOR_WEBGL);
    
    const audioCtx = new AudioContext();
    const oscillator = audioCtx.createOscillator();
    """
    
    results = detector.detect_fingerprinting(test_code)
    print(json.dumps(results, indent=2))

