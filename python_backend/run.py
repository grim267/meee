#!/usr/bin/env python3
"""
CyberSecure Hospital Defense System - Python Backend Runner
Simple script to run the Flask application
"""

import os
import sys
import subprocess

def check_requirements():
    """Check if all requirements are installed"""
    try:
        import flask
        import sklearn
        import pandas
        import numpy
        import supabase
        print("✅ All required packages are installed")
        return True
    except ImportError as e:
        print(f"❌ Missing required package: {e}")
        print("Please run: pip install -r requirements.txt")
        return False

def check_environment():
    """Check environment variables"""
    required_vars = ['SUPABASE_URL', 'SUPABASE_KEY']
    missing_vars = []
    
    for var in required_vars:
        if not os.getenv(var):
            missing_vars.append(var)
    
    if missing_vars:
        print(f"❌ Missing environment variables: {', '.join(missing_vars)}")
        print("Please copy .env.example to .env and configure it")
        return False
    
    print("✅ Environment variables configured")
    return True

def main():
    """Main runner function"""
    print("🛡️  CyberSecure Hospital Defense System - Python Backend")
    print("=" * 60)
    
    # Check requirements
    if not check_requirements():
        sys.exit(1)
    
    # Check environment
    if not check_environment():
        sys.exit(1)
    
    # Check if running as root (needed for network monitoring)
    if os.geteuid() != 0:
        print("⚠️  Warning: Not running as root - network monitoring may not work")
        print("   For full functionality, run with: sudo python run.py")
    
    print("🚀 Starting Python backend server...")
    print("   Access the API at: http://localhost:3001")
    print("   Press Ctrl+C to stop")
    print("-" * 60)
    
    # Run the Flask app
    try:
        from app import app, socketio
        socketio.run(
            app,
            host='0.0.0.0',
            port=int(os.getenv('FLASK_PORT', 3001)),
            debug=os.getenv('FLASK_ENV') == 'development'
        )
    except KeyboardInterrupt:
        print("\n🛑 Server stopped by user")
    except Exception as e:
        print(f"❌ Error starting server: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()