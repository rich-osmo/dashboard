#!/bin/bash
# Build a self-contained DMG for Personal Dashboard.
#
# Prerequisites:
#   brew install create-dmg
#   Python 3.11+ available as python3
#   Node.js 20+ available
#
# Usage:
#   ./scripts/build-dmg.sh [VERSION]
#   VERSION defaults to 1.0.0

set -euo pipefail

VERSION="${1:-1.0.0}"
APP_NAME="Dashboard"
DMG_NAME="PersonalDashboard-${VERSION}-macOS"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== Building Personal Dashboard v${VERSION} ==="

cd "$PROJECT_ROOT"

# 1. Build frontend
echo "--- Building frontend ---"
cd app/frontend
npm ci --silent
npm run build
cd "$PROJECT_ROOT"

# 2. Set up a clean build venv
echo "--- Setting up build environment ---"
BUILD_VENV="$PROJECT_ROOT/build-venv"
rm -rf "$BUILD_VENV"
python3 -m venv "$BUILD_VENV"
source "$BUILD_VENV/bin/activate"

pip install -q --upgrade pip
pip install -q -r app/backend/requirements.txt
pip install -q pyinstaller pywebview

# 3. Run PyInstaller
echo "--- Running PyInstaller ---"
APP_VERSION="$VERSION" pyinstaller dashboard.spec --clean --noconfirm

# 4. Verify the .app was created
if [ ! -d "dist/${APP_NAME}.app" ]; then
    echo "ERROR: PyInstaller did not produce dist/${APP_NAME}.app"
    exit 1
fi

echo "--- App bundle created: dist/${APP_NAME}.app ---"

# 5. Create DMG
echo "--- Creating DMG ---"
# Remove any previous DMG with the same name
rm -f "dist/${DMG_NAME}.dmg"

if command -v create-dmg &> /dev/null; then
    # create-dmg exits with code 2 on non-fatal warnings (e.g., no background image)
    create-dmg \
        --volname "Personal Dashboard" \
        --volicon "Dashboard.app/Contents/Resources/AppIcon.icns" \
        --window-pos 200 120 \
        --window-size 600 400 \
        --icon-size 100 \
        --icon "${APP_NAME}.app" 175 190 \
        --hide-extension "${APP_NAME}.app" \
        --app-drop-link 425 190 \
        "dist/${DMG_NAME}.dmg" \
        "dist/${APP_NAME}.app" || true
else
    # Fallback: create a simple DMG with hdiutil
    echo "create-dmg not found, using hdiutil fallback"
    hdiutil create \
        -volname "Personal Dashboard" \
        -srcfolder "dist/${APP_NAME}.app" \
        -ov -format UDZO \
        "dist/${DMG_NAME}.dmg"
fi

# 6. Clean up build venv
echo "--- Cleaning up ---"
deactivate 2>/dev/null || true
rm -rf "$BUILD_VENV"

# 7. Report
if [ -f "dist/${DMG_NAME}.dmg" ]; then
    SIZE=$(du -h "dist/${DMG_NAME}.dmg" | cut -f1)
    echo ""
    echo "=== Success ==="
    echo "DMG: dist/${DMG_NAME}.dmg (${SIZE})"
else
    echo "ERROR: DMG was not created"
    exit 1
fi
