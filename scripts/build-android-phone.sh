#!/bin/sh
set -eu
ROOT=/workspace
SDK="$ROOT/.android-sdk"
BT="$SDK/build-tools/34.0.0"
JAR="$SDK/platforms/android-34/android.jar"
APP="$ROOT/android-phone"
OUT="$ROOT/public/downloads"
VER=1.2.24
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
  --version-code 144 \
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
"$BT/apksigner" sign \
  --ks "$ROOT/android-tv/catedra.keystore" \
  --ks-key-alias catedra \
  --ks-pass pass:catedra-tv \
  --key-pass pass:catedra-tv \
  --v1-signing-enabled true \
  --v2-signing-enabled true \
  --v3-signing-enabled true \
  --v1-signer-name CERT \
  --out "$OUT/Catedra-Phone-$VER.apk" \
  "$WORK/aligned.apk"
"$BT/apksigner" verify --verbose "$OUT/Catedra-Phone-$VER.apk" | head -12
"$BT/aapt" dump badging "$OUT/Catedra-Phone-$VER.apk" | head -8
rm -f "$OUT/Catedra-Phone-$VER.apk.idsig"
ls -lh "$OUT/Catedra-Phone-$VER.apk"
