#!/bin/sh
set -eu
ROOT=/workspace
SDK="$ROOT/.android-sdk"
BT="$SDK/build-tools/34.0.0"
JAR="$SDK/platforms/android-34/android.jar"
APP="$ROOT/android-phone"
OUT="$ROOT/public/downloads"
VER=1.2.33
WORK=/tmp/catedra-phone-apk
rm -rf "$WORK"
mkdir -p "$WORK/gen" "$WORK/classes" "$WORK/dex" "$WORK/assets/www" "$OUT"

cp "$ROOT/tizen-widget/index.html" "$ROOT/tizen-widget/icon.png" "$ROOT/tizen-widget/splash.jpg" "$WORK/assets/www/"
mkdir -p "$WORK/assets/www/css" "$WORK/assets/www/js"
cp "$ROOT/tizen-widget/css/app.css" "$WORK/assets/www/css/"
cp "$ROOT/tizen-widget/js/app.js" "$WORK/assets/www/js/"

"$BT/aapt2" compile --dir "$APP/res" -o "$WORK/res.zip"
"$BT/aapt2" link \
  -I "$JAR" \
  --manifest "$APP/AndroidManifest.xml" \
  --java "$WORK/gen" \
  --min-sdk-version 21 \
  --target-sdk-version 34 \
  --version-code 153 \
  --version-name "$VER" \
  -o "$WORK/base.apk" \
  "$WORK/res.zip"

find "$APP/src" "$WORK/gen" -name '*.java' > "$WORK/sources.txt"
javac --release 8 -encoding UTF-8 -classpath "$JAR" -d "$WORK/classes" @"$WORK/sources.txt"
"$BT/d8" --min-api 21 --lib "$JAR" --output "$WORK/dex" "$WORK/classes"/ru/catedra/mobile/*.class

rm -rf "$WORK/pkg"
mkdir -p "$WORK/pkg"
unzip -q -o "$WORK/base.apk" -d "$WORK/pkg"
cp "$WORK/dex/classes.dex" "$WORK/pkg/"
mkdir -p "$WORK/pkg/assets"
cp -a "$WORK/assets/www" "$WORK/pkg/assets/"

python3 - << 'PY'
import os, zipfile
root = "/tmp/catedra-phone-apk/pkg"
out = "/tmp/catedra-phone-apk/unsigned.apk"
stored = {"resources.arsc", "AndroidManifest.xml"}
with zipfile.ZipFile(out, "w") as z:
    for dirpath, _, files in os.walk(root):
        for name in sorted(files):
            full = os.path.join(dirpath, name)
            rel = os.path.relpath(full, root).replace(os.sep, "/")
            mode = zipfile.ZIP_STORED if rel in stored else zipfile.ZIP_DEFLATED
            z.write(full, rel, compress_type=mode)
print("zipped", os.path.getsize(out))
PY
"$BT/zipalign" -f -p 4 "$WORK/unsigned.apk" "$WORK/aligned.apk"
python3 "$ROOT/scripts/sign-apk-compat.py" "$WORK/aligned.apk" "$OUT/Catedra-Phone-$VER.apk"
"$BT/apksigner" verify --verbose --min-sdk-version 21 "$OUT/Catedra-Phone-$VER.apk" | head -12
"$BT/aapt" dump badging "$OUT/Catedra-Phone-$VER.apk" | head -4
ls -lh "$OUT/Catedra-Phone-$VER.apk"

python3 - "$APP/AndroidManifest.xml" "$WORK/AndroidManifest-rustore.xml" "$WORK/assets/www/index.html" "$WORK/assets/www/no-update" << 'PY'
import re, sys
from pathlib import Path
manifest = Path(sys.argv[1]).read_text()
manifest = manifest.replace('    <uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />\n', '')
manifest = re.sub(r'\n\s*<provider\s+android:name="\.ApkProvider".*?/>\s*', '\n', manifest, count=1, flags=re.S)
Path(sys.argv[2]).write_text(manifest)
html = Path(sys.argv[3])
text = html.read_text()
needle = '<script src="js/app.js"></script>'
if "CATEDRA_STORE" not in text:
    html.write_text(text.replace(needle, '<script>window.CATEDRA_STORE=true;</script>\n  ' + needle, 1))
Path(sys.argv[4]).write_text("rustore\n")
PY
"$BT/aapt2" link \
  -I "$JAR" \
  --manifest "$WORK/AndroidManifest-rustore.xml" \
  --min-sdk-version 21 \
  --target-sdk-version 34 \
  --version-code 153 \
  --version-name "$VER" \
  -o "$WORK/base-rustore.apk" \
  "$WORK/res.zip"
rm -rf "$WORK/pkg-rustore"
mkdir -p "$WORK/pkg-rustore"
unzip -q -o "$WORK/base-rustore.apk" -d "$WORK/pkg-rustore"
cp "$WORK/dex/classes.dex" "$WORK/pkg-rustore/"
mkdir -p "$WORK/pkg-rustore/assets"
cp -a "$WORK/assets/www" "$WORK/pkg-rustore/assets/"
python3 - << 'PY'
import os, zipfile
root = "/tmp/catedra-phone-apk/pkg-rustore"
out = "/tmp/catedra-phone-apk/unsigned-rustore.apk"
stored = {"resources.arsc", "AndroidManifest.xml"}
with zipfile.ZipFile(out, "w") as z:
    for dirpath, _, files in os.walk(root):
        for name in sorted(files):
            full = os.path.join(dirpath, name)
            rel = os.path.relpath(full, root).replace(os.sep, "/")
            mode = zipfile.ZIP_STORED if rel in stored else zipfile.ZIP_DEFLATED
            z.write(full, rel, compress_type=mode)
print("zipped", os.path.getsize(out))
PY
"$BT/zipalign" -f -p 4 "$WORK/unsigned-rustore.apk" "$WORK/aligned-rustore.apk"
python3 "$ROOT/scripts/sign-apk-compat.py" "$WORK/aligned-rustore.apk" "$OUT/Catedra-Phone-RuStore-$VER.apk"
"$BT/apksigner" verify --verbose --min-sdk-version 21 "$OUT/Catedra-Phone-RuStore-$VER.apk" | head -8
"$BT/aapt" dump permissions "$OUT/Catedra-Phone-RuStore-$VER.apk"
ls -lh "$OUT/Catedra-Phone-RuStore-$VER.apk"

