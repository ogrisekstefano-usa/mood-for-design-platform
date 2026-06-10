import asyncio
from playwright.async_api import async_playwright

BASE_URL = "https://i18n-recovery-1.preview.emergentagent.com"
EMAIL = "admin@moodfordesign.com"
PASSWORD = "Blueprint2024!"

async def login(page):
    await page.goto(BASE_URL)
    await page.wait_for_timeout(2000)
    try:
        await page.fill('input[type="email"]', EMAIL)
        await page.fill('input[type="password"]', PASSWORD)
        await page.click('button[type="submit"]', force=True)
        await page.wait_for_timeout(2000)
        print(f"Logged in, URL: {page.url}")
    except Exception as e:
        print(f"Login error: {e}")

async def check_page(page, path, checks, name):
    await page.goto(BASE_URL + path)
    await page.wait_for_timeout(2500)
    body = await page.evaluate("() => document.body.innerText")
    body_lower = body.lower()
    
    # Check for missing token pattern (unicode brackets)
    token_check = await page.evaluate("""() => {
        const text = document.body.innerText;
        const matches = [...text.matchAll(/\u27e6[^\u27e7]+\u27e7/g)];
        return matches.map(m => m[0]);
    }""")
    
    # Check debug overlay
    overlay = await page.evaluate("""() => {
        const els = Array.from(document.querySelectorAll('*'));
        const found = els.find(e => e.children.length === 0 && e.innerText && e.innerText.includes('missing'));
        return found ? found.parentElement.innerText : null;
    }""")
    
    print(f"\n=== {name} ({path}) ===")
    print(f"  Missing tokens: {token_check if token_check else 'NONE'}")
    print(f"  Debug overlay: {overlay}")
    
    for label, text in checks:
        found = text.lower() in body_lower
        status = "OK" if found else "MISSING"
        print(f"  [{status}] {label}: '{text}'")
    
    await page.screenshot(path=f".screenshots/{name.lower().replace(' ','_')}.jpg", quality=40, full_page=False)
    return token_check, overlay

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.set_viewport_size({"width": 1920, "height": 1080})
        page.on("console", lambda msg: print(f"CONSOLE: {msg.text}") if "error" in msg.text.lower() else None)
        
        await login(page)
        
        # Test LeadsPage
        await check_page(page, "/relations/leads", [
            ("Title Leads", "Leads"),
            ("Search placeholder", "cerca per nome o email"),
            ("Signal label", "segnale"),
            ("Atmosphere label", "Atmosfera"),
            ("Intake captured", "intake acquisito"),
            ("Nuovo Lead CTA", "Nuovo Lead"),
            ("Reset button", "Reimposta"),
        ], "LeadsPage")
        
        # Test AccountsPage
        await check_page(page, "/relations/accounts", [
            ("Title Accounts", "Accounts"),
            ("Search placeholder", "Cerca account"),
            ("Health Eccellente", "Eccellente"),
            ("Health Stabile", "Stabile"),
            ("Health A rischio", "A rischio"),
            ("Reset button", "Reimposta"),
        ], "AccountsPage")
        
        # Test ProspectsPage
        await check_page(page, "/relations/prospects", [
            ("Title Prospects", "Prospects"),
            ("Search placeholder", "Cerca prospect"),
            ("Reset button", "Reimposta"),
        ], "ProspectsPage")
        
        # Test LeadDetailPage - need an actual lead ID
        # First get leads list to find a lead
        await page.goto(BASE_URL + "/relations/leads")
        await page.wait_for_timeout(2000)
        lead_links = await page.evaluate("""() => {
            const links = Array.from(document.querySelectorAll('a[href*="/relations/leads/"]'));
            return links.map(l => l.href).filter(h => !h.endsWith('/leads/'));
        }""")
        print(f"\nFound lead links: {lead_links[:3]}")
        
        if lead_links:
            lead_path = lead_links[0].replace(BASE_URL, '')
            await check_page(page, lead_path, [
                ("Eyebrow CRM Lead", "CRM"),
                ("Back to list", "Torna alla lista"),
            ], "LeadDetailPage")
        
        await browser.close()

asyncio.run(main())
