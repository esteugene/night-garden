#!/bin/sh
# Assemble "Night Garden.app" from a compiled binary: the Info.plist, a private copy of the
# scene and the Three.js library, and the licence notices. Used by install.sh (a build for
# this Mac) and release.sh (a universal, signed build for other people's Macs).
#
#   sh wallpaper/bundle.sh <binary> <destination.app> [codesign identity]
set -eu

binary=$1
app=$2
identity=${3:--}
here=$(cd "$(dirname "$0")" && pwd)
project=$(dirname "$here")

rm -rf "$app"
scene="$app/Contents/Resources/scene"
mkdir -p "$app/Contents/MacOS" "$scene/scenes"
cp "$binary" "$app/Contents/MacOS/Night Garden"
cp "$here/Info.plist" "$app/Contents/Info.plist"
cp -R "$project/scenes/night-garden" "$scene/scenes/"
cp -R "$project/vendor" "$scene/"
rm -rf "$scene/scenes/night-garden/tests"
cp "$project/LICENSE" "$app/Contents/Resources/LICENSE.txt"
cp "$project/THIRD-PARTY.md" "$app/Contents/Resources/THIRD-PARTY.md"

if [ "$identity" = "-" ]; then
	codesign --force --sign - "$app" >/dev/null 2>&1 || true
else
	codesign --force --options runtime --timestamp --sign "$identity" "$app"
fi
