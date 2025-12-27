#!/usr/bin/env python3
"""
Behavioral Analyzer
Statistical and baseline-based analysis without ML
"""

import logging
from typing import Dict, Any, List, Optional
from collections import defaultdict
from datetime import datetime, timedelta
import statistics

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class BehavioralAnalyzer:
    """Analyze behaviors using statistical methods and baseline comparison"""
    
    # Baseline thresholds (can be updated from historical data)
    BASELINE_THRESHOLDS = {
        'KEYLOGGING': {'avg_frequency': 0, 'max_frequency': 0},
        'COOKIE_ACCESS': {'avg_frequency': 2, 'max_frequency': 5},
        'FORM_DATA_CAPTURE': {'avg_frequency': 1, 'max_frequency': 3},
        'DATA_EXFILTRATION': {'avg_frequency': 0, 'max_frequency': 0},
        'HISTORY_ACCESS': {'avg_frequency': 1, 'max_frequency': 3},
        'TAB_MONITORING': {'avg_frequency': 2, 'max_frequency': 5}
    }
    
    # Suspicious behavior sequences
    SUSPICIOUS_SEQUENCES = [
        ['HISTORY_ACCESS', 'TAB_MONITORING', 'DATA_EXFILTRATION'],
        ['COOKIE_ACCESS', 'STORAGE_ACCESS', 'DATA_EXFILTRATION'],
        ['KEYLOGGING', 'FORM_DATA_CAPTURE', 'DATA_EXFILTRATION'],
        ['DOM_INJECTION', 'SCRIPT_INJECTION', 'CONTENT_MODIFICATION'],
        ['REQUEST_INTERCEPTION', 'FETCH_INTERCEPTION', 'DATA_EXFILTRATION']
    ]
    
    def __init__(self, baseline_behaviors: Optional[List[Dict]] = None):
        """
        Initialize behavioral analyzer
        
        Args:
            baseline_behaviors: Optional baseline behaviors for comparison
        """
        self.baseline = self._calculate_baseline(baseline_behaviors) if baseline_behaviors else None
    
    def analyze(self, behaviors: List[Dict], static_analysis: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Perform comprehensive behavioral analysis
        
        Args:
            behaviors: List of behavior dictionaries
            static_analysis: Optional static analysis for context validation
            
        Returns:
            Analysis results
        """
        if not behaviors:
            return {'error': 'No behaviors provided'}
        
        results = {
            'statistical_analysis': self._statistical_analysis(behaviors),
            'baseline_comparison': self._compare_to_baseline(behaviors) if self.baseline else None,
            'sequence_analysis': self._analyze_sequences(behaviors, static_analysis),  # Enhanced with static context
            'temporal_analysis': self._temporal_analysis(behaviors),
            'anomaly_detection': self._detect_statistical_anomalies(behaviors),
            'burst_detection': self._detect_bursts(behaviors),  # NEW: Burst detection
            'pattern_sequences': self._detect_pattern_sequences(behaviors, static_analysis),  # Enhanced with static context
            'risk_score': 0,
            'flags': []
        }
        
        # Calculate overall risk score
        results['risk_score'] = self._calculate_behavioral_risk_score(results, static_analysis)
        results['risk_level'] = self._get_risk_level(results['risk_score'])
        
        return results
    
    def _statistical_analysis(self, behaviors: List[Dict]) -> Dict[str, Any]:
        """Perform statistical analysis on behaviors"""
        analysis = {
            'total_behaviors': len(behaviors),
            'type_distribution': {},
            'severity_distribution': {},
            'frequency_stats': {},
            'temporal_stats': {}
        }
        
        # Type distribution
        type_counts = defaultdict(int)
        for behavior in behaviors:
            behavior_type = behavior.get('type', 'UNKNOWN')
            type_counts[behavior_type] += 1
        analysis['type_distribution'] = dict(type_counts)
        
        # Severity distribution
        severity_counts = defaultdict(int)
        for behavior in behaviors:
            severity = behavior.get('severity', 'UNKNOWN')
            severity_counts[severity] += 1
        analysis['severity_distribution'] = dict(severity_counts)
        
        # Frequency statistics per type
        for behavior_type, count in type_counts.items():
            analysis['frequency_stats'][behavior_type] = {
                'count': count,
                'percentage': round(count / len(behaviors) * 100, 2),
                'avg_per_hour': self._calculate_avg_per_hour(behaviors, behavior_type)
            }
        
        # Temporal statistics
        timestamps = [b.get('timestamp') for b in behaviors if isinstance(b.get('timestamp'), datetime)]
        if timestamps:
            time_diffs = []
            sorted_timestamps = sorted(timestamps)
            for i in range(1, len(sorted_timestamps)):
                diff = (sorted_timestamps[i] - sorted_timestamps[i-1]).total_seconds()
                if diff > 0:
                    time_diffs.append(diff)
            
            if time_diffs:
                analysis['temporal_stats'] = {
                    'avg_time_between': round(statistics.mean(time_diffs), 2),
                    'median_time_between': round(statistics.median(time_diffs), 2),
                    'min_time_between': round(min(time_diffs), 2),
                    'max_time_between': round(max(time_diffs), 2),
                    'std_dev': round(statistics.stdev(time_diffs) if len(time_diffs) > 1 else 0, 2)
                }
        
        return analysis
    
    def _calculate_avg_per_hour(self, behaviors: List[Dict], behavior_type: str) -> float:
        """Calculate average behaviors per hour for a specific type"""
        matching_behaviors = [b for b in behaviors if b.get('type') == behavior_type]
        if not matching_behaviors:
            return 0.0
        
        timestamps = [b.get('timestamp') for b in matching_behaviors if isinstance(b.get('timestamp'), datetime)]
        if len(timestamps) < 2:
            return len(matching_behaviors)
        
        time_span = (max(timestamps) - min(timestamps)).total_seconds() / 3600  # hours
        if time_span == 0:
            return len(matching_behaviors)
        
        return round(len(matching_behaviors) / time_span, 2)
    
    def _calculate_baseline(self, behaviors: List[Dict]) -> Dict[str, Any]:
        """Calculate baseline statistics from historical behaviors"""
        if not behaviors:
            return self.BASELINE_THRESHOLDS
        
        baseline = {}
        type_counts = defaultdict(int)
        
        for behavior in behaviors:
            behavior_type = behavior.get('type', 'UNKNOWN')
            type_counts[behavior_type] += 1
        
        # Calculate averages
        total_time_span = 1.0  # Default 1 hour
        timestamps = [b.get('timestamp') for b in behaviors if isinstance(b.get('timestamp'), datetime)]
        if len(timestamps) > 1:
            total_time_span = (max(timestamps) - min(timestamps)).total_seconds() / 3600
            if total_time_span == 0:
                total_time_span = 1.0
        
        for behavior_type, count in type_counts.items():
            baseline[behavior_type] = {
                'avg_frequency': round(count / total_time_span, 2),
                'max_frequency': count
            }
        
        return baseline
    
    def _compare_to_baseline(self, behaviors: List[Dict]) -> Dict[str, Any]:
        """Compare current behaviors to baseline"""
        if not self.baseline:
            return None
        
        comparison = {
            'deviations': [],
            'total_deviations': 0,
            'risk_score': 0
        }
        
        # Calculate current frequencies
        type_counts = defaultdict(int)
        timestamps = [b.get('timestamp') for b in behaviors if isinstance(b.get('timestamp'), datetime)]
        
        time_span = 1.0
        if len(timestamps) > 1:
            time_span = (max(timestamps) - min(timestamps)).total_seconds() / 3600
            if time_span == 0:
                time_span = 1.0
        
        for behavior in behaviors:
            behavior_type = behavior.get('type', 'UNKNOWN')
            type_counts[behavior_type] += 1
        
        # Compare to baseline
        for behavior_type, current_count in type_counts.items():
            baseline_data = self.baseline.get(behavior_type, {'avg_frequency': 0, 'max_frequency': 0})
            baseline_freq = baseline_data.get('avg_frequency', 0)
            current_freq = current_count / time_span if time_span > 0 else current_count
            
            if baseline_freq > 0:
                deviation_ratio = current_freq / baseline_freq
            else:
                # No baseline, use threshold
                threshold = self.BASELINE_THRESHOLDS.get(behavior_type, {}).get('max_frequency', 0)
                deviation_ratio = current_freq / threshold if threshold > 0 else float('inf')
            
            if deviation_ratio > 2.0:  # More than 2x baseline
                severity = 'HIGH' if deviation_ratio > 5.0 else 'MEDIUM'
                comparison['deviations'].append({
                    'behavior_type': behavior_type,
                    'baseline_frequency': baseline_freq,
                    'current_frequency': round(current_freq, 2),
                    'deviation_ratio': round(deviation_ratio, 2),
                    'severity': severity
                })
                comparison['total_deviations'] += 1
                comparison['risk_score'] += 10 if severity == 'HIGH' else 5
            elif baseline_freq == 0 and current_freq > 0:
                # New behavior type not in baseline
                comparison['deviations'].append({
                    'behavior_type': behavior_type,
                    'baseline_frequency': 0,
                    'current_frequency': round(current_freq, 2),
                    'deviation_ratio': float('inf'),
                    'severity': 'MEDIUM'
                })
                comparison['total_deviations'] += 1
                comparison['risk_score'] += 5
        
        comparison['risk_score'] = min(int(comparison['risk_score']), 100)
        
        return comparison
    
    def _analyze_sequences(self, behaviors: List[Dict], static_analysis: Optional[Dict] = None) -> Dict[str, Any]:
        """Analyze behavior sequences for suspicious patterns with static context"""
        analysis = {
            'detected_sequences': [],
            'sequence_count': 0,
            'risk_score': 0,
            'critical_sequences': []
        }
        
        # Group behaviors by extension and sort by timestamp
        behavior_sequence = [b.get('type') for b in sorted(behaviors, key=lambda x: x.get('timestamp', datetime.min))]
        
        # Get static code patterns if available
        static_patterns = set()
        if static_analysis:
            static_patterns = set(static_analysis.get('code_patterns', []))
        
        # Check for suspicious sequences
        for seq in self.SUSPICIOUS_SEQUENCES:
            if self._contains_sequence(behavior_sequence, seq):
                # Check if sequence is supported by static analysis (higher confidence)
                is_static_supported = False
                if static_patterns:
                    # Check if at least one step in sequence matches static patterns
                    for step in seq:
                        if step in static_patterns:
                            is_static_supported = True
                            break
                
                # Determine severity based on static context
                if is_static_supported:
                    severity = 'CRITICAL'
                    risk_score = 30  # Higher risk if static supports it
                    confidence = 0.9
                else:
                    severity = 'HIGH'
                    risk_score = 20
                    confidence = 0.7
                
                sequence_info = {
                    'sequence': seq,
                    'severity': severity,
                    'description': f'Detected suspicious sequence: {" -> ".join(seq)}',
                    'static_supported': is_static_supported,
                    'confidence': confidence
                }
                
                analysis['detected_sequences'].append(sequence_info)
                if severity == 'CRITICAL':
                    analysis['critical_sequences'].append(sequence_info)
                analysis['sequence_count'] += 1
                analysis['risk_score'] += risk_score
        
        return analysis
    
    def _contains_sequence(self, sequence: List[str], subsequence: List[str]) -> bool:
        """Check if sequence contains subsequence (not necessarily consecutive)"""
        it = iter(sequence)
        return all(item in it for item in subsequence)
    
    def _temporal_analysis(self, behaviors: List[Dict]) -> Dict[str, Any]:
        """Analyze temporal patterns in behaviors"""
        analysis = {
            'hourly_distribution': defaultdict(int),
            'daily_distribution': defaultdict(int),
            'peak_hours': [],
            'activity_pattern': 'NORMAL'
        }
        
        for behavior in behaviors:
            timestamp = behavior.get('timestamp')
            if isinstance(timestamp, datetime):
                hour = timestamp.hour
                day = timestamp.date().isoformat()  # Convert to string for JSON serialization
                analysis['hourly_distribution'][hour] += 1
                analysis['daily_distribution'][day] += 1
        
        # Find peak hours
        if analysis['hourly_distribution']:
            sorted_hours = sorted(analysis['hourly_distribution'].items(), key=lambda x: x[1], reverse=True)
            analysis['peak_hours'] = [{'hour': h, 'count': c} for h, c in sorted_hours[:3]]
        
        # Determine activity pattern
        if analysis['hourly_distribution']:
            off_hours_activity = sum(analysis['hourly_distribution'][h] for h in range(2, 6))
            total_activity = sum(analysis['hourly_distribution'].values())
            if total_activity > 0 and off_hours_activity / total_activity > 0.3:
                analysis['activity_pattern'] = 'SUSPICIOUS'
        
        return analysis
    
    def _detect_bursts(self, behaviors: List[Dict]) -> Dict[str, Any]:
        """
        Detect burst patterns (sudden spikes in activity)
        Google Standard: Burst detection for suspicious activity patterns
        """
        analysis = {
            'bursts_detected': [],
            'burst_count': 0,
            'risk_score': 0
        }
        
        if len(behaviors) < 5:
            return analysis
        
        # Group behaviors by time windows (5-minute windows)
        behaviors_by_window = defaultdict(list)
        for behavior in behaviors:
            timestamp = behavior.get('timestamp')
            if isinstance(timestamp, datetime):
                # Round to 5-minute window
                window_key = timestamp.replace(second=0, microsecond=0)
                window_key = window_key.replace(minute=(window_key.minute // 5) * 5)
                behaviors_by_window[window_key].append(behavior)
        
        # Calculate average behaviors per window
        if behaviors_by_window:
            avg_per_window = len(behaviors) / len(behaviors_by_window)
            threshold = avg_per_window * 3  # 3x average = burst
            
            for window, window_behaviors in behaviors_by_window.items():
                if len(window_behaviors) > threshold:
                    # Burst detected
                    burst_types = defaultdict(int)
                    for b in window_behaviors:
                        burst_types[b.get('type', 'UNKNOWN')] += 1
                    
                    analysis['bursts_detected'].append({
                        'window': window.isoformat(),
                        'behavior_count': len(window_behaviors),
                        'threshold': threshold,
                        'types': dict(burst_types),
                        'severity': 'HIGH' if len(window_behaviors) > threshold * 2 else 'MEDIUM'
                    })
                    analysis['burst_count'] += 1
                    analysis['risk_score'] += 15
        
        analysis['risk_score'] = min(analysis['risk_score'], 100)
        return analysis
    
    def _detect_pattern_sequences(self, behaviors: List[Dict], static_analysis: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Detect advanced pattern sequences (Google Standard - Group-based)
        Uses sliding event window: any behaviors in group within time window
        Examples: KEYLOGGING → POST → unknown domain within 5 minutes
        """
        analysis = {
            'sequences_detected': [],
            'group_sequences_detected': [],
            'sequence_count': 0,
            'risk_score': 0
        }
        
        if len(behaviors) < 2:
            return analysis
        
        # Sort by timestamp
        sorted_behaviors = sorted(behaviors, key=lambda x: x.get('timestamp', datetime.min))
        
        # Behavior groups (Google Standard: group-based detection)
        BEHAVIOR_GROUPS = {
            'exfiltration_group': ['KEYLOGGING', 'COOKIE_ACCESS', 'FORM_DATA_CAPTURE', 'TOKEN_THEFT', 'DATA_EXFILTRATION'],
            'network_group': ['REQUEST_INTERCEPTION', 'FETCH_INTERCEPTION', 'XHR_INTERCEPTION', 'DATA_EXFILTRATION'],
            'injection_group': ['SCRIPT_INJECTION', 'DOM_INJECTION', 'EVAL_EXECUTION', 'FUNCTION_CONSTRUCTOR'],
            'monitoring_group': ['HISTORY_ACCESS', 'TAB_MONITORING', 'TAB_SWITCH', 'DATA_EXFILTRATION']
        }
        
        # Advanced sequence patterns (with timing constraints)
        ADVANCED_SEQUENCES = [
            {
                'pattern': ['KEYLOGGING', 'DATA_EXFILTRATION'],
                'groups': ['exfiltration_group'],
                'time_window': 300,  # 5 minutes
                'severity': 'CRITICAL',
                'description': 'Keylogging followed by exfiltration'
            },
            {
                'pattern': ['COOKIE_ACCESS', 'DATA_EXFILTRATION'],
                'groups': ['exfiltration_group'],
                'time_window': 300,
                'severity': 'CRITICAL',
                'description': 'Cookie theft followed by exfiltration'
            },
            {
                'pattern': ['FORM_DATA_CAPTURE', 'DATA_EXFILTRATION'],
                'groups': ['exfiltration_group'],
                'time_window': 300,
                'severity': 'HIGH',
                'description': 'Form capture followed by exfiltration'
            },
            {
                'pattern': ['HISTORY_ACCESS', 'TAB_MONITORING', 'DATA_EXFILTRATION'],
                'groups': ['monitoring_group'],
                'time_window': 600,  # 10 minutes
                'severity': 'HIGH',
                'description': 'Information gathering sequence'
            },
            {
                'pattern': ['REQUEST_INTERCEPTION', 'FETCH_INTERCEPTION', 'DATA_EXFILTRATION'],
                'groups': ['network_group'],
                'time_window': 300,
                'severity': 'HIGH',
                'description': 'Network interception sequence'
            }
        ]
        
        # Get static patterns if available
        static_patterns = set()
        if static_analysis:
            static_patterns = set(static_analysis.get('code_patterns', []))
        
        # 1. Exact sequence detection (original method) with static context
        for seq_def in ADVANCED_SEQUENCES:
            pattern = seq_def['pattern']
            time_window = seq_def['time_window']
            
            # Find matching sequence with timing constraint
            for i in range(len(sorted_behaviors) - len(pattern) + 1):
                window_behaviors = sorted_behaviors[i:i+len(pattern)]
                
                # Check if types match
                types = [b.get('type', '') for b in window_behaviors]
                if types == pattern:
                    # Check timing constraint
                    first_time = window_behaviors[0].get('timestamp')
                    last_time = window_behaviors[-1].get('timestamp')
                    
                    if isinstance(first_time, datetime) and isinstance(last_time, datetime):
                        time_diff = (last_time - first_time).total_seconds()
                        if time_diff <= time_window:
                            # Check if sequence is supported by static analysis
                            is_static_supported = False
                            if static_patterns:
                                for step in pattern:
                                    if step in static_patterns:
                                        is_static_supported = True
                                        break
                            
                            # Adjust severity and score based on static support
                            if is_static_supported:
                                severity = 'CRITICAL'
                                score = 35  # Higher score if static supports
                                confidence = 0.9
                            else:
                                severity = seq_def['severity']
                                score = 30 if seq_def['severity'] == 'CRITICAL' else 20
                                confidence = 0.7
                            
                            # Sequence detected within time window
                            analysis['sequences_detected'].append({
                                'pattern': pattern,
                                'time_window_seconds': time_diff,
                                'max_window': time_window,
                                'severity': severity,
                                'description': seq_def['description'],
                                'static_supported': is_static_supported,
                                'confidence': confidence,
                                'behaviors': [
                                    {
                                        'type': b.get('type'),
                                        'timestamp': b.get('timestamp').isoformat() if isinstance(b.get('timestamp'), datetime) else str(b.get('timestamp'))
                                    }
                                    for b in window_behaviors
                                ]
                            })
                            analysis['sequence_count'] += 1
                            analysis['risk_score'] += score
        
        # 2. Group-based sequence detection (Google Standard: sliding event window)
        # Any 3+ behaviors from same group within time window
        for group_name, group_behaviors in BEHAVIOR_GROUPS.items():
            # Find all behaviors in this group
            group_events = [
                (b, b.get('timestamp')) for b in sorted_behaviors
                if b.get('type', '') in group_behaviors
            ]
            
            if len(group_events) < 3:
                continue
            
            # Sliding window: check for 3+ events within 5 minutes
            time_window = 300  # 5 minutes
            for i in range(len(group_events)):
                window_start = group_events[i][1]
                if not isinstance(window_start, datetime):
                    continue
                
                window_end = window_start + timedelta(seconds=time_window)
                events_in_window = [
                    e for e in group_events[i:]
                    if isinstance(e[1], datetime) and e[1] <= window_end
                ]
                
                if len(events_in_window) >= 3:
                    # Group sequence detected
                    analysis['group_sequences_detected'].append({
                        'group': group_name,
                        'events_count': len(events_in_window),
                        'time_window_seconds': time_window,
                        'severity': 'HIGH' if len(events_in_window) >= 5 else 'MEDIUM',
                        'description': f'Group-based sequence: {len(events_in_window)} {group_name} events within {time_window}s',
                        'behaviors': [
                            {
                                'type': e[0].get('type'),
                                'timestamp': e[1].isoformat() if isinstance(e[1], datetime) else str(e[1])
                            }
                            for e in events_in_window
                        ]
                    })
                    analysis['sequence_count'] += 1
                    score = 15 if len(events_in_window) >= 5 else 10
                    analysis['risk_score'] += score
                    break  # Only count once per group
        
        analysis['risk_score'] = min(analysis['risk_score'], 100)
        return analysis
    
    def _detect_statistical_anomalies(self, behaviors: List[Dict]) -> Dict[str, Any]:
        """Detect statistical anomalies using Z-score and percentile methods"""
        anomalies = {
            'z_score_anomalies': [],
            'percentile_anomalies': [],
            'variance_anomalies': [],
            'total_anomalies': 0
        }
        
        # Group by type
        type_counts = defaultdict(int)
        for behavior in behaviors:
            behavior_type = behavior.get('type', 'UNKNOWN')
            type_counts[behavior_type] += 1
        
        if not type_counts:
            return anomalies
        
        # Calculate statistics
        counts = list(type_counts.values())
        if len(counts) > 1:
            mean_count = statistics.mean(counts)
            # Clamp stdev minimum to avoid false positives with 2-3 behavior types
            # Google Standard: Use minimum stdev of 1.0 to prevent over-sensitivity
            raw_stdev = statistics.stdev(counts) if len(counts) > 1 else 0
            stdev_count = max(raw_stdev, 1.0)  # Minimum stdev clamp
            
            # Z-score analysis (only if we have enough data)
            if len(counts) >= 3:  # Need at least 3 different behavior types for reliable Z-score
                for behavior_type, count in type_counts.items():
                    if stdev_count > 0:
                        z_score = (count - mean_count) / stdev_count
                        # Higher threshold for 2-3 types to reduce false positives
                        threshold = 3.0 if len(counts) <= 3 else 2.0
                        if abs(z_score) > threshold:
                            anomalies['z_score_anomalies'].append({
                                'behavior_type': behavior_type,
                                'count': count,
                                'z_score': round(z_score, 2),
                                'severity': 'HIGH' if abs(z_score) > 4.0 else 'MEDIUM'
                            })
                            anomalies['total_anomalies'] += 1
            
            # Percentile analysis
            if counts:
                p95 = sorted(counts)[int(len(counts) * 0.95)] if len(counts) > 1 else max(counts)
                p99 = sorted(counts)[int(len(counts) * 0.99)] if len(counts) > 1 else max(counts)
                
                for behavior_type, count in type_counts.items():
                    if count >= p99:
                        anomalies['percentile_anomalies'].append({
                            'behavior_type': behavior_type,
                            'count': count,
                            'percentile': 99,
                            'severity': 'CRITICAL'
                        })
                        anomalies['total_anomalies'] += 1
                    elif count >= p95:
                        anomalies['percentile_anomalies'].append({
                            'behavior_type': behavior_type,
                            'count': count,
                            'percentile': 95,
                            'severity': 'HIGH'
                        })
                        anomalies['total_anomalies'] += 1
        
        return anomalies
    
    def _calculate_behavioral_risk_score(self, results: Dict, static_analysis: Optional[Dict] = None) -> int:
        """
        Calculate overall behavioral risk score (Google Standard)
        Combines all behavioral analysis components with static context
        
        Args:
            results: Behavioral analysis results
            static_analysis: Optional static analysis for context
        """
        total_score = 0
        
        # Baseline comparison score
        if results.get('baseline_comparison'):
            total_score += results['baseline_comparison'].get('risk_score', 0)
        
        # Critical sequences boost (if static context supports)
        if static_analysis and results.get('sequence_analysis'):
            critical_sequences = results['sequence_analysis'].get('critical_sequences', [])
            if critical_sequences:
                # Boost score for critical sequences supported by static analysis
                total_score += len(critical_sequences) * 10
        
        # Sequence analysis score
        total_score += results['sequence_analysis'].get('risk_score', 0)
        
        # NEW: Burst detection score
        burst_analysis = results.get('burst_detection', {})
        total_score += burst_analysis.get('risk_score', 0)
        
        # NEW: Pattern sequences score (advanced)
        pattern_sequences = results.get('pattern_sequences', {})
        total_score += pattern_sequences.get('risk_score', 0)
        
        # Anomaly detection score
        anomaly_count = results['anomaly_detection'].get('total_anomalies', 0)
        total_score += min(anomaly_count * 5, 30)
        
        # Temporal pattern score
        if results['temporal_analysis'].get('activity_pattern') == 'SUSPICIOUS':
            total_score += 10
        
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


if __name__ == '__main__':
    # Test the analyzer
    analyzer = BehavioralAnalyzer()
    
    test_behaviors = [
        {'type': 'KEYLOGGING', 'severity': 'CRITICAL', 'timestamp': datetime.utcnow()},
        {'type': 'FORM_DATA_CAPTURE', 'severity': 'HIGH', 'timestamp': datetime.utcnow()},
        {'type': 'DATA_EXFILTRATION', 'severity': 'CRITICAL', 'timestamp': datetime.utcnow()}
    ]
    
    results = analyzer.analyze(test_behaviors)
    print(f"Risk Score: {results['risk_score']}/100")
    print(f"Risk Level: {results['risk_level']}")


