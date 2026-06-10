#!/usr/bin/env python3
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png"}
OCR_LANGUAGE = os.environ.get("OCR_LANGUAGE", "eng")

def print_result(ok, markdown=None, error=None):
    print(json.dumps({"ok": ok, "markdown": markdown or "", "error": error}))

def run_rapidocr_image(file_path: Path) -> str:
    from rapidocr_onnxruntime import RapidOCR

    engine = RapidOCR()
    result, _ = engine(str(file_path))

    if not result:
        return ""

    lines = []
    for item in result:
        if len(item) >= 2:
            lines.append(str(item[1]))

    return "\n".join(lines)

def run_rapidocr_pdf(file_path: Path) -> str:
    from pdf2image import convert_from_path
    from rapidocr_onnxruntime import RapidOCR

    engine = RapidOCR()
    pages = convert_from_path(str(file_path), dpi=220)
    parts = []

    with tempfile.TemporaryDirectory() as temp_dir:
        for index, page in enumerate(pages, start=1):
            image_path = Path(temp_dir) / f"page-{index}.png"
            page.save(image_path)

            result, _ = engine(str(image_path))
            if not result:
                continue

            lines = []
            for item in result:
                if len(item) >= 2:
                    lines.append(str(item[1]))

            text = "\n".join(lines).strip()
            if text:
                parts.append(f"## OCR strana {index}\n\n{text}")

    return "\n\n".join(parts)

def main():
    if len(sys.argv) != 2:
        print_result(False, error="Usage: convert_with_markitdown.py <file>")
        sys.exit(1)

    file_path = Path(sys.argv[1])

    if not file_path.exists():
        print_result(False, error="Input file does not exist.")
        sys.exit(1)

    try:
        suffix = file_path.suffix.lower()

        if suffix == ".rtf":
            from striprtf.striprtf import rtf_to_text
            markdown = rtf_to_text(file_path.read_text(errors="ignore"))
            print_result(True, markdown=markdown)
            return

        if suffix in IMAGE_EXTENSIONS:
            try:
                markdown = run_rapidocr_image(file_path).strip()
                if markdown:
                    print_result(True, markdown=markdown)
                    return
            except Exception as exc:
                print_result(True, markdown=f"[OCR zatím není dostupné v tomto prostředí. Obrázek byl uložen jako originál. Chyba OCR: {exc}]")
                return

            print_result(True, markdown="[OCR nevrátil žádný rozpoznaný text. Obrázek byl uložen jako originál.]")
            return

        from markitdown import MarkItDown
        result = MarkItDown().convert(str(file_path))
        markdown = (getattr(result, "text_content", None) or "").strip()

        if suffix == ".pdf" and len(markdown) < 50:
            try:
                ocr_markdown = run_rapidocr_pdf(file_path).strip()
                if ocr_markdown:
                    markdown = ocr_markdown
            except Exception:
                pass

        print_result(True, markdown=markdown)
    except Exception as exc:
        print_result(False, error=str(exc))
        sys.exit(0)

if __name__ == "__main__":
    main()
