#!/bin/sh
# Build the release download: a universal (Apple silicon + Intel) "Night Garden.app",
# signed with a Developer ID when one is in the keychain, notarised when notarytool has a
# keychain profile, and zipped together with install.sh and uninstall.sh into dist/.
#
#   sh wallpaper/release.sh
#
# Environment:
#   SIGN_IDENTITY   codesign identity; default: the first "Developer ID Application" found,
#                   or ad-hoc ("-") when there is none. Ad-hoc builds are for testing only,
#                   Gatekeeper refuses them on other Macs.
#   NOTARY_PROFILE  notarytool keychain profile; default "night-garden". Create it once with
#                   xcrun notarytool store-credentials night-garden --apple-id you@example.com --team-id TEAMID
#                   (it asks for an app-specific password from appleid.apple.com). Skipped
#                   when the profile does not exist.
set -eu

here=$(cd "$(dirname "$0")" && pwd)
project=$(dirname "$here")
version=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$here/Info.plist")
dist="$project/dist"
stage="$dist/Night Garden $version"
app="$stage/Night Garden.app"

identity=${SIGN_IDENTITY:-$(security find-identity -v -p codesigning 2>/dev/null | sed -n 's/.*"\(Developer ID Application: [^"]*\)".*/\1/p' | head -1)}
identity=${identity:--}
profile=${NOTARY_PROFILE:-night-garden}

build=$(mktemp -d)
trap 'rm -rf "$build"' EXIT
for arch in arm64 x86_64; do
	swiftc -O -target "$arch-apple-macos13.0" -o "$build/$arch" \
		"$here/Wallpaper.swift" -framework Cocoa -framework WebKit -framework IOKit
done
lipo -create "$build/arm64" "$build/x86_64" -output "$build/Night Garden"

rm -rf "$stage"
mkdir -p "$stage"
sh "$here/bundle.sh" "$build/Night Garden" "$app" "$identity"
cp "$here/install.sh" "$here/uninstall.sh" "$stage/"
cat >"$stage/README.txt" <<TEXT
Night Garden $version, a live macOS wallpaper.

1. Open Terminal, drag install.sh into it and press Return
   (or run: sh "$(basename "$stage")/install.sh").
2. Wait about twenty seconds for the first frame.

The app is copied to ~/Applications and starts at every login. A moon in the menu bar
pauses or quits it. To remove it, run uninstall.sh the same way.

Source, licences and credits: https://github.com/esteugene/night-garden
TEXT

if [ "$identity" = "-" ]; then
	echo "Signed ad-hoc: no Developer ID in the keychain. This build only runs on this Mac."
elif xcrun notarytool history --keychain-profile "$profile" >/dev/null 2>&1; then
	ditto -c -k --keepParent --norsrc "$app" "$build/notarize.zip"
	xcrun notarytool submit "$build/notarize.zip" --keychain-profile "$profile" --wait
	xcrun stapler staple "$app"
else
	echo "Not notarised: no notarytool profile '$profile'. Other Macs will show a Gatekeeper warning." >&2
fi

zip="$dist/Night-Garden-$version.zip"
rm -f "$zip"
(cd "$dist" && ditto -c -k --keepParent --norsrc "$(basename "$stage")" "$zip")
codesign -dv "$app" 2>&1 | sed -n 's/^Authority=/  signed by: /p' | head -1
echo "Release: $zip"
