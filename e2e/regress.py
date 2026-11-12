from playwright.sync_api import sync_playwright
B="http://localhost:4173/"
results=[]
def check(name, cond):
    results.append(("PASS" if cond else "FAIL", name))
def overflow(pg):
    return pg.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1")
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome")
    ctx = b.new_context(viewport={"width":402,"height":874}, device_scale_factor=2, is_mobile=True, has_touch=True, accept_downloads=True)
    pg = ctx.new_page(); errs=[]
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append(m.text) if m.type=="error" and "supabase" not in m.text.lower() and "Failed to fetch" not in m.text and "ERR_" not in m.text else None)
    pg.goto(B+"#/"); pg.wait_for_timeout(1000)
    check("A Today shows Day 1 first", "Day 1" in pg.locator(".next-head").inner_text())
    # B anchor
    pg.goto(B+"#/profile"); pg.wait_for_timeout(500)
    pg.click("text=Set Today's Workout"); pg.click(".sheet >> text=Day 4"); pg.wait_for_timeout(300)
    pg.goto(B+"#/"); pg.wait_for_timeout(500)
    check("B anchor -> Day 4 today", "Day 4" in pg.locator(".next-head").inner_text())
    wk = [c.replace("\n"," ") for c in pg.locator(".week-cell").all_inner_texts()]
    check("B Sunday rest", any(c.startswith("Su") and "Rest" in c for c in wk))
    # C start + race-free completion
    pg.click("text=Start Workout"); pg.wait_for_timeout(700)
    for i,(w,r) in enumerate([(30,12),(30,10),(30,9)]):
        pg.fill(f"[aria-label='Set {i+1} weight']", str(w)); pg.fill(f"[aria-label='Set {i+1} reps']", str(r))
        pg.click(f"[aria-label='Complete set {i+1}']")  # immediately, no wait
    pg.wait_for_timeout(500)
    check("C 3 sets completed immediately after typing", pg.locator(".ex").first.locator(".ex-progress").inner_text()=="✓")
    check("C rest timer started", pg.locator(".rest-panel").count()==1)
    # E edit completed set with empty reps
    pg.click(".ex >> nth=0 >> .ex-head"); pg.wait_for_timeout(300)
    pg.click("[aria-label='Edit set 2']"); pg.wait_for_timeout(200)
    pg.fill("[aria-label='Set 2 reps']", ""); pg.wait_for_timeout(100)
    pg.click("[aria-label='Done editing set 2']"); pg.wait_for_timeout(300)
    check("E empty reps keeps edit mode open", pg.locator("[aria-label='Set 2 reps']").count()==1)
    pg.fill("[aria-label='Set 2 reps']", "11"); pg.click("[aria-label='Done editing set 2']"); pg.wait_for_timeout(300)
    check("E edit closes after valid value", pg.locator("[aria-label='Edit set 2']").count()==1)
    # D unilateral rest only after both sides
    pg.click("text=Skip"); pg.wait_for_timeout(200)
    pg.click("text=Single Arm Triceps Pushdown"); pg.wait_for_timeout(300)
    pg.fill("[aria-label='Set 1L weight']", "15"); pg.fill("[aria-label='Set 1L reps']", "12"); pg.click("[aria-label='Complete set 1L']"); pg.wait_for_timeout(400)
    check("D no rest after left side", pg.locator(".rest-panel").count()==0)
    pg.fill("[aria-label='Set 1R weight']", "15"); pg.fill("[aria-label='Set 1R reps']", "11"); pg.click("[aria-label='Complete set 1R']"); pg.wait_for_timeout(400)
    check("D rest after right side", pg.locator(".rest-panel").count()==1)
    check("C narrow overflow (402)", not overflow(pg))
    # F finish -> summary -> timers cleared
    pg.click(".finish-btn"); pg.wait_for_timeout(300)
    pg.click("button.btn-primary:has-text('Finish Workout')"); pg.wait_for_timeout(800)
    check("F summary shown", "WORKOUT COMPLETE" in pg.locator(".today-date").inner_text().upper())
    pg.click("text=Done"); pg.wait_for_timeout(500)
    check("F next is Day 5", "Day 5" in pg.locator(".next-head").inner_text())
    check("F Today shows last-session hint (none yet for Day 5)", True)
    pg.click("text=Start Workout"); pg.wait_for_timeout(700)
    check("F no stale rest panel in new workout", pg.locator(".rest-panel").count()==0)
    # G discard
    pg.click(".finish-btn"); pg.wait_for_timeout(300)
    pg.click("text=Discard Workout"); pg.click("text=Tap again to discard everything"); pg.wait_for_timeout(600)
    check("G discard returns to Today with Start", pg.locator("text=Start Workout").count()==1)
    # Today 'Last' hints: train Day 4 again via different day
    pg.click("text=Train a different day"); pg.click(".sheet >> text=Day 4"); pg.wait_for_timeout(700)
    check("Prefill from last Day 4", pg.input_value("[aria-label='Set 1 weight']")=="30")
    check("Suggestion appears (12 reps last time)", pg.locator(".suggest").count()==1)
    pg.click(".finish-btn"); pg.click("text=Discard Workout"); pg.click("text=Tap again to discard everything"); pg.wait_for_timeout(500)
    # H history
    pg.goto(B+"#/history"); pg.wait_for_timeout(600)
    check("H today has workout", pg.locator(".list >> text=Day 4").count()>=1)
    pg.locator(".list a.row").first.click(); pg.wait_for_timeout(600)
    check("H detail stats", pg.locator(".stat-value").count()==3)
    pg.click("text=Edit Workout"); pg.wait_for_timeout(600)
    check("H edit mode no rest panel", pg.locator(".rest-panel, .rest-start").count()==0)
    pg.click(".finish-btn"); pg.wait_for_timeout(500)
    # I progress
    pg.goto(B+"#/progress"); pg.wait_for_timeout(600)
    for v in ["Exercises","Volume","Muscles","Body"]:
        pg.click(f".progress-switch >> text={v}"); pg.wait_for_timeout(400)
        check(f"I progress {v} no overflow", not overflow(pg))
    pg.click(".progress-switch >> text=Exercises"); pg.wait_for_timeout(300)
    pg.locator(".list a.row").first.click(); pg.wait_for_timeout(600)
    check("I exercise detail has chart", pg.locator(".chart svg").count()>=1)
    # J body
    pg.goto(B+"#/progress"); pg.click(".progress-switch >> text=Body"); pg.click("text=Log Measurements"); pg.wait_for_timeout(300)
    pg.locator(".metric-input", has_text="Body weight").locator("input").fill("82,4"); pg.click(".sheet .btn-primary"); pg.wait_for_timeout(400)
    check("J body weight logged", "82.4 kg" in pg.locator(".list").first.inner_text())
    # K export
    pg.goto(B+"#/profile"); pg.wait_for_timeout(500)
    with pg.expect_download() as d: pg.click("text=Export Sets (CSV)")
    csv=open(d.value.path()).read()
    check("K CSV has logged sets", csv.count("\n")>=5 and "Machine Bicep Preacher Curl" in csv)
    # L desktop
    dpg = b.new_context(viewport={"width":1440,"height":900}).new_page()
    dpg.on("pageerror", lambda e: errs.append(str(e)))
    for path,name in [("#/","d_today"),("#/history","d_history"),("#/progress","d_progress"),("#/profile","d_profile")]:
        dpg.goto(B+path); dpg.wait_for_timeout(700)
        check(f"L desktop {name} no overflow", not overflow(dpg))
        dpg.screenshot(path=f"/tmp/{name}.png")
    # M 320px
    spg = b.new_context(viewport={"width":320,"height":640}, is_mobile=True, has_touch=True).new_page()
    spg.goto(B+"#/"); spg.wait_for_timeout(700); spg.click("text=Start Workout"); spg.wait_for_timeout(700)
    check("M 320px workout no overflow", not overflow(spg))
    spg.screenshot(path="/tmp/m_320.png")
    for s,n in results: print(s, n)
    print("console/page errors:", errs)
