// Диагностика кнопки "Позвонить"
// Скопируй весь код ниже и вставь в консоль DevTools (F12 → Console)

(function() {
    const btn = document.querySelector('.phone-toggle');
    if (!btn) {
        console.error('❌ Кнопка .phone-toggle НЕ НАЙДЕНА в DOM');
        return;
    }

    console.log('=== ДИАГНОСТИКА КНОПКИ .phone-toggle ===\n');

    // 1. Классы элемента
    console.log('1. КЛАССЫ ЭЛЕМЕНТА:');
    console.log('   className:', btn.className);
    console.log('   classList:', Array.from(btn.classList).join(', '));
    console.log('');

    // 2. Размеры
    const rect = btn.getBoundingClientRect();
    console.log('2. РЕАЛЬНЫЕ РАЗМЕРЫ (getBoundingClientRect):');
    console.log('   width:', rect.width, 'px');
    console.log('   height:', rect.height, 'px');
    console.log('');

    // 3. Computed styles
    const cs = getComputedStyle(btn);
    console.log('3. COMPUTED STYLES (итоговые стили браузера):');
    console.log('   display:', cs.display);
    console.log('   padding:', cs.padding);
    console.log('   height:', cs.height);
    console.log('   line-height:', cs.lineHeight);
    console.log('   border-width:', cs.borderWidth);
    console.log('   box-sizing:', cs.boxSizing);
    console.log('   font-size:', cs.fontSize);
    console.log('   font-weight:', cs.fontWeight);
    console.log('   min-height:', cs.minHeight);
    console.log('');

    // 4. Какие CSS-правила применяются
    console.log('4. ПРИМЕНЯЕМЫЕ CSS-ПРАВИЛА (в порядке специфичности):');
    const sheets = document.styleSheets;
    let ruleCount = 0;

    for (let i = 0; i < sheets.length; i++) {
        try {
            const rules = sheets[i].cssRules || sheets[i].rules;
            for (let j = 0; j < rules.length; j++) {
                const rule = rules[j];
                if (rule.selectorText) {
                    // Проверяем, матчится ли селектор на нашу кнопку
                    try {
                        if (btn.matches(rule.selectorText)) {
                            ruleCount++;
                            console.log(`   ${ruleCount}. СЕЛЕКТОР: ${rule.selectorText}`);
                            // Выведем ключевые свойства из правила
                            const decl = rule.style;
                            const relevant = ['display','padding','height','line-height','border-width','box-sizing','font-size','font-weight','min-height'];
                            relevant.forEach(prop => {
                                const val = decl.getPropertyValue(prop);
                                if (val) console.log(`      ${prop}: ${val}`);
                            });
                        }
                    } catch(e) {}
                }
            }
        } catch(e) {
            // cross-origin stylesheet, skip
        }
    }

    if (ruleCount === 0) {
        console.log('   ⚠️ Ни одно CSS-правило не матчится! Стили inline?');
    }
    console.log('');

    // 5. Inline styles
    console.log('5. INLINE STYLES (btn.style):');
    const inline = btn.getAttribute('style');
    if (inline) {
        console.log('   ', inline);
    } else {
        console.log('   (нет inline-стилей)');
    }
    console.log('');

    // 6. Сравнение с WhatsApp
    const wa = document.querySelector('.messenger-btn.whatsapp');
    if (wa) {
        const waRect = wa.getBoundingClientRect();
        const waCs = getComputedStyle(wa);
        console.log('6. СРАВНЕНИЕ С WhatsApp:');
        console.log('   WhatsApp width:', waRect.width, 'px');
        console.log('   WhatsApp height:', waRect.height, 'px');
        console.log('   WhatsApp padding:', waCs.padding);
        console.log('   WhatsApp line-height:', waCs.lineHeight);
        console.log('   WhatsApp display:', waCs.display);
        console.log('');
        console.log('   РАЗНИЦА В ВЫСОТЕ:', (rect.height - waRect.height).toFixed(1), 'px');
    }

    console.log('=== КОНЕЦ ДИАГНОСТИКИ ===');
    console.log('Скопируй весь вывод выше и пришли мне');
})();
