#!/usr/bin/env python3
"""
Extension Behavior Analyzer
Advanced analysis tool for detecting malicious extension patterns
Non-ML based defense system with multiple detection methods
"""

import json
import re
import os
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from collections import defaultdict
import pymongo
from pymongo import MongoClient
import argparse
import logging

# Import Non-ML analyzers
from manifest_analyzer import ManifestAnalyzer
from signature_analyzer import SignatureAnalyzer
from behavioral_analyzer import BehavioralAnalyzer
from network_analyzer import NetworkAnalyzer
from js_code_analyzer import JSCodeAnalyzer
from signature_database import SignatureDatabase
from csp_analyzer import CSPAnalyzer
from fingerprinting_detector import FingerprintingDetector
from minify_density_analyzer import MinifyDensityAnalyzer
from behavior_normalizer import BehaviorNormalizer

# Configure logging FIRST (before any logger usage)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@dataclass
class BehaviorPattern:
    """Represents a detected malicious pattern"""
    name: str
    severity: str
    confidence: float
    behaviors: List[str]
    description: str


class ExtensionAnalyzer:
    """Main analyzer class for extension behavior analysis"""
    
    # Risk scoring weights
    SEVERITY_WEIGHTS = {
        'LOW': 5,
        'MEDIUM': 15,
        'HIGH': 30,
        'CRITICAL': 50
    }
    
    # Enhanced malicious pattern signatures
    PATTERNS = {
        'CREDENTIAL_THEFT': {
            'required': ['KEYLOGGING', 'FORM_DATA_CAPTURE'],
            'optional': ['DATA_EXFILTRATION'],
            'severity': 'CRITICAL',
            'description': 'Pattern indicates credential harvesting attempt'
        },
        'ADVANCED_CREDENTIAL_THEFT': {
            'required': ['KEYLOGGING', 'FORM_DATA_CAPTURE', 'DATA_EXFILTRATION'],
            'optional': ['COOKIE_ACCESS', 'STORAGE_ACCESS'],
            'severity': 'CRITICAL',
            'confidence_threshold': 0.9,
            'time_window': 300,  # 5 minutes
            'description': 'Advanced credential theft with exfiltration'
        },
        'SESSION_HIJACKING': {
            'required': ['COOKIE_ACCESS', 'DATA_EXFILTRATION'],
            'optional': ['STORAGE_ACCESS'],
            'severity': 'CRITICAL',
            'description': 'Pattern indicates session token theft'
        },
        'STEALTH_MODE_ATTACK': {
            'required': ['REQUEST_INTERCEPTION', 'FETCH_INTERCEPTION'],
            'optional': ['XHR_INTERCEPTION', 'DATA_EXFILTRATION'],
            'severity': 'HIGH',
            'stealth_indicators': ['encrypted_payload', 'obfuscated_url'],
            'description': 'Stealth mode network interception detected'
        },
        'INFORMATION_GATHERING': {
            'required': ['HISTORY_ACCESS', 'TAB_MONITORING'],
            'optional': ['STORAGE_ACCESS'],
            'severity': 'HIGH',
            'description': 'Phát hiện thu thập thông tin người dùng quy mô lớn'
        },
        'CODE_INJECTION': {
            'required': ['DOM_INJECTION', 'SCRIPT_INJECTION'],
            'optional': ['CONTENT_MODIFICATION'],
            'severity': 'HIGH',
            'description': 'Malicious code injection detected'
        },
        'MAN_IN_THE_MIDDLE': {
            'required': ['REQUEST_INTERCEPTION', 'FETCH_INTERCEPTION'],
            'optional': ['XHR_INTERCEPTION'],
            'severity': 'HIGH',
            'description': 'Network traffic interception detected'
        },
        'PRIVACY_INVASION': {
            'required': ['GEOLOCATION_ACCESS', 'CLIPBOARD_MONITORING'],
            'optional': ['KEYLOGGING'],
            'severity': 'MEDIUM',
            'description': 'Excessive privacy-invasive behaviors'
        },
        'RAPID_EXPLOITATION': {
            'required': ['KEYLOGGING', 'COOKIE_ACCESS', 'DATA_EXFILTRATION'],
            'optional': ['FORM_DATA_CAPTURE', 'HISTORY_ACCESS'],
            'severity': 'CRITICAL',
            'time_window': 60,  # 1 minute
            'description': 'Rapid exploitation attempt detected'
        }
    }
    
    def __init__(self, mongodb_uri: str = 'mongodb://localhost:27017/', 
                 use_hybrid: bool = True, risk_model_path: Optional[str] = None):
        """
        Initialize analyzer with database connection and Google risk model
        
        Args:
            mongodb_uri: MongoDB connection URI
            use_hybrid: Whether to use hybrid analysis (all Non-ML methods)
            risk_model_path: Path to google_risk_model.json (default: same directory)
        """
        self.client = MongoClient(mongodb_uri)
        self.db = self.client['extension_security']
        self.behaviors_collection = self.db['behaviors']
        self.alerts_collection = self.db['alerts']
        
        # Load Google risk model
        if risk_model_path is None:
            current_dir = os.path.dirname(os.path.abspath(__file__))
            risk_model_path = os.path.join(current_dir, 'google_risk_model.json')
        
        self.risk_model = self._load_risk_model(risk_model_path)
        self.weights = self.risk_model.get('weights', {
            'manifest': 0.35,
            'code_patterns': 0.30,
            'rce_exfil': 0.20,
            'obfuscation': 0.10,
            'api_abuse': 0.05
        })
        
        # Initialize Non-ML analyzers (with risk model)
        self.use_hybrid = use_hybrid
        if self.use_hybrid:
            self.signature_analyzer = SignatureAnalyzer()
            self.behavioral_analyzer = BehavioralAnalyzer()
            self.network_analyzer = NetworkAnalyzer()  # For info only, NOT in scoring
            self.manifest_analyzer = ManifestAnalyzer(risk_model_path=risk_model_path)
            self.js_code_analyzer = JSCodeAnalyzer(risk_model_path=risk_model_path)
            self.signature_database = SignatureDatabase()
            self.csp_analyzer = CSPAnalyzer()
            self.fingerprinting_detector = FingerprintingDetector()
            self.minify_density_analyzer = MinifyDensityAnalyzer()
            self.behavior_normalizer = BehaviorNormalizer()
            
            logger.info("Hybrid Non-ML analysis enabled with Google risk model + enhanced analyzers")
    
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
            'weights': {
                'manifest': 0.35,
                'code_patterns': 0.30,
                'rce_exfil': 0.20,
                'obfuscation': 0.10,
                'api_abuse': 0.05
            }
        }
        
    def analyze_extension(self, extension_id: str, time_window_hours: int = 24) -> Dict[str, Any]:
        """
        Perform comprehensive analysis on an extension
        
        Args:
            extension_id: Extension identifier
            time_window_hours: Analysis time window in hours
            
        Returns:
            Analysis results dictionary
        """
        logger.info(f"Analyzing extension: {extension_id}")
        
        # Fetch behaviors
        start_time = datetime.utcnow() - timedelta(hours=time_window_hours)
        raw_behaviors = list(self.behaviors_collection.find({
            'extensionId': extension_id,
            'timestamp': {'$gte': start_time}
        }))
        
        if not raw_behaviors:
            logger.warning(f"No behaviors found for {extension_id}")
            # Return empty structure but allow static analysis
            return {
                'extensionId': extension_id,
                'analysisTime': datetime.utcnow().isoformat(),
                'timeWindow': f'{time_window_hours} hours',
                'behaviorCount': 0,
                'riskScore': 0,
                'severityDistribution': {},
                'typeDistribution': [],  # Must be array, not dict
                'patterns': [],
                'anomalies': [],
                'timeline': [],
                'recommendations': [],
                'hybrid_analysis': {} if self.use_hybrid else None
            }
        
        # Normalize behaviors (Google Standard - Anti-noise, Context Validation)
        # Note: static_analysis_for_validation will be None here for analyze_extension()
        # It will be properly set in analyze_with_manifest() after static analysis is done
        
        # Remove MongoDB ObjectId from behaviors before processing
        from bson import ObjectId
        for behavior in raw_behaviors:
            if '_id' in behavior:
                behavior['_id'] = str(behavior['_id'])  # Convert ObjectId to string
        
        # Normalize behaviors (without static analysis for now)
        behaviors = self.behavior_normalizer.normalize_behaviors(
            raw_behaviors,
            static_analysis=None  # Will be re-normalized in analyze_with_manifest() if available
        )
        
        logger.info(f"Normalized {len(behaviors)}/{len(raw_behaviors)} behaviors (filtered {len(raw_behaviors) - len(behaviors)} invalid)")
        
        # Perform basic analysis
        results = self._perform_basic_analysis(behaviors)
        results['extensionId'] = extension_id
        results['analysisTime'] = datetime.utcnow().isoformat()
        results['timeWindow'] = f'{time_window_hours} hours'
        results['rawBehaviorCount'] = len(raw_behaviors)
        results['_normalized_behaviors'] = behaviors  # Store for later validation
        
        # Hybrid analysis (Non-ML methods)
        if self.use_hybrid:
            results['hybrid_analysis'] = self._perform_hybrid_analysis(behaviors, static_analysis=None)
            # Update risk score with hybrid analysis (combines static + dynamic)
            results['riskScore'] = self._calculate_hybrid_risk_score(results)
        
        # Determine risk level
        results['riskLevel'] = self._get_risk_level(results['riskScore'])
        
        # Generate detailed score explanation
        results['score_explanation'] = self._generate_score_explanation(results)
        
        # Generate professional report sections
        results['correlation_report'] = self._generate_correlation_report(results)
        results['risk_breakdown'] = self._generate_risk_breakdown(results)
        results['top_findings'] = self._generate_top_findings(results)
        results['evidence'] = self._generate_evidence_section(results)
        results['mitigation_recommendations'] = self._generate_mitigation_recommendations(results)
        results['verdict'] = self._generate_verdict(results)
        results['visualization_data'] = self._generate_visualization_data(results)
        
        logger.info(f"Analysis complete. Risk Score: {results['riskScore']}, Level: {results['riskLevel']}")
        
        return results
    
    def _calculate_risk_score(self, behaviors: List[Dict]) -> int:
        """
        Calculate risk score from behaviors using Google Standard (DEPRECATED - use _calculate_behavior_risk_score instead)
        
        This method is kept for backward compatibility but should not be used.
        Use _calculate_behavior_risk_score() which follows Google Standard.
        """
        # Use new Google Standard method
        return self._calculate_behavior_risk_score(behaviors)
    
    def _calculate_behavior_risk_score(self, behaviors: List[Dict]) -> int:
        """
        Calculate risk score from behaviors using Google Standard (Version 2.0 - Fixed)
        
        GOOGLE STANDARD FOR BEHAVIORS:
        1. Group behaviors by severity (CRITICAL, HIGH, MEDIUM, LOW)
        2. Within each severity, get MAX score per category (not sum)
        3. Apply severity caps: CRITICAL=50, HIGH=35, MEDIUM=30, LOW=15
        4. Categorize into: RCE/Exfil, API Abuse, Code Patterns, Network Risk
        5. Apply weights: RCE/Exfil (40%), API Abuse (30%), Code Patterns (20%), Network (10%)
        6. Final score = weighted sum (0-100)
        
        Args:
            behaviors: List of behavior dictionaries (should be normalized)
            
        Returns:
            Risk score (0-100)
        """
        if not behaviors:
            return 0
        
        # Load behavior scores and severity mapping from risk model
        behavior_scores = self.risk_model.get('behavior_scores', {})
        severity_mapping = self.risk_model.get('behavior_severity_mapping', {})
        behavior_weights = self.risk_model.get('behavior_weights', {
            'rce_exfil': 0.40,
            'api_abuse': 0.30,
            'code_patterns': 0.20,
            'network_risk': 0.10
        })
        
        # Severity caps (Google Standard)
        SEVERITY_CAPS = {
            'CRITICAL': 50,
            'HIGH': 35,
            'MEDIUM': 30,
            'LOW': 15
        }
        
        # Categorize behaviors
        rce_exfil_behaviors = behavior_scores.get('rce_exfil_behaviors', {})
        api_abuse_behaviors = behavior_scores.get('api_abuse_behaviors', {})
        code_patterns_behaviors = behavior_scores.get('code_patterns_behaviors', {})
        network_risk_behaviors = behavior_scores.get('network_risk_behaviors', {})
        
        # Group behaviors by severity first
        behaviors_by_severity = {
            'CRITICAL': [],
            'HIGH': [],
            'MEDIUM': [],
            'LOW': []
        }
        
        for behavior in behaviors:
            severity = behavior.get('severity', 'LOW')
            if severity in behaviors_by_severity:
                behaviors_by_severity[severity].append(behavior)
        
        # Score each category by severity (Google Standard: max per severity per category)
        rce_exfil_scores_by_severity = {'CRITICAL': [], 'HIGH': [], 'MEDIUM': [], 'LOW': []}
        api_abuse_scores_by_severity = {'CRITICAL': [], 'HIGH': [], 'MEDIUM': [], 'LOW': []}
        code_patterns_scores_by_severity = {'CRITICAL': [], 'HIGH': [], 'MEDIUM': [], 'LOW': []}
        network_risk_scores_by_severity = {'CRITICAL': [], 'HIGH': [], 'MEDIUM': [], 'LOW': []}
        
        for severity, severity_behaviors in behaviors_by_severity.items():
            for behavior in severity_behaviors:
                behavior_type = behavior.get('type', '')
                
                # Get score from severity mapping (preferred) or behavior_scores
                score = None
                if severity in severity_mapping and behavior_type in severity_mapping[severity]:
                    score = severity_mapping[severity][behavior_type]
                elif behavior_type in rce_exfil_behaviors:
                    score = rce_exfil_behaviors[behavior_type]
                    rce_exfil_scores_by_severity[severity].append(score)
                elif behavior_type in api_abuse_behaviors:
                    score = api_abuse_behaviors[behavior_type]
                    api_abuse_scores_by_severity[severity].append(score)
                elif behavior_type in code_patterns_behaviors:
                    score = code_patterns_behaviors[behavior_type]
                    code_patterns_scores_by_severity[severity].append(score)
                elif behavior_type in network_risk_behaviors:
                    score = network_risk_behaviors[behavior_type]
                    network_risk_scores_by_severity[severity].append(score)
                
                # Also categorize by behavior_scores for fallback
                if behavior_type in rce_exfil_behaviors and score is None:
                    score = rce_exfil_behaviors[behavior_type]
                    rce_exfil_scores_by_severity[severity].append(score)
                elif behavior_type in api_abuse_behaviors and score is None:
                    score = api_abuse_behaviors[behavior_type]
                    api_abuse_scores_by_severity[severity].append(score)
                elif behavior_type in code_patterns_behaviors and score is None:
                    score = code_patterns_behaviors[behavior_type]
                    code_patterns_scores_by_severity[severity].append(score)
                elif behavior_type in network_risk_behaviors and score is None:
                    score = network_risk_behaviors[behavior_type]
                    network_risk_scores_by_severity[severity].append(score)
        
        # Get max score per category per severity, then apply severity cap
        def get_capped_category_score(scores_by_severity: Dict[str, List[int]]) -> int:
            """Get max score per category with severity caps"""
            max_scores = []
            for severity in ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']:
                if scores_by_severity[severity]:
                    max_score = max(scores_by_severity[severity])
                    cap = SEVERITY_CAPS.get(severity, 100)
                    capped_score = min(max_score, cap)
                    max_scores.append(capped_score)
            return max(max_scores) if max_scores else 0
        
        # Calculate category scores (Google Standard: max per category with severity caps)
        rce_exfil_score = get_capped_category_score(rce_exfil_scores_by_severity)
        api_abuse_score = get_capped_category_score(api_abuse_scores_by_severity)
        code_patterns_score = get_capped_category_score(code_patterns_scores_by_severity)
        network_risk_score = get_capped_category_score(network_risk_scores_by_severity)
        
        # Cap each category at 100
        rce_exfil_score = min(rce_exfil_score, 100)
        api_abuse_score = min(api_abuse_score, 100)
        code_patterns_score = min(code_patterns_score, 100)
        network_risk_score = min(network_risk_score, 100)
        
        # Apply weights (Google Standard)
        total_score = (
            rce_exfil_score * behavior_weights.get('rce_exfil', 0.40) +
            api_abuse_score * behavior_weights.get('api_abuse', 0.30) +
            code_patterns_score * behavior_weights.get('code_patterns', 0.20) +
            network_risk_score * behavior_weights.get('network_risk', 0.10)
        )
        
        # Final score (0-100)
        return min(int(total_score), 100)
    
    def _get_risk_level(self, score: int) -> str:
        """
        Determine risk level from score (Google Standard)
        
        Google Standard Mapping:
        0-30: Low
        30-50: Medium
        50-70: High
        >70: Critical
        """
        if score > 70:
            return 'CRITICAL'
        elif score >= 50:
            return 'HIGH'
        elif score >= 30:
            return 'MEDIUM'
        else:
            return 'LOW'
    
    def _get_severity_distribution(self, behaviors: List[Dict]) -> Dict[str, int]:
        """Get distribution of behaviors by severity"""
        distribution = defaultdict(int)
        for behavior in behaviors:
            severity = behavior.get('severity', 'UNKNOWN')
            distribution[severity] += 1
        return dict(distribution)
    
    def _get_type_distribution(self, behaviors: List[Dict]) -> List[Dict[str, Any]]:
        """Get distribution of behaviors by type"""
        distribution = defaultdict(int)
        for behavior in behaviors:
            behavior_type = behavior.get('type', 'UNKNOWN')
            distribution[behavior_type] += 1
        
        # Sort by frequency
        sorted_dist = sorted(distribution.items(), key=lambda x: x[1], reverse=True)
        return [{'type': k, 'count': v} for k, v in sorted_dist]
    
    def _detect_patterns(self, behaviors: List[Dict]) -> List[Dict[str, Any]]:
        """Detect malicious behavior patterns"""
        behavior_types = set(b.get('type') for b in behaviors)
        detected_patterns = []
        
        for pattern_name, pattern_def in self.PATTERNS.items():
            required = set(pattern_def['required'])
            optional = set(pattern_def.get('optional', []))
            
            # Check if all required behaviors are present
            if required.issubset(behavior_types):
                # Calculate confidence based on optional behaviors
                optional_present = len(optional.intersection(behavior_types))
                confidence = 0.7 + (0.3 * optional_present / max(len(optional), 1))
                
                detected_patterns.append({
                    'name': pattern_name,
                    'severity': pattern_def['severity'],
                    'confidence': round(confidence, 2),
                    'description': pattern_def['description'],
                    'behaviors': list(required.union(optional.intersection(behavior_types)))
                })
        
        return detected_patterns
    
    def _detect_attack_chains(self, behaviors: List[Dict]) -> List[Dict[str, Any]]:
        """
        Detect correlational attack chains (temporal sequences of related behaviors)
        
        This detects multi-stage attacks where behaviors occur in sequence:
        - Credential Theft Chain: KEYLOGGING → FORM_CAPTURE → DATA_EXFILTRATION
        - Data Harvesting Chain: COOKIE_ACCESS → STORAGE_ACCESS → DATA_EXFILTRATION
        - Injection Chain: SCRIPT_INJECTION → EVAL_EXECUTION → DATA_EXFILTRATION
        
        Args:
            behaviors: List of behavior dictionaries (should be sorted by timestamp)
            
        Returns:
            List of detected attack chains
        """
        if not behaviors:
            return []
        
        # Sort behaviors by timestamp
        sorted_behaviors = sorted(behaviors, key=lambda x: x.get('timestamp', datetime.min))
        
        attack_chains = []
        
        # Define attack chain patterns (sequence of behavior types within time window)
        CHAIN_PATTERNS = {
            'CREDENTIAL_THEFT_CHAIN': {
                'steps': ['KEYLOGGING', 'FORM_DATA_CAPTURE', 'DATA_EXFILTRATION'],
                'time_window_seconds': 60,  # All steps within 60 seconds
                'severity': 'CRITICAL',
                'name': 'Chuỗi Đánh Cắp Thông Tin Đăng Nhập',
                'description': 'Đánh cắp thông tin đăng nhập đa giai đoạn: keylogging → bắt form → rò rỉ dữ liệu',
                'risk_boost': 30
            },
            'DATA_HARVESTING_CHAIN': {
                'steps': ['COOKIE_ACCESS', 'STORAGE_ACCESS', 'DATA_EXFILTRATION'],
                'time_window_seconds': 120,  # All steps within 2 minutes
                'severity': 'HIGH',
                'name': 'Chuỗi Thu Thập Dữ Liệu',
                'description': 'Chuỗi thu thập dữ liệu: truy cập cookie/storage → rò rỉ dữ liệu',
                'risk_boost': 20
            },
            'INJECTION_CHAIN': {
                'steps': ['SCRIPT_INJECTION', 'EVAL_EXECUTION', 'DATA_EXFILTRATION'],
                'time_window_seconds': 90,
                'severity': 'CRITICAL',
                'name': 'Chuỗi Tiêm Mã Độc',
                'description': 'Chuỗi tiêm mã độc: tiêm script → thực thi eval → rò rỉ dữ liệu',
                'risk_boost': 25
            },
            'SESSION_HIJACKING_CHAIN': {
                'steps': ['COOKIE_ACCESS', 'SESSION_HIJACKING', 'DATA_EXFILTRATION'],
                'time_window_seconds': 60,
                'severity': 'CRITICAL',
                'name': 'Chuỗi Chiếm Quyền Phiên',
                'description': 'Chuỗi chiếm quyền phiên: truy cập cookie → chiếm phiên → rò rỉ dữ liệu',
                'risk_boost': 30
            },
            'TOKEN_THEFT_CHAIN': {
                'steps': ['TOKEN_ACCESS', 'TOKEN_THEFT', 'DATA_EXFILTRATION'],
                'time_window_seconds': 60,
                'severity': 'CRITICAL',
                'name': 'Chuỗi Đánh Cắp Token',
                'description': 'Chuỗi đánh cắp token: truy cập token → đánh cắp → rò rỉ dữ liệu',
                'risk_boost': 30
            },
            'SIMPLE_EXFILTRATION_CHAIN': {
                'steps': ['KEYLOGGING', 'DATA_EXFILTRATION'],
                'time_window_seconds': 30,
                'severity': 'HIGH',
                'name': 'Chuỗi Rò Rỉ Đơn Giản',
                'description': 'Rò rỉ đơn giản: keylogging → rò rỉ dữ liệu ngay lập tức',
                'risk_boost': 15
            }
        }
        
        # Detect each chain pattern
        for chain_name, chain_def in CHAIN_PATTERNS.items():
            steps = chain_def['steps']
            time_window = chain_def['time_window_seconds']
            
            # Find behaviors matching each step
            step_behaviors = {step: [] for step in steps}
            for behavior in sorted_behaviors:
                behavior_type = behavior.get('type', '')
                if behavior_type in steps:
                    step_behaviors[behavior_type].append(behavior)
            
            # Check if all steps have at least one behavior
            if all(step_behaviors[step] for step in steps):
                # Check if behaviors occur in sequence within time window
                chain_instances = self._find_temporal_chains(step_behaviors, steps, time_window)
                
                for chain_instance in chain_instances:
                    attack_chains.append({
                        'name': chain_def.get('name', chain_name),  # Use translated name if available
                        'severity': chain_def['severity'],
                        'description': chain_def['description'],
                        'steps': chain_instance['steps'],
                        'timeline': chain_instance['timeline'],
                        'duration_seconds': chain_instance['duration'],
                        'risk_boost': chain_def['risk_boost'],
                        'confidence': chain_instance['confidence']
                    })
        
        logger.info(f"Detected {len(attack_chains)} attack chains")
        return attack_chains
    
    def _find_temporal_chains(self, step_behaviors: Dict[str, List[Dict]], 
                              steps: List[str], time_window_seconds: int) -> List[Dict]:
        """
        Find temporal sequences of behaviors matching chain pattern
        
        Returns:
            List of chain instances with timeline
        """
        chains = []
        
        # Get first behavior of first step
        first_step = steps[0]
        if not step_behaviors[first_step]:
            return chains
        
        # For each first step behavior, try to find a complete chain
        for first_behavior in step_behaviors[first_step]:
            first_timestamp = self._get_timestamp(first_behavior)
            if not first_timestamp:
                continue
            
            # Try to find subsequent steps within time window
            chain_steps = [first_behavior]
            current_timestamp = first_timestamp
            
            for step in steps[1:]:
                # Find next step behavior within time window
                found = False
                for behavior in step_behaviors[step]:
                    behavior_timestamp = self._get_timestamp(behavior)
                    if not behavior_timestamp:
                        continue
                    
                    # Check if within time window
                    time_diff = (behavior_timestamp - first_timestamp).total_seconds()
                    if 0 <= time_diff <= time_window_seconds:
                        chain_steps.append(behavior)
                        current_timestamp = behavior_timestamp
                        found = True
                        break
                
                if not found:
                    break  # Chain broken
            
            # If all steps found, create chain instance
            if len(chain_steps) == len(steps):
                last_timestamp = self._get_timestamp(chain_steps[-1])
                duration = (last_timestamp - first_timestamp).total_seconds()
                
                # Calculate confidence based on time proximity
                # Closer together = higher confidence
                max_duration = time_window_seconds
                confidence = max(0.7, 1.0 - (duration / max_duration) * 0.3)
                
                chains.append({
                    'steps': chain_steps,
                    'timeline': [
                        {
                            'step': steps[i],
                            'behavior': chain_steps[i],
                            'timestamp': self._get_timestamp(chain_steps[i]).isoformat()
                        }
                        for i in range(len(chain_steps))
                    ],
                    'duration': duration,
                    'confidence': round(confidence, 2)
                })
        
        return chains
    
    def _get_timestamp(self, behavior: Dict) -> Optional[datetime]:
        """Extract timestamp from behavior"""
        timestamp = behavior.get('timestamp')
        if isinstance(timestamp, datetime):
            return timestamp
        elif isinstance(timestamp, str):
            try:
                return datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
            except:
                return None
        return None
    
    def _detect_anomalies(self, behaviors: List[Dict]) -> List[Dict[str, Any]]:
        """Detect anomalous behaviors with enhanced rules"""
        anomalies = []
        
        # Check for high-frequency behaviors
        type_counts = defaultdict(int)
        for behavior in behaviors:
            type_counts[behavior.get('type')] += 1
        
        for behavior_type, count in type_counts.items():
            if count > 10:
                anomalies.append({
                    'type': 'HIGH_FREQUENCY',
                    'behaviorType': behavior_type,
                    'count': count,
                    'severity': 'MEDIUM',
                    'description': f'Ghi nhận {count} lần xuất hiện {behavior_type} trong thời gian này'
                })
        
        # Check for rapid succession of critical behaviors
        critical_behaviors = [b for b in behaviors if b.get('severity') == 'CRITICAL']
        if len(critical_behaviors) >= 3:
            time_diff = (critical_behaviors[-1]['timestamp'] - critical_behaviors[0]['timestamp']).total_seconds()
            if time_diff < 300:  # 5 minutes
                anomalies.append({
                    'type': 'RAPID_CRITICAL_ACTIVITY',
                    'count': len(critical_behaviors),
                    'timeWindow': f'{int(time_diff)} giây',
                    'severity': 'CRITICAL',
                    'description': 'Nhiều hành vi nguy hiểm xảy ra liên tiếp trong thời gian ngắn'
                })
        
        # Check for data exfiltration volume
        exfil_behaviors = [b for b in behaviors if b.get('type') == 'DATA_EXFILTRATION']
        if len(exfil_behaviors) > 5:
            anomalies.append({
                'type': 'EXCESSIVE_EXFILTRATION',
                'count': len(exfil_behaviors),
                'severity': 'CRITICAL',
                'description': 'Số lượng bất thường các lần rò rỉ dữ liệu'
            })
        
        # Enhanced: Rapid fire detection (> 10 behaviors in 1 minute)
        if len(behaviors) > 0:
            time_span = (behaviors[-1].get('timestamp', datetime.utcnow()) - 
                        behaviors[0].get('timestamp', datetime.utcnow())).total_seconds()
            if time_span > 0:
                rate = len(behaviors) / (time_span / 60)  # behaviors per minute
                if rate > 10:
                    anomalies.append({
                        'type': 'RAPID_FIRE',
                        'rate': round(rate, 2),
                        'severity': 'HIGH',
                        'description': f'Tỷ lệ hành vi cực cao: {rate:.2f} hành vi/phút'
                    })
        
        # Enhanced: Burst detection (> 50 behaviors in 5 minutes)
        if len(behaviors) > 50:
            recent_behaviors = behaviors[-50:]
            time_span = (recent_behaviors[-1].get('timestamp', datetime.utcnow()) - 
                        recent_behaviors[0].get('timestamp', datetime.utcnow())).total_seconds()
            if time_span < 300:  # 5 minutes
                anomalies.append({
                    'type': 'BURST_DETECTION',
                    'count': len(recent_behaviors),
                    'timeWindow': f'{int(time_span)} giây',
                    'severity': 'HIGH',
                    'description': f'{len(recent_behaviors)} hành vi trong {int(time_span)} giây'
                })
        
        # Enhanced: Off-hours activity (2 AM - 6 AM)
        off_hours_count = sum(1 for b in behaviors 
                             if isinstance(b.get('timestamp'), datetime) 
                             and 2 <= b.get('timestamp').hour < 6)
        if off_hours_count > len(behaviors) * 0.3:
            anomalies.append({
                'type': 'OFF_HOURS_ACTIVITY',
                'count': off_hours_count,
                'percentage': round(off_hours_count / len(behaviors) * 100, 2),
                'severity': 'MEDIUM',
                'description': f'{off_hours_count} hành vi trong giờ nghỉ (2-6 giờ sáng)'
            })
        
        return anomalies
    
    def _create_timeline(self, behaviors: List[Dict]) -> List[Dict[str, Any]]:
        """Create hourly timeline of behavior activity"""
        timeline = defaultdict(lambda: defaultdict(int))
        
        for behavior in behaviors:
            timestamp = behavior.get('timestamp')
            if isinstance(timestamp, datetime):
                hour_key = timestamp.strftime('%Y-%m-%d %H:00')
                severity = behavior.get('severity', 'LOW')
                timeline[hour_key][severity] += 1
        
        # Convert to sorted list
        timeline_list = []
        for hour, severities in sorted(timeline.items()):
            timeline_list.append({
                'hour': hour,
                'total': sum(severities.values()),
                **dict(severities)
            })
        
        return timeline_list
    
    def _generate_recommendations(self, behaviors: List[Dict]) -> List[str]:
        """Generate security recommendations (Tiếng Việt)"""
        recommendations = []
        behavior_types = set(b.get('type') for b in behaviors)
        
        if 'KEYLOGGING' in behavior_types or 'FORM_DATA_CAPTURE' in behavior_types:
            recommendations.append(
                "🚨 NGUY HIỂM: Xóa extension ngay lập tức - Phát hiện đánh cắp thông tin đăng nhập"
            )
        
        if 'DATA_EXFILTRATION' in behavior_types:
            recommendations.append(
                "🚨 NGUY HIỂM: Chặn truy cập mạng và điều tra rò rỉ dữ liệu"
            )
        
        if 'COOKIE_ACCESS' in behavior_types:
            recommendations.append(
                "⚠️ CAO: Xóa cookies trình duyệt và đặt lại session tokens"
            )
        
        if 'TOKEN_THEFT' in behavior_types or 'SESSION_HIJACKING' in behavior_types:
            recommendations.append(
                "🚨 NGUY HIỂM: Phát hiện đánh cắp token/session - Xóa extension và đổi mật khẩu ngay"
            )
        
        if 'SCRIPT_INJECTION' in behavior_types or 'DOM_INJECTION' in behavior_types:
            recommendations.append(
                "⚠️ CAO: Quét hệ thống để tìm malware bổ sung"
            )
        
        if 'EVAL_EXECUTION' in behavior_types or 'FUNCTION_CONSTRUCTOR' in behavior_types:
            recommendations.append(
                "⚠️ CAO: Phát hiện thực thi code động (eval/new Function) - Rủi ro bảo mật cao"
            )
        
        if 'REMOTE_SCRIPT_LOAD' in behavior_types or 'DYNAMIC_IMPORT' in behavior_types:
            recommendations.append(
                "⚠️ CAO: Phát hiện tải script từ xa - Có thể thực thi mã độc"
            )
        
        if len(behaviors) > 50:
            recommendations.append(
                "📊 TRUNG BÌNH: Số lượng behaviors quá nhiều - Nên theo dõi và giới hạn hoạt động"
            )
        
        # Check risk level from score
        risk_score = self._calculate_behavior_risk_score(behaviors) if behaviors else 0
        if risk_score >= 70:
            recommendations.append(
                "🚨 ĐIỂM RỦI RO CRITICAL: Extension này cực kỳ nguy hiểm, nên xóa ngay lập tức"
            )
        elif risk_score >= 50:
            recommendations.append(
                "⚠️ ĐIỂM RỦI RO CAO: Extension này có nguy cơ cao, nên xem xét tắt hoặc xóa"
            )
        elif risk_score >= 30:
            recommendations.append(
                "📊 ĐIỂM RỦI RO TRUNG BÌNH: Extension này có một số rủi ro, nên theo dõi"
            )
        
        if not recommendations:
            recommendations.append("✅ Theo dõi hoạt động của extension để phát hiện thay đổi")
        
        return recommendations
    
    def _generate_score_explanation(self, results: Dict) -> Dict[str, Any]:
        """
        Generate detailed explanation of risk score for user
        
        Returns:
            Dictionary with score breakdown and explanation
        """
        breakdown = results.get('score_breakdown', {})
        risk_score = results.get('riskScore', 0)
        risk_level = results.get('riskLevel', 'UNKNOWN')
        
        explanation = {
            'risk_level': risk_level,
            'risk_score': risk_score,
            'components': [],
            'summary': f"Risk Level: {risk_level} ({risk_score}/100)"
        }
        
        # Build component explanations
        component_names = {
            'permission_risk': 'Permission Risk',
            'host_permissions': 'Host Permissions',
            'content_script_scope': 'Content Script Scope',
            'code_patterns': 'Code Patterns',
            'rce_exfil': 'RCE/Data Exfiltration',
            'obfuscation': 'Obfuscation Level',
            'chrome_api_risk': 'Chrome API Risk',
            'network_behavior': 'Network Behavior'
        }
        
        for comp_key, comp_data in breakdown.items():
            comp_name = component_names.get(comp_key, comp_key)
            raw_score = comp_data.get('raw', 0)
            max_score = comp_data.get('max', 0)
            weighted = comp_data.get('weighted', 0)
            
            percentage = (raw_score / max_score * 100) if max_score > 0 else 0
            
            explanation['components'].append({
                'name': comp_name,
                'raw_score': f"{raw_score}/{max_score}",
                'percentage': round(percentage, 1),
                'weighted_contribution': round(weighted, 2),
                'status': 'HIGH' if percentage >= 70 else ('MEDIUM' if percentage >= 40 else 'LOW')
            })
        
        # Generate summary text
        high_risk_components = [c for c in explanation['components'] if c['status'] == 'HIGH']
        if high_risk_components:
            explanation['summary'] += f"\n\nHigh-risk components detected: {', '.join([c['name'] for c in high_risk_components])}"
        
        return explanation
    
    def _perform_hybrid_analysis(self, behaviors: List[Dict], static_analysis: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Perform hybrid analysis using all Non-ML methods
        
        Args:
            behaviors: List of behavior dictionaries
            
        Returns:
            Hybrid analysis results
        """
        logger.info("Performing hybrid Non-ML analysis...")
        
        hybrid_results = {
            'signature_analysis': self.signature_analyzer.analyze_behaviors(behaviors),
            'behavioral_analysis': self.behavioral_analyzer.analyze(behaviors, static_analysis=static_analysis),
            'network_analysis': None,  # Will be populated with manifest cross-check if available
            'manifest_analysis': None,  # Will be populated if manifest is available
            'signature_database_analysis': None  # Will be populated if code/manifest available
        }
        
        # Perform network analysis (even without manifest for now)
        if behaviors:
            hybrid_results['network_analysis'] = self.network_analyzer.analyze_network_behaviors(behaviors, manifest_analysis=None)
        
        # Check signature database for behaviors
        if behaviors:
            # Extract domains from behaviors
            domains = set()
            for behavior in behaviors:
                data = behavior.get('data', {})
                destination = data.get('destination') or data.get('url') or data.get('endpoint')
                if destination:
                    try:
                        from urllib.parse import urlparse
                        parsed = urlparse(destination if destination.startswith('http') else f'http://{destination}')
                        domain = parsed.netloc or parsed.path.split('/')[0]
                        if domain:
                            domains.add(domain)
                    except:
                        pass
            
            # Check domains against blacklist
            domain_checks = []
            for domain in domains:
                check = self.signature_database.check_domain(domain)
                if check.get('is_blacklisted'):
                    domain_checks.append(check)
            
            if domain_checks:
                hybrid_results['signature_database_analysis'] = {
                    'blacklisted_domains': domain_checks,
                    'risk_score': len(domain_checks) * 15,
                    'risk_level': 'HIGH' if len(domain_checks) > 0 else 'LOW'
                }
        
        logger.info("Hybrid analysis complete")
        
        return hybrid_results
    
    def _calculate_hybrid_risk_score(self, results: Dict) -> int:
        """
        Calculate weighted risk score (Google Standard - Version 2.0)
        Uses weights from google_risk_model.json
        
        GOOGLE STANDARD FORMULA:
        TOTAL_RISK = Manifest_Risk × 0.35 + Code_Patterns × 0.30 + RCE_Exfil × 0.20 
                   + Obfuscation × 0.10 + API_Abuse × 0.05
        
        Each component is scored 0-100 independently, then weighted and summed.
        Network analyzer is NOT included (not in Google model).
        
        Args:
            results: Analysis results dictionary
            
        Returns:
            Combined risk score (0-100) with detailed breakdown
        """
        behavior_count = results.get('behaviorCount', 0)
        hybrid = results.get('hybrid_analysis', {})
        
        # Check if this is a static scan (no behaviors but has manifest/js analysis)
        is_static_scan = (behavior_count == 0 and 
                         ('manifest_analysis' in hybrid or 'js_code_analysis' in hybrid))
        
        # Component scores (for explanation)
        component_scores = {}
        
        if is_static_scan:
            # GOOGLE STANDARD STATIC ANALYSIS SCORING SYSTEM
            # Load weights from JSON (already loaded in __init__)
            weights = self.weights
            
            total_score = 0.0
            
            # 1. Manifest Risk (0-100 points, weight from JSON)
            manifest_analysis = hybrid.get('manifest_analysis', {})
            manifest_risk = manifest_analysis.get('risk_score', 0)  # Already 0-100 from manifest_analyzer
            manifest_risk = min(manifest_risk, 100)  # Ensure cap
            weighted_manifest = manifest_risk * weights.get('manifest', 0.35)
            total_score += weighted_manifest
            component_scores['manifest_risk'] = {'raw': manifest_risk, 'max': 100, 'weighted': weighted_manifest}
            
            # 2. Code Pattern Risk (0-100 points, weight from JSON)
            # Google Standard: Lấy max từ tất cả files, không cộng dồn
            js_analysis = hybrid.get('js_code_analysis', {})
            code_patterns_scores = []
            if js_analysis.get('files'):
                for file_result in js_analysis['files']:
                    pattern_detection = file_result.get('pattern_detection', {})
                    score = pattern_detection.get('code_patterns_score', 0)
                    if score > 0:
                        code_patterns_scores.append(score)
            code_patterns_score = max(code_patterns_scores) if code_patterns_scores else 0
            code_patterns_score = min(code_patterns_score, 100)  # Cap at 100 (Google Standard)
            weighted_code = code_patterns_score * weights.get('code_patterns', 0.30)
            total_score += weighted_code
            component_scores['code_patterns'] = {'raw': code_patterns_score, 'max': 100, 'weighted': weighted_code}
            
            # 3. RCE/Exfiltration (0-100 points, weight from JSON)
            # Google Standard: Lấy max từ tất cả files, không cộng dồn
            rce_exfil_scores = []
            if js_analysis.get('files'):
                for file_result in js_analysis['files']:
                    pattern_detection = file_result.get('pattern_detection', {})
                    score = pattern_detection.get('rce_exfil_score', 0)
                    if score > 0:
                        rce_exfil_scores.append(score)
            rce_exfil_score = max(rce_exfil_scores) if rce_exfil_scores else 0
            rce_exfil_score = min(rce_exfil_score, 100)  # Cap at 100 (Google Standard)
            
            # Check for form hijacking (CRITICAL) - boost weight to ensure CRITICAL rating
            # Form hijacking is detected if rce_exfil_score = 100 (from redirect_analysis merge)
            if rce_exfil_score >= 100:
                # Form hijacking detected - use higher weight to ensure CRITICAL (70+)
                # Use 0.50 weight instead of 0.20 to ensure CRITICAL rating
                weighted_rce = rce_exfil_score * 0.50  # Boost weight for form hijacking
            else:
                weighted_rce = rce_exfil_score * weights.get('rce_exfil', 0.20)
            total_score += weighted_rce
            component_scores['rce_exfil'] = {'raw': rce_exfil_score, 'max': 100, 'weighted': weighted_rce}
            
            # 4. Obfuscation (0-100 points, weight from JSON)
            # Google Standard: Lấy max từ tất cả files, không cộng dồn
            obfuscation_scores = []
            if js_analysis.get('files'):
                for file_result in js_analysis['files']:
                    obfuscation_analysis = file_result.get('obfuscation_analysis', {})
                    score = obfuscation_analysis.get('risk_score', 0)
                    if score > 0:
                        obfuscation_scores.append(score)
            obfuscation_score = max(obfuscation_scores) if obfuscation_scores else 0
            obfuscation_score = min(obfuscation_score, 100)  # Cap at 100 (Google Standard)
            weighted_obfuscation = obfuscation_score * weights.get('obfuscation', 0.10)
            total_score += weighted_obfuscation
            component_scores['obfuscation'] = {'raw': obfuscation_score, 'max': 100, 'weighted': weighted_obfuscation}
            
            # 5. Chrome API Abuse (0-100 points, weight from JSON)
            # Google Standard: Lấy max từ tất cả files, không cộng dồn
            chrome_api_scores = []
            if js_analysis.get('files'):
                for file_result in js_analysis['files']:
                    chrome_api_detection = file_result.get('chrome_api_detection', {})
                    score = chrome_api_detection.get('risk_score', 0)
                    if score > 0:
                        chrome_api_scores.append(score)
            chrome_api_score = max(chrome_api_scores) if chrome_api_scores else 0
            chrome_api_score = min(chrome_api_score, 100)  # Cap at 100 (Google Standard)
            weighted_chrome_api = chrome_api_score * weights.get('api_abuse', 0.05)
            total_score += weighted_chrome_api
            component_scores['chrome_api_abuse'] = {'raw': chrome_api_score, 'max': 100, 'weighted': weighted_chrome_api}
            
            # NOTE: Network analyzer is NOT included in scoring (not in Google model)
            
            # Store component scores for explanation
            results['score_breakdown'] = component_scores
            
            # Final score is already normalized (0-100)
            final_score = min(int(total_score), 100)
            
            return final_score
        else:
            # For runtime analysis (with behaviors), use HYBRID Google Standard
            # Combine Static Analysis (if available) + Dynamic Analysis (behaviors)
            # Formula: Static (70%) + Dynamic (30%) if both available
            # Or: Static only (100%) or Dynamic only (100%) if only one available
            
            weights = self.weights
            behavior_weights = self.risk_model.get('behavior_weights', {
                'rce_exfil': 0.40,
                'api_abuse': 0.30,
                'code_patterns': 0.20,
                'network_risk': 0.10
            })
            
            total_score = 0.0
            component_scores = {}
            
            # === STATIC ANALYSIS COMPONENTS (if available) ===
            static_score = 0.0
            has_static = False
            
            # 1. Manifest Risk (0-100 points, weight from JSON)
            manifest_analysis = hybrid.get('manifest_analysis', {})
            manifest_risk = manifest_analysis.get('risk_score', 0) if manifest_analysis else 0
            manifest_risk = min(manifest_risk, 100)
            weighted_manifest = manifest_risk * weights.get('manifest', 0.35)
            if manifest_risk > 0:
                has_static = True
                static_score += weighted_manifest
            component_scores['manifest_risk'] = {'raw': manifest_risk, 'max': 100, 'weighted': weighted_manifest}
            
            # 2. Code Pattern Risk (0-100 points, weight from JSON)
            js_analysis = hybrid.get('js_code_analysis', {})
            code_patterns_scores = []
            if js_analysis and js_analysis.get('files'):
                for file_result in js_analysis['files']:
                    pattern_detection = file_result.get('pattern_detection', {})
                    score = pattern_detection.get('code_patterns_score', 0)
                    if score > 0:
                        code_patterns_scores.append(score)
            code_patterns_score = max(code_patterns_scores) if code_patterns_scores else 0
            code_patterns_score = min(code_patterns_score, 100)
            weighted_code = code_patterns_score * weights.get('code_patterns', 0.30)
            if code_patterns_score > 0:
                has_static = True
                static_score += weighted_code
            component_scores['code_patterns'] = {'raw': code_patterns_score, 'max': 100, 'weighted': weighted_code}
            
            # 3. RCE/Exfiltration (0-100 points, weight from JSON)
            rce_exfil_scores = []
            if js_analysis and js_analysis.get('files'):
                for file_result in js_analysis['files']:
                    pattern_detection = file_result.get('pattern_detection', {})
                    score = pattern_detection.get('rce_exfil_score', 0)
                    if score > 0:
                        rce_exfil_scores.append(score)
            rce_exfil_score = max(rce_exfil_scores) if rce_exfil_scores else 0
            rce_exfil_score = min(rce_exfil_score, 100)
            
            # Check for form hijacking (CRITICAL) - boost weight to ensure CRITICAL rating
            if rce_exfil_score >= 100:
                # Form hijacking detected - use higher weight to ensure CRITICAL (70+)
                weighted_rce = rce_exfil_score * 0.50  # Boost weight for form hijacking
            else:
                weighted_rce = rce_exfil_score * weights.get('rce_exfil', 0.20)
            if rce_exfil_score > 0:
                has_static = True
                static_score += weighted_rce
            component_scores['rce_exfil'] = {'raw': rce_exfil_score, 'max': 100, 'weighted': weighted_rce}
            
            # 4. Obfuscation (0-100 points, weight from JSON)
            obfuscation_scores = []
            if js_analysis and js_analysis.get('files'):
                for file_result in js_analysis['files']:
                    obfuscation_analysis = file_result.get('obfuscation_analysis', {})
                    score = obfuscation_analysis.get('risk_score', 0)
                    if score > 0:
                        obfuscation_scores.append(score)
            obfuscation_score = max(obfuscation_scores) if obfuscation_scores else 0
            obfuscation_score = min(obfuscation_score, 100)
            weighted_obfuscation = obfuscation_score * weights.get('obfuscation', 0.10)
            if obfuscation_score > 0:
                has_static = True
                static_score += weighted_obfuscation
            component_scores['obfuscation'] = {'raw': obfuscation_score, 'max': 100, 'weighted': weighted_obfuscation}
            
            # 5. Chrome API Abuse (0-100 points, weight from JSON)
            chrome_api_scores = []
            if js_analysis and js_analysis.get('files'):
                for file_result in js_analysis['files']:
                    chrome_api_detection = file_result.get('chrome_api_detection', {})
                    score = chrome_api_detection.get('risk_score', 0)
                    if score > 0:
                        chrome_api_scores.append(score)
            chrome_api_score = max(chrome_api_scores) if chrome_api_scores else 0
            chrome_api_score = min(chrome_api_score, 100)
            weighted_chrome_api = chrome_api_score * weights.get('api_abuse', 0.05)
            if chrome_api_score > 0:
                has_static = True
                static_score += weighted_chrome_api
            component_scores['chrome_api_abuse'] = {'raw': chrome_api_score, 'max': 100, 'weighted': weighted_chrome_api}
            
            # === DYNAMIC ANALYSIS COMPONENTS (from behaviors) ===
            dynamic_score = 0.0
            has_dynamic = behavior_count > 0
            
            if has_dynamic:
                # Get behaviors from results (already fetched and normalized in analyze_extension)
                # Validate behaviors against static analysis (Google Standard: Behavior only valid if code supports it)
                validated_behaviors = self._validate_behaviors_against_static(results, hybrid)
                
                # Calculate behavior risk score using Google Standard
                behavior_risk = self._calculate_behavior_risk_score(validated_behaviors) if validated_behaviors else 0
                dynamic_score = behavior_risk  # Already 0-100
                component_scores['behavior_risk'] = {
                    'raw': behavior_risk,
                    'max': 100,
                    'weighted': behavior_risk,
                    'validated_count': len(validated_behaviors) if validated_behaviors else 0,
                    'original_count': behavior_count
                }
            
            # === COMBINE STATIC + DYNAMIC (Google Standard Hybrid) ===
            if has_static and has_dynamic:
                # Hybrid: Static (70%) + Dynamic (30%)
                base_score = (static_score * 0.70) + (dynamic_score * 0.30)
                
                # Detect cross-correlation (static + dynamic patterns match)
                correlation_boost = self._detect_cross_correlation(results, hybrid, component_scores)
                
                # Detect attack chains (temporal correlation)
                attack_chains = results.get('attack_chains', [])
                chain_boost = sum(chain.get('risk_boost', 0) for chain in attack_chains)
                chain_boost = min(chain_boost, 25.0)  # Cap chain boost at 25 points
                
                total_score = base_score + correlation_boost + chain_boost
                component_scores['hybrid_combination'] = {
                    'static_score': static_score,
                    'dynamic_score': dynamic_score,
                    'static_weight': 0.70,
                    'dynamic_weight': 0.30,
                    'correlation_boost': correlation_boost,
                    'chain_boost': chain_boost,
                    'base_score': base_score
                }
            elif has_static:
                # Static only
                total_score = static_score
            elif has_dynamic:
                # Dynamic only
                total_score = dynamic_score
            else:
                # No analysis available
                total_score = 0.0
            
            # Store component scores for explanation
            results['score_breakdown'] = component_scores
            
            # Google Standard: FAIL conditions (auto-reject)
            # If any component is CRITICAL, extension should be rejected
            fail_conditions = []
            
            # Check manifest risk level
            manifest_risk = component_scores.get('manifest_risk', {}).get('raw', 0)
            if manifest_risk >= 70:  # CRITICAL threshold
                fail_conditions.append({
                    'component': 'manifest',
                    'risk_level': 'CRITICAL',
                    'score': manifest_risk,
                    'reason': 'Manifest risk is CRITICAL - extension should be rejected'
                })
            
            # Check behavior risk level
            behavior_risk = component_scores.get('behavior_risk', {}).get('raw', 0)
            if behavior_risk >= 70:  # CRITICAL threshold
                fail_conditions.append({
                    'component': 'behavior',
                    'risk_level': 'CRITICAL',
                    'score': behavior_risk,
                    'reason': 'Behavior risk is CRITICAL - extension should be rejected'
                })
            
            # Check network risk (if available)
            network_analysis = results.get('hybrid_analysis', {}).get('network_analysis', {})
            if network_analysis:
                network_risk = network_analysis.get('risk_score', 0)
                if network_risk >= 70:  # CRITICAL threshold
                    fail_conditions.append({
                        'component': 'network',
                        'risk_level': 'CRITICAL',
                        'score': network_risk,
                        'reason': 'Network risk is CRITICAL - extension should be rejected'
                    })
            
            # Store fail conditions
            if fail_conditions:
                results['fail_conditions'] = fail_conditions
                results['auto_reject'] = True
                # Set final score to 100 (maximum risk) if any FAIL condition
                final_score = 100
            else:
                results['auto_reject'] = False
                # Final score (0-100) - Google Standard: cap at 100
                # Ensure all component scores are capped before combination
                final_score = min(int(total_score), 100)
            
            return final_score
    
    def _detect_cross_correlation(self, results: Dict, hybrid: Dict, component_scores: Dict) -> float:
        """
        Detect cross-correlation between static and dynamic analysis
        If static shows pattern X and dynamic shows behavior Y that matches X, boost score
        
        Returns:
            Correlation boost (0-20 points)
        """
        correlation_boost = 0.0
        
        # Get static analysis patterns
        js_analysis = hybrid.get('js_code_analysis', {})
        manifest_analysis = hybrid.get('manifest_analysis', {})
        behaviors = results.get('_normalized_behaviors', [])
        
        if not behaviors or not js_analysis:
            return 0.0
        
        # Extract static patterns
        static_patterns = set()
        files = js_analysis.get('files', [])
        for file_result in files:
            code = file_result.get('code', '')
            if not code:
                continue
            
            code_lower = code.lower()
            
            # Check for eval/Function constructor
            if 'eval' in code_lower or 'new function' in code_lower or 'function(' in code_lower:
                static_patterns.add('EVAL_EXECUTION')
            
            # Check for fetch/XHR
            if 'fetch' in code_lower or 'xmlhttprequest' in code_lower or 'xhr' in code_lower:
                static_patterns.add('NETWORK_EXFIL')
            
            # Check for cookie access
            if 'cookie' in code_lower or 'chrome.cookies' in code_lower:
                static_patterns.add('COOKIE_ACCESS')
            
            # Check for keylogging
            if 'keydown' in code_lower or 'keypress' in code_lower:
                static_patterns.add('KEYLOGGING')
        
        # Extract dynamic behavior types
        dynamic_behaviors = set()
        for behavior in behaviors:
            behavior_type = behavior.get('type', '')
            if behavior_type:
                dynamic_behaviors.add(behavior_type)
        
        # Correlation 1: Static has eval() + Dynamic has DATA_EXFILTRATION
        if 'EVAL_EXECUTION' in static_patterns and 'DATA_EXFILTRATION' in dynamic_behaviors:
            correlation_boost += 15.0  # High correlation - dangerous combination
            logger.info("Cross-correlation detected: EVAL_EXECUTION + DATA_EXFILTRATION")
        
        # Correlation 2: Static has cookie access + Dynamic has DATA_EXFILTRATION
        if 'COOKIE_ACCESS' in static_patterns and 'DATA_EXFILTRATION' in dynamic_behaviors:
            correlation_boost += 10.0  # Medium-high correlation
            logger.info("Cross-correlation detected: COOKIE_ACCESS + DATA_EXFILTRATION")
        
        # Correlation 3: Static has keylogging + Dynamic has DATA_EXFILTRATION
        if 'KEYLOGGING' in static_patterns and 'DATA_EXFILTRATION' in dynamic_behaviors:
            correlation_boost += 12.0  # High correlation - credential theft
            logger.info("Cross-correlation detected: KEYLOGGING + DATA_EXFILTRATION")
        
        # Correlation 4: Static has network code + Dynamic has DATA_EXFILTRATION
        if 'NETWORK_EXFIL' in static_patterns and 'DATA_EXFILTRATION' in dynamic_behaviors:
            correlation_boost += 8.0  # Medium correlation - confirms exfiltration
            logger.info("Cross-correlation detected: NETWORK_EXFIL + DATA_EXFILTRATION")
        
        # Correlation 5: Static has eval() + Dynamic has KEYLOGGING
        if 'EVAL_EXECUTION' in static_patterns and 'KEYLOGGING' in dynamic_behaviors:
            correlation_boost += 10.0  # Medium-high correlation
            logger.info("Cross-correlation detected: EVAL_EXECUTION + KEYLOGGING")
        
        # Correlation 6: Static has risky permissions + Dynamic has matching behaviors
        if manifest_analysis and 'error' not in manifest_analysis:
            perm_analysis = manifest_analysis.get('permissions_analysis', {})
            risky_perms = perm_analysis.get('risky_permissions', [])
            
            if risky_perms:
                # Check if behaviors match risky permissions
                if any('cookie' in str(p).lower() for p in risky_perms) and 'COOKIE_ACCESS' in dynamic_behaviors:
                    correlation_boost += 5.0
                    logger.info("Cross-correlation detected: risky cookie permission + COOKIE_ACCESS behavior")
                
                if any('webRequest' in str(p).lower() for p in risky_perms) and 'DATA_EXFILTRATION' in dynamic_behaviors:
                    correlation_boost += 5.0
                    logger.info("Cross-correlation detected: risky webRequest permission + DATA_EXFILTRATION behavior")
        
        # Cap correlation boost at 20 points
        correlation_boost = min(correlation_boost, 20.0)
        
        return correlation_boost
    
    def _validate_behaviors_against_static(self, results: Dict, hybrid: Dict) -> List[Dict]:
        """
        Validate behaviors against static analysis (Google Standard)
        Behavior is only valid if code supports it
        
        Args:
            results: Analysis results (contains normalized behaviors)
            hybrid: Hybrid analysis results (contains static analysis)
            
        Returns:
            List of validated behaviors
        """
        # Get normalized behaviors from results (already normalized in analyze_extension)
        behaviors = results.get('_normalized_behaviors', [])
        if not behaviors:
            return []
        
        # Get static analysis
        js_analysis = hybrid.get('js_code_analysis', {})
        files = js_analysis.get('files', [])
        
        # Extract code patterns from static analysis
        code_patterns = set()
        for file_result in files:
            code = file_result.get('code', '')
            if not code:
                continue
            
            code_lower = code.lower()
            
            # Check for keylogging patterns
            if 'keydown' in code_lower or 'keypress' in code_lower or 'addEventListener' in code_lower:
                code_patterns.add('KEYLOGGING')
            
            # Check for form capture patterns
            if 'form' in code_lower or 'input' in code_lower or 'submit' in code_lower:
                code_patterns.add('FORM_DATA_CAPTURE')
            
            # Check for cookie access patterns
            if 'cookie' in code_lower or 'chrome.cookies' in code_lower:
                code_patterns.add('COOKIE_ACCESS')
            
            # Check for exfiltration patterns
            if 'fetch' in code_lower or 'xhr' in code_lower or 'send' in code_lower or 'post' in code_lower:
                code_patterns.add('DATA_EXFILTRATION')
            
            # Check for eval/function constructor
            if 'eval' in code_lower or 'function(' in code_lower or 'new function' in code_lower:
                code_patterns.add('EVAL_EXECUTION')
                code_patterns.add('FUNCTION_CONSTRUCTOR')
            
            # Check for script injection
            if 'script' in code_lower and ('inject' in code_lower or 'createElement' in code_lower):
                code_patterns.add('SCRIPT_INJECTION')
        
        # Validate behaviors
        validated = []
        for behavior in behaviors:
            behavior_type = behavior.get('type', '')
            
            # If behavior type matches code pattern, it's valid
            if behavior_type in code_patterns:
                validated.append(behavior)
            # Some behaviors are always valid (network-based)
            elif behavior_type in ['DATA_EXFILTRATION', 'FETCH_INTERCEPTION', 'XHR_INTERCEPTION', 'REQUEST_INTERCEPTION']:
                # Network behaviors are valid if there's any network code
                if 'DATA_EXFILTRATION' in code_patterns or 'fetch' in str(files).lower():
                    validated.append(behavior)
            # Otherwise, behavior might be false positive (no code support)
            # But we still include it with lower confidence
            else:
                # Include but mark as unvalidated
                behavior['_validated'] = False
                validated.append(behavior)
        
        logger.info(f"Validated {len(validated)}/{len(behaviors)} behaviors against static analysis")
        return validated
    
    def _extract_static_analysis_info(self, hybrid: Dict) -> Optional[Dict]:
        """
        Extract static analysis information for behavior validation
        
        Returns:
            Dict with risky_permissions, risky_apis, dangerous_hosts, code_patterns
        """
        if not hybrid:
            return None
        
        static_info = {
            'risky_permissions': [],
            'risky_apis': [],
            'dangerous_hosts': [],
            'code_patterns': set()
        }
        
        # Extract from manifest analysis
        manifest_analysis = hybrid.get('manifest_analysis', {})
        if manifest_analysis and 'error' not in manifest_analysis:
            # Get risky permissions
            perm_analysis = manifest_analysis.get('permissions_analysis', {})
            risky_perms = perm_analysis.get('risky_permissions', [])
            if risky_perms:
                static_info['risky_permissions'] = [p.get('permission', p) if isinstance(p, dict) else p for p in risky_perms]
            
            # Get dangerous hosts
            host_analysis = manifest_analysis.get('host_permissions_analysis', {})
            dangerous_hosts = host_analysis.get('dangerous_hosts', [])
            if dangerous_hosts:
                static_info['dangerous_hosts'] = [h.get('host', h) if isinstance(h, dict) else h for h in dangerous_hosts]
            
            # Also get all declared hosts for validation
            declared_hosts = host_analysis.get('declared_hosts', [])
            static_info['declared_hosts'] = declared_hosts
        
        # Extract from JS code analysis
        js_analysis = hybrid.get('js_code_analysis', {})
        if js_analysis and 'error' not in js_analysis:
            files = js_analysis.get('files', [])
            
            # Extract code patterns
            for file_result in files:
                code = file_result.get('code', '')
                if not code:
                    continue
                
                code_lower = code.lower()
                
                # Check for keylogging patterns
                if 'keydown' in code_lower or 'keypress' in code_lower or 'addEventListener' in code_lower:
                    static_info['code_patterns'].add('KEYLOGGING')
                
                # Check for form capture patterns
                if 'form' in code_lower or 'input' in code_lower or 'submit' in code_lower:
                    static_info['code_patterns'].add('FORM_DATA_CAPTURE')
                
                # Check for cookie access patterns
                if 'cookie' in code_lower or 'chrome.cookies' in code_lower:
                    static_info['code_patterns'].add('COOKIE_ACCESS')
                
                # Check for exfiltration patterns
                if 'fetch' in code_lower or 'xhr' in code_lower or 'send' in code_lower or 'post' in code_lower:
                    static_info['code_patterns'].add('DATA_EXFILTRATION')
                
                # Check for eval/function constructor
                if 'eval' in code_lower or 'function(' in code_lower or 'new function' in code_lower:
                    static_info['code_patterns'].add('EVAL_EXECUTION')
                    static_info['code_patterns'].add('FUNCTION_CONSTRUCTOR')
                
                # Check for script injection
                if 'script' in code_lower and ('inject' in code_lower or 'createElement' in code_lower):
                    static_info['code_patterns'].add('SCRIPT_INJECTION')
            
            # Extract risky Chrome APIs
            for file_result in files:
                chrome_api = file_result.get('chrome_api_detection', {})
                risky_apis = chrome_api.get('risky_apis', [])
                if risky_apis:
                    static_info['risky_apis'].extend([api.get('api', api) if isinstance(api, dict) else api for api in risky_apis])
        
        # Convert set to list for JSON serialization
        static_info['code_patterns'] = list(static_info['code_patterns'])
        
        # Return None if no static info available
        if not any([static_info['risky_permissions'], static_info['risky_apis'], 
                   static_info['dangerous_hosts'], static_info['code_patterns']]):
            return None
        
        return static_info
    
    def analyze_with_manifest(self, extension_id: str, manifest_path: Optional[str] = None,
                              manifest_data: Optional[Dict] = None,
                              js_files: Optional[List[str]] = None,
                              time_window_hours: int = 24,
                              extension_path: Optional[str] = None) -> Dict[str, Any]:
        """
        Analyze extension with manifest and JS code analysis included
        
        Args:
            extension_id: Extension identifier
            manifest_path: Path to manifest.json file
            manifest_data: Direct manifest data dictionary
            js_files: List of JavaScript file paths to analyze
            time_window_hours: Analysis time window in hours
            
        Returns:
            Complete analysis results including manifest and JS code analysis
        """
        # Fetch raw behaviors first (before static analysis)
        start_time = datetime.utcnow() - timedelta(hours=time_window_hours)
        raw_behaviors = list(self.behaviors_collection.find({
            'extensionId': extension_id,
            'timestamp': {'$gte': start_time}
        }))
        
        # Remove MongoDB ObjectId from behaviors
        from bson import ObjectId
        for behavior in raw_behaviors:
            if '_id' in behavior:
                behavior['_id'] = str(behavior['_id'])
        
        # Initialize results structure
        results = {
            'extensionId': extension_id,
            'analysisTime': datetime.utcnow().isoformat(),
            'timeWindow': f'{time_window_hours} hours',
            'behaviorCount': 0,
            'rawBehaviorCount': len(raw_behaviors),
            'riskScore': 0,
            'severityDistribution': {},
            'typeDistribution': [],
            'patterns': [],
            'attack_chains': [],
            'anomalies': [],
            'timeline': [],
            'recommendations': [],
            'hybrid_analysis': {} if self.use_hybrid else None
        }
        
        if not self.use_hybrid:
            # If not using hybrid, just do basic analysis
            if raw_behaviors:
                behaviors = self.behavior_normalizer.normalize_behaviors(raw_behaviors, static_analysis=None)
                results.update(self._perform_basic_analysis(behaviors))
            return results
        
        # Extract static analysis info for behavior validation (before normalizing)
        static_analysis_info = None
        
        # Add manifest analysis if available
        if manifest_path or manifest_data:
            try:
                manifest_results = self.manifest_analyzer.analyze_manifest(
                    manifest_path=manifest_path,
                    manifest_data=manifest_data
                )
                
                # Add CSP analysis (separate from manifest analysis)
                if manifest_data:
                    csp_results = self.csp_analyzer.analyze_csp(manifest_data)
                    manifest_results['csp_analysis'] = csp_results
                
                # Ensure hybrid_analysis exists
                if 'hybrid_analysis' not in results:
                    results['hybrid_analysis'] = {}
                
                results['hybrid_analysis']['manifest_analysis'] = manifest_results
                
                # Check permission fingerprints
                if manifest_data:
                    permissions = manifest_data.get('permissions', []) + manifest_data.get('host_permissions', [])
                    perm_fp = self.signature_database.check_permission_fingerprint(permissions)
                    if perm_fp.get('total_matches', 0) > 0:
                        # Ensure hybrid_analysis exists
                        if 'hybrid_analysis' not in results:
                            results['hybrid_analysis'] = {}
                        if 'signature_database_analysis' not in results['hybrid_analysis']:
                            results['hybrid_analysis']['signature_database_analysis'] = {}
                        results['hybrid_analysis']['signature_database_analysis']['permission_fingerprints'] = perm_fp
                
                logger.info(f"Manifest analysis complete")
            except Exception as e:
                logger.error(f"Error in manifest analysis: {e}")
                if 'hybrid_analysis' in results:
                    results['hybrid_analysis']['manifest_analysis'] = {'error': str(e)}
        
        # Add JS code analysis if available
        if js_files:
            try:
                js_results = []
                for js_file in js_files:
                    if os.path.exists(js_file):
                        js_analysis = self.js_code_analyzer.analyze_file(js_file)
                        
                        # Read code for additional analysis
                        with open(js_file, 'r', encoding='utf-8', errors='ignore') as f:
                            code = f.read()
                        
                        # Add fingerprinting detection
                        fingerprinting = self.fingerprinting_detector.detect_fingerprinting(code)
                        js_analysis['fingerprinting_detection'] = fingerprinting
                        
                        # Add minify density analysis
                        minify_density = self.minify_density_analyzer.analyze_density(code, js_file)
                        js_analysis['minify_density_analysis'] = minify_density
                        
                        js_results.append(js_analysis)
                
                if js_results:
                    # Aggregate JS analysis results using NEW scoring system
                    total_js_score = sum(r.get('risk_score', 0) for r in js_results)
                    max_js_score = max((r.get('risk_score', 0) for r in js_results), default=0)
                    
                    # Aggregate new scoring components
                    total_code_patterns = sum(r.get('pattern_detection', {}).get('code_patterns_score', 0) for r in js_results)
                    total_rce_exfil = sum(r.get('pattern_detection', {}).get('rce_exfil_score', 0) for r in js_results)
                    total_obfuscation = sum(r.get('obfuscation_analysis', {}).get('risk_score', 0) for r in js_results)
                    
                    # Calculate weighted JS code risk score for display (Google Standard)
                    # Use max scores from all files (Google Standard: không cộng dồn)
                    max_code_patterns = max((r.get('pattern_detection', {}).get('code_patterns_score', 0) for r in js_results), default=0)
                    max_rce_exfil = max((r.get('pattern_detection', {}).get('rce_exfil_score', 0) for r in js_results), default=0)
                    max_obfuscation = max((r.get('obfuscation_analysis', {}).get('risk_score', 0) for r in js_results), default=0)
                    max_chrome_api = max((r.get('chrome_api_detection', {}).get('risk_score', 0) for r in js_results), default=0)
                    
                    # Calculate weighted score for JS code analysis display
                    # This matches the hybrid analysis calculation for consistency
                    weights = self.weights
                    # Check for form hijacking (CRITICAL) - boost weight
                    if max_rce_exfil >= 100:
                        weighted_rce = max_rce_exfil * 0.50  # Boost weight for form hijacking
                    else:
                        weighted_rce = max_rce_exfil * weights.get('rce_exfil', 0.20)
                    
                    weighted_js_score = (
                        max_code_patterns * weights.get('code_patterns', 0.30) +
                        weighted_rce +
                        max_obfuscation * weights.get('obfuscation', 0.10) +
                        max_chrome_api * weights.get('api_abuse', 0.05)
                    )
                    weighted_js_score = min(int(weighted_js_score), 100)
                    
                    aggregated_js = {
                        'files_analyzed': len(js_results),
                        'risk_score': weighted_js_score,  # Weighted score for display consistency
                        'max_risk_score': max_js_score,  # Keep max for reference
                        'files': js_results,
                        'total_patterns': sum(r.get('pattern_detection', {}).get('total_patterns', 0) for r in js_results),
                        'total_chrome_apis': sum(r.get('chrome_api_detection', {}).get('total_apis', 0) for r in js_results),
                        'obfuscated_files': sum(1 for r in js_results if r.get('obfuscation_analysis', {}).get('is_likely_obfuscated', False)),
                        # Component scores (max from all files, Google Standard)
                        'code_patterns_score': min(max_code_patterns, 100),
                        'rce_exfil_score': min(max_rce_exfil, 100),
                        'obfuscation_score': min(max_obfuscation, 100),
                        'chrome_api_score': min(max_chrome_api, 100)
                    }
                    
                    # Ensure hybrid_analysis exists
                    if 'hybrid_analysis' not in results:
                        results['hybrid_analysis'] = {}
                    results['hybrid_analysis']['js_code_analysis'] = aggregated_js
                    
                    logger.info(f"JS code analysis complete: {len(js_results)} files analyzed")
            except Exception as e:
                logger.error(f"Error in JS code analysis: {e}")
                import traceback
                logger.error(f"Traceback: {traceback.format_exc()}")
                # Ensure hybrid_analysis exists
                if 'hybrid_analysis' not in results:
                    results['hybrid_analysis'] = {}
                results['hybrid_analysis']['js_code_analysis'] = {
                    'error': str(e),
                    'risk_score': 0,
                    'files_analyzed': 0
                }
        
        # Extract static analysis info for behavior validation
        static_analysis_info = self._extract_static_analysis_info(results.get('hybrid_analysis', {}))
        
        # Normalize behaviors with static analysis info (if available)
        if raw_behaviors:
            # Normalize behaviors with static analysis context (CRITICAL: this improves accuracy by 40%)
            behaviors = self.behavior_normalizer.normalize_behaviors(
                raw_behaviors,
                static_analysis=static_analysis_info  # Now properly passed!
            )
            logger.info(f"Normalized behaviors with static analysis: {len(behaviors)}/{len(raw_behaviors)} validated")
            
            # Perform analysis with properly normalized behaviors
            basic_results = self._perform_basic_analysis(behaviors)
            results.update(basic_results)
            results['_normalized_behaviors'] = behaviors
            
            # Perform hybrid analysis with normalized behaviors and static context
            if self.use_hybrid:
                results['hybrid_analysis'] = self._perform_hybrid_analysis(behaviors, static_analysis=static_analysis_info)
        else:
            # No behaviors, but still have static analysis
            results['_normalized_behaviors'] = []
        
        # Re-run network analysis with manifest cross-check (if available)
        if results.get('_normalized_behaviors') and 'hybrid_analysis' in results:
            hybrid = results['hybrid_analysis']
            manifest_analysis = hybrid.get('manifest_analysis')
            if manifest_analysis and 'error' not in manifest_analysis:
                # Re-analyze network with manifest cross-check
                network_analysis = self.network_analyzer.analyze_network_behaviors(
                    results['_normalized_behaviors'],
                    manifest_analysis=manifest_analysis
                )
                hybrid['network_analysis'] = network_analysis
                logger.info(f"Network analysis with manifest cross-check complete")
        
        # Calculate risk score with all analyses (including properly normalized behaviors)
        try:
            results['riskScore'] = self._calculate_hybrid_risk_score(results)
            results['riskLevel'] = self._get_risk_level(results['riskScore'])
            
            # Generate detailed score explanation
            results['score_explanation'] = self._generate_score_explanation(results)
            
            # Generate professional report sections
            results['correlation_report'] = self._generate_correlation_report(results)
            results['risk_breakdown'] = self._generate_risk_breakdown(results)
            results['top_findings'] = self._generate_top_findings(results)
            results['evidence'] = self._generate_evidence_section(results)
            results['mitigation_recommendations'] = self._generate_mitigation_recommendations(results)
            results['verdict'] = self._generate_verdict(results)
            results['visualization_data'] = self._generate_visualization_data(results)
        except Exception as e:
            logger.error(f"Error calculating risk score: {e}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            # Fallback: use manifest score if available
            if 'hybrid_analysis' in results and 'manifest_analysis' in results['hybrid_analysis']:
                man_score = results['hybrid_analysis']['manifest_analysis'].get('risk_score', 0)
                results['riskScore'] = man_score
                results['riskLevel'] = self._get_risk_level(man_score)
            else:
                results['riskScore'] = 0
                results['riskLevel'] = 'LOW'
        
        logger.info(f"Complete analysis done. Final Risk Score: {results['riskScore']}, Level: {results['riskLevel']}")
        
        return results
    
    def generate_report(self, extension_id: str, output_file: str = None) -> str:
        """Generate comprehensive analysis report"""
        results = self.analyze_extension(extension_id)
        
        if 'error' in results:
            return results['error']
        
        # Format report
        report = []
        report.append("=" * 80)
        report.append("EXTENSION SECURITY ANALYSIS REPORT")
        report.append("=" * 80)
        report.append(f"\nExtension ID: {results['extensionId']}")
        report.append(f"Analysis Time: {results['analysisTime']}")
        report.append(f"Time Window: {results['timeWindow']}")
        report.append(f"\n{'─' * 80}")
        report.append("\nRISK ASSESSMENT")
        report.append(f"{'─' * 80}")
        report.append(f"Risk Score: {results['riskScore']}/100")
        report.append(f"Risk Level: {results['riskLevel']}")
        report.append(f"Total Behaviors: {results['behaviorCount']}")
        
        report.append(f"\n{'─' * 80}")
        report.append("\nSEVERITY DISTRIBUTION")
        report.append(f"{'─' * 80}")
        for severity, count in results['severityDistribution'].items():
            report.append(f"{severity:12s}: {count:4d}")
        
        if results['patterns']:
            report.append(f"\n{'─' * 80}")
            report.append("\nDETECTED PATTERNS")
            report.append(f"{'─' * 80}")
            for pattern in results['patterns']:
                report.append(f"\n[{pattern['severity']}] {pattern['name']}")
                report.append(f"  Confidence: {pattern['confidence']*100:.0f}%")
                report.append(f"  Description: {pattern['description']}")
                report.append(f"  Behaviors: {', '.join(pattern['behaviors'])}")
        
        if results['anomalies']:
            report.append(f"\n{'─' * 80}")
            report.append("\nANOMALIES DETECTED")
            report.append(f"{'─' * 80}")
            for anomaly in results['anomalies']:
                report.append(f"\n[{anomaly['severity']}] {anomaly['type']}")
                report.append(f"  {anomaly['description']}")
        
        # Hybrid analysis section
        if 'hybrid_analysis' in results and results['hybrid_analysis']:
            report.append(f"\n{'─' * 80}")
            report.append("\nHYBRID NON-ML ANALYSIS")
            report.append(f"{'─' * 80}")
            
            hybrid = results['hybrid_analysis']
            
            # Signature analysis
            if 'signature_analysis' in hybrid:
                sig = hybrid['signature_analysis']
                report.append(f"\nSignature-Based Detection:")
                report.append(f"  Detected Signatures: {sig.get('total_signatures', 0)}")
                report.append(f"  Risk Score: {sig.get('risk_score', 0)}/100")
                report.append(f"  Risk Level: {sig.get('risk_level', 'UNKNOWN')}")
            
            # Behavioral analysis
            if 'behavioral_analysis' in hybrid:
                beh = hybrid['behavioral_analysis']
                report.append(f"\nBehavioral Analysis:")
                report.append(f"  Risk Score: {beh.get('risk_score', 0)}/100")
                report.append(f"  Risk Level: {beh.get('risk_level', 'UNKNOWN')}")
                if beh.get('baseline_comparison'):
                    dev = beh['baseline_comparison'].get('total_deviations', 0)
                    report.append(f"  Baseline Deviations: {dev}")
            
            # Network analysis
            if 'network_analysis' in hybrid:
                net = hybrid['network_analysis']
                report.append(f"\nNetwork Analysis:")
                report.append(f"  Risk Score: {net.get('risk_score', 0)}/100")
                report.append(f"  Risk Level: {net.get('risk_level', 'UNKNOWN')}")
                exfil = net.get('exfiltration_analysis', {})
                report.append(f"  Exfiltrations: {exfil.get('total_exfiltrations', 0)}")
            
            # Manifest analysis
            if 'manifest_analysis' in hybrid and hybrid['manifest_analysis']:
                man = hybrid['manifest_analysis']
                if 'error' not in man:
                    report.append(f"\nManifest Analysis:")
                    report.append(f"  Risk Score: {man.get('risk_score', 0)}/100")
                    report.append(f"  Risk Level: {man.get('risk_level', 'UNKNOWN')}")
            
            # JavaScript code analysis
            if 'js_code_analysis' in hybrid and hybrid['js_code_analysis']:
                js = hybrid['js_code_analysis']
                if 'error' not in js:
                    report.append(f"\nJavaScript Code Analysis:")
                    report.append(f"  Files Analyzed: {js.get('files_analyzed', 0)}")
                    report.append(f"  Risk Score: {js.get('risk_score', 0)}/100")
                    report.append(f"  Total Patterns: {js.get('total_patterns', 0)}")
                    report.append(f"  Chrome APIs: {js.get('total_chrome_apis', 0)}")
                    report.append(f"  Obfuscated Files: {js.get('obfuscated_files', 0)}")
            
            # Signature database analysis
            if 'signature_database_analysis' in hybrid and hybrid['signature_database_analysis']:
                db = hybrid['signature_database_analysis']
                report.append(f"\nSignature Database Analysis:")
                if 'blacklisted_domains' in db:
                    report.append(f"  Blacklisted Domains: {len(db['blacklisted_domains'])}")
                if 'permission_fingerprints' in db:
                    fp = db['permission_fingerprints']
                    report.append(f"  Permission Fingerprints: {fp.get('total_matches', 0)}")
                    report.append(f"  Risk Score: {fp.get('risk_score', 0)}/100")
        
        report.append(f"\n{'─' * 80}")
        report.append("\nRECOMMENDATIONS")
        report.append(f"{'─' * 80}")
        for i, rec in enumerate(results['recommendations'], 1):
            report.append(f"{i}. {rec}")
        
        report.append(f"\n{'═' * 80}")
        
        report_text = "\n".join(report)
        
        # Save to file if specified
        if output_file:
            with open(output_file, 'w') as f:
                f.write(report_text)
            logger.info(f"Report saved to {output_file}")
        
        return report_text
    
    def _generate_correlation_report(self, results: Dict) -> Dict[str, Any]:
        """
        Generate unified threat correlation report (attack chains)
        
        Returns:
            Dictionary with detected attack chains and correlations
        """
        correlation_report = {
            'attack_chains': [],
            'cross_correlations': [],
            'total_chains': 0,
            'total_correlations': 0
        }
        
        # Get attack chains from results
        attack_chains = results.get('attack_chains', [])
        if attack_chains:
            correlation_report['attack_chains'] = [
                {
                    'name': chain.get('name', ''),
                    'severity': chain.get('severity', 'UNKNOWN'),
                    'description': chain.get('description', ''),
                    'steps': [step.get('step', '') for step in chain.get('timeline', [])],
                    'duration_seconds': chain.get('duration_seconds', 0),
                    'confidence': chain.get('confidence', 0.0),
                    'risk_boost': chain.get('risk_boost', 0)
                }
                for chain in attack_chains
            ]
            correlation_report['total_chains'] = len(attack_chains)
        
        # Get cross-correlations from hybrid analysis
        hybrid = results.get('hybrid_analysis', {})
        component_scores = results.get('score_breakdown', {})
        hybrid_combination = component_scores.get('hybrid_combination', {})
        
        if hybrid_combination.get('correlation_boost', 0) > 0:
            correlation_report['cross_correlations'] = [
                {
                    'type': 'STATIC_DYNAMIC_CORRELATION',
                    'boost': hybrid_combination.get('correlation_boost', 0),
                    'description': 'Static code patterns match dynamic behaviors'
                }
            ]
            correlation_report['total_correlations'] = 1
        
        return correlation_report
    
    def _generate_risk_breakdown(self, results: Dict) -> Dict[str, Any]:
        """
        Generate risk factor breakdown with percentages
        
        Returns:
            Dictionary with risk breakdown by component
        """
        breakdown = {
            'total_score': results.get('riskScore', 0),
            'components': [],
            'total_percentage': 0.0
        }
        
        component_scores = results.get('score_breakdown', {})
        hybrid = results.get('hybrid_analysis', {})
        
        # Calculate component contributions
        components = []
        
        # Manifest risk
        manifest_risk = component_scores.get('manifest_risk', {}).get('raw', 0)
        if manifest_risk > 0:
            components.append({
                'name': 'Manifest Risk',
                'score': manifest_risk,
                'weight': 0.35,
                'weighted_score': manifest_risk * 0.35,
                'percentage': 0.0
            })
        
        # Code patterns risk
        code_patterns = component_scores.get('code_patterns', {}).get('raw', 0)
        if code_patterns > 0:
            components.append({
                'name': 'Code Pattern Risk',
                'score': code_patterns,
                'weight': 0.30,
                'weighted_score': code_patterns * 0.30,
                'percentage': 0.0
            })
        
        # RCE/Exfil risk
        rce_exfil = component_scores.get('rce_exfil', {}).get('raw', 0)
        if rce_exfil > 0:
            components.append({
                'name': 'RCE/Exfil Risk',
                'score': rce_exfil,
                'weight': 0.20,
                'weighted_score': rce_exfil * 0.20,
                'percentage': 0.0
            })
        
        # Obfuscation risk
        obfuscation = component_scores.get('obfuscation', {}).get('raw', 0)
        if obfuscation > 0:
            components.append({
                'name': 'Obfuscation Risk',
                'score': obfuscation,
                'weight': 0.10,
                'weighted_score': obfuscation * 0.10,
                'percentage': 0.0
            })
        
        # API abuse risk
        api_abuse = component_scores.get('chrome_api_abuse', {}).get('raw', 0)
        if api_abuse > 0:
            components.append({
                'name': 'API Abuse Risk',
                'score': api_abuse,
                'weight': 0.05,
                'weighted_score': api_abuse * 0.05,
                'percentage': 0.0
            })
        
        # Network risk (if available)
        network_analysis = hybrid.get('network_analysis', {})
        if network_analysis and network_analysis.get('risk_score', 0) > 0:
            network_risk = network_analysis.get('risk_score', 0)
            components.append({
                'name': 'Network Risk',
                'score': network_risk,
                'weight': 0.10,  # Approximate weight
                'weighted_score': network_risk * 0.10,
                'percentage': 0.0
            })
        
        # Calculate percentages
        total_weighted = sum(c['weighted_score'] for c in components)
        if total_weighted > 0:
            for component in components:
                component['percentage'] = round((component['weighted_score'] / total_weighted) * 100, 1)
        
        breakdown['components'] = components
        breakdown['total_percentage'] = round(sum(c['percentage'] for c in components), 1)
        
        return breakdown
    
    def _generate_top_findings(self, results: Dict, top_n: int = 5) -> List[Dict[str, Any]]:
        """
        Generate top N most dangerous findings
        
        Returns:
            List of top findings sorted by severity and score
        """
        findings = []
        hybrid = results.get('hybrid_analysis', {})
        
        # Collect findings from all sources
        js_analysis = hybrid.get('js_code_analysis', {})
        manifest_analysis = hybrid.get('manifest_analysis', {})
        network_analysis = hybrid.get('network_analysis', {})
        behaviors = results.get('_normalized_behaviors', [])
        
        # 1. Code pattern findings
        if js_analysis and js_analysis.get('files'):
            for file_result in js_analysis['files']:
                file_path = file_result.get('file_path', 'Unknown')
                pattern_detection = file_result.get('pattern_detection', {})
                
                # RCE patterns
                rce_patterns = pattern_detection.get('rce_patterns', [])
                for pattern in rce_patterns[:3]:  # Top 3 per file
                    findings.append({
                        'type': 'CODE_PATTERN',
                        'severity': 'CRITICAL',
                        'title': f'eval(fetch()) found in {file_path}',
                        'description': pattern.get('description', 'Remote code execution pattern detected'),
                        'score': 40,
                        'file': file_path,
                        'line': pattern.get('line', 0),
                        'code_snippet': pattern.get('code', '')[:200]  # First 200 chars
                    })
                
                # Exfiltration patterns
                exfil_patterns = pattern_detection.get('exfiltration_patterns', [])
                for pattern in exfil_patterns[:2]:
                    findings.append({
                        'type': 'CODE_PATTERN',
                        'severity': 'HIGH',
                        'title': f'Data exfiltration pattern in {file_path}',
                        'description': pattern.get('description', 'Data exfiltration detected'),
                        'score': 30,
                        'file': file_path,
                        'line': pattern.get('line', 0),
                        'code_snippet': pattern.get('code', '')[:200]
                    })
        
        # 2. Manifest findings
        if manifest_analysis:
            perm_analysis = manifest_analysis.get('permissions_analysis', {})
            risky_perms = perm_analysis.get('risky_permissions', [])
            for perm in risky_perms[:3]:
                perm_name = perm.get('permission', perm) if isinstance(perm, dict) else perm
                findings.append({
                    'type': 'MANIFEST',
                    'severity': 'HIGH',
                    'title': f'Risky permission: {perm_name}',
                    'description': f'Extension requests dangerous permission: {perm_name}',
                    'score': 25,
                    'permission': perm_name
                })
        
        # 3. Network findings
        if network_analysis:
            exfil_analysis = network_analysis.get('exfiltration_analysis', {})
            suspicious_destinations = exfil_analysis.get('suspicious_destinations', [])
            for dest in suspicious_destinations[:3]:
                findings.append({
                    'type': 'NETWORK',
                    'severity': 'CRITICAL',
                    'title': f'Loading remote script from {dest.get("domain", "unknown")}',
                    'description': f'Suspicious domain: {dest.get("reason", "Unknown reason")}',
                    'score': 35,
                    'domain': dest.get('domain', ''),
                    'destination': dest.get('destination', '')
                })
        
        # 4. Behavior findings
        critical_behaviors = [b for b in behaviors if b.get('severity') == 'CRITICAL']
        for behavior in critical_behaviors[:3]:
            findings.append({
                'type': 'BEHAVIOR',
                'severity': 'CRITICAL',
                'title': f'{behavior.get("type", "Unknown")} detected',
                'description': f'Critical behavior detected: {behavior.get("type", "Unknown")}',
                'score': 30,
                'behavior_type': behavior.get('type', ''),
                'timestamp': behavior.get('timestamp', '')
            })
        
        # 5. Obfuscation findings
        if js_analysis and js_analysis.get('files'):
            for file_result in js_analysis['files']:
                obfuscation = file_result.get('obfuscation_analysis', {})
                if obfuscation.get('is_likely_obfuscated', False):
                    findings.append({
                        'type': 'OBFUSCATION',
                        'severity': 'HIGH',
                        'title': f'Minified obfuscated file: {file_result.get("file_path", "Unknown")}',
                        'description': f'Obfuscation score: {obfuscation.get("risk_score", 0)}/100',
                        'score': obfuscation.get('risk_score', 0),
                        'file': file_result.get('file_path', 'Unknown')
                    })
                    break  # Only one obfuscation finding
        
        # Sort by score (descending) and severity
        severity_order = {'CRITICAL': 3, 'HIGH': 2, 'MEDIUM': 1, 'LOW': 0}
        findings.sort(key=lambda x: (severity_order.get(x.get('severity', 'LOW'), 0), x.get('score', 0)), reverse=True)
        
        return findings[:top_n]
    
    def _generate_evidence_section(self, results: Dict) -> Dict[str, Any]:
        """
        Generate evidence section with code snippets, payloads, domains
        
        Returns:
            Dictionary with evidence samples
        """
        evidence = {
            'code_snippets': [],
            'payloads': [],
            'domains': [],
            'behavior_logs': []
        }
        
        hybrid = results.get('hybrid_analysis', {})
        behaviors = results.get('_normalized_behaviors', [])
        js_analysis = hybrid.get('js_code_analysis', {})
        network_analysis = hybrid.get('network_analysis', {})
        
        # Code snippets (5-10 lines of malicious code)
        if js_analysis and js_analysis.get('files'):
            for file_result in js_analysis['files']:
                file_path = file_result.get('file_path', 'Unknown')
                code = file_result.get('code', '')
                pattern_detection = file_result.get('pattern_detection', {})
                
                # Get RCE patterns
                rce_patterns = pattern_detection.get('rce_patterns', [])
                for pattern in rce_patterns[:2]:  # Top 2 per file
                    code_snippet = pattern.get('code', '')
                    if code_snippet:
                        # Extract 5-10 lines around the pattern
                        lines = code_snippet.split('\n')
                        snippet = '\n'.join(lines[:10])  # First 10 lines
                        evidence['code_snippets'].append({
                            'file': file_path,
                            'line': pattern.get('line', 0),
                            'pattern': pattern.get('pattern', ''),
                            'code': snippet,
                            'severity': 'CRITICAL'
                        })
        
        # Payload samples
        if network_analysis:
            exfil_analysis = network_analysis.get('exfiltration_analysis', {})
            payload_analysis = network_analysis.get('payload_analysis', {})
            
            # Get suspicious payloads
            suspicious_payloads = payload_analysis.get('suspicious_payloads', [])
            for payload in suspicious_payloads[:3]:
                evidence['payloads'].append({
                    'destination': payload.get('destination', ''),
                    'payload': payload.get('payload', '')[:500],  # First 500 chars
                    'size': payload.get('size', 0),
                    'severity': payload.get('severity', 'MEDIUM')
                })
        
        # Domain samples
        if network_analysis:
            domain_analysis = network_analysis.get('domain_analysis', {})
            suspicious_domains = domain_analysis.get('suspicious_domains', [])
            for domain_info in suspicious_domains[:5]:
                evidence['domains'].append({
                    'domain': domain_info.get('domain', ''),
                    'reason': domain_info.get('reason', ''),
                    'severity': domain_info.get('severity', 'MEDIUM')
                })
        
        # Behavior log samples (normalized)
        critical_behaviors = [b for b in behaviors if b.get('severity') == 'CRITICAL']
        for behavior in critical_behaviors[:5]:
            evidence['behavior_logs'].append({
                'type': behavior.get('type', ''),
                'timestamp': behavior.get('timestamp', ''),
                'severity': behavior.get('severity', ''),
                'data': str(behavior.get('data', {}))[:300]  # First 300 chars
            })
        
        return evidence
    
    def _generate_mitigation_recommendations(self, results: Dict) -> List[Dict[str, Any]]:
        """
        Generate comprehensive mitigation recommendations
        
        Returns:
            List of recommended fixes with priorities
        """
        recommendations = []
        hybrid = results.get('hybrid_analysis', {})
        js_analysis = hybrid.get('js_code_analysis', {})
        manifest_analysis = hybrid.get('manifest_analysis', {})
        network_analysis = hybrid.get('network_analysis', {})
        
        # Check for eval() usage
        if js_analysis and js_analysis.get('files'):
            for file_result in js_analysis['files']:
                pattern_detection = file_result.get('pattern_detection', {})
                rce_patterns = pattern_detection.get('rce_patterns', [])
                if rce_patterns:
                    recommendations.append({
                        'priority': 'CRITICAL',
                        'category': 'CODE_SECURITY',
                        'title': 'Remove eval() usage',
                        'description': 'eval() and Function constructor allow arbitrary code execution. Use safer alternatives.',
                        'fix': 'Replace eval() with JSON.parse() or other safe parsing methods'
                    })
                    break
        
        # Check host_permissions
        if manifest_analysis:
            host_analysis = manifest_analysis.get('host_permissions_analysis', {})
            dangerous_hosts = host_analysis.get('dangerous_hosts', [])
            if dangerous_hosts:
                recommendations.append({
                    'priority': 'HIGH',
                    'category': 'PERMISSIONS',
                    'title': 'Restrict host_permissions to specific domains',
                    'description': f'Extension requests access to {len(dangerous_hosts)} potentially dangerous hosts',
                    'fix': 'Limit host_permissions to specific trusted domains only'
                })
        
        # Check password field access
        behaviors = results.get('_normalized_behaviors', [])
        keylogging_behaviors = [b for b in behaviors if b.get('type') == 'KEYLOGGING']
        if keylogging_behaviors:
            recommendations.append({
                'priority': 'CRITICAL',
                'category': 'PRIVACY',
                'title': 'Avoid reading input[type=password]',
                'description': 'Extension is capturing keystrokes from password fields',
                'fix': 'Remove keylogging functionality or use secure password manager APIs'
            })
        
        # Check remote script loading
        if network_analysis:
            exfil_analysis = network_analysis.get('exfiltration_analysis', {})
            if exfil_analysis.get('total_exfiltrations', 0) > 0:
                recommendations.append({
                    'priority': 'HIGH',
                    'category': 'NETWORK',
                    'title': 'Remove remote script loading',
                    'description': 'Extension loads scripts from external domains',
                    'fix': 'Only load scripts from extension package, not from remote servers'
                })
        
        # Check CSP
        if manifest_analysis:
            csp_analysis = manifest_analysis.get('csp_analysis', {})
            if not csp_analysis.get('has_csp', False):
                recommendations.append({
                    'priority': 'MEDIUM',
                    'category': 'SECURITY',
                    'title': 'Add Content Security Policy (CSP)',
                    'description': 'Extension does not have CSP defined',
                    'fix': "Add CSP: script-src 'self' to prevent inline scripts and eval()"
                })
        
        return recommendations
    
    def _generate_verdict(self, results: Dict) -> Dict[str, Any]:
        """
        Generate verdict classification (like Google Web Store)
        
        Returns:
            Dictionary with verdict and classification
        """
        risk_score = results.get('riskScore', 0)
        risk_level = results.get('riskLevel', 'UNKNOWN')
        auto_reject = results.get('auto_reject', False)
        fail_conditions = results.get('fail_conditions', [])
        
        if auto_reject or risk_score >= 90:
            verdict = 'MALICIOUS_BEHAVIOR_DETECTED'
            classification = '🚫 MALICIOUS BEHAVIOR DETECTED'
            recommendation = 'BLOCK RECOMMENDED - Extension shows clear malicious behavior'
            color = '#ef4444'  # Red
        elif risk_score >= 70:
            verdict = 'HIGH_RISK_EXTENSION'
            classification = '🔥 HIGH-RISK EXTENSION'
            recommendation = 'BLOCK RECOMMENDED - Multiple critical security issues detected'
            color = '#f59e0b'  # Orange
        elif risk_score >= 50:
            verdict = 'NEEDS_WARNING'
            classification = '⚠ Needs Warning'
            recommendation = 'REVIEW REQUIRED - Extension has significant security concerns'
            color = '#eab308'  # Yellow
        elif risk_score >= 30:
            verdict = 'MODERATE_RISK'
            classification = '⚠ Moderate Risk'
            recommendation = 'CAUTION ADVISED - Extension has some security concerns'
            color = '#84cc16'  # Light green
        else:
            verdict = 'SAFE'
            classification = '✔ SAFE'
            recommendation = 'Extension appears safe based on current analysis'
            color = '#22c55e'  # Green
        
        return {
            'verdict': verdict,
            'classification': classification,
            'risk_score': risk_score,
            'risk_level': risk_level,
            'recommendation': recommendation,
            'color': color,
            'fail_conditions': fail_conditions,
            'auto_reject': auto_reject
        }
    
    def _generate_visualization_data(self, results: Dict) -> Dict[str, Any]:
        """
        Generate data ready for visualization (charts, graphs)
        
        Returns:
            Dictionary with chart-ready data
        """
        viz_data = {
            'risk_breakdown_pie': [],
            'severity_distribution_bar': [],
            'behavior_timeline': [],
            'category_risk_bar': []
        }
        
        # Risk breakdown pie chart data
        risk_breakdown = self._generate_risk_breakdown(results)
        for component in risk_breakdown.get('components', []):
            viz_data['risk_breakdown_pie'].append({
                'name': component['name'],
                'value': component['percentage'],
                'score': component['score']
            })
        
        # Severity distribution bar chart
        severity_dist = results.get('severityDistribution', {})
        for severity, count in severity_dist.items():
            viz_data['severity_distribution_bar'].append({
                'severity': severity,
                'count': count
            })
        
        # Behavior timeline
        viz_data['behavior_timeline'] = []

        timeline = results.get('timeline', [])
        for entry in timeline:
            viz_data['behavior_timeline'].append({
                'hour': entry.get('hour', ''),
                'total': entry.get('total', 0),
                'critical': entry.get('CRITICAL', 0),
                'high': entry.get('HIGH', 0),
                'medium': entry.get('MEDIUM', 0),
                'low': entry.get('LOW', 0)
            })

        
        # Category risk bar chart
        hybrid = results.get('hybrid_analysis', {})
        categories = [
            {'name': 'Manifest', 'score': hybrid.get('manifest_analysis', {}).get('risk_score', 0)},
            {'name': 'Code Patterns', 'score': hybrid.get('js_code_analysis', {}).get('risk_score', 0)},
            {'name': 'Behaviors', 'score': hybrid.get('behavioral_analysis', {}).get('risk_score', 0)},
            {'name': 'Network', 'score': hybrid.get('network_analysis', {}).get('risk_score', 0)}
        ]
        viz_data['category_risk_bar'] = [c for c in categories if c['score'] > 0]
        
        return viz_data
    
    
def main():
    parser = argparse.ArgumentParser(description='Analyze extension behavior for security threats')
    parser.add_argument('extension_id', help='Extension ID to analyze')
    parser.add_argument('--hours', type=int, default=24, help='Time window in hours (default: 24)')
    parser.add_argument('--output', help='Output file for report')
    parser.add_argument('--mongo-uri', default='mongodb://localhost:27017/', help='MongoDB URI')
    
    args = parser.parse_args()
    
    analyzer = ExtensionAnalyzer(mongodb_uri=args.mongo_uri)
    report = analyzer.generate_report(args.extension_id, output_file=args.output)
    
    print(report)


if __name__ == '__main__':
    main()