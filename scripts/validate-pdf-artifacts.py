import argparse
import json
import re
import sys
from pathlib import Path


def parse_args():
    parser = argparse.ArgumentParser(description="Validate and render Explore Intelligence PDF artifacts.")
    parser.add_argument("python_lib", nargs="?", help="Optional directory containing the PyMuPDF installation.")
    parser.add_argument("--report-dir", default="docs/admin-v3.3/reports", help="Report directory relative to the repository root.")
    return parser.parse_args()


ARGS = parse_args()
if ARGS.python_lib:
    sys.path.insert(0, ARGS.python_lib)

import pymupdf as fitz


ROOT = Path(__file__).resolve().parents[1]
REPORT_DIR = ROOT / ARGS.report_dir
RENDER_DIR = REPORT_DIR / "rendered"
EXPECTED_TEXT = ["EXPLORE", "INTELLIGENCE 3.3"]
SENSITIVE = re.compile(r"refresh[_-]?token|client[_-]?secret|service[_-]?role|private query|secret user email", re.I)


def validate_pdf(path: Path):
    document = fitz.open(path)
    rendered = RENDER_DIR / path.stem
    rendered.mkdir(parents=True, exist_ok=True)
    pages = []
    full_text = []
    image_count = 0
    for index, page in enumerate(document):
        text = page.get_text("text")
        full_text.append(text)
        rect = page.rect
        overflow = []
        for block in page.get_text("blocks"):
            x0, y0, x1, y1 = block[:4]
            if x0 < -0.5 or y0 < -0.5 or x1 > rect.width + 0.5 or y1 > rect.height + 0.5:
                overflow.append([round(x0, 2), round(y0, 2), round(x1, 2), round(y1, 2)])
        page_images = len(page.get_images(full=True))
        image_count += page_images
        image_path = rendered / f"page-{index + 1:02d}.png"
        page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False).save(image_path)
        pages.append({
            "page": index + 1,
            "width_pt": round(rect.width, 2),
            "height_pt": round(rect.height, 2),
            "text_characters": len(text),
            "image_count": page_images,
            "overflow_blocks": overflow,
            "render": str(image_path.relative_to(ROOT)).replace("\\", "/"),
        })
    contact_sheets = []
    contact_directory = RENDER_DIR / "_contact-sheets"
    contact_directory.mkdir(parents=True, exist_ok=True)
    for start in range(0, document.page_count, 4):
        contact = fitz.open()
        sheet = contact.new_page(width=1280, height=1760)
        for slot, page_number in enumerate(range(start, min(start + 4, document.page_count))):
            column = slot % 2
            row = slot // 2
            cell = fitz.Rect(30 + column * 625, 50 + row * 850, 625 + column * 625, 845 + row * 850)
            sheet.show_pdf_page(cell, document, page_number, keep_proportion=True)
            sheet.insert_text((cell.x0, cell.y0 - 12), f"Page {page_number + 1}", fontsize=11, color=(0.1, 0.1, 0.1))
        contact_path = contact_directory / f"{path.stem}-{start + 1:02d}-{min(start + 4, document.page_count):02d}.png"
        sheet.get_pixmap(alpha=False).save(contact_path)
        contact_sheets.append(str(contact_path.relative_to(ROOT)).replace("\\", "/"))
        contact.close()
    combined = "\n".join(full_text)
    raw = path.read_bytes()
    metadata = {key: document.metadata.get(key) for key in ["title", "author", "subject", "creator", "creationDate"]}
    return {
        "file": path.name,
        "bytes": path.stat().st_size,
        "page_count": document.page_count,
        "metadata": metadata,
        "language_tag_present": b"/Lang (en-US)" in raw or b"/Lang (es-ES)" in raw,
        "required_text": {value: value in combined for value in EXPECTED_TEXT},
        "contains_fixture_label": "NONPRODUCTION FIXTURE" in combined or "MUESTRA NO PRODUCTIVA" in combined,
        "contains_fixture_kpi_18420": "18,420" in combined or "18.420" in combined,
        "contains_comparison_context": "Previous" in combined or "Anterior" in combined,
        "contains_unavailable_boundary": "Unavailable" in combined or "No disponible" in combined,
        "contains_sensitive_text": bool(SENSITIVE.search(combined)),
        "contains_replacement_character": "\ufffd" in combined,
        "embedded_image_count": image_count,
        "contact_sheets": contact_sheets,
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
            failures.append(f'{result["file"]}: missing required 3.3 text')
        if not result["contains_fixture_label"]:
            failures.append(f'{result["file"]}: missing fixture disclosure')
        if result["contains_sensitive_text"]:
            failures.append(f'{result["file"]}: sensitive text detected')
        if result["contains_replacement_character"]:
            failures.append(f'{result["file"]}: replacement character detected')
        if result["embedded_image_count"] < 1:
            failures.append(f'{result["file"]}: real brand image is not embedded')
        if not result["language_tag_present"]:
            failures.append(f'{result["file"]}: document language tag is missing')
        if "eduardo" in result["file"].lower() and result["metadata"]["title"] == "Eduardo":
            failures.append(f'{result["file"]}: recipient incorrectly replaced the document title')
        if any(page["overflow_blocks"] for page in result["pages"]):
            failures.append(f'{result["file"]}: text overflow detected')
    report = {
        "validator": "PyMuPDF text, metadata, language, image, bounds, reconciliation markers, and 2x page rendering",
        "pdf_count": len(results),
        "page_count": sum(result["page_count"] for result in results),
        "status": "passed" if not failures and results else "failed",
        "failures": failures or ([] if results else ["no PDF artifacts found"]),
        "files": results,
    }
    if not results:
        report["status"] = "failed"
    (REPORT_DIR / "pdf-validation.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    raise SystemExit(0 if report["status"] == "passed" else 1)


if __name__ == "__main__":
    main()
