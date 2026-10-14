import json
import re
import sys
from pathlib import Path

if len(sys.argv) > 1:
    sys.path.insert(0, sys.argv[1])

import pymupdf as fitz

ROOT = Path(__file__).resolve().parents[1]
REPORT_DIR = ROOT / "docs" / "admin-v3.2" / "reports"
RENDER_DIR = REPORT_DIR / "rendered"
EXPECTED_TEXT = ["EXPLORE", "INTELLIGENCE 3.2", "NONPRODUCTION FIXTURE"]
SENSITIVE = re.compile(r"refresh[_-]?token|client[_-]?secret|service[_-]?role|private query|secret user email", re.I)


def validate_pdf(path: Path):
    document = fitz.open(path)
    rendered = RENDER_DIR / path.stem
    rendered.mkdir(parents=True, exist_ok=True)
    pages = []
    full_text = []
    for index, page in enumerate(document):
        text = page.get_text("text")
        full_text.append(text)
        rect = page.rect
        overflow = []
        for block in page.get_text("blocks"):
            x0, y0, x1, y1 = block[:4]
            if x0 < -0.5 or y0 < -0.5 or x1 > rect.width + 0.5 or y1 > rect.height + 0.5:
                overflow.append([round(x0, 2), round(y0, 2), round(x1, 2), round(y1, 2)])
        image_path = rendered / f"page-{index + 1:02d}.png"
        page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False).save(image_path)
        pages.append({
            "page": index + 1,
            "width_pt": round(rect.width, 2),
            "height_pt": round(rect.height, 2),
            "text_characters": len(text),
            "overflow_blocks": overflow,
            "render": str(image_path.relative_to(ROOT)).replace("\\", "/"),
        })
    combined = "\n".join(full_text)
    return {
        "file": path.name,
        "bytes": path.stat().st_size,
        "page_count": document.page_count,
        "metadata": {key: document.metadata.get(key) for key in ["title", "author", "subject", "creator", "creationDate"]},
        "required_text": {value: value in combined for value in EXPECTED_TEXT},
        "contains_fixture_kpi_18420": "18,420" in combined,
        "contains_unavailable_boundary": "Unavailable" in combined or "No disponible" in combined,
        "contains_sensitive_text": bool(SENSITIVE.search(combined)),
        "contains_replacement_character": "�" in combined,
        "pages": pages,
    }


def main():
    RENDER_DIR.mkdir(parents=True, exist_ok=True)
    results = [validate_pdf(path) for path in sorted(REPORT_DIR.glob("*.pdf"))]
    failures = []
    for result in results:
        if result["page_count"] < 1:
            failures.append(f'{result["file"]}: no pages')
        if not all(result["required_text"].values()):
            failures.append(f'{result["file"]}: missing required text')
        if result["contains_sensitive_text"]:
            failures.append(f'{result["file"]}: sensitive text detected')
        if result["contains_replacement_character"]:
            failures.append(f'{result["file"]}: replacement character detected')
        if any(page["overflow_blocks"] for page in result["pages"]):
            failures.append(f'{result["file"]}: text overflow detected')
    report = {
        "validator": "PyMuPDF text, metadata, bounds, and 2x page rendering",
        "pdf_count": len(results),
        "page_count": sum(result["page_count"] for result in results),
        "status": "passed" if not failures else "failed",
        "failures": failures,
        "files": results,
    }
    (REPORT_DIR / "pdf-validation.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    raise SystemExit(1 if failures else 0)


if __name__ == "__main__":
    main()
