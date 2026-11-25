#!/usr/bin/env python3
"""Пересобрать versions.xml по последним релизам GitHub.

Название, описание и иконка берутся из catalog/apps.json.
Версия и прямая ссылка — из самого нового файла этого приложения.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parents[1]
REPO = os.environ.get("CATALOG_REPO", "GrafAtRuss/catedra-tv")
RAW_ICONS = f"https://raw.githubusercontent.com/{REPO}/main/catalog/icons/"
VERSION_RE = re.compile(r"(\d+\.\d+\.\d+)")


def classify(name: str) -> str | None:
    if name.startswith("Catedra-Phone-RuStore-") and name.endswith(".apk"):
        return "phone-rustore"
    if name.startswith("Catedra-Phone-") and name.endswith(".apk"):
        return "phone"
    if name.startswith("Catedra-TV-RuStore-") and name.endswith(".apk"):
        return "tv-rustore"
    if name.startswith("Catedra-TV-") and name.endswith("-YaOS.apk"):
        return "yaos"
    if name.startswith("Catedra-TV-") and name.endswith(".wgt"):
        return "tizen"
    if name.startswith("Catedra-TV-") and name.endswith(".apk"):
        return "tv"
    if name.startswith("Catedra-Aurora-") and name.endswith("-armv7hl.rpm"):
        return "aurora32"
    if name.startswith("Catedra-Aurora-") and name.endswith("-aarch64.rpm"):
        return "aurora64"
    return None


def ver_key(version: str) -> tuple:
    return tuple(int(part) for part in version.split("."))


def fetch_releases() -> list:
    env = os.environ.copy()
    raw = subprocess.check_output(
        ["gh", "api", "--paginate", f"repos/{REPO}/releases?per_page=100"],
        text=True,
        env=env,
    )
    data = json.loads(raw)
    if not isinstance(data, list):
        raise SystemExit("GitHub API вернул не список релизов")
    return data


def latest_assets(releases: list) -> tuple[dict, str]:
    best: dict = {}
    newest = ""
    for release in releases:
        if release.get("draft"):
            continue
        published = release.get("published_at") or ""
        for asset in release.get("assets") or []:
            name = asset.get("name") or ""
            app_id = classify(name)
            if not app_id:
                continue
            match = VERSION_RE.search(name)
            url = asset.get("browser_download_url") or ""
            if not match or not url.startswith("https://"):
                continue
            version = match.group(1)
            current = best.get(app_id)
            if current is None or ver_key(version) > ver_key(current["version"]):
                best[app_id] = {
                    "version": version,
                    "download": url,
                    "file": name,
                    "published": published,
                }
                if published > newest:
                    newest = published
    return best, newest


def icon_url(icon: str) -> str:
    if icon.startswith("https://"):
        return icon
    return RAW_ICONS + icon.lstrip("/")


def build_xml(apps: list, found: dict, updated: str) -> str:
    rows = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        "<!--",
        "  Каталог приложений «Кафедра».",
        "  Обновляется скриптом scripts/update-catalog.py при выпуске версии.",
        f"  https://raw.githubusercontent.com/{REPO}/main/versions.xml",
        "  У каждого приложения: id, название, версия, краткое описание, иконка, прямая ссылка.",
        "-->",
        "<catalog>",
        f"  <updated>{escape(updated)}</updated>",
        "  <applications>",
    ]
    for app in apps:
        app_id = app["id"]
        item = found.get(app_id)
        if not item:
            print(f"нет файла для {app_id}", file=sys.stderr)
            continue
        rows.append(f'    <application id="{escape(app_id)}">')
        rows.append(f"      <name>{escape(app['name'])}</name>")
        rows.append(f"      <version>{escape(item['version'])}</version>")
        rows.append(f"      <description>{escape(app['description'])}</description>")
        rows.append(f"      <icon>{escape(icon_url(app['icon']))}</icon>")
        rows.append(f"      <download>{escape(item['download'])}</download>")
        rows.append(f"      <file>{escape(item['file'])}</file>")
        rows.append("    </application>")
    rows.append("  </applications>")
    rows.append("</catalog>")
    rows.append("")
    return "\n".join(rows)


def main() -> None:
    meta = json.loads((ROOT / "catalog" / "apps.json").read_text(encoding="utf-8"))
    apps = meta["apps"]
    found, updated = latest_assets(fetch_releases())
    if not found:
        raise SystemExit("в релизах не найдено ни одного приложения, файл не трогаю")
    xml = build_xml(apps, found, updated or "")
    target = ROOT / "versions.xml"
    previous = target.read_text(encoding="utf-8") if target.exists() else ""
    if previous == xml:
        print("versions.xml уже актуален")
        return
    target.write_text(xml, encoding="utf-8")
    print(f"записан {target}")
    for app in apps:
        item = found.get(app["id"])
        if item:
            print(f"  {app['id']}: {item['version']}  {item['file']}")


if __name__ == "__main__":
    main()
