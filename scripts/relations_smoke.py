"""Capture Relations stage screenshots — Leads, Prospects, Accounts.
Saves PNGs into /app/test_reports/_screens/ so the agent can view them.
"""
import asyncio, os, json, urllib.request
from playwright.async_api import async_playwright

OUT = "/app/test_reports/_screens"
os.makedirs(OUT, exist_ok=True)
BASE = "https://content-hub-pro-22.preview.emergentagent.com"

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={"width": 1920, "height": 1080})
        page = await ctx.new_page()
        # Login
        await page.goto(f"{BASE}/auth/login", wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_selector('input[type="email"]', timeout=15000)
        await page.fill('input[type="email"]', 'demo@moodfordesign.com')
        await page.fill('input[type="password"]', 'Blueprint2024!')
        await page.click('button[type="submit"]')
        try:
            await page.wait_for_url("**/dashboard*", timeout=15000)
        except Exception as e:
            print("nav timeout:", e)
        print("After login URL:", page.url)
        await page.wait_for_timeout(2500)

        for stage in ["leads", "prospects", "accounts"]:
            await page.goto(f"{BASE}/relations/{stage}", wait_until="domcontentloaded", timeout=30000)
            await page.wait_for_timeout(9000)
            # Dismiss any blocking modal/overlay (designer profile, onboarding etc.)
            for sel in [
                'button[aria-label="Close"]',
                'button[aria-label="Chiudi"]',
                'button[data-testid*="close"]',
                'button[data-testid*="skip"]',
                'button[data-testid*="dismiss"]',
                '[role=dialog] button:has-text("Salta")',
                '[role=dialog] button:has-text("Skip")',
                '[role=dialog] button:has-text("×")',
            ]:
                try:
                    btn = page.locator(sel).first
                    if await btn.count() > 0 and await btn.is_visible():
                        await btn.click(timeout=2000)
                        await page.wait_for_timeout(800)
                        print(f"  closed modal via {sel}")
                        break
                except Exception: pass
            # Also try pressing Escape
            try: await page.keyboard.press("Escape")
            except Exception: pass
            await page.wait_for_timeout(1200)
            png = f"{OUT}/relations_{stage}.png"
            await page.screenshot(path=png, full_page=True)
            print(f"  {stage}: {page.url} → {png}")
            title = await page.evaluate("document.querySelector('[data-testid=cr-header-title]')?.innerText || 'NO_TITLE'")
            print(f"    title: {title!r}")
            errs = await page.evaluate("(window.__react_errors||[]).slice(0,3)")
            if errs: print(f"    react_errs: {errs}")

        await browser.close()

asyncio.run(main())
