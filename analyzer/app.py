#!/usr/bin/env python3
"""
Flask Web Application for Extension Analyzer
Web UI for running and viewing analyzer results
"""

from flask import Flask, render_template, request, jsonify, send_file
from flask_cors import CORS
import json
import os
import sys
import signal
from datetime import datetime, timezone, date
from pathlib import Path
from analyzer import ExtensionAnalyzer
import logging
from typing import List, Optional
import zipfile
import shutil
import tempfile
import platform

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

def serialize_datetime(obj):
    """Helper function to serialize datetime, date, and MongoDB ObjectId objects to strings"""
    from bson import ObjectId
    
    if isinstance(obj, ObjectId):
        return str(obj)
    elif isinstance(obj, (datetime, date)):
        return obj.isoformat()
    elif isinstance(obj, dict):
        return {k: serialize_datetime(v) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple)):
        return [serialize_datetime(item) for item in obj]
    return obj

# Initialize analyzer
analyzer = ExtensionAnalyzer(use_hybrid=True)

def get_all_chrome_profiles():
    """Get all Chrome profile paths that contain extensions"""
    system = platform.system()
    username = os.getenv('USERNAME') or os.getenv('USER')
    profiles = []
    
    if system == 'Windows':
        # Windows: C:\Users\<username>\AppData\Local\Google\Chrome\User Data\<Profile>\Extensions
        appdata = os.getenv('LOCALAPPDATA')
        if appdata:
            user_data_path = os.path.join(appdata, 'Google', 'Chrome', 'User Data')
        else:
            user_data_path = os.path.join('C:', 'Users', username, 'AppData', 'Local', 'Google', 'Chrome', 'User Data')
        
        # Profiles to check in order
        profiles_to_check = ['Default', 'Profile 1', 'Profile 2', 'Guest Profile']
        
        # Also check for other profiles (Profile 3, Profile 4, etc.)
        if os.path.exists(user_data_path):
            try:
                for item in os.listdir(user_data_path):
                    if item.startswith('Profile ') and item not in profiles_to_check:
                        # Insert after Profile 2 but before Guest Profile
                        if 'Profile 2' in profiles_to_check:
                            idx = profiles_to_check.index('Profile 2') + 1
                            profiles_to_check.insert(idx, item)
                        else:
                            profiles_to_check.append(item)
            except:
                pass
        
        # Check each profile
        for profile in profiles_to_check:
            extensions_path = os.path.join(user_data_path, profile, 'Extensions')
            if os.path.exists(extensions_path):
                profiles.append({
                    'name': profile,
                    'path': extensions_path,
                    'user_data_path': user_data_path
                })
        
        return profiles
        
    elif system == 'Darwin':  # macOS
        home = os.path.expanduser('~')
        user_data_path = os.path.join(home, 'Library', 'Application Support', 'Google', 'Chrome')
        
        profiles_to_check = ['Default', 'Profile 1', 'Profile 2', 'Guest Profile']
        if os.path.exists(user_data_path):
            try:
                for item in os.listdir(user_data_path):
                    if item.startswith('Profile ') and item not in profiles_to_check:
                        if 'Profile 2' in profiles_to_check:
                            idx = profiles_to_check.index('Profile 2') + 1
                            profiles_to_check.insert(idx, item)
                        else:
                            profiles_to_check.append(item)
            except:
                pass
        
        for profile in profiles_to_check:
            extensions_path = os.path.join(user_data_path, profile, 'Extensions')
            if os.path.exists(extensions_path):
                profiles.append({
                    'name': profile,
                    'path': extensions_path,
                    'user_data_path': user_data_path
                })
        
        return profiles
        
    else:  # Linux
        home = os.path.expanduser('~')
        user_data_path = os.path.join(home, '.config', 'google-chrome')
        
        profiles_to_check = ['Default', 'Profile 1', 'Profile 2', 'Guest Profile']
        if os.path.exists(user_data_path):
            try:
                for item in os.listdir(user_data_path):
                    if item.startswith('Profile ') and item not in profiles_to_check:
                        if 'Profile 2' in profiles_to_check:
                            idx = profiles_to_check.index('Profile 2') + 1
                            profiles_to_check.insert(idx, item)
                        else:
                            profiles_to_check.append(item)
            except:
                pass
        
        for profile in profiles_to_check:
            extensions_path = os.path.join(user_data_path, profile, 'Extensions')
            if os.path.exists(extensions_path):
                profiles.append({
                    'name': profile,
                    'path': extensions_path,
                    'user_data_path': user_data_path
                })
        
        return profiles

def get_chrome_extensions_path():
    """Get Chrome extensions folder path based on OS - auto-detect profile (backward compatibility)"""
    profiles = get_all_chrome_profiles()
    if profiles:
        # Return first profile found (Profile 1 or Default)
        for profile in profiles:
            if profile['name'] in ['Profile 1', 'Default']:
                return profile['path']
        return profiles[0]['path']
    
    # Fallback
    system = platform.system()
    username = os.getenv('USERNAME') or os.getenv('USER')
    if system == 'Windows':
        appdata = os.getenv('LOCALAPPDATA')
        if appdata:
            user_data_path = os.path.join(appdata, 'Google', 'Chrome', 'User Data')
        else:
            user_data_path = os.path.join('C:', 'Users', username, 'AppData', 'Local', 'Google', 'Chrome', 'User Data')
        return os.path.join(user_data_path, 'Default', 'Extensions')
        
    elif system == 'Darwin':  # macOS
        home = os.path.expanduser('~')
        user_data_path = os.path.join(home, 'Library', 'Application Support', 'Google', 'Chrome')
        
        # Check profiles
        profiles_to_check = ['Profile 1', 'Default']
        if os.path.exists(user_data_path):
            try:
                for item in os.listdir(user_data_path):
                    if item.startswith('Profile ') and item not in profiles_to_check:
                        profiles_to_check.append(item)
            except:
                pass
        
        for profile in profiles_to_check:
            extensions_path = os.path.join(user_data_path, profile, 'Extensions')
            if os.path.exists(extensions_path):
                return extensions_path
        
        return os.path.join(user_data_path, 'Default', 'Extensions')
    else:  # Linux
        home = os.path.expanduser('~')
        user_data_path = os.path.join(home, '.config', 'google-chrome')
        
        profiles_to_check = ['Profile 1', 'Default']
        if os.path.exists(user_data_path):
            try:
                for item in os.listdir(user_data_path):
                    if item.startswith('Profile ') and item not in profiles_to_check:
                        profiles_to_check.append(item)
            except:
                pass
        
        for profile in profiles_to_check:
            extensions_path = os.path.join(user_data_path, profile, 'Extensions')
            if os.path.exists(extensions_path):
                return extensions_path
        
        return os.path.join(user_data_path, 'Default', 'Extensions')

def scan_installed_extensions(chrome_path: str, profile_name: str = None) -> List[dict]:
    """
    Scan Chrome extensions folder and return list of installed extensions
    
    Args:
        chrome_path: Path to Chrome extensions folder
        profile_name: Optional profile name (e.g., 'Default', 'Profile 1')
        
    Returns:
        List of extension dictionaries with id, version, path, manifest_path, name, profile
    """
    extensions = []
    
    if not os.path.exists(chrome_path):
        logger.warning(f"Chrome extensions folder not found: {chrome_path}")
        return extensions
    
    try:
        for ext_id in os.listdir(chrome_path):
            ext_folder = os.path.join(chrome_path, ext_id)
            if not os.path.isdir(ext_folder):
                continue
            
            # Get latest version
            try:
                versions = [v for v in os.listdir(ext_folder) if os.path.isdir(os.path.join(ext_folder, v))]
                if not versions:
                    continue
                
                # Sort versions and get latest
                # Handle version strings that might not be numeric
                def version_key(v):
                    try:
                        return [int(i) for i in v.split('.')]
                    except ValueError:
                        # If version is not numeric, use string comparison
                        return [v]
                latest_version = sorted(versions, key=version_key)[-1]
                full_path = os.path.join(ext_folder, latest_version)
                manifest_path = os.path.join(full_path, 'manifest.json')
                
                if os.path.exists(manifest_path):
                    # Read manifest to get name
                    try:
                        with open(manifest_path, 'r', encoding='utf-8') as f:
                            manifest_data = json.load(f)
                        name = manifest_data.get('name', ext_id)
                        
                        # Handle i18n names (__MSG_key__)
                        if isinstance(name, str) and name.startswith('__MSG_') and name.endswith('__'):
                            # Extract the key (e.g., "__MSG_extName__" -> "extName")
                            i18n_key = name[6:-2]  # Remove "__MSG_" and "__"
                            
                            # Try to read from _locales
                            locales_path = os.path.join(full_path, '_locales')
                            if os.path.exists(locales_path):
                                # Try common locales in order
                                for locale in ['en', 'en_US', 'en_GB', 'vi', 'vi_VN']:
                                    messages_path = os.path.join(locales_path, locale, 'messages.json')
                                    if os.path.exists(messages_path):
                                        try:
                                            with open(messages_path, 'r', encoding='utf-8') as msg_file:
                                                messages = json.load(msg_file)
                                                if i18n_key in messages:
                                                    name_obj = messages[i18n_key]
                                                    if isinstance(name_obj, dict):
                                                        name = name_obj.get('message', ext_id)
                                                    else:
                                                        name = str(name_obj)
                                                    break
                                        except Exception as e:
                                            logger.debug(f"Error reading messages.json for {locale}: {e}")
                                            continue
                                
                                # If still not found, try any locale
                                if name.startswith('__MSG_'):
                                    try:
                                        for locale_dir in os.listdir(locales_path):
                                            locale_dir_path = os.path.join(locales_path, locale_dir)
                                            if os.path.isdir(locale_dir_path):
                                                messages_path = os.path.join(locale_dir_path, 'messages.json')
                                                if os.path.exists(messages_path):
                                                    with open(messages_path, 'r', encoding='utf-8') as msg_file:
                                                        messages = json.load(msg_file)
                                                        if i18n_key in messages:
                                                            name_obj = messages[i18n_key]
                                                            if isinstance(name_obj, dict):
                                                                name = name_obj.get('message', ext_id)
                                                            else:
                                                                name = str(name_obj)
                                                            break
                                    except Exception as e:
                                        logger.debug(f"Error reading any locale: {e}")
                            
                            # If still not found, use a cleaned version of the key
                            if name.startswith('__MSG_'):
                                name = i18n_key.replace('_', ' ').title()
                        
                        # Handle dict format (already localized)
                        if isinstance(name, dict):
                            name = name.get('message', ext_id) or name.get('default_message', ext_id) or ext_id
                            
                    except Exception as e:
                        logger.warning(f"Error reading manifest for {ext_id}: {e}")
                        name = ext_id
                    
                    ext_data = {
                        'id': ext_id,
                        'version': latest_version,
                        'path': full_path,
                        'manifest_path': manifest_path,
                        'name': name
                    }
                    if profile_name:
                        ext_data['profile'] = profile_name
                    extensions.append(ext_data)
            except Exception as e:
                logger.warning(f"Error processing extension {ext_id}: {e}")
                continue
                
    except Exception as e:
        logger.error(f"Error scanning Chrome extensions folder: {e}")
    
    return extensions

@app.route('/')
def index():
    """Main page"""
    return render_template('index.html')

@app.route('/api/scan-extension', methods=['POST'])
def scan_extension():
    """
    Scan extension from folder or zip file
    
    Request body (multipart/form-data):
    - extension_folder: Path to extension folder (optional)
    - extension_file: Uploaded zip file (optional)
    """
    try:
        # Check if folder path is provided
        folder_path = request.form.get('extension_folder', '').strip()
        
        # Check if file is uploaded
        uploaded_file = request.files.get('extension_file')
        
        if not folder_path and not uploaded_file:
            return jsonify({
                'success': False,
                'error': 'Vui lòng chọn thư mục extension hoặc upload file zip'
            }), 400
        
        # Temporary directory for processing
        temp_dir = None
        
        try:
            # Handle uploaded zip file
            if uploaded_file:
                temp_dir = tempfile.mkdtemp()
                zip_path = os.path.join(temp_dir, 'extension.zip')
                uploaded_file.save(zip_path)
                
                # Extract zip
                extract_dir = os.path.join(temp_dir, 'extracted')
                os.makedirs(extract_dir, exist_ok=True)
                
                with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                    zip_ref.extractall(extract_dir)
                
                folder_path = extract_dir
            
            # Validate folder path
            if not os.path.exists(folder_path):
                return jsonify({
                    'success': False,
                    'error': f'Thư mục không tồn tại: {folder_path}'
                }), 400
            
            # Find manifest.json
            manifest_path = os.path.join(folder_path, 'manifest.json')
            if not os.path.exists(manifest_path):
                return jsonify({
                    'success': False,
                    'error': 'Không tìm thấy manifest.json trong thư mục extension'
                }), 400
            
            # Read manifest
            with open(manifest_path, 'r', encoding='utf-8') as f:
                manifest_data = json.load(f)
            
            # Find all JavaScript files
            js_files = []
            for root, dirs, files in os.walk(folder_path):
                # Skip node_modules and other common directories
                dirs[:] = [d for d in dirs if d not in ['node_modules', '.git', '__pycache__']]
                
                for file in files:
                    if file.endswith(('.js', '.jsx')):
                        js_files.append(os.path.join(root, file))
            
            # Get extension name/ID from manifest
            extension_id = manifest_data.get('name', 'unknown-extension')
            if not extension_id or extension_id == 'unknown-extension':
                extension_id = os.path.basename(folder_path)
            
            logger.info(f"Scanning extension: {extension_id}")
            logger.info(f"Found {len(js_files)} JavaScript files")
            
            # Perform analysis
            results = analyzer.analyze_with_manifest(
                extension_id=extension_id,
                manifest_data=manifest_data,
                js_files=js_files[:10] if js_files else None,  # Limit to 10 files for performance
                time_window_hours=24,
                extension_path=folder_path
            )
            
            # Add scan metadata
            results['scan_metadata'] = {
                'extension_name': manifest_data.get('name', 'Unknown'),
                'extension_version': manifest_data.get('version', 'Unknown'),
                'manifest_version': manifest_data.get('manifest_version', 'Unknown'),
                'js_files_found': len(js_files),
                'js_files_analyzed': min(len(js_files), 10),
                'scan_time': datetime.now(timezone.utc).isoformat()
            }
            
            # Serialize datetime objects to strings
            results = serialize_datetime(results)
            
            return jsonify({
                'success': True,
                'data': results,
                'timestamp': datetime.now(timezone.utc).isoformat()
            })
            
        finally:
            # Clean up temporary directory
            if temp_dir and os.path.exists(temp_dir):
                try:
                    shutil.rmtree(temp_dir)
                except:
                    pass
    
    except json.JSONDecodeError as e:
        logger.error(f"Error parsing manifest.json: {e}")
        return jsonify({
            'success': False,
            'error': f'Lỗi đọc manifest.json: {str(e)}'
        }), 400
    
    except Exception as e:
        logger.error(f"Error scanning extension: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/analyze', methods=['POST'])
def analyze_extension():
    """
    Analyze extension endpoint
    
    Request body:
    {
        "extension_id": "mal-ext",
        "hours": 24,
        "include_manifest": false,
        "manifest_path": null,
        "manifest_data": null
    }
    """
    try:
        data = request.get_json()
        
        extension_id = data.get('extension_id')
        hours = data.get('hours', 24)
        include_manifest = data.get('include_manifest', False)
        manifest_path = data.get('manifest_path')
        manifest_data = data.get('manifest_data')
        
        if not extension_id:
            return jsonify({'error': 'extension_id is required'}), 400
        
        logger.info(f"Analyzing extension: {extension_id}")
        
        # Perform analysis
        if include_manifest and (manifest_path or manifest_data):
            results = analyzer.analyze_with_manifest(
                extension_id=extension_id,
                manifest_path=manifest_path,
                manifest_data=manifest_data,
                time_window_hours=hours
            )
        else:
            results = analyzer.analyze_extension(extension_id, hours)
        
        # Serialize datetime objects to strings for JSON serialization
        results = serialize_datetime(results)
        
        return jsonify({
            'success': True,
            'data': results,
            'timestamp': datetime.now(timezone.utc).isoformat()
        })
    
    except Exception as e:
        logger.error(f"Error analyzing extension: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now(timezone.utc).isoformat()
    })

@app.route('/api/test-installed', methods=['GET'])
def test_installed():
    """Test endpoint for installed extensions"""
    return jsonify({
        'success': True,
        'message': 'Installed extensions route is working',
        'routes': [str(rule) for rule in app.url_map.iter_rules() if 'installed' in str(rule)]
    })

@app.route('/api/extensions', methods=['GET'])
def list_extensions():
    """List all extensions in database"""
    try:
        extensions = []
        behaviors = analyzer.behaviors_collection.find({}, {'extensionId': 1})
        
        extension_ids = set()
        for behavior in behaviors:
            ext_id = behavior.get('extensionId')
            if ext_id:
                extension_ids.add(ext_id)
        
        for ext_id in extension_ids:
            count = analyzer.behaviors_collection.count_documents({'extensionId': ext_id})
            extensions.append({
                'extension_id': ext_id,
                'behavior_count': count
            })
        
        return jsonify({
            'success': True,
            'extensions': extensions
        })
    
    except Exception as e:
        logger.error(f"Error listing extensions: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/analyze-manifest', methods=['POST'])
def analyze_manifest():
    """
    Analyze manifest.json from Chrome extension
    
    Request body:
    {
        "extension_id": "abc123",
        "manifest_data": {...}
    }
    """
    try:
        data = request.get_json()
        
        extension_id = data.get('extension_id')
        manifest_data = data.get('manifest_data')
        
        if not manifest_data:
            return jsonify({'error': 'manifest_data is required'}), 400
        
        logger.info(f"Analyzing manifest for extension: {extension_id}")
        
        # Analyze manifest
        manifest_results = analyzer.manifest_analyzer.analyze_manifest(manifest_data=manifest_data)
        
        # Check permission fingerprints
        permissions = manifest_data.get('permissions', []) + manifest_data.get('host_permissions', [])
        perm_fp = analyzer.signature_database.check_permission_fingerprint(permissions)
        
        # Generate recommendations
        recommendations = []
        if manifest_results['risk_level'] == 'CRITICAL':
            recommendations.append('CRITICAL: Extension có nguy cơ cao. Nên xóa ngay lập tức.')
        elif manifest_results['risk_level'] == 'HIGH':
            recommendations.append('HIGH: Extension có nguy cơ. Nên xem xét tắt hoặc xóa.')
        elif manifest_results['risk_level'] == 'MEDIUM':
            recommendations.append('MEDIUM: Extension có một số rủi ro. Nên theo dõi.')
        
        if manifest_results.get('host_permissions_analysis', {}).get('universal_access'):
            recommendations.append('Extension có quyền truy cập tất cả websites. Cần cẩn thận.')
        
        if manifest_results.get('permissions_analysis', {}).get('total_permissions', 0) > 10:
            recommendations.append('Extension yêu cầu quá nhiều quyền. Cần xem xét.')
        
        if perm_fp.get('total_matches', 0) > 0:
            recommendations.append(f"Phát hiện {perm_fp['total_matches']} permission fingerprint nguy hiểm.")
        
        return jsonify({
            'success': True,
            'data': {
                'risk_score': manifest_results.get('risk_score', 0),
                'risk_level': manifest_results.get('risk_level', 'UNKNOWN'),
                'flags': manifest_results.get('flags', []),
                'suspicious_patterns': manifest_results.get('suspicious_patterns', []),
                'recommendations': recommendations,
                'permissions_analysis': manifest_results.get('permissions_analysis', {}),
                'host_permissions_analysis': manifest_results.get('host_permissions_analysis', {}),
                'content_scripts_analysis': manifest_results.get('content_scripts_analysis', {}),
                'permission_fingerprints': perm_fp
            },
            'timestamp': datetime.now(timezone.utc).isoformat()
        })
    
    except Exception as e:
        logger.error(f"Error analyzing manifest: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/analyze-js-code', methods=['POST'])
def analyze_js_code():
    """
    Analyze JavaScript code files
    
    Request body:
    {
        "code": "javascript code string",
        "file_path": "optional/path/to/file.js"
    }
    """
    try:
        data = request.get_json()
        
        code = data.get('code')
        file_path = data.get('file_path')
        
        if not code and not file_path:
            return jsonify({'error': 'code or file_path is required'}), 400
        
        logger.info(f"Analyzing JavaScript code: {file_path or 'inline'}")
        
        if file_path:
            js_results = analyzer.js_code_analyzer.analyze_file(file_path)
        else:
            js_results = analyzer.js_code_analyzer.analyze_code(code)
        
        # Check code fingerprints
        if code or (file_path and os.path.exists(file_path)):
            code_content = code if code else open(file_path, 'r', encoding='utf-8', errors='ignore').read()
            code_fp = analyzer.signature_database.check_code_fingerprint(code_content)
            js_results['code_fingerprints'] = code_fp
        
        return jsonify({
            'success': True,
            'data': js_results,
            'timestamp': datetime.now(timezone.utc).isoformat()
        })
    
    except Exception as e:
        logger.error(f"Error analyzing JS code: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

def signal_handler(sig, frame):
    """Handle shutdown signals gracefully"""
    print('\n\nShutting down server...')
    try:
        # Close MongoDB connection if exists
        if hasattr(analyzer, 'client'):
            analyzer.client.close()
        sys.exit(0)
    except Exception as e:
        logger.error(f"Error during shutdown: {e}")
        sys.exit(1)

@app.route('/api/list-installed-extensions', methods=['GET'])
def list_installed_extensions():
    """
    List all installed Chrome extensions from all profiles
    
    Returns:
        JSON with list of extensions from all profiles
    """
    try:
        logger.info("=== LIST INSTALLED EXTENSIONS CALLED ===")
        
        # Get all Chrome profiles
        profiles = get_all_chrome_profiles()
        logger.info(f"Found {len(profiles)} Chrome profiles")
        
        if not profiles:
            # Fallback to old method
            chrome_path = get_chrome_extensions_path()
            logger.info(f"Chrome extensions path: {chrome_path}")
            
            if not os.path.exists(chrome_path):
                logger.warning(f"Chrome extensions folder not found: {chrome_path}")
                return jsonify({
                    'success': False,
                    'error': f'Chrome extensions folder not found: {chrome_path}',
                    'chrome_path': chrome_path,
                    'suggestion': 'Please check if Chrome is installed and the path is correct.'
                }), 200
            
            extensions = scan_installed_extensions(chrome_path)
            logger.info(f"Found {len(extensions)} extensions")
            
            return jsonify({
                'success': True,
                'extensions': extensions,
                'chrome_path': chrome_path,
                'count': len(extensions),
                'profiles_scanned': 1
            })
        
        # Scan all profiles
        all_extensions = []
        profiles_scanned = []
        
        for profile in profiles:
            profile_name = profile['name']
            chrome_path = profile['path']
            
            logger.info(f"Scanning profile: {profile_name} at {chrome_path}")
            
            if not os.path.exists(chrome_path):
                logger.warning(f"Profile {profile_name} extensions folder not found: {chrome_path}")
                continue
            
            try:
                extensions = scan_installed_extensions(chrome_path, profile_name=profile_name)
                logger.info(f"Found {len(extensions)} extensions in profile {profile_name}")
                
                all_extensions.extend(extensions)
                profiles_scanned.append({
                    'name': profile_name,
                    'path': chrome_path,
                    'count': len(extensions)
                })
            except Exception as e:
                logger.error(f"Error scanning profile {profile_name}: {e}")
                continue
        
        logger.info(f"Total extensions found across all profiles: {len(all_extensions)}")
        
        return jsonify({
            'success': True,
            'extensions': all_extensions,
            'count': len(all_extensions),
            'profiles_scanned': profiles_scanned,
            'total_profiles': len(profiles_scanned)
        })
    except Exception as e:
        logger.error(f"Error listing installed extensions: {e}", exc_info=True)
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/analyze-installed-extension', methods=['POST'])
def analyze_installed_extension():
    """
    Analyze a specific installed Chrome extension
    
    Request body (JSON):
    - extension_id: Extension ID to analyze
    - chrome_path: Optional custom Chrome extensions path
    """
    try:
        data = request.get_json()
        extension_id = data.get('extension_id')
        custom_chrome_path = data.get('chrome_path')
        
        if not extension_id:
            return jsonify({
                'success': False,
                'error': 'extension_id is required'
            }), 400
        
        # Get Chrome extensions path
        chrome_path = custom_chrome_path or get_chrome_extensions_path()
        
        # Find extension
        extensions = scan_installed_extensions(chrome_path)
        extension = next((ext for ext in extensions if ext['id'] == extension_id), None)
        
        if not extension:
            return jsonify({
                'success': False,
                'error': f'Extension {extension_id} not found'
            }), 404
        
        # Read manifest
        manifest_path = extension['manifest_path']
        with open(manifest_path, 'r', encoding='utf-8') as f:
            manifest_data = json.load(f)
        
        # Find all JavaScript files
        extension_path = extension['path']
        js_files = []
        for root, dirs, files in os.walk(extension_path):
            # Skip node_modules and other common directories
            dirs[:] = [d for d in dirs if d not in ['node_modules', '.git', '__pycache__']]
            
            for file in files:
                if file.endswith(('.js', '.jsx')):
                    js_files.append(os.path.join(root, file))
        
        # Analyze using existing analyzer
        logger.info(f"Analyzing installed extension: {extension_id}")
        results = analyzer.analyze_with_manifest(
            extension_id=extension_id,
            manifest_path=manifest_path,
            manifest_data=manifest_data,
            js_files=js_files,
            time_window_hours=24,
            extension_path=extension_path
        )
        
        # Serialize results
        serialized_results = serialize_datetime(results)
        
        return jsonify({
            'success': True,
            'extension': {
                'id': extension_id,
                'name': extension['name'],
                'version': extension['version']
            },
            'results': serialized_results
        })
        
    except Exception as e:
        logger.error(f"Error analyzing installed extension: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    # Create templates and static directories if they don't exist
    base_dir = os.path.dirname(__file__)
    templates_dir = os.path.join(base_dir, 'templates')
    static_dir = os.path.join(base_dir, 'static')
    
    os.makedirs(templates_dir, exist_ok=True)
    os.makedirs(static_dir, exist_ok=True)
    
    # Debug: Print all registered routes
    print("\n" + "="*80)
    print("REGISTERED ROUTES:")
    print("="*80)
    for rule in app.url_map.iter_rules():
        if 'installed' in rule.rule or 'api' in rule.rule:
            print(f"  {rule.methods} {rule.rule}")
    print("="*80 + "\n")
    
    # Register signal handlers for graceful shutdown
    if sys.platform != 'win32':
        # Unix-like systems
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)
    else:
        # Windows
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGBREAK, signal_handler)
    
    print("=" * 80)
    print("Extension Analyzer Web Interface")
    print("=" * 80)
    print(f"Starting server on http://localhost:5000")
    print(f"Open your browser and navigate to: http://localhost:5000")
    print("Press Ctrl+C to stop the server")
    print("=" * 80)
    
    try:
        # Disable reloader on Windows to avoid socket errors
        use_reloader = sys.platform != 'win32'
        app.run(
            debug=True, 
            host='0.0.0.0', 
            port=5000,
            use_reloader=use_reloader,  # Disable reloader on Windows
            threaded=True
        )
    except KeyboardInterrupt:
        print('\n\nShutting down server...')
        try:
            if hasattr(analyzer, 'client'):
                analyzer.client.close()
        except:
            pass
        sys.exit(0)
