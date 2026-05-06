from playwright.sync_api import sync_playwright
import time

SHOP = 'https://aigenie-hub.myshopify.com/admin'

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()

    print('='*50)
    print('  银月钱庄 · Shopify 店铺自动配置')
    print('  模式: 无头（不弹窗）')
    print('='*50)

    # 登录
    page.goto(SHOP)
    page.wait_for_load_state('networkidle')
    print('\n📌 请在 Trae 浏览器中登录 Shopify（邮箱: alanlsl8208@gmail.com）')
    print('   登录完成后，按 Enter 键继续...')
    input()

    # ── 通用设置 ──
    print('\n--- 设置通用信息 ---')
    page.goto(f'{SHOP}/settings/general')
    page.wait_for_load_state('networkidle')
    time.sleep(2)

    # 店铺名称
    name_input = page.locator('input[name="shop[name]"]')
    if name_input.is_visible(timeout=5000):
        name_input.fill('')
        name_input.fill('AIGenie Vision')
        print('  ✅ 店铺名称 → AIGenie Vision')

    # 保存
    save_btn = page.locator('button[type="submit"]:has-text("Save")')
    if save_btn.is_visible(timeout=3000):
        save_btn.click()
        time.sleep(1.5)
        print('  ✅ 通用设置已保存')

    # ── 货币 ──
    print('\n--- 设置结算货币 USD ---')
    page.goto(f'{SHOP}/settings/general')
    page.wait_for_load_state('networkidle')
    time.sleep(2)

    currency_sel = page.locator('select[name="shop[currency]"]')
    if currency_sel.is_visible(timeout=5000):
        currency_sel.select_option('USD')
        print('  ✅ 结算货币 → USD')
    else:
        print('  ⚠️ 未找到货币下拉框')

    if save_btn.is_visible(timeout=3000):
        save_btn.click()
        time.sleep(1.5)

    # ── 时区 ──
    print('\n--- 设置时区 EST ---')
    tz_sel = page.locator('select[name="shop[timezone]"]')
    if tz_sel.is_visible(timeout=5000):
        tz_sel.select_option('(GMT-05:00) Eastern Time (US & Canada)')
        print('  ✅ 时区 → EST')
    else:
        print('  ⚠️ 未找到时区下拉框')

    if save_btn.is_visible(timeout=3000):
        save_btn.click()
        time.sleep(1.5)

    # ── 目标市场 ──
    print('\n--- 设置目标市场 ---')
    page.goto(f'{SHOP}/settings/markets')
    page.wait_for_load_state('networkidle')
    time.sleep(2)

    add_btn = page.locator('button:has-text("Add market"), a:has-text("Add market")')
    if add_btn.is_visible(timeout=3000):
        add_btn.click()
        time.sleep(1)
        for country in ['United States', 'Canada', 'United Kingdom', 'Germany', 'France']:
            cb = page.locator(f'text={country}').first()
            if cb.is_visible(timeout=1000):
                cb.click()
        print('  ✅ 已添加目标市场：美国、加拿大、英国、德国、法国')
        confirm = page.locator('button:has-text("Add"), button:has-text("Save")').first()
        if confirm.is_visible(timeout=2000):
            confirm.click()
            time.sleep(1.5)
    else:
        print('  ⚠️ 未找到市场设置按钮')

    # ── 客服邮箱 ──
    print('\n--- 设置客服邮箱 ---')
    page.goto(f'{SHOP}/settings/general')
    page.wait_for_load_state('networkidle')
    time.sleep(2)

    email_input = page.locator('input[name="shop[email]"]')
    if email_input.is_visible(timeout=5000):
        email_input.fill('')
        email_input.fill('support@aigenievision.com')
        print('  ✅ 客服邮箱 → support@aigenievision.com')

    if save_btn.is_visible(timeout=3000):
        save_btn.click()
        time.sleep(1.5)

    # ── About Us ──
    print('\n--- 创建 About Us 页面 ---')
    page.goto(f'{SHOP}/pages/new')
    page.wait_for_load_state('networkidle')
    time.sleep(2)

    title_input = page.locator('input[name="page[title]"]')
    if title_input.is_visible(timeout=5000):
        title_input.fill('About AIGenie Vision')
        print('  ✅ 页面标题 → About AIGenie Vision')

    # TinyMCE 编辑器
    editor_frame = page.frame_locator('iframe.tox-edit-area__iframe').first()
    editor_body = editor_frame.locator('body')
    if editor_body.is_visible(timeout=5000):
        editor_body.fill('')
        editor_body.fill('Welcome to AIGenie Vision, where cutting-edge technology meets everyday lifestyle.\n\nWe believe that language should never be a barrier to human connection. Born from a passion for innovation, AIGenie Vision specializes in next-generation AI Smart Glasses designed to seamlessly translate the world around you in real-time. Whether you are traveling the globe, conducting international business, or simply exploring new cultures, our ultra-lightweight smart eyewear ensures you never miss a beat.\n\nOur Mission: To break down global communication barriers through sleek, wearable AI technology.\n\nWhy choose us?\n\nInnovation First: We source only the most advanced AI translation chips.\n\nUncompromised Style: Technology shouldn\'t look clunky. Our glasses are designed for everyday elegance.\n\nGlobal Guarantee: Secure shipping and a dedicated support team ready to assist you worldwide.\n\nStep into the future with AIGenie Vision. Connect, communicate, and conquer.')
        print('  ✅ About Us 内容已填充')

    save_page = page.locator('button:has-text("Save")').first()
    if save_page.is_visible(timeout=3000):
        save_page.click()
        time.sleep(2)
        print('  ✅ About Us 页面已保存')

    print('\n' + '='*50)
    print('  🎉 店铺配置完成！')
    print('  请检查：')
    print('    1. Settings > General: 名称/货币/时区')
    print('    2. Settings > Markets: 北美+欧洲')
    print('    3. Pages: About Us 内容')
    print('='*50)

    browser.close()
