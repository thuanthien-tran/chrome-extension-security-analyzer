#!/usr/bin/env python3
"""
Signature Database
Hash blacklist and fingerprint patterns for malicious extensions
"""

import hashlib
import json
import logging
from typing import Dict, Any, List, Set
from pathlib import Path

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class SignatureDatabase:
    """Database of known malicious extension signatures"""
    
    # Hash blacklist (MD5, SHA256 hashes of known malicious extensions)
    HASH_BLACKLIST = {
        # Example hashes (add real ones from malware samples)
        'md5': set(),
        'sha256': set()
    }
    
    # Domain blacklist (known malicious domains)
    DOMAIN_BLACKLIST = {
        'sync-data.xyz',
        'analytics-backdoor.site',
        'data-collect.ml',
        'exfiltrate.tk',
        'steal-info.ga',
        'malicious-api.cf',
        # Add more known malicious domains
    }
    
    # Domain patterns (suspicious patterns)
    DOMAIN_PATTERNS = [
        r'[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}',  # IP addresses
        r'\.tk$', r'\.ml$', r'\.ga$', r'\.cf$', r'\.gq$',  # Free TLDs
        r'bit\.ly', r'tinyurl\.com', r't\.co', r'goo\.gl',  # URL shorteners
        r'[a-z0-9]{32,}\.(tk|ml|ga|cf)',  # Random subdomain + free TLD
    ]
    
    # Code fingerprint patterns (unique code patterns from known malware)
    CODE_FINGERPRINTS = {
        'credential_stealer_v1': {
            'pattern': r'chrome\.cookies\.getAll.*function.*fetch',
            'description': 'Credential stealer pattern: cookies.getAll + fetch',
            'severity': 'CRITICAL',
            'score': 40
        },
        'keylogger_v1': {
            'pattern': r'addEventListener\s*\(\s*["\']keydown["\'].*sendMessage',
            'description': 'Keylogger pattern: keydown listener + sendMessage',
            'severity': 'CRITICAL',
            'score': 40
        },
        'data_exfil_v1': {
            'pattern': r'chrome\.storage\.local\.get.*fetch.*POST',
            'description': 'Data exfiltration pattern: storage.get + fetch POST',
            'severity': 'HIGH',
            'score': 30
        },
        'session_hijack_v1': {
            'pattern': r'chrome\.cookies\.get.*chrome\.tabs\.sendMessage',
            'description': 'Session hijack pattern: cookies.get + tabs.sendMessage',
            'severity': 'CRITICAL',
            'score': 35
        },
        'obfuscated_payload_v1': {
            'pattern': r'eval\s*\(\s*atob\s*\(\s*atob',
            'description': 'Multi-layer obfuscation: nested atob + eval',
            'severity': 'HIGH',
            'score': 30
        },
        'iife_unpack_v1': {
            'pattern': r'\(function.*\)\s*\(\s*\)\s*.*eval\s*\(\s*atob',
            'description': 'IIFE unpack pattern: IIFE + eval(atob)',
            'severity': 'HIGH',
            'score': 25
        }
    }
    
    # Permission fingerprint patterns
    PERMISSION_FINGERPRINTS = {
        'ultimate_control': {
            'permissions': ['cookies', 'webRequestBlocking', 'proxy', '<all_urls>'],
            'description': 'Ultimate control: can intercept and modify all traffic',
            'severity': 'CRITICAL',
            'score': 50
        },
        'credential_harvester': {
            'permissions': ['cookies', 'webRequest', '<all_urls>', 'tabs'],
            'description': 'Credential harvester: can steal cookies and monitor tabs',
            'severity': 'CRITICAL',
            'score': 45
        },
        'data_collector': {
            'permissions': ['history', 'tabs', 'storage', 'webRequest'],
            'description': 'Data collector: can gather browsing history and data',
            'severity': 'HIGH',
            'score': 35
        },
        'code_injector': {
            'permissions': ['scripting', '<all_urls>', 'webRequest'],
            'description': 'Code injector: can inject scripts into all pages',
            'severity': 'HIGH',
            'score': 40
        }
    }
    
    def __init__(self, db_path: str = None):
        """
        Initialize signature database
        
        Args:
            db_path: Path to JSON file containing signature database
        """
        self.db_path = db_path
        if db_path and Path(db_path).exists():
            self._load_database(db_path)
    
    def _load_database(self, db_path: str):
        """Load signature database from JSON file"""
        try:
            with open(db_path, 'r') as f:
                data = json.load(f)
                self.HASH_BLACKLIST['md5'].update(data.get('md5_hashes', []))
                self.HASH_BLACKLIST['sha256'].update(data.get('sha256_hashes', []))
                self.DOMAIN_BLACKLIST.update(data.get('domains', []))
            logger.info(f"Loaded signature database from {db_path}")
        except Exception as e:
            logger.error(f"Error loading database: {e}")
    
    def check_hash(self, file_path: str) -> Dict[str, Any]:
        """
        Check file hash against blacklist
        
        Args:
            file_path: Path to file to check
            
        Returns:
            Check results
        """
        result = {
            'is_blacklisted': False,
            'hash_type': None,
            'hash_value': None,
            'match_found': False
        }
        
        try:
            with open(file_path, 'rb') as f:
                content = f.read()
            
            # Calculate MD5
            md5_hash = hashlib.md5(content).hexdigest()
            result['hash_value'] = md5_hash
            
            if md5_hash in self.HASH_BLACKLIST['md5']:
                result['is_blacklisted'] = True
                result['hash_type'] = 'md5'
                result['match_found'] = True
                return result
            
            # Calculate SHA256
            sha256_hash = hashlib.sha256(content).hexdigest()
            if sha256_hash in self.HASH_BLACKLIST['sha256']:
                result['is_blacklisted'] = True
                result['hash_type'] = 'sha256'
                result['hash_value'] = sha256_hash
                result['match_found'] = True
                return result
            
        except Exception as e:
            logger.error(f"Error checking hash: {e}")
            result['error'] = str(e)
        
        return result
    
    def check_domain(self, domain: str) -> Dict[str, Any]:
        """
        Check domain against blacklist
        
        Args:
            domain: Domain to check
            
        Returns:
            Check results
        """
        result = {
            'is_blacklisted': False,
            'domain': domain,
            'match_type': None
        }
        
        # Exact match
        if domain in self.DOMAIN_BLACKLIST:
            result['is_blacklisted'] = True
            result['match_type'] = 'exact'
            return result
        
        # Pattern match
        import re
        for pattern in self.DOMAIN_PATTERNS:
            if re.search(pattern, domain, re.IGNORECASE):
                result['is_blacklisted'] = True
                result['match_type'] = 'pattern'
                result['pattern'] = pattern
                return result
        
        return result
    
    def check_code_fingerprint(self, code: str) -> Dict[str, Any]:
        """
        Check code against fingerprint patterns
        
        Args:
            code: JavaScript code to check
            
        Returns:
            Check results
        """
        result = {
            'fingerprints_found': [],
            'total_matches': 0,
            'risk_score': 0
        }
        
        import re
        for fp_name, fp_def in self.CODE_FINGERPRINTS.items():
            pattern = re.compile(fp_def['pattern'], re.IGNORECASE | re.MULTILINE | re.DOTALL)
            if pattern.search(code):
                result['fingerprints_found'].append({
                    'name': fp_name,
                    'description': fp_def['description'],
                    'severity': fp_def['severity'],
                    'score': fp_def['score']
                })
                result['total_matches'] += 1
                result['risk_score'] += fp_def['score']
        
        return result
    
    def check_permission_fingerprint(self, permissions: List[str]) -> Dict[str, Any]:
        """
        Check permissions against fingerprint patterns
        
        Args:
            permissions: List of permissions
            
        Returns:
            Check results
        """
        result = {
            'fingerprints_found': [],
            'total_matches': 0,
            'risk_score': 0
        }
        
        perm_set = set(permissions)
        
        for fp_name, fp_def in self.PERMISSION_FINGERPRINTS.items():
            required_perms = set(fp_def['permissions'])
            if required_perms.issubset(perm_set):
                result['fingerprints_found'].append({
                    'name': fp_name,
                    'description': fp_def['description'],
                    'severity': fp_def['severity'],
                    'score': fp_def['score'],
                    'matched_permissions': list(required_perms)
                })
                result['total_matches'] += 1
                result['risk_score'] += fp_def['score']
        
        return result
    
    def add_hash(self, hash_value: str, hash_type: str = 'md5'):
        """Add hash to blacklist"""
        if hash_type in self.HASH_BLACKLIST:
            self.HASH_BLACKLIST[hash_type].add(hash_value)
    
    def add_domain(self, domain: str):
        """Add domain to blacklist"""
        self.DOMAIN_BLACKLIST.add(domain)
    
    def save_database(self, db_path: str):
        """Save signature database to JSON file"""
        try:
            data = {
                'md5_hashes': list(self.HASH_BLACKLIST['md5']),
                'sha256_hashes': list(self.HASH_BLACKLIST['sha256']),
                'domains': list(self.DOMAIN_BLACKLIST)
            }
            with open(db_path, 'w') as f:
                json.dump(data, f, indent=2)
            logger.info(f"Saved signature database to {db_path}")
        except Exception as e:
            logger.error(f"Error saving database: {e}")


if __name__ == '__main__':
    # Test the database
    db = SignatureDatabase()
    
    # Test domain check
    result = db.check_domain('evil.com.tk')
    print(f"Domain check: {result}")
    
    # Test permission fingerprint
    perms = ['cookies', 'webRequestBlocking', 'proxy', '<all_urls>']
    result = db.check_permission_fingerprint(perms)
    print(f"Permission fingerprint: {result}")



