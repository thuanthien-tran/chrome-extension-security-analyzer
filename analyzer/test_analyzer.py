#!/usr/bin/env python3
"""
Test Script for Analyzer
Quick test các module mới và static analysis
"""

import json
import os
import sys
from pathlib import Path

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_csp_analyzer():
    """Test CSP Analyzer"""
    print("=" * 80)
    print("TEST 1: CSP Analyzer")
    print("=" * 80)
    
    from csp_analyzer import CSPAnalyzer
    
    analyzer = CSPAnalyzer()
    
    # Test 1: CSP với unsafe-eval
    manifest1 = {
        "manifest_version": 3,
        "name": "Test Extension",
        "content_security_policy": {
            "extension_pages": "script-src 'self' 'unsafe-eval'; object-src 'self'"
        }
    }
    
    result1 = analyzer.analyze_csp(manifest1)
    print(f"Test 1 - CSP với unsafe-eval:")
    print(f"  Risk Score: {result1['risk_score']}/100")
    print(f"  Risk Level: {result1['risk_level']}")
    print(f"  Violations: {len(result1['violations'])}")
    print()
    
    # Test 2: CSP an toàn
    manifest2 = {
        "manifest_version": 3,
        "name": "Safe Extension",
        "content_security_policy": {
            "extension_pages": "script-src 'self'; object-src 'self'"
        }
    }
    
    result2 = analyzer.analyze_csp(manifest2)
    print(f"Test 2 - CSP an toàn:")
    print(f"  Risk Score: {result2['risk_score']}/100")
    print(f"  Risk Level: {result2['risk_level']}")
    print(f"  Violations: {len(result2['violations'])}")
    print()


def test_fingerprinting_detector():
    """Test Fingerprinting Detector"""
    print("=" * 80)
    print("TEST 2: Fingerprinting Detector")
    print("=" * 80)
    
    from fingerprinting_detector import FingerprintingDetector
    
    detector = FingerprintingDetector()
    
    # Test code với fingerprinting
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
    
    result = detector.detect_fingerprinting(test_code)
    print(f"Techniques Found: {result['total_techniques']}")
    print(f"Risk Score: {result['risk_score']}/100")
    print(f"Risk Level: {result['risk_level']}")
    print(f"Techniques: {[t['technique'] for t in result['techniques_found']]}")
    print()


def test_minify_density_analyzer():
    """Test Minify Density Analyzer"""
    print("=" * 80)
    print("TEST 3: Minify Density Analyzer")
    print("=" * 80)
    
    from minify_density_analyzer import MinifyDensityAnalyzer
    
    analyzer = MinifyDensityAnalyzer()
    
    # Test 1: Minified code
    minified_code = "function a(b,c){return b+c}var d=a(1,2);console.log(d);"
    result1 = analyzer.analyze_density(minified_code)
    print(f"Test 1 - Minified Code:")
    print(f"  Is Minified: {result1['is_minified']}")
    print(f"  Density Score: {result1['density_score']}")
    print(f"  Avg Chars/Line: {result1.get('avg_chars_per_line', 'N/A')}")
    print(f"  Risk Score: {result1['risk_score']}/100")
    print()
    
    # Test 2: Normal code
    normal_code = """
    function addNumbers(a, b) {
        // This function adds two numbers
        return a + b;
    }
    
    var result = addNumbers(1, 2);
    console.log(result);
    """
    result2 = analyzer.analyze_density(normal_code)
    print(f"Test 2 - Normal Code:")
    print(f"  Is Minified: {result2['is_minified']}")
    print(f"  Density Score: {result2['density_score']}")
    print(f"  Avg Chars/Line: {result2.get('avg_chars_per_line', 'N/A')}")
    print(f"  Risk Score: {result2['risk_score']}/100")
    print()


def test_wasm_detection():
    """Test WASM Detection"""
    print("=" * 80)
    print("TEST 4: WASM Detection")
    print("=" * 80)
    
    from js_code_analyzer import JSCodeAnalyzer
    
    analyzer = JSCodeAnalyzer()
    
    # Test code với WASM
    wasm_code = """
    WebAssembly.instantiateStreaming(fetch('module.wasm'))
        .then(result => {
            const wasmModule = result.instance;
            wasmModule.exports.main();
        });
    """
    
    result = analyzer.analyze_code(wasm_code)
    wasm_detection = result.get('wasm_detection', {})
    
    print(f"WASM Found: {wasm_detection.get('wasm_found', False)}")
    print(f"Risk Score: {wasm_detection.get('risk_score', 0)}/100")
    print(f"Risk Level: {wasm_detection.get('risk_level', 'LOW')}")
    print(f"Indicators: {[i['indicator'] for i in wasm_detection.get('wasm_indicators', [])]}")
    print()


def test_static_analysis_with_extension():
    """Test Static Analysis với extension thực tế"""
    print("=" * 80)
    print("TEST 5: Static Analysis với Extension")
    print("=" * 80)
    
    # Test với high_risk_extension
    extension_path = Path(__file__).parent.parent / "test_extensions" / "high_risk_extension"
    
    if not extension_path.exists():
        print(f"Extension path không tồn tại: {extension_path}")
        print("Skipping test...")
        return
    
    manifest_path = extension_path / "manifest.json"
    
    if not manifest_path.exists():
        print(f"Manifest không tồn tại: {manifest_path}")
        print("Skipping test...")
        return
    
    try:
        from manifest_analyzer import ManifestAnalyzer
        from js_code_analyzer import JSCodeAnalyzer
        from fingerprinting_detector import FingerprintingDetector
        from minify_density_analyzer import MinifyDensityAnalyzer
        from csp_analyzer import CSPAnalyzer
        
        # Load manifest
        with open(manifest_path, 'r', encoding='utf-8') as f:
            manifest_data = json.load(f)
        
        # Analyze manifest
        manifest_analyzer = ManifestAnalyzer()
        manifest_result = manifest_analyzer.analyze_manifest(manifest_data=manifest_data)
        
        print(f"Manifest Analysis:")
        print(f"  Risk Score: {manifest_result['risk_score']}/100")
        print(f"  Risk Level: {manifest_result['risk_level']}")
        print(f"  Permission Risk: {manifest_result['permissions_analysis']['risk_score']}/40")
        print(f"  Host Permission Risk: {manifest_result['host_permissions_analysis']['risk_score']}/30")
        print()
        
        # Analyze CSP
        csp_analyzer = CSPAnalyzer()
        csp_result = csp_analyzer.analyze_csp(manifest_data)
        print(f"CSP Analysis:")
        print(f"  Risk Score: {csp_result['risk_score']}/100")
        print(f"  Violations: {len(csp_result['violations'])}")
        print()
        
        # Analyze JS files
        js_files = list(extension_path.glob("*.js"))
        if js_files:
            js_analyzer = JSCodeAnalyzer()
            fingerprinting_detector = FingerprintingDetector()
            minify_density_analyzer = MinifyDensityAnalyzer()
            
            for js_file in js_files[:3]:  # Test 3 files đầu tiên
                print(f"Analyzing: {js_file.name}")
                with open(js_file, 'r', encoding='utf-8', errors='ignore') as f:
                    code = f.read()
                
                js_result = js_analyzer.analyze_code(code, str(js_file))
                fingerprinting = fingerprinting_detector.detect_fingerprinting(code)
                minify_density = minify_density_analyzer.analyze_density(code, str(js_file))
                
                print(f"  JS Risk Score: {js_result['risk_score']}/100")
                print(f"  Code Patterns: {js_result['pattern_detection']['code_patterns_score']}/100")
                print(f"  RCE/Exfil: {js_result['pattern_detection']['rce_exfil_score']}/100")
                print(f"  Obfuscation: {js_result['obfuscation_analysis']['risk_score']}/100")
                print(f"  Chrome API: {js_result['chrome_api_detection']['risk_score']}/100")
                print(f"  Fingerprinting: {fingerprinting['risk_score']}/100 ({fingerprinting['total_techniques']} techniques)")
                print(f"  Minify Density: {minify_density['density_score']} (is_minified: {minify_density['is_minified']})")
                print(f"  WASM: {js_result['wasm_detection']['wasm_found']}")
                print()
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()


def main():
    """Run all tests"""
    print("\n" + "=" * 80)
    print("ANALYZER TEST SUITE")
    print("=" * 80 + "\n")
    
    try:
        test_csp_analyzer()
        test_fingerprinting_detector()
        test_minify_density_analyzer()
        test_wasm_detection()
        test_static_analysis_with_extension()
        
        print("=" * 80)
        print("✅ TẤT CẢ TEST ĐÃ HOÀN THÀNH")
        print("=" * 80)
        
    except Exception as e:
        print(f"\n❌ LỖI: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()





