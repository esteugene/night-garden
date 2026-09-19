#!/bin/sh
# Stop Night Garden, remove its login item and delete the app. The desktop keeps the
# still picture the installer set; choose another one in System Settings if you like.
# Desktop Habitats, if installed, is left alone.
set -eu

label=com.zheke.night-garden
agent="$HOME/Library/LaunchAgents/$label.plist"

launchctl bootout "gui/$(id -u)/$label" 2>/dev/null || true
rm -f "$agent"
rm -rf "$HOME/Applications/Night Garden.app"
echo "Night Garden removed. The still picture stays at ~/Pictures/Night Garden.png."
