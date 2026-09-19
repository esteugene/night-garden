#!/bin/sh
# Install Night Garden as a live desktop wallpaper and start it now and at every login.
#
# From a release download, "Night Garden.app" sits next to this script and is copied as
# it is. From the source tree the agent is compiled first, which needs the Xcode command
# line tools (xcode-select --install). Either way the app lands in ~/Applications with
# its own copy of the scene, so this folder can be deleted afterwards.
#
# Desktop Habitats, if installed, is not touched: Night Garden has its own name, bundle
# identifier and login item.
set -eu

here=$(cd "$(dirname "$0")" && pwd)
label=com.zheke.night-garden
app="$HOME/Applications/Night Garden.app"
agent="$HOME/Library/LaunchAgents/$label.plist"
domain="gui/$(id -u)"

launchctl bootout "$domain/$label" 2>/dev/null || true
mkdir -p "$HOME/Applications"

if [ -d "$here/Night Garden.app" ]; then
	# A release download: the app is already built and signed.
	rm -rf "$app"
	cp -R "$here/Night Garden.app" "$app"
else
	if ! command -v swiftc >/dev/null; then
		echo "swiftc is missing. Install the Xcode command line tools: xcode-select --install" >&2
		exit 1
	fi
	build=$(mktemp -d)
	trap 'rm -rf "$build"' EXIT
	# Built for this machine's own architecture; the binary never leaves it.
	swiftc -O -target "$(uname -m)-apple-macos13.0" -o "$build/Night Garden" \
		"$here/Wallpaper.swift" -framework Cocoa -framework WebKit -framework IOKit
	sh "$here/bundle.sh" "$build/Night Garden" "$app"
fi

mkdir -p "$(dirname "$agent")"
cat >"$agent" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>Label</key>
	<string>$label</string>
	<key>ProgramArguments</key>
	<array>
		<string>$app/Contents/MacOS/Night Garden</string>
	</array>
	<key>RunAtLoad</key>
	<true/>
	<key>KeepAlive</key>
	<dict>
		<key>SuccessfulExit</key>
		<false/>
	</dict>
	<key>ProcessType</key>
	<string>Interactive</string>
	<key>StandardErrorPath</key>
	<string>/tmp/night-garden.log</string>
</dict>
</plist>
PLIST

launchctl bootstrap "$domain" "$agent"
launchctl kickstart -k "$domain/$label"

# The desktop picture behind the live layer: what login, Mission Control and Stage Manager
# show before the scene is drawing. It is a frame of the scene itself.
still="$HOME/Pictures/Night Garden.png"
mkdir -p "$HOME/Pictures"
echo "Waiting for the first frame, then setting the still picture."
sleep 12
if pid=$(pgrep -n -f "Night Garden.app/Contents/MacOS/Night Garden"); then
	kill -USR1 "$pid" && sleep 8
	if [ -s /tmp/night-garden.png ]; then
		cp /tmp/night-garden.png "$still"
		osascript -e "tell application \"System Events\" to tell every desktop to set picture to \"$still\"" >/dev/null 2>&1 ||
			echo "Could not set the still picture; the live layer covers it anyway."
	fi
else
	echo "The app did not stay running. If macOS blocked it, open System Settings > Privacy & Security," >&2
	echo "choose Open Anyway next to Night Garden, then run this script again." >&2
	exit 1
fi

echo "Night Garden installed: $app"
echo "Look for the moon in the menu bar to pause or quit. Remove it with: sh $here/uninstall.sh"
