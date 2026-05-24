"""Capture the Relationship Memory™ timeline page."""
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

        # Get a lead with answer events
        for lid in ["6bd44c13-d10d-4aaa-bda0-f753808ae3b2"]:
            url = f"{BASE}/relations/memory/{lid}"
            await page.goto(url, wait_until="domcontentloaded", timeout=30000)
            await page.wait_for_timeout(6000)
            png = f"{OUT}/memory_timeline.png"
            await page.screenshot(path=png, full_page=True)
            chap_count = await page.evaluate("document.querySelectorAll('[data-testid^=mem-chapter-cards-]').length")
            print(f"memory: {page.url} → {png} · chapters: {chap_count}")
            title = await page.evaluate("document.querySelector('[data-testid=mem-hero] h1')?.innerText || 'NO'")
            print(f"  hero title: {title}")
        await b.close()

asyncio.run(main())
