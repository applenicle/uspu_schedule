from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for name,w,h in [('light-mobile',390,844),('dark-mobile',390,844),('long-names',390,844),('long-names',320,780),('light-mobile',320,780)]:
        page=browser.new_page(viewport={'width':w,'height':h},device_scale_factor=1)
        html=(root/'previews'/f'{name}.html').read_text()
        css=(root/'src/app/globals.css').read_text()
        html=html.replace('<link href="../src/app/globals.css" rel="stylesheet">', '<style>'+css+'</style>')
        page.set_content(html)
        page.wait_for_timeout(130)
        result=root/'previews'/f'{name}-{w}.png'
        page.screenshot(path=str(result),full_page=False)
        metrics=page.evaluate('''() => ({ body:document.body.scrollWidth, viewport:window.innerWidth, lessons:document.querySelectorAll('.lesson-card').length, css:getComputedStyle(document.querySelector('.lesson-card')).backgroundColor, smallestButton:Math.round(Math.min(...Array.from(document.querySelectorAll('button')).map(el=>el.getBoundingClientRect()).filter(r=>r.width>0&&r.height>0).map(r=>Math.min(r.width,r.height)))) })''')
        print(name,w,metrics)
        page.close()
    browser.close()
