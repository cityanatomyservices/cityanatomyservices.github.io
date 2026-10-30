"""Turn README.md (the austin.chat growth plan) into a printable PDF.

Three plain steps, so anyone can re-run it:
  1. a tiny Markdown-to-HTML converter (only the features README.md uses) + print CSS
  2. headless Chrome prints the HTML to PDF (Letter, no browser header/footer)
  3. pypdf + reportlab stamp page numbers and a running footer on every page

Run from WSL with the OSGeo4W python (it has pypdf and reportlab):
  cmd.exe /c C:\\OSGeo4W\\bin\\python-qgis-ltr.bat <windows path to this file>
Outputs report.html and austin-chat-growth-plan.pdf next to README.md.
"""
import html, re, subprocess, sys, tempfile, io
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent        # the report folder
MD = HERE / "README.md"
HTML_OUT = HERE / "report.html"
PDF_RAW = HERE / "_raw.pdf"
PDF_OUT = HERE / "austin-chat-growth-plan.pdf"
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

# ---------------------------------------------------------------- 1. markdown -> html
def inline(t):
    t = html.escape(t, quote=False)
    t = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", t)
    t = re.sub(r"`([^`]+)`", r"<code>\1</code>", t)
    t = re.sub(r"\*(?!\s)(.+?)\*", r"<i>\1</i>", t)
    t = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2">\1</a>', t)
    return t

def table(rows):
    cells = [[c.strip() for c in r.strip().strip("|").split("|")] for r in rows]
    head, body = cells[0], cells[2:]           # row 1 is the |---| separator
    cols = len(head)
    cls = "wide" if cols >= 6 else ""
    out = [f'<table class="{cls}"><thead><tr>' + "".join(f"<th>{inline(c)}</th>" for c in head) + "</tr></thead><tbody>"]
    for r in body:
        r = (r + [""] * cols)[:cols]
        out.append("<tr>" + "".join(f"<td>{inline(c)}</td>" for c in r) + "</tr>")
    out.append("</tbody></table>")
    return "\n".join(out)

def convert(md):
    lines = md.splitlines()
    out, i, fig = [], 0, 0
    while i < len(lines):
        ln = lines[i]
        if ln.startswith("|"):
            j = i
            while j < len(lines) and lines[j].startswith("|"):
                j += 1
            out.append(table(lines[i:j])); i = j; continue
        m = re.match(r"^(#{1,3}) (.*)", ln)
        if m:
            lvl = len(m.group(1)); txt = inline(m.group(2))
            brk = ' class="chapter"' if lvl == 2 and re.match(r"[1-9]\d*\.", m.group(2)) else ""   # new page for sections 1+, not for 0
            out.append(f"<h{lvl}{brk}>{txt}</h{lvl}>"); i += 1; continue
        m = re.match(r"^!\[([^\]]*)\]\(([^)]+)\)", ln)
        if m:
            fig += 1
            out.append(f'<figure><img src="{m.group(2)}" alt="{m.group(1)}"></figure>'); i += 1; continue
        if ln.strip() == "---":
            out.append("<hr>"); i += 1; continue
        if re.match(r"^\s*[-*] ", ln) or re.match(r"^\s*\d+\. ", ln):
            ordered = bool(re.match(r"^\s*\d+\. ", ln)); j = i; items = []
            while j < len(lines) and (re.match(r"^\s*[-*] ", lines[j]) or re.match(r"^\s*\d+\. ", lines[j])):
                items.append(re.sub(r"^\s*([-*]|\d+\.) ", "", lines[j])); j += 1
            tag = "ol" if ordered else "ul"
            out.append(f"<{tag}>" + "".join(f"<li>{inline(x)}</li>" for x in items) + f"</{tag}>"); i = j; continue
        if ln.strip() == "":
            i += 1; continue
        j = i; para = []
        while j < len(lines) and lines[j].strip() and not lines[j].startswith(("|", "#", "![", "---")) \
                and not re.match(r"^\s*([-*]|\d+\.) ", lines[j]):
            para.append(lines[j]); j += 1
        out.append(f"<p>{inline(' '.join(para))}</p>"); i = j
    return "\n".join(out)

CSS = """
@page { size: Letter; margin: 0.8in 0.75in 0.9in 0.75in; }
html { font-size: 10.5pt; }
body { font-family: Georgia, "Times New Roman", serif; color: #111; line-height: 1.42; margin: 0; }
h1 { font-family: "Segoe UI", Arial, sans-serif; font-size: 30pt; line-height: 1.1; margin: 0 0 6pt; color: #0b0b0b; }
h1 + h2 { font-family: "Segoe UI", Arial, sans-serif; font-weight: normal; font-size: 16pt; color: #52514e; margin: 0 0 18pt; border: 0; }
h2 { font-family: "Segoe UI", Arial, sans-serif; font-size: 17pt; margin: 22pt 0 8pt; padding-bottom: 4pt; border-bottom: 2px solid #2a78d6; color: #0b0b0b; }
h2.chapter { page-break-before: always; }
h3 { font-family: "Segoe UI", Arial, sans-serif; font-size: 12.5pt; margin: 16pt 0 6pt; color: #1f4f8f; }
p { margin: 0 0 7pt; text-align: left; }
ul, ol { margin: 0 0 8pt 18pt; padding: 0; }
li { margin-bottom: 3pt; }
code { font-family: Consolas, "Courier New", monospace; font-size: 9pt; background: #f1f0ec; padding: 0 2pt; }
hr { border: 0; border-top: 1px solid #ddd; margin: 14pt 0; }
a { color: #1f4f8f; text-decoration: none; }
figure { margin: 10pt 0 12pt; page-break-inside: avoid; }
figure img { width: 100%; height: auto; border: 1px solid #e5e4df; }
table { border-collapse: collapse; width: 100%; margin: 6pt 0 12pt; font-family: "Segoe UI", Arial, sans-serif; font-size: 8.6pt; line-height: 1.3; }
table.wide { font-size: 7.6pt; }
th { background: #eef3fa; text-align: left; font-weight: 600; border-bottom: 1.5px solid #2a78d6; padding: 4pt 5pt; vertical-align: bottom; }
td { border-bottom: 1px solid #e5e4df; padding: 3.5pt 5pt; vertical-align: top; }
tr { page-break-inside: avoid; }
thead { display: table-header-group; }
.cover { page-break-after: always; padding-top: 1.6in; }
.cover .kicker { font-family: "Segoe UI", Arial, sans-serif; color: #2a78d6; letter-spacing: 2px; text-transform: uppercase; font-size: 10pt; margin-bottom: 14pt; }
.cover h1 { font-size: 38pt; }
.cover .sub { font-family: "Segoe UI", Arial, sans-serif; font-size: 18pt; color: #52514e; margin: 10pt 0 40pt; }
.cover .meta { font-family: "Segoe UI", Arial, sans-serif; font-size: 10.5pt; color: #52514e; line-height: 1.6; border-top: 1px solid #ddd; padding-top: 12pt; }
.toc { page-break-after: always; }
.toc h2 { border: 0; }
.toc ol { list-style: none; margin-left: 0; font-family: "Segoe UI", Arial, sans-serif; font-size: 11pt; }
.toc li { margin-bottom: 5pt; }
"""

def build_html():
    md = MD.read_text(encoding="utf-8")
    # strip the markdown's own title block (first three lines) and put a cover page in front
    body_md = md.split("\n", 1)[1]
    body_md = re.sub(r"^\n## .*?\n", "", body_md, count=1)   # drop the subtitle line too; the cover carries it
    body = convert(body_md)
    heads = re.findall(r"^## (\d+\. .*)$", md, flags=re.M)
    toc = "".join(f"<li>{inline(h)}</li>" for h in heads)
    page = f"""<!doctype html><html><head><meta charset="utf-8"><title>How austin.chat gets users</title>
<style>{CSS}</style></head><body>
<div class="cover">
<div class="kicker">City Anatomy research report</div>
<h1>How austin.chat gets users</h1>
<div class="sub">A growth plan for a free Austin things-to-do site, its Day Planner and its coming free classifieds</div>
<div class="meta">Draft research report, 29 October 2026<br>
A factual plan for the owner to act on and rewrite. Every number carries a label: FACT (sourced), ESTIMATE (arithmetic shown) or UNCERTAIN.<br>
Five research notes and a site audit (about 250 source links) are in the site repository folder
<code>docs/growth-plan/appendix</code>.</div>
</div>
<div class="toc"><h2>Contents</h2><ol>{toc}</ol></div>
{body}
</body></html>"""
    HTML_OUT.write_text(page, encoding="utf-8")
    print("html", HTML_OUT)

# ---------------------------------------------------------------- 2. chrome -> pdf
def print_pdf():
    tmp = Path(tempfile.mkdtemp(prefix="chrome-pdf-"))
    url = "file:///" + str(HTML_OUT).replace("\\", "/")
    cmd = [CHROME, "--headless=new", f"--user-data-dir={tmp}", "--no-first-run", "--disable-gpu",
           "--no-pdf-header-footer", f"--print-to-pdf={PDF_RAW}", url]
    subprocess.run(cmd, check=True, timeout=180)
    print("pdf", PDF_RAW, PDF_RAW.stat().st_size, "bytes")

# ---------------------------------------------------------------- 3. page numbers
def stamp():
    from pypdf import PdfReader, PdfWriter
    from reportlab.pdfgen import canvas
    reader = PdfReader(str(PDF_RAW)); writer = PdfWriter()
    n = len(reader.pages)
    for i, page in enumerate(reader.pages):
        w = float(page.mediabox.width); h = float(page.mediabox.height)
        buf = io.BytesIO(); c = canvas.Canvas(buf, pagesize=(w, h))
        if i >= 1:   # no footer on the cover
            c.setFont("Helvetica", 8); c.setFillColorRGB(0.32, 0.32, 0.31)
            c.drawString(54, 32, "How austin.chat gets users  ·  draft, 29 Oct 2026")
            c.drawRightString(w - 54, 32, f"{i + 1} / {n}")
        c.showPage(); c.save(); buf.seek(0)   # showPage so an empty cover overlay still yields a page
        page.merge_page(PdfReader(buf).pages[0]); writer.add_page(page)
    writer.add_metadata({"/Title": "How austin.chat gets users", "/Author": "City Anatomy", "/Subject": "Growth plan for austin.chat, 29 October 2026"})
    with open(PDF_OUT, "wb") as f:
        writer.write(f)
    PDF_RAW.unlink()
    print("final", PDF_OUT, n, "pages")

if __name__ == "__main__":
    build_html(); print_pdf(); stamp()
