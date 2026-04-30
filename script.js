/**
 * Garant Bot - Mini App
 * Lava-дизайн, Telegram WebApp API
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ИНИЦИАЛИЗАЦИЯ TELEGRAM WEBAPP
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const tg = window.Telegram.WebApp;

// Разворачиваем на весь экран
tg.expand();

// Подтверждение при закрытии
tg.enableClosingConfirmation();

// Получаем тему Telegram
const theme = tg.themeParams;
const isDark = theme.bg_color ? parseInt(theme.bg_color.replace('#', ''), 16) < 0x888888 : true;

// Данные пользователя
const initData = tg.initDataUnsafe;
const user = initData?.user || {};
const userId = user.id || 0;
const userName = user.first_name || 'Пользователь';
const userUsername = user.username || 'user';
const userLastName = user.last_name || '';

// Устанавливаем цвет верхней панели
tg.setHeaderColor('#0A0A0F');

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

let currentScreen = 'createDealScreen';
let uploadedPhoto = null;
let onlineCount = 47;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ЗАПУСК ПРИЛОЖЕНИЯ
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    loadProfile();
    loadRating();
    setupPhotoUpload();
    updateOnline();

    // Регулярное обновление онлайна
    setInterval(updateOnline, 15000);

    console.log('🌋 Garant Bot Mini App загружен');
    console.log('👤 Пользователь:', userName, '@' + userUsername);
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// НАВИГАЦИЯ
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function initNavigation() {
    const navBtns = document.querySelectorAll('.nav-btn');
    const screens = document.querySelectorAll('.screen');

    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const screenId = btn.dataset.screen;
            navigateTo(screenId);
        });
    });
}

function navigateTo(screenId) {
    // Обновляем активную кнопку
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.screen === screenId);
    });

    // Обновляем активный экран
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.toggle('active', screen.id === screenId);
    });

    currentScreen = screenId;

    // Haptic feedback
    if (tg.HapticFeedback) {
        tg.HapticFeedback.impactOccurred('light');
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ЗАГРУЗКА ФОТО
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function setupPhotoUpload() {
    const uploadArea = document.getElementById('photoUpload');
    const photoInput = document.getElementById('photoInput');
    const placeholder = uploadArea.querySelector('.photo-placeholder');

    uploadArea.addEventListener('click', () => {
        // Показываем выбор: камера или галерея
        tg.showPopup({
            title: '📸 Загрузить фото',
            message: 'Выберите источник',
            buttons: [
                { type: 'default', text: '📷 Камера', id: 'camera' },
                { type: 'default', text: '🖼 Галерея', id: 'gallery' },
                { type: 'cancel', text: '❌ Отмена' }
            ]
        }, (btnId) => {
            if (btnId === 'gallery') {
                photoInput.click();
            } else if (btnId === 'camera') {
                photoInput.setAttribute('capture', 'environment');
                photoInput.click();
                photoInput.removeAttribute('capture');
            }
        });
    });

    photoInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                uploadedPhoto = event.target.result;
                placeholder.innerHTML = `
                    <img src="${uploadedPhoto}" alt="Фото товара" style="max-width: 100%; max-height: 200px; border-radius: 12px;">
                    <p style="color: #34C759;">✅ Фото загружено!</p>
                `;
            };
            reader.readAsDataURL(file);
        }
    });

    // Drag & Drop
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = '#FF6B35';
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.style.borderColor = 'rgba(255,255,255,0.2)';
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = 'rgba(255,255,255,0.2)';
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            photoInput.files = e.dataTransfer.files;
            photoInput.dispatchEvent(new Event('change'));
        }
    });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ПРОФИЛЬ
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function loadProfile() {
    document.getElementById('userName').textContent = userName + ' ' + userLastName;
    document.getElementById('userTag').textContent = '@' + userUsername;

    const avatar = document.getElementById('userAvatar');
    avatar.textContent = userName.charAt(0).toUpperCase();

    // Загружаем данные из Telegram WebApp
    if (user.photo_url) {
        avatar.innerHTML = `<img src="${user.photo_url}" alt="Аватар" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
    }

    // Здесь должен быть запрос к боту через sendData
    // Пока заглушка
    updateProfileDisplay({
        rating: 4.2,
        successful_deals: 127,
        failed_deals: 3,
        total_deals: 130,
        balance_stars: 12450,
        balance_rub: 0
    });

    loadUserDeals();
}

function updateProfileDisplay(data) {
    // Обновляем рейтинг
    updateRatingDisplay(data.rating);

    // Обновляем статистику
    document.getElementById('successDeals').textContent = data.successful_deals;
    document.getElementById('failedDeals').textContent = data.failed_deals;
    document.getElementById('totalDeals').textContent = data.total_deals;

    // Обновляем баланс
    document.getElementById('balance').textContent =
        `${data.balance_stars.toLocaleString()} ⭐ | ${data.balance_rub.toLocaleString()} ₽`;
}

function updateRatingDisplay(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = (rating - fullStars) >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

    let starsHTML = '⭐'.repeat(fullStars);
    if (hasHalfStar) starsHTML += '✨';
    starsHTML += '☆'.repeat(emptyStars);

    document.getElementById('ratingStars').textContent = starsHTML;
    document.getElementById('ratingValue').textContent = rating.toFixed(1) + ' / 5.0';

    // Анимация звёзд
    const starsElement = document.getElementById('ratingStars');
    starsElement.style.transform = 'scale(1.1)';
    setTimeout(() => { starsElement.style.transform = 'scale(1)'; }, 200);
}

function loadUserDeals() {
    // Здесь должен быть запрос к боту
    const deals = [
        { title: 'iPhone 15 Pro Max', status: 'completed', price: '45 000 ₽', emoji: '✅', date: '15.02.2024' },
        { title: 'Telegram Premium 1 год', status: 'processing', price: '500 ⭐', emoji: '⏳', date: '20.02.2024' },
        { title: 'Дизайн Telegram канала', status: 'cancelled', price: '2 000 ₽', emoji: '❌', date: '10.02.2024' },
    ];

    const dealsList = document.getElementById('dealsList');
    let html = '<h3>📊 Мои последние сделки</h3>';

    if (deals.length === 0) {
        html += '<div class="deal-item-empty">У вас пока нет сделок</div>';
    } else {
        deals.forEach(deal => {
            html += `
                <div class="deal-item">
                    <span class="deal-emoji">${deal.emoji}</span>
                    <div class="deal-info">
                        <span class="deal-title">${deal.title}</span>
                        <span class="deal-price">${deal.price}</span>
                    </div>
                    <span class="deal-date">${deal.date}</span>
                </div>
            `;
        });
    }

    dealsList.innerHTML = html;

    // Также заполняем экран "Мои сделки"
    document.getElementById('allMyDeals').innerHTML = html;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// РЕЙТИНГ ПРОДАВЦОВ
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function loadRating() {
    // Здесь должен быть запрос к боту
    const sellers = [
        { name: 'Alex', username: 'seller1', rating: 4.9, deals: 534, medal: '🥇' },
        { name: 'Maria', username: 'seller2', rating: 4.7, deals: 412, medal: '🥈' },
        { name: 'Dmitry', username: 'seller3', rating: 4.5, deals: 298, medal: '🥉' },
        { name: 'Elena', username: 'seller4', rating: 4.3, deals: 189, medal: '4️⃣' },
        { name: 'Sergey', username: 'seller5', rating: 4.1, deals: 156, medal: '5️⃣' },
        { name: 'Anna', username: 'seller6', rating: 3.9, deals: 134, medal: '6️⃣' },
        { name: 'Pavel', username: 'seller7', rating: 3.7, deals: 98, medal: '7️⃣' },
    ];

    const container = document.getElementById('topSellers');
    let html = '';

    sellers.forEach(seller => {
        html += `
            <div class="glass-card seller-card">
                <div class="seller-medal">${seller.medal}</div>
                <div class="seller-avatar">${seller.name.charAt(0)}</div>
                <div class="seller-info">
                    <div class="seller-name-row">
                        <span class="seller-name">${seller.name}</span>
                        <span class="seller-username">@${seller.username}</span>
                    </div>
                    <div class="seller-stats">
                        <span class="seller-rating">⭐ ${seller.rating}</span>
                        <span class="seller-deals">✅ ${seller.deals} сделок</span>
                    </div>
                </div>
                <div class="seller-trust">
                    ${seller.rating >= 4.5 ? '🛡️ Проверен' : seller.rating >= 3.5 ? '👍 Надёжный' : '👤 Новичок'}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// СОЗДАНИЕ СДЕЛКИ
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function createDeal() {
    const title = document.getElementById('dealTitle').value.trim();
    const description = document.getElementById('dealDescription').value.trim();
    const priceStars = parseInt(document.getElementById('priceStars').value) || 0;
    const priceRub = parseFloat(document.getElementById('priceRub').value) || 0;

    // Валидация
    if (!title) {
        shakeElement(document.getElementById('dealTitle'));
        tg.showAlert('❌ Введите название сделки');
        return;
    }

    if (title.length < 3) {
        shakeElement(document.getElementById('dealTitle'));
        tg.showAlert('❌ Название должно быть не менее 3 символов');
        return;
    }

    if (priceStars === 0 && priceRub === 0) {
        tg.showAlert('❌ Укажите цену в звёздах или рублях');
        return;
    }

    // Отправляем данные в бота
    const dealData = {
        action: 'create_deal',
        title: title,
        description: description,
        priceStars: priceStars,
        priceRub: priceRub,
        photo: uploadedPhoto || ''
    };

    tg.sendData(JSON.stringify(dealData));

    // Haptic feedback
    if (tg.HapticFeedback) {
        tg.HapticFeedback.notificationOccurred('success');
    }

    // Показываем сообщение об успехе
    tg.showPopup({
        title: '✅ Сделка создана!',
        message: `"${title}" отправлена на проверку.\n\nЦена: ${priceStars} ⭐ | ${priceRub} ₽`,
        buttons: [{ type: 'ok' }]
    });

    // Очищаем форму
    document.getElementById('dealTitle').value = '';
    document.getElementById('dealDescription').value = '';
    document.getElementById('priceStars').value = '';
    document.getElementById('priceRub').value = '';

    // Сбрасываем фото
    uploadedPhoto = null;
    document.querySelector('.photo-placeholder').innerHTML = `
        <span class="photo-icon">📸</span>
        <p>Нажмите, чтобы загрузить фото</p>
    `;

    // Переключаем на экран сделок
    setTimeout(() => {
        navigateTo('dealsScreen');
    }, 500);
}

function shakeElement(element) {
    element.style.animation = 'shake 0.5s ease';
    element.style.borderColor = '#FF3B30';
    setTimeout(() => {
        element.style.animation = '';
        element.style.borderColor = '';
    }, 500);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ОНЛАЙН ПОЛЬЗОВАТЕЛИ
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function updateOnline() {
    // Здесь должен быть запрос к боту
    // Пока генерируем случайное число для демонстрации
    onlineCount = 40 + Math.floor(Math.random() * 20);

    const onlineElement = document.getElementById('onlineCount');
    const aboutOnlineElement = document.getElementById('aboutOnline');

    if (onlineElement) {
        animateNumber(onlineElement, onlineCount);
    }
    if (aboutOnlineElement) {
        aboutOnlineElement.textContent = onlineCount;
    }
}

function animateNumber(element, target) {
    const current = parseInt(element.textContent) || 0;
    const diff = target - current;
    const steps = 20;
    const increment = diff / steps;
    let step = 0;

    const animation = setInterval(() => {
        step++;
        element.textContent = Math.round(current + increment * step);
        if (step >= steps) {
            element.textContent = target;
            clearInterval(animation);
        }
    }, 50);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ПОИСК ПРОДАВЦА
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchSeller');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const sellerCards = document.querySelectorAll('.seller-card');

            sellerCards.forEach(card => {
                const name = card.querySelector('.seller-name')?.textContent.toLowerCase() || '';
                const username = card.querySelector('.seller-username')?.textContent.toLowerCase() || '';

                if (name.includes(query) || username.includes(query)) {
                    card.style.display = '';
                    card.style.animation = 'fadeIn 0.3s ease';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ОБРАБОТКА ОТВЕТА ОТ БОТА
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Слушаем ответ от бота (если используется CloudStorage или другие методы)
tg.onEvent('viewportChanged', (event) => {
    // Адаптация под высоту клавиатуры
    if (event.isStateStable) {
        document.body.style.paddingBottom = '0px';
    }
});

// Обработка данных из WebApp
tg.onEvent('mainButtonClicked', () => {
    tg.sendData(JSON.stringify({ action: 'main_button_clicked' }));
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ЭКСПОРТ ФУНКЦИЙ
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Делаем функции доступными глобально
window.createDeal = createDeal;
window.loadProfile = loadProfile;
window.loadRating = loadRating;
window.navigateTo = navigateTo;

console.log('🌋 Все функции загружены и готовы к работе');
