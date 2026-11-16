#!/bin/sh
set -eu
ROOT=/workspace
STAGE="$ROOT/aurora/stage"
OUT="$ROOT/public/downloads"
RPM_ROOT=/tmp/rpmroot
export LD_LIBRARY_PATH=$RPM_ROOT/usr/lib/x86_64-linux-gnu
export RPM_CONFIGDIR=$RPM_ROOT/usr/lib/rpm
export PATH=$RPM_ROOT/usr/bin:$PATH

python3 "$ROOT/aurora/tools/make_elf.py"
cp "$ROOT/tizen-widget/icon.png" "$ROOT/aurora/qml/icon.png"

build_one() {
  arch="$1"
  top=/tmp/aurora-rpm-$arch
  rm -rf "$top" "$STAGE"
  mkdir -p "$top" "$STAGE/usr/bin" \
    "$STAGE/usr/share/applications" \
    "$STAGE/usr/share/ru.catedra.Catedra/qml" \
    "$STAGE/usr/share/icons/hicolor/86x86/apps" \
    "$STAGE/usr/share/icons/hicolor/108x108/apps" \
    "$STAGE/usr/share/icons/hicolor/128x128/apps" \
    "$STAGE/usr/share/icons/hicolor/172x172/apps"
  install -m 755 "$ROOT/aurora/launchers/launcher.$arch" "$STAGE/usr/bin/ru.catedra.Catedra"
  install -m 644 "$ROOT/aurora/desktop/ru.catedra.Catedra.desktop" "$STAGE/usr/share/applications/ru.catedra.Catedra.desktop"
  cp "$ROOT/aurora/qml/"*.qml "$ROOT/aurora/qml/"*.js "$ROOT/aurora/qml/icon.png" "$STAGE/usr/share/ru.catedra.Catedra/qml/"
  chmod 644 "$STAGE/usr/share/ru.catedra.Catedra/qml/"*
  cp "$ROOT/aurora/icons/86.png" "$STAGE/usr/share/icons/hicolor/86x86/apps/ru.catedra.Catedra.png"
  cp "$ROOT/aurora/icons/108.png" "$STAGE/usr/share/icons/hicolor/108x108/apps/ru.catedra.Catedra.png"
  cp "$ROOT/aurora/icons/128.png" "$STAGE/usr/share/icons/hicolor/128x128/apps/ru.catedra.Catedra.png"
  cp "$ROOT/aurora/icons/172.png" "$STAGE/usr/share/icons/hicolor/172x172/apps/ru.catedra.Catedra.png"
  chmod 644 "$STAGE/usr/share/icons/hicolor/"*"/apps/"*.png
  cat > "$top/catedra.spec" << EOF
%global __os_install_post %{nil}
%global debug_package %{nil}
%global _build_id_links none

Name: ru.catedra.Catedra
Version: 1.2.32
Release: 1
Summary: Catedra live Mass
License: LicenseRef-proprietary
URL: https://catedra.ru

Requires: sailfishsilica-qt5 >= 0.10.9
Requires: qt5-qtmultimedia
Requires: qt5-qtdeclarative-import-multimedia
Requires: qt5-qtmultimedia-plugin-mediaservice-gstmediaplayer
Requires: qt5-qtmultimedia-plugin-audio-pulseaudio
Requires: qt5-qtdeclarative-import-localstorageplugin

%description
Live Mass, schedule and recordings of the Cathedral of the Immaculate Conception in Moscow.

%install
mkdir -p %{buildroot}
cp -a $STAGE/. %{buildroot}/

%files
%defattr(-,root,root,-)
/usr/bin/ru.catedra.Catedra
/usr/share/applications/ru.catedra.Catedra.desktop
/usr/share/icons/hicolor/86x86/apps/ru.catedra.Catedra.png
/usr/share/icons/hicolor/108x108/apps/ru.catedra.Catedra.png
/usr/share/icons/hicolor/128x128/apps/ru.catedra.Catedra.png
/usr/share/icons/hicolor/172x172/apps/ru.catedra.Catedra.png
/usr/share/ru.catedra.Catedra/qml/ArchivePage.qml
/usr/share/ru.catedra.Catedra/qml/Catedra.js
/usr/share/ru.catedra.Catedra/qml/HomePage.qml
/usr/share/ru.catedra.Catedra/qml/LivePage.qml
/usr/share/ru.catedra.Catedra/qml/SchedulePage.qml
/usr/share/ru.catedra.Catedra/qml/SettingsPage.qml
/usr/share/ru.catedra.Catedra/qml/Store.js
/usr/share/ru.catedra.Catedra/qml/icon.png
/usr/share/ru.catedra.Catedra/qml/main.qml
EOF
  rpmbuild -bb --target "$arch" --define "_topdir $top" --define "_tmppath $top/tmp" "$top/catedra.spec"
  cp "$top/RPMS/$arch/ru.catedra.Catedra-1.2.32-1.$arch.rpm" "$OUT/Catedra-Aurora-1.2.32-$arch.rpm"
  rpm -qp --info "$OUT/Catedra-Aurora-1.2.32-$arch.rpm"
  echo "file $(readelf -h "$STAGE/usr/bin/ru.catedra.Catedra" | awk '/Machine|Class/ {print}')"
}

mkdir -p "$OUT"
build_one armv7hl
build_one aarch64
ls -lh "$OUT"/Catedra-Aurora-1.2.32-*.rpm
