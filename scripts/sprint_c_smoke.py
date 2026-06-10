"""Capture Sprint C drawers: Welcome + Continuation Interview."""
import asyncio, os
from playwright.async_api import async_playwright

OUT = "/app/test_reports/_screens"
os.makedirs(OUT, exist_ok=True)
BASE = "https://i18n-recovery-1.preview.emergentagent.com"

async def login(page):
    await page.goto(f"{BASE}/auth/login", wait_until="domcontentloaded", timeout=30000)
    await page.wait_for_selector('input[type="email"]', timeout=15000)
    await page.fill('input[type="email"]', 'demo@moodfordesign.com')
    await page.fill('input[type="password"]', 'Blueprint2024!')
    await page.click('button[type="submit"]')
    try: await page.wait_for_url("**/dashboard*", timeout=15000)
    except: pass
    await page.wait_for_timeout(2500)

async def dismiss_modal(page):
    for sel in ['button[aria-label="Chiudi"]', 'button[aria-label="Close"]']:
        try:
            btn = page.locator(sel).first
            if await btn.count() > 0 and await btn.is_visible():
                await btn.click(timeout=2000); await page.wait_for_timeout(600)
                return True
        except: pass
    return False

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True)
        ctx = await b.new_context(viewport={"width": 1920, "height": 1080})
        page = await ctx.new_page()
        await login(page)

        # Click a lead → wait drawer body → assert memory link
        await page.goto(f"{BASE}/relations/leads", wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(9000)
        cards = page.locator('[data-testid^=lead-card-]')
        if await cards.count() > 0:
            await cards.first.click()
            await page.wait_for_selector('[data-testid=welcome-drawer-body]', timeout=10000)
            mem_link = page.locator('[data-testid=welcome-drawer-memory-link]')
            visible = await mem_link.count() > 0 and await mem_link.first.is_visible()
            print(f"welcome-drawer-memory-link visible: {visible}")
            if visible:
                await mem_link.first.click()
                await page.wait_for_url('**/relations/memory/**', timeout=10000)
                await page.wait_for_timeout(5000)
                hero = await page.evaluate("document.querySelector('[data-testid=mem-hero] h1')?.innerText || 'none'")
                chaps = await page.evaluate("document.querySelectorAll('[data-testid^=mem-chapter-]').length")
                print(f"memory page hero: {hero!r} · chapters: {chaps}")
            # Check presence vocabulary on chip
            await page.go_back()
            await page.wait_for_timeout(2500)
            chip_text = await page.evaluate("(()=>{const e=document.querySelector('[data-testid^=designer-chip-]');return e?e.innerText:''})()")
            print(f"designer chip text sample: {chip_text!r}")
        else:
            print("no lead cards found")

        # Leads → click first lead → Welcome drawer → continuation interview
        await page.goto(f"{BASE}/relations/leads", wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(9000)
        await dismiss_modal(page); await page.wait_for_timeout(800)
        cards = page.locator('[data-testid^=lead-card-]')
        if await cards.count() > 0:
            await cards.first.click()
            await page.wait_for_selector('[data-testid=welcome-drawer]', timeout=8000)
            await page.wait_for_timeout(2500)
            await page.screenshot(path=f"{OUT}/welcome_drawer_lead.png", full_page=False)
            print("welcome_drawer_lead: ok")
            try:
                act = page.locator('[data-testid=welcome-drawer-action-continuation_interview]').first
                if await act.count() > 0:
                    await act.click()
                    await page.wait_for_selector('[data-testid=ci-drawer]', timeout=8000)
                    await page.wait_for_timeout(3500)
                    await page.screenshot(path=f"{OUT}/continuation_interview.png", full_page=False)
                    print("continuation_interview: ok")
                    # Click the first option to verify answer-event posts and step advances
                    opts = page.locator('[data-testid^=ci-drawer-option-]')
                    if await opts.count() > 0:
                        # Track network response for the auth'd answer-event endpoint
                        post_status = [None]
                        async def _on_resp(r):
                            if '/api/relations/intake/answer-event' in r.url:
                                post_status[0] = r.status
                        page.on('response', lambda r: asyncio.create_task(_on_resp(r)))
                        await opts.first.click()
                        await page.wait_for_timeout(3000)
                        step = await page.evaluate("document.querySelector('[data-testid=ci-drawer-progress]')?.innerText || ''")
                        print(f"answer-event status: {post_status[0]} · step now: {step.splitlines()[0] if step else 'none'}")
                        await page.screenshot(path=f"{OUT}/continuation_interview_step2.png", full_page=False)
                    else: print("no options in CI drawer")
                else: print("no continuation action")
            except Exception as e:
                print("CI drawer err:", e)

        # Prospects → click first lane → Welcome drawer
        await page.goto(f"{BASE}/relations/prospects", wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(9000)
        await dismiss_modal(page); await page.wait_for_timeout(800)
        lanes = page.locator('[data-testid^=prospect-lane-]')
        if await lanes.count() > 0:
            await lanes.first.click()
            await page.wait_for_selector('[data-testid=welcome-drawer]', timeout=8000)
            await page.wait_for_timeout(2500)
            await page.screenshot(path=f"{OUT}/welcome_drawer.png", full_page=False)
            print("welcome_drawer: ok")
            # Click Continue interview action if present
            try:
                act = page.locator('[data-testid=welcome-drawer-action-continuation_interview]').first
                if await act.count() > 0 and await act.is_visible():
                    await act.click(); await page.wait_for_timeout(3500)
                    await page.screenshot(path=f"{OUT}/continuation_interview.png", full_page=False)
                    print("continuation_interview: ok")
                else:
                    print("no continuation action — interview drawer skipped")
            except Exception as e:
                print("CI drawer err:", e)
        else:
            print("no prospect lanes found")

        await b.close()

asyncio.run(main())
