"""Capture Media System Unificato™ preview + UnifiedMediaPickerModal."""
import asyncio, os
from playwright.async_api import async_playwright

OUT = "/app/test_reports/_screens"
os.makedirs(OUT, exist_ok=True)
BASE = "https://content-hub-pro-22.preview.emergentagent.com"

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

        # Preview page
        await page.goto(f"{BASE}/admin/media-system-preview", wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(3500)
        await page.screenshot(path=f"{OUT}/media_preview_landing.png", full_page=False)
        try:
            await page.click('[data-testid=ump-preview-open]', timeout=5000)
            await page.wait_for_selector('[data-testid=ump-modal]', timeout=8000)
            await page.wait_for_timeout(4500)
            count = await page.evaluate("document.querySelector('[data-testid=ump-count] strong')?.innerText || '0'")
            filters = await page.evaluate("document.querySelectorAll('[data-testid^=ump-filter-]').length")
            tiles = await page.evaluate("document.querySelectorAll('[data-testid^=ump-tile-]:not([data-testid$=usedin])').length")
            print(f"Modal opened · assets count badge: {count} · filter chips: {filters} · tiles rendered: {tiles}")
            await page.screenshot(path=f"{OUT}/media_picker_modal.png", full_page=False)
            # Try clicking warm_ivory filter
            try:
                await page.click('[data-testid=ump-filter-warm_ivory]', timeout=3000)
                await page.wait_for_timeout(1500)
                await page.screenshot(path=f"{OUT}/media_picker_warm_ivory.png", full_page=False)
                print("warm_ivory filter applied")
            except Exception as e: print("filter err:", e)
        except Exception as e:
            print("modal open err:", e)
        await b.close()

asyncio.run(main())
