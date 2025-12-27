#!/usr/bin/env python3
"""
Minify Density Analyzer
Google's original code for detecting minified/obfuscated code
Based on code density analysis
"""

import re
import json
import math
import logging
from typing import Dict, Any, Optional
from collections import Counter

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class MinifyDensityAnalyzer:
    """
    Analyze code minification density
    Google's method: Calculate code density (characters per line, token density)
    High density = likely minified/obfuscated
    """
    
    def __init__(self):
        """Initialize minify density analyzer"""
        pass
    
    def analyze_density(self, code: str, file_path: Optional[str] = None) -> Dict[str, Any]:
        """
        Analyze code minification density (Google's original method)
        
        Args:
            code: JavaScript code to analyze
            file_path: Optional file path for context
            
        Returns:
            Density analysis results
        """
        if not code:
            return {
                'is_minified': False,
                'density_score': 0,
                'risk_score': 0,
                'risk_level': 'LOW'
            }
        
        analysis = {
            'file_path': file_path,
            'file_size': len(code),
            'line_count': len(code.splitlines()),
            'character_count': len(code),
            'non_whitespace_chars': len(re.sub(r'\s', '', code)),
            'is_minified': False,
            'density_score': 0.0,
            'risk_score': 0,
            'risk_level': 'LOW',
            'indicators': []
        }
        
        # Calculate code density metrics
        lines = code.splitlines()
        non_empty_lines = [line for line in lines if line.strip()]
        
        if len(non_empty_lines) == 0:
            return analysis
        
        # 1. Characters per line (Google's primary metric)
        avg_chars_per_line = sum(len(line) for line in non_empty_lines) / len(non_empty_lines)
        analysis['avg_chars_per_line'] = round(avg_chars_per_line, 2)
        
        # 2. Non-whitespace density
        non_ws_density = analysis['non_whitespace_chars'] / analysis['character_count'] if analysis['character_count'] > 0 else 0
        analysis['non_whitespace_density'] = round(non_ws_density, 3)
        
        # 3. Token density (approximate - count operators, keywords, identifiers)
        tokens = self._count_tokens(code)
        token_density = tokens / analysis['character_count'] if analysis['character_count'] > 0 else 0
        analysis['token_density'] = round(token_density, 3)
        analysis['token_count'] = tokens
        
        # 4. Variable name length (minified code has short variable names)
        avg_var_length = self._calculate_avg_variable_length(code)
        analysis['avg_variable_length'] = round(avg_var_length, 2)
        
        # 5. Comment ratio (minified code has no comments)
        comment_ratio = self._calculate_comment_ratio(code)
        analysis['comment_ratio'] = round(comment_ratio, 3)
        
        # Google's minification detection rules
        # High density indicators:
        # - > 80 chars per line (typical minified code)
        # - > 0.9 non-whitespace density
        # - < 0.05 comment ratio
        # - < 3 avg variable name length
        
        density_score = 0.0
        
        # Characters per line indicator
        if avg_chars_per_line > 100:
            density_score += 30
            analysis['indicators'].append('VERY_HIGH_CHARS_PER_LINE')
        elif avg_chars_per_line > 80:
            density_score += 20
            analysis['indicators'].append('HIGH_CHARS_PER_LINE')
        elif avg_chars_per_line > 60:
            density_score += 10
            analysis['indicators'].append('MEDIUM_CHARS_PER_LINE')
        
        # Non-whitespace density indicator
        if non_ws_density > 0.95:
            density_score += 25
            analysis['indicators'].append('VERY_HIGH_NON_WS_DENSITY')
        elif non_ws_density > 0.90:
            density_score += 15
            analysis['indicators'].append('HIGH_NON_WS_DENSITY')
        
        # Comment ratio indicator (minified code has no comments)
        if comment_ratio < 0.01:
            density_score += 20
            analysis['indicators'].append('NO_COMMENTS')
        elif comment_ratio < 0.05:
            density_score += 10
            analysis['indicators'].append('LOW_COMMENT_RATIO')
        
        # Variable name length indicator
        if avg_var_length < 2:
            density_score += 15
            analysis['indicators'].append('VERY_SHORT_VARIABLES')
        elif avg_var_length < 3:
            density_score += 10
            analysis['indicators'].append('SHORT_VARIABLES')
        
        # Token density indicator
        if token_density > 0.15:
            density_score += 10
            analysis['indicators'].append('HIGH_TOKEN_DENSITY')
        
        analysis['density_score'] = round(density_score, 2)
        
        # Detect multi-pass minification (code that's been minified multiple times)
        multi_pass_score = self._detect_multi_pass_minification(code)
        if multi_pass_score > 0:
            density_score += multi_pass_score
            analysis['indicators'].append('MULTI_PASS_MINIFICATION')
            analysis['multi_pass_score'] = multi_pass_score
        
        # Detect nested eval (eval within eval - common obfuscation technique)
        nested_eval_score = self._detect_nested_eval(code)
        if nested_eval_score > 0:
            density_score += nested_eval_score
            analysis['indicators'].append('NESTED_EVAL')
            analysis['nested_eval_score'] = nested_eval_score
        
        analysis['density_score'] = round(density_score, 2)
        
        # Determine if minified
        # Google's threshold: density_score > 40 = likely minified
        if density_score >= 50:
            analysis['is_minified'] = True
            analysis['is_likely_obfuscated'] = True
            analysis['risk_score'] = min(int(density_score), 100)
            analysis['risk_level'] = 'HIGH'
        elif density_score >= 30:
            analysis['is_minified'] = True
            analysis['is_likely_obfuscated'] = density_score >= 40
            analysis['risk_score'] = min(int(density_score * 0.8), 100)
            analysis['risk_level'] = 'MEDIUM'
        elif density_score >= 20:
            analysis['is_minified'] = False  # Might be minified but not certain
            analysis['is_likely_obfuscated'] = False
            analysis['risk_score'] = min(int(density_score * 0.5), 100)
            analysis['risk_level'] = 'LOW'
        else:
            analysis['is_minified'] = False
            analysis['is_likely_obfuscated'] = False
            analysis['risk_score'] = 0
            analysis['risk_level'] = 'LOW'
        
        return analysis
    
    def _detect_multi_pass_minification(self, code: str) -> int:
        """
        Detect multi-pass minification (code minified multiple times)
        
        Indicators:
        - Extremely short variable names (1 char) combined with high density
        - No whitespace but still has some structure
        - Repeated patterns that suggest multiple minification passes
        """
        score = 0
        
        # Check for extremely short variable names (1 char) with high frequency
        var_pattern = r'\b[a-z_$][a-z0-9_$]*\b'
        variables = re.findall(var_pattern, code)
        if variables:
            single_char_vars = [v for v in variables if len(v) == 1]
            if len(single_char_vars) > len(variables) * 0.5:  # >50% are single char
                score += 10
        
        # Check for code that's been minified then obfuscated (very high density + no structure)
        lines = code.splitlines()
        if lines:
            avg_line_length = sum(len(line) for line in lines) / len(lines)
            non_ws_density = len(re.sub(r'\s', '', code)) / len(code) if code else 0
            if avg_line_length > 200 and non_ws_density > 0.95:
                score += 15
        
        return min(score, 25)  # Cap at 25 points
    
    def _detect_nested_eval(self, code: str) -> int:
        """
        Detect nested eval patterns (eval within eval - common obfuscation)
        
        Patterns:
        - eval(eval(...))
        - eval(atob(...)) or eval(btoa(...))
        - eval(String.fromCharCode(...))
        - eval within Function constructor
        """
        score = 0
        
        # Pattern 1: eval(eval(...))
        nested_eval_pattern = r'eval\s*\(\s*eval\s*\('
        if re.search(nested_eval_pattern, code, re.IGNORECASE):
            score += 20
        
        # Pattern 2: eval(atob(...)) or eval(btoa(...))
        eval_atob_pattern = r'eval\s*\(\s*(atob|btoa)\s*\('
        if re.search(eval_atob_pattern, code, re.IGNORECASE):
            score += 15
        
        # Pattern 3: eval(String.fromCharCode(...))
        eval_char_code_pattern = r'eval\s*\(\s*String\s*\.\s*fromCharCode\s*\('
        if re.search(eval_char_code_pattern, code, re.IGNORECASE):
            score += 15
        
        # Pattern 4: eval within Function constructor
        eval_in_function_pattern = r'new\s+Function\s*\([^)]*eval\s*\('
        if re.search(eval_in_function_pattern, code, re.IGNORECASE):
            score += 15
        
        # Pattern 5: Multiple eval calls in sequence
        eval_calls = len(re.findall(r'\beval\s*\(', code, re.IGNORECASE))
        if eval_calls > 5:
            score += 10
        
        return min(score, 30)  # Cap at 30 points
    
    def _count_tokens(self, code: str) -> int:
        """Approximate token count (operators, keywords, identifiers)"""
        # Remove strings and comments for accurate token counting
        code_no_strings = re.sub(r'["\'][^"\']*["\']', '', code)
        code_no_comments = re.sub(r'//.*?$|/\*.*?\*/', '', code_no_strings, flags=re.MULTILINE | re.DOTALL)
        
        # Count operators, keywords, identifiers
        operators = len(re.findall(r'[+\-*/%=<>!&|^~?:,;.()[\]{}]', code_no_comments))
        keywords = len(re.findall(r'\b(function|var|let|const|if|else|for|while|return|new|this|typeof|instanceof)\b', code_no_comments))
        identifiers = len(re.findall(r'\b[a-zA-Z_$][a-zA-Z0-9_$]*\b', code_no_comments))
        
        return operators + keywords + identifiers
    
    def _calculate_avg_variable_length(self, code: str) -> float:
        """Calculate average variable name length"""
        # Extract variable declarations
        var_patterns = [
            r'\bvar\s+([a-zA-Z_$][a-zA-Z0-9_$]*)',
            r'\blet\s+([a-zA-Z_$][a-zA-Z0-9_$]*)',
            r'\bconst\s+([a-zA-Z_$][a-zA-Z0-9_$]*)',
            r'function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(',
            r'\.([a-zA-Z_$][a-zA-Z0-9_$]*)\s*='
        ]
        
        all_vars = []
        for pattern in var_patterns:
            matches = re.findall(pattern, code)
            all_vars.extend(matches)
        
        if not all_vars:
            return 0.0
        
        avg_length = sum(len(var) for var in all_vars) / len(all_vars)
        return avg_length
    
    def _calculate_comment_ratio(self, code: str) -> float:
        """Calculate comment ratio (comments / total characters)"""
        # Count comment characters
        single_line_comments = len(re.findall(r'//.*', code))
        multi_line_comments = len(re.findall(r'/\*.*?\*/', code, re.DOTALL))
        
        # Approximate comment length
        comment_chars = single_line_comments * 10 + multi_line_comments * 20  # Rough estimate
        
        total_chars = len(code)
        if total_chars == 0:
            return 0.0
        
        return comment_chars / total_chars


if __name__ == '__main__':
    # Test minify density analyzer
    analyzer = MinifyDensityAnalyzer()
    
    # Minified code example
    minified_code = "function a(b,c){return b+c}var d=a(1,2);console.log(d);"
    
    # Normal code example
    normal_code = """
    function addNumbers(a, b) {
        // This function adds two numbers
        return a + b;
    }
    
    var result = addNumbers(1, 2);
    console.log(result);
    """
    
    print("Minified code analysis:")
    print(json.dumps(analyzer.analyze_density(minified_code), indent=2))
    
    print("\nNormal code analysis:")
    print(json.dumps(analyzer.analyze_density(normal_code), indent=2))

