"""Capture Density Switcher (Settings) + Leads w/ origin + Memory link from Account."""
import asyncio, os
from playwright.async_api import async_playwright

OUT = "/app/test_reports/_screens"
os.makedirs(OUT, exist_ok=True)
BASE = "https://i18n-recovery-1.preview.emergentagent.com"

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True)
        ctx = await b.new_context(viewport={"width": 1920, "height": 1200})
        page = await ctx.new_page()
        await page.goto(f"{BASE}/auth/login", wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_selector('input[type="email"]', timeout=15000)
        await page.fill('input[type="email"]', 'demo@moodfordesign.com')
        await page.fill('input[type="password"]', 'Blueprint2024!')
        await page.click('button[type="submit"]')
        try: await page.wait_for_url("**/dashboard*", timeout=15000)
        except: pass
        await page.wait_for_timeout(2500)

        # 1 — Settings page · density switcher (dismiss owner intro modal if present)
        await page.goto(f"{BASE}/settings", wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(4500)
        try:
            modal_close = page.locator('[data-testid=owner-introduction-modal] button[aria-label="Close"], [data-testid=owner-introduction-modal] button[aria-label="Chiudi"]').last
            if await modal_close.count() > 0 and await modal_close.is_visible():
                await modal_close.click(timeout=2000, force=True)
                await page.wait_for_timeout(1000)
        except Exception: pass
        try: await page.keyboard.press("Escape")
        except: pass
        await page.wait_for_timeout(800)
        # Scroll to density section
        try:
            await page.evaluate("document.querySelector('[data-testid=settings-density]')?.scrollIntoView({block:'center'})")
            await page.wait_for_timeout(1500)
        except: pass
        await page.screenshot(path=f"{OUT}/settings_density.png", full_page=False)
        # Click Editorial
        try:
            await page.click('[data-testid=density-switcher-editorial]', timeout=5000)
            await page.wait_for_timeout(1500)
            mode = await page.evaluate("document.documentElement.getAttribute('data-ui-density')")
            print(f"after click Editorial: data-ui-density={mode}")
        except Exception as e:
            print("density click err:", e)
        # 2 — Leads (with editorial density active)
        await page.goto(f"{BASE}/relations/leads", wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(9000)
        mode = await page.evaluate("document.documentElement.getAttribute('data-ui-density')")
        print(f"leads page density: {mode}")
        await page.screenshot(path=f"{OUT}/leads_editorial.png", full_page=False)
        # Verify memory link in card
        mem = await page.evaluate("document.querySelector('[data-testid^=lead-memory-link-]') ? 'present' : 'absent'")
        print(f"lead memory link: {mem}")
        # 3 — Accounts page with memory link
        await page.goto(f"{BASE}/relations/accounts", wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(8000)
        amem = await page.evaluate("document.querySelector('[data-testid^=account-memory-link-]') ? 'present' : 'absent'")
        print(f"account memory link: {amem}")
        await page.screenshot(path=f"{OUT}/accounts_editorial.png", full_page=False)
        # 4 — Reset to default for cleanliness
        await page.evaluate("window.localStorage.setItem('mfd.ui_density','default')")
        await b.close()

asyncio.run(main())
