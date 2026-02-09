#!/usr/bin/env python3
"""
Dependency verification script for Canteen Management System.
This script tests all imports used in the project.
"""

import sys
import subprocess
from importlib import import_module

def test_import(module_name, pip_name=None):
    """Test if a module can be imported."""
    try:
        import_module(module_name)
        print(f"✓ {module_name}")
        return True
    except ImportError as e:
        pip_name = pip_name or module_name
        print(f"✗ {module_name} - Missing: {e}")
        print(f"  Install with: pip install {pip_name}")
        return False
    except Exception as e:
        print(f"⚠ {module_name} - Error: {e}")
        return False

def main():
    print("Testing Canteen Management System dependencies...\n")
    
    # Core dependencies from requirements.txt
    dependencies = [
        ("fastapi", "fastapi"),
        ("uvicorn", "uvicorn"),
        ("sqlalchemy", "sqlalchemy"),
        ("jwt", "python-jose[cryptography]"),
        ("passlib", "passlib[bcrypt]"),
        ("pydantic", "pydantic"),
        ("pydantic_settings", "pydantic-settings"),
        ("starlette", "starlette"),
        ("python_dotenv", "python-dotenv"),
        ("docx", "python-docx"),
        ("email_validator", "email-validator"),
    ]
    
    # Standard library modules (should always be available)
    stdlib_modules = [
        "random",
        "string",
        "os",
        "csv",
        "io",
        "datetime",
        "typing",
        "smtplib",
        "email.mime.text",
        "email.mime.multipart",
        "re",
        "enum",
        "logging",
        "sys",
        "pathlib",
    ]
    
    all_passed = True
    
    print("Testing external dependencies:")
    print("=" * 40)
    for module_name, pip_name in dependencies:
        if not test_import(module_name, pip_name):
            all_passed = False
    
    print("\nTesting standard library modules:")
    print("=" * 40)
    for module_name in stdlib_modules:
        if not test_import(module_name):
            all_passed = False
    
    # Test project-specific imports
    print("\nTesting project-specific imports:")
    print("=" * 40)
    project_imports = [
        "auth",
        "menu_parser",
        "models",
        "schemas",
        "docx_utils",
        "logger",
        "init_db",
    ]
    
    for module_name in project_imports:
        try:
            import_module(module_name)
            print(f"✓ {module_name}")
        except ImportError as e:
            print(f"✗ {module_name} - {e}")
            all_passed = False
        except Exception as e:
            print(f"⚠ {module_name} - {e}")
    
    print("\n" + "=" * 40)
    if all_passed:
        print("✅ All dependencies verified successfully!")
        print("The requirements.txt file appears to be complete.")
    else:
        print("❌ Some dependencies are missing or have issues.")
        print("Please install missing packages and update requirements.txt if needed.")
    
    return 0 if all_passed else 1

if __name__ == "__main__":
    sys.exit(main())