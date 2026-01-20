from playwright.sync_api import sync_playwright

def html_to_pdf_bytes(html: str) -> bytes:
    with sync_playwright() as p:
        browser = p.chromium.launch()  # headless por defecto
        page = browser.new_page()
        page.set_content(html, wait_until="networkidle")

        pdf_bytes = page.pdf(
            format="A4",
            print_background=True,
            prefer_css_page_size=True,
        )
        browser.close()
        return pdf_bytes
