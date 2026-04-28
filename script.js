// ==================== КОНФИГУРАЦИЯ SUPABASE ====================
const SUPABASE_URL = 'https://bntfmxwakwmgskgtkgho.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJudGZteHdha3dtZ3NrZ3RrZ2hvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczODQ3OTUsImV4cCI6MjA5Mjk2MDc5NX0.JYlvN1wVUaQsw7O_w8-f_dhEHYeMQ1BUSi4ByYK2i38';

// ==================== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ====================
let currentUser = null;
let activeChatId = null;
let soundEnabled = true;

// БОТ
const BOT_USER = {
    id: 'bot_speedgram',
    username: 'SpeedGramBot',
    avatar: 'https://cdn-icons-png.flaticon.com/512/906/906347.png',
    isBot: true
};

// ==================== SUPABASE ФУНКЦИИ ====================
async function supabaseRequest(endpoint, method = 'GET', body = null) {
    const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
    const response = await fetch(url, {
        method: method,
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json'
        },
        body: body ? JSON.stringify(body) : null
    });
    if (method === 'GET') return response.json();
    return response;
}

async function loadUsers() {
    try {
        return await supabaseRequest('users?select=*');
    } catch(e) {
        return [];
    }
}

async function saveUser(user) {
    return await supabaseRequest('users', 'POST', user);
}

async function loadChats() {
    try {
        return await supabaseRequest('chats?select=*');
    } catch(e) {
        return [];
    }
}

async function saveChat(chat) {
    const exists = await supabaseRequest(`chats?id=eq.${chat.id}&select=id`);
    if (exists.length > 0) {
        return await supabaseRequest(`chats?id=eq.${chat.id}`, 'PUT', chat);
    } else {
        return await supabaseRequest('chats', 'POST', chat);
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => m === '&' ? '&amp;' : (m === '<' ? '&lt;' : '&gt;'));
}

// ==================== АВТОРИЗАЦИЯ ====================
document.querySelectorAll('.auth-tab').forEach(btn => {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.auth-tab').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        const tab = this.dataset.tab;
        document.querySelectorAll('.auth-panel').forEach(p => p.classList.remove('active'));
        if (tab === 'login') document.getElementById('login-panel').classList.add('active');
        else document.getElementById('register-panel').classList.add('active');
    });
});

// РЕГИСТРАЦИЯ
document.getElementById('register-btn')?.addEventListener('click', async () => {
    const username = document.getElementById('reg-username').value.trim();
    const password = document.getElementById('reg-password').value;
    const password2 = document.getElementById('reg-password2').value;
    const status = document.getElementById('reg-status');
    
    if (!username || username.length < 3) {
        status.innerHTML = '❌ Имя минимум 3 символа';
        return;
    }
    if (!password || password.length < 3) {
        status.innerHTML = '❌ Пароль минимум 3 символа';
        return;
    }
    if (password !== password2) {
        status.innerHTML = '❌ Пароли не совпадают';
        return;
    }
    
    const users = await loadUsers();
    if (users.find(u => u.username === username)) {
        status.innerHTML = '❌ Пользователь уже есть';
        return;
    }
    
    const newUser = {
        id: 'u' + Date.now(),
        username: username,
        password: password,
        avatar: 'https://i.pravatar.cc/100?img=' + Math.floor(Math.random() * 70),
        created_at: new Date().toISOString()
    };
    
    await saveUser(newUser);
    alert('✅ Регистрация успешна! Войдите.');
    document.getElementById('reg-username').value = '';
    document.getElementById('reg-password').value = '';
    document.getElementById('reg-password2').value = '';
    status.innerHTML = '';
    document.querySelector('.auth-tab[data-tab="login"]').click();
    document.getElementById('login-username').value = username;
});

// ВХОД
document.getElementById('login-btn')?.addEventListener('click', async () => {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    
    const users = await loadUsers();
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
        loginSuccess(user);
    } else {
        alert('❌ Неверный логин или пароль');
    }
});

async function loginSuccess(user) {
    currentUser = user;
    localStorage.setItem('sg_current_user_id', currentUser.id);
    
    document.getElementById('auth-screen').classList.remove('active');
    document.getElementById('messenger-screen').classList.add('active');
    document.getElementById('sidebar-name').innerText = user.username;
    document.getElementById('sidebar-avatar').src = user.avatar;
    document.getElementById('settings-avatar').src = user.avatar;
    
    // Создаём чат с ботом
    const chats = await loadChats();
    const botChatId = `bot_${user.id}`;
    let botChat = chats.find(c => c.id === botChatId);
    if (!botChat) {
        botChat = {
            id: botChatId,
            type: 'private',
            participants: [user.id, BOT_USER.id],
            name: BOT_USER.username,
            avatar: BOT_USER.avatar,
            messages: [{
                id: 1,
                senderId: BOT_USER.id,
                senderName: BOT_USER.username,
                type: 'text',
                text: 'Привет! Я бот SpeedGram 🤖',
                time: Date.now(),
                read: false
            }]
        };
        await saveChat(botChat);
    }
    
    renderChats();
    setInterval(checkNewMessages, 1000);
}

// ==================== ОТРИСОВКА ЧАТОВ ====================
async function renderChats() {
    if (!currentUser) return;
    const chats = await loadChats();
    const users = await loadUsers();
    const myChats = chats.filter(c => c.participants && c.participants.includes(currentUser.id));
    const container = document.getElementById('chats-list');
    container.innerHTML = '';
    
    for (const chat of myChats) {
        let otherId = chat.participants?.find(p => p !== currentUser.id);
        let otherUser = users.find(u => u.id === otherId);
        if (!otherUser && otherId === BOT_USER.id) otherUser = BOT_USER;
        let name = chat.type === 'private' ? (otherUser?.username || 'unknown') : chat.name;
        let avatar = chat.type === 'private' ? (otherUser?.avatar || 'https://i.pravatar.cc/48') : (chat.avatar || 'https://i.pravatar.cc/48');
        let lastMsg = chat.messages?.[chat.messages.length-1]?.text || 'Нет сообщений';
        
        const div = document.createElement('div');
        div.className = `chat-item ${activeChatId === chat.id ? 'active' : ''}`;
        div.innerHTML = `
            <img src="${avatar}">
            <div class="chat-details">
                <strong>${escapeHtml(name)}</strong>
                <div><small>${escapeHtml(lastMsg.substring(0, 30))}</small></div>
            </div>
        `;
        div.onclick = () => openChat(chat.id);
        container.appendChild(div);
    }
}

async function openChat(chatId) {
    activeChatId = chatId;
    renderChats();
    const chats = await loadChats();
    const users = await loadUsers();
    const chat = chats.find(c => c.id === chatId);
    if (!chat) return;
    
    let otherId = chat.participants?.find(p => p !== currentUser.id);
    let otherUser = users.find(u => u.id === otherId);
    if (!otherUser && otherId === BOT_USER.id) otherUser = BOT_USER;
    let name = chat.type === 'private' ? (otherUser?.username || 'unknown') : chat.name;
    let avatar = chat.type === 'private' ? (otherUser?.avatar || 'https://i.pravatar.cc/44') : (chat.avatar || 'https://i.pravatar.cc/44');
    
    document.getElementById('chat-name').innerText = name;
    document.getElementById('chat-avatar').src = avatar;
    document.getElementById('chat-status').innerText = otherUser?.isBot ? 'Бот' : 'онлайн';
    
    renderMessages(chatId);
}

async function renderMessages(chatId) {
    const chats = await loadChats();
    const chat = chats.find(c => c.id === chatId);
    if (!chat) return;
    const container = document.getElementById('messages-list');
    container.innerHTML = '';
    
    if (!chat.messages || chat.messages.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:#7f8fa4;">💬 Напишите первое сообщение</div>';
        return;
    }
    
    for (const msg of chat.messages) {
        const isOwn = msg.senderId === currentUser.id;
        const div = document.createElement('div');
        div.className = `message ${isOwn ? 'own' : ''}`;
        const time = new Date(msg.time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
        div.innerHTML = `
            <strong class="message-username">${escapeHtml(msg.senderName)}</strong>
            <div class="message-text">${escapeHtml(msg.text)}</div>
            <div class="message-time">${time}</div>
        `;
        container.appendChild(div);
    }
    
    document.getElementById('messages-container').scrollTop = document.getElementById('messages-container').scrollHeight;
}

async function sendMessage(text) {
    if (!activeChatId || !text.trim()) return;
    const chats = await loadChats();
    let chat = chats.find(c => c.id === activeChatId);
    if (!chat) return;
    
    const msg = {
        id: Date.now(),
        senderId: currentUser.id,
        senderName: currentUser.username,
        type: 'text',
        text: text,
        time: Date.now(),
        read: false
    };
    if (!chat.messages) chat.messages = [];
    chat.messages.push(msg);
    await saveChat(chat);
    renderMessages(activeChatId);
    renderChats();
}

// Отправка
document.getElementById('send-message')?.addEventListener('click', () => {
    const input = document.getElementById('message-text');
    sendMessage(input.value);
    input.value = '';
});

document.getElementById('message-text')?.addEventListener('keypress', e => {
    if (e.key === 'Enter') document.getElementById('send-message').click();
});

// Настройки
document.getElementById('settings-btn')?.addEventListener('click', () => {
    document.getElementById('settings-modal').classList.remove('hidden');
});

document.getElementById('close-settings')?.addEventListener('click', () => {
    document.getElementById('settings-modal').classList.add('hidden');
});

// Поиск
document.getElementById('search-btn')?.addEventListener('click', () => {
    document.getElementById('search-modal').classList.remove('hidden');
});

document.getElementById('close-search')?.addEventListener('click', () => {
    document.getElementById('search-modal').classList.add('hidden');
});

// Профиль
document.getElementById('sidebar-user')?.addEventListener('click', () => {
    alert('👤 ' + currentUser.username);
});

// Проверка новых сообщений
async function checkNewMessages() {
    if (!currentUser) return;
    const chats = await loadChats();
    const myChats = chats.filter(c => c.participants && c.participants.includes(currentUser.id));
    for (const chat of myChats) {
        if (activeChatId === chat.id) {
            renderMessages(chat.id);
        }
    }
    renderChats();
}

// Загрузка сессии
const savedUserId = localStorage.getItem('sg_current_user_id');
if (savedUserId) {
    loadUsers().then(users => {
        const user = users.find(u => u.id === savedUserId);
        if (user) loginSuccess(user);
    });
}
