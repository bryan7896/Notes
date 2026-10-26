#!/usr/bin/env python3
"""
build.py — empaqueta la PWA de Notas.

Toma todo lo que hay en src/ y lo copia a la raíz del proyecto (al
lado de este mismo build.py), listo para subir a cualquier hosting
estático (GitHub Pages, Netlify, Vercel, un server propio, etc.) o
para abrir index.html directo en el iPhone agregándolo a la pantalla
de inicio. index.html queda así directamente en la raíz, no dentro de
una subcarpeta como "dist/".

Uso:
    python build.py
    python build.py --api-url "https://script.google.com/.../exec"

--api-url es opcional: si lo pasas, reescribe la URL del backend en
js/config.js sin tener que tocar el archivo fuente (src/js/config.js)
a mano (útil si vuelves a desplegar el Apps Script y te da una URL
nueva).
"""

import argparse
import re
import shutil
from pathlib import Path
from typing import Optional

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
OUT = ROOT  # el build se genera directo en la raíz del proyecto

# Archivos/carpetas propios del proyecto (no de la PWA) que nunca se
# deben tocar aunque compartan nombre con algo dentro de src/.
PRESERVE = {"build.py", "Code.gs", "src", "__pycache__", ".git"}


def build(api_url: Optional[str]) -> None:
    if not SRC.exists():
        raise SystemExit(f"No existe la carpeta de origen: {SRC}")

    # Limpia en la raíz solo lo que la build anterior haya generado
    # (lo que hoy existe dentro de src/), para no dejar basura de
    # versiones previas sin tocar build.py, Code.gs, etc.
    for item in SRC.iterdir():
        target = OUT / item.name
        if target.name in PRESERVE:
            continue
        if target.exists():
            if target.is_dir() and not target.is_symlink():
                shutil.rmtree(target)
            else:
                target.unlink()

    # Copia el contenido de src/ a la raíz, archivo por archivo /
    # carpeta por carpeta (no la carpeta src/ completa).
    for item in SRC.iterdir():
        target = OUT / item.name
        if item.is_dir():
            shutil.copytree(item, target)
        else:
            shutil.copy2(item, target)

    if api_url:
        config_path = OUT / "js" / "config.js"
        content = config_path.read_text(encoding="utf-8")
        new_content = re.sub(
            r'API_URL:\s*".*?"',
            f'API_URL: "{api_url}"',
            content,
            count=1,
        )
        config_path.write_text(new_content, encoding="utf-8")
        print(f"API_URL actualizado en {config_path}")

    print(f"Listo. PWA generada en la raíz del proyecto: {OUT}")
    print(f"index.html queda en: {OUT / 'index.html'}")
    print("Para probar localmente: python -m http.server 8000")
    print("(los Service Workers necesitan http(s), no sirve con file://)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Genera la PWA de Notas en la raíz del proyecto")
    parser.add_argument("--api-url", default=None, help="URL del despliegue de Apps Script")
    args = parser.parse_args()
    build(args.api_url)
