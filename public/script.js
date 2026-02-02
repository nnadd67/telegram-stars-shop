/* Telegram Stars Shop - Premium Script */

// Иконки (SVG)
const ICONS = {
    star: '<svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>',
    upload: '<svg viewBox="0 0 24 24"><path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path fill="#ffffff" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>'
};

// Конфигурация
const CONFIG = {
    API_URL: '/.netlify/functions/process-order',
    PRICES_URL: '/.netlify/functions/telegram-webhook' // GET запрос возвращает цены
};

const state = {
    packages: [],
    selected: null,
    file: null
};

document.addEventListener('DOMContentLoaded', async () => {
    await loadPackages();
    setupEvents();

    // Иконка загрузки
    document.querySelector('.upload-icon').innerHTML = ICONS.upload;
});

async function loadPackages() {
    let packages = [];

    try {
        // Пытаемся получить актуальные цены от бота
        const res = await fetch(CONFIG.PRICES_URL);
        if (res.ok) {
            const data = await res.json();
            if (data.packages) packages = data.packages;
        }
    } catch (e) {
        console.warn('API цен недоступно, используем резерв');
    }

    // Если API не ответил, используем резерв
    if (packages.length === 0) {
        packages = [
            { id: 1, stars: 50, price: 14000, desc: "Test Pack" },
            { id: 2, stars: 100, price: 27000, desc: "Starter Pack" },
            { id: 7, stars: 200, price: 51000, desc: "Выгодный набор" },
            { id: 3, stars: 250, price: 65000, desc: "Popular Choice", popular: true },
            { id: 8, stars: 300, price: 73000, desc: "Золотая середина" },
            { id: 4, stars: 500, price: 125000, desc: "Sponsor Pack" },
            { id: 5, stars: 1000, price: 250000, desc: "Ultimate", popular: true },
            { id: 6, stars: 3000, price: 730000, desc: "Максимальная выгода", popular: true }
        ];
    }

    const grid = document.getElementById('packagesGrid');
    grid.innerHTML = '';

    packages.forEach(pkg => {
        const el = document.createElement('div');
        el.className = `package-card ${pkg.popular ? 'popular' : ''}`;
        el.innerHTML = `
            ${pkg.popular ? '<div class="popular-badge">HIT</div>' : ''}
            <div class="stars-icon">${ICONS.star}</div>
            <div class="price">${pkg.stars} Stars</div>
            <div class="desc">${pkg.desc}</div>
            <div class="price" style="font-size: 18px; margin-top: 15px; color: #fff;">${formatPrice(pkg.price)} UZS</div>
        `;

        el.onclick = () => selectPackage(pkg, el);
        grid.appendChild(el);
    });
}

function selectPackage(pkg, el) {
    state.selected = pkg;
    document.querySelectorAll('.package-card').forEach(c => c.classList.remove('selected'));
    el.classList.add('selected');

    document.getElementById('selectedPackage').value = pkg.id;
    document.getElementById('starsAmount').value = pkg.stars;
    document.getElementById('paymentAmount').value = pkg.price;
    document.getElementById('selectedInfo').innerText = `${pkg.stars} Stars - ${formatPrice(pkg.price)} UZS`;

    document.getElementById('orderForm').scrollIntoView({ behavior: 'smooth' });
}

function setupEvents() {
    const dropArea = document.getElementById('uploadArea');
    const input = document.getElementById('screenshotInput');

    dropArea.onclick = () => input.click();

    input.onchange = (e) => {
        if (e.target.files[0]) handleFile(e.target.files[0]);
    };

    document.getElementById('paymentMethod').onchange = (e) => {
        const cardInfo = document.getElementById('paymentCardInfo');
        if (e.target.value === 'Humo') {
            cardInfo.style.display = 'block';
            cardInfo.innerHTML = `
                <div style="background: #222; padding: 15px; border-radius: 8px; margin-top: 10px;">
                    <div style="color: #888; font-size: 12px;">HUMO CARD</div>
                    <div style="font-size: 18px; letter-spacing: 2px; margin: 5px 0;">9860 1417 1512 8007</div>
                    <div style="color: #fff;">SAFIYEV TEMUR</div>
                    <button type="button" onclick="navigator.clipboard.writeText('9860141715128007')" style="background:none; border:1px solid #444; color:#aaa; padding:5px 10px; border-radius:4px; margin-top:10px; cursor:pointer; font-size:12px;">Копировать</button>
                </div>
            `;
        } else {
            cardInfo.style.display = 'none';
        }
    };

    document.getElementById('orderForm').onsubmit = async (e) => {
        e.preventDefault();
        if (!state.selected || !state.file) return alert('Выберите пакет и скриншот');

        const btn = e.target.querySelector('.submit-btn');
        const originalText = btn.innerText;
        btn.disabled = true;
        btn.innerText = 'Обработка...';

        try {
            const data = {
                telegramUsername: document.getElementById('telegramUsername').value,
                stars: state.selected.stars,
                amount: state.selected.price,
                paymentMethod: 'Humo',
                screenshot: await toBase64(state.file)
            };

            const res = await fetch(CONFIG.API_URL, {
                method: 'POST',
                body: JSON.stringify(data)
            });

            const json = await res.json();
            if (json.success) {
                document.body.innerHTML = `
                    <div style="text-align:center; padding: 100px; color: #fff;">
                        <div style="width: 80px; height: 80px; margin: 0 auto; fill: #ffffff;">${ICONS.check}</div>
                        <h1>Заказ принят!</h1>
                        <p>Ваш номер: <code>${json.orderId}</code></p>
                        <p>Мы проверим оплату и зачислим Stars в течение 15 минут.</p>
                        <button onclick="location.reload()" style="background:#333; color:#fff; padding:10px 20px; border:none; margin-top:20px; cursor:pointer; border-radius:8px;">Вернуться</button>
                    </div>
                `;
            } else {
                alert('Ошибка: ' + (json.error || 'Неизвестная ошибка'));
            }
        } catch (err) {
            console.error(err);
            alert('Ошибка сети или сервера');
        } finally {
            btn.disabled = false;
            btn.innerText = originalText;
        }
    };
}

function handleFile(file) {
    state.file = file;
    document.querySelector('.upload-text').innerText = file.name;
    // Preview
    const reader = new FileReader();
    reader.onload = (e) => {
        document.querySelector('.upload-icon').innerHTML = `<img src="${e.target.result}" style="width:100%; height:100%; object-fit:cover; border-radius:8px;">`;
    };
    reader.readAsDataURL(file);
}

function formatPrice(p) {
    return new Intl.NumberFormat('ru-RU').format(p);
}

function toBase64(file) {
    return new Promise((r, j) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => r(reader.result);
        reader.onerror = j;
    });
}
