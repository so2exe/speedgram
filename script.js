// ==================== SPEEDGRAM — РАБОЧАЯ ВЕРСИЯ ====================
const SUPABASE_URL = 'https://bntfmxwakwmgskgtkgho.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJudGZteHdha3dtZ3NrZ3RrZ2hvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczODQ3OTUsImV4cCI6MjA5Mjk2MDc5NX0.JYlvN1wVUaQsw7O_w8-f_dhEHYeMQ1BUSi4ByYK2i38';

let currentUser = null;
let activeChatId = null;

const BOT_USER = {
    id: 'bot_speedgram',
    username: 'SpeedGramBot',
    avatar: 'https://cdn-icons-png.flaticon.com/512/906/906347.png'
};

// ========== ЗАПРОСЫ К БАЗЕ ==========
async function api(endpoint, method = 'GET', data = null) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
        method: method,
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json'
        },
        body: data ? JSON.stringify(data) : null
    });
    if (method === 'GET') return res.json();
    return res;
}

async function getUsers() { return await api('users?select=*'); }
async function getChats() { return await api('chats?select=*'); }

async function saveChat(chat) {
    const exists = await api(`chats?id=eq.${chat.id}&select=id`);
    if (exists.length > 0) {
        return await api(`chats?id=eq.${chat.id}`, 'PUT', chat);
    } else {
        return await api('chats', 'POST', chat);
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => m === '&' ? '&amp;' : (m === '<' ? '&lt;' : '&gt;'));
}

// ========== АВТОРИЗАЦИЯ ==========
document.getElementById('login-btn').onclick = async () => {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const users = await getUsers();
    const user = users.find(u => u.username === username && u.password === password);
    
    if (user) {
        currentUser = user;
        localStorage.setItem('sg_user', JSON.stringify(user));
        
        document.getElementById('auth-screen').classList.remove('active');
        document.getElementById('messenger-screen').classList.add('active');
        document.getElementById('sidebar-name').innerText = user.username;
        document.getElementById('sidebar-avatar').src = user.avatar;
        document.getElementById('settings-username').innerText = user.username;
        
        // Создаём чат с ботом если его нет
        const chats = await getChats();
        const botChat = chats.find(c => c.id === `bot_${user.id}`);
        if (!botChat) {
            await saveChat({
                id: `bot_${user.id}`,
                type: 'private',
                participants: [user.id, BOT_USER.id],
                name: BOT_USER.username,
                avatar: BOT_USER.avatar,
                messages: [{
                    id: 1,
                    senderId: BOT_USER.id,
                    senderName: BOT_USER.username,
                    text: 'Привет! Я бот SpeedGram 🤖 Напиши "привет"',
                    time: Date.now()
                }]
            });
        }
        
        await renderChats();
        startMessageChecker();
    } else {
        alert('❌ Неверный логин или пароль');
    }
};

document.getElementById('register-btn').onclick = async () => {
    const username = document.getElementById('reg-username').value.trim();
    const password = document.getElementById('reg-password').value;
    const password2 = document.getElementById('reg-password2').value;
    const status = document.getElementById('reg-status');
    
    if (username.length < 3) {
        status.innerHTML = '❌ Минимум 3 символа';
        return;
    }
    if (password.length < 3) {
        status.innerHTML = '❌ Пароль минимум 3 символа';
        return;
    }
    if (password !== password2) {
        status.innerHTML = '❌ Пароли не совпадают';
        return;
    }
    
    const users = await getUsers();
    if (users.find(u => u.username === username)) {
        status.innerHTML = '❌ Пользователь уже существует';
        return;
    }
    
    const newUser = {
        id: 'u' + Date.now(),
        username: username,
        password: password,
        avatar: 'https://i.pravatar.cc/100?img=' + Math.floor(Math.random() * 70),
        created_at: new Date().toISOString()
    };
    
    await api('users', 'POST', newUser);
    alert('✅ Регистрация успешна! Теперь войдите.');
    
    document.getElementById('reg-username').value = '';
    document.getElementById('reg-password').value = '';
    document.getElementById('reg-password2').value = '';
    status.innerHTML = '';
    
    document.querySelector('.auth-tab[data-tab="login"]').click();
    document.getElementById('login-username').value = username;
    document.getElementById('login-password').value = '';
};

// ========== ОТРИСОВКА ЧАТОВ ==========
async function renderChats() {
    const chats = await getChats();
    const users = await getUsers();
    const myChats = chats.filter(c => c.participants && c.participants.includes(currentUser.id));
    const container = document.getElementById('chats-list');
    container.innerHTML = '';
    
    for (const chat of myChats) {
        const otherId = chat.participants?.find(p => p !== currentUser.id);
        let otherUser = users.find(u => u.id === otherId);
        if (!otherUser && otherId === BOT_USER.id) otherUser = BOT_USER;
        
        const name = otherUser?.username || chat.name || 'Чат';
        const avatar = otherUser?.avatar || chat.avatar || 'https://i.pravatar.cc/48';
        const lastMsg = chat.messages?.[chat.messages.length-1]?.text || 'Нет сообщений';
        
        const div = document.createElement('div');
        div.className = `chat-item ${activeChatId === chat.id ? 'active' : ''}`;
        div.innerHTML = `
            <img src="${avatar}" onerror="this.src='https://i.pravatar.cc/48'">
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
    await renderChats();
    
    const chats = await getChats();
    const users = await getUsers();
    const chat = chats.find(c => c.id === chatId);
    if (!chat) return;
    
    const otherId = chat.participants?.find(p => p !== currentUser.id);
    let otherUser = users.find(u => u.id === otherId);
    if (!otherUser && otherId === BOT_USER.id) otherUser = BOT_USER;
    
    const name = otherUser?.username || chat.name;
    const avatar = otherUser?.avatar || chat.avatar;
    
    document.getElementById('chat-name').innerText = name;
    document.getElementById('chat-avatar').src = avatar;
    document.getElementById('chat-status').innerText = otherUser?.isBot ? '🤖 Бот' : 'онлайн';
    
    await renderMessages(chatId);
}

async function renderMessages(chatId) {
    const chats = await getChats();
    const chat = chats.find(c => c.id === chatId);
    const container = document.getElementById('messages-list');
    container.innerHTML = '';
    
    if (!chat?.messages || chat.messages.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:#7f8fa4;">💬 Напишите первое сообщение</div>';
        return;
    }
    
    for (const msg of chat.messages) {
        const isOwn = msg.senderId === currentUser.id;
        const div = document.createElement('div');
        div.className = `message ${isOwn ? 'own' : ''}`;
        const time = new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
    
    const chats = await getChats();
    let chat = chats.find(c => c.id === activeChatId);
    if (!chat) return;
    
    const msg = {
        id: Date.now(),
        senderId: currentUser.id,
        senderName: currentUser.username,
        text: text,
        time: Date.now()
    };
    
    if (!chat.messages) chat.messages = [];
    chat.messages.push(msg);
    await saveChat(chat);
    
    await renderMessages(activeChatId);
    await renderChats();
    
    // Если это бот - отвечаем
    const otherId = chat.participants?.find(p => p !== currentUser.id);
    if (otherId === BOT_USER.id) {
        setTimeout(() => botReply(activeChatId, text), 500);
    }
}

async function botReply(chatId, userMessage) {
    const msg = userMessage.toLowerCase();
    let reply = '';
    if (msg.includes('привет')) reply = 'Привет! 👋 Рад тебя видеть!';
    else if (msg.includes('как дела')) reply = 'Отлично! А у тебя?';
    else reply = 'Привет! Я бот SpeedGram. Напиши "привет" или "как дела"';
    
    const chats = await getChats();
    let chat = chats.find(c => c.id === chatId);
    if (!chat) return;
    
    const botMsg = {
        id: Date.now(),
        senderId: BOT_USER.id,
        senderName: BOT_USER.username,
        text: reply,
        time: Date.now()
    };
    
    if (!chat.messages) chat.messages = [];
    chat.messages.push(botMsg);
    await saveChat(chat);
    
    if (activeChatId === chatId) {
        await renderMessages(chatId);
    }
    await renderChats();
}

// ========== ПОИСК ПОЛЬЗОВАТЕЛЕЙ ==========
document.getElementById('search-btn').onclick = () => {
    document.getElementById('search-modal').classList.remove('hidden');
    document.getElementById('search-results').innerHTML = '';
};

document.getElementById('do-search').onclick = async () => {
    const query = document.getElementById('search-query').value.trim().toLowerCase();
    if (!query) return;
    
    const users = await getUsers();
    const results = document.getElementById('search-results');
    results.innerHTML = '';
    
    for (const user of users) {
        if (user.username.toLowerCase().includes(query) && user.id !== currentUser.id) {
            const div = document.createElement('div');
            div.className = 'account-item';
            div.innerHTML = `
                <span><img src="${user.avatar}" style="width:32px;height:32px;border-radius:50%;vertical-align:middle;margin-right:8px;"> ${escapeHtml(user.username)}</span>
                <button class="start-chat-btn" data-id="${user.id}" data-name="${user.username}" data-avatar="${user.avatar}" style="padding:6px 12px;border-radius:16px;background:#4e9eff;color:white;border:none;cursor:pointer;">💬</button>
            `;
            results.appendChild(div);
        }
    }
    
    if (results.innerHTML === '') {
        results.innerHTML = '<div style="text-align:center;padding:16px;">❌ Ничего не найдено</div>';
    }
    
    document.querySelectorAll('.start-chat-btn').forEach(btn => {
        btn.onclick = async () => {
            const userId = btn.dataset.id;
            const username = btn.dataset.name;
            const avatar = btn.dataset.avatar;
            
            const chatId = [currentUser.id, userId].sort().join('_');
            const chats = await getChats();
            let chat = chats.find(c => c.id === chatId);
            
            if (!chat) {
                chat = {
                    id: chatId,
                    type: 'private',
                    participants: [currentUser.id, userId],
                    name: username,
                    avatar: avatar,
                    messages: []
                };
                await saveChat(chat);
            }
            
            document.getElementById('search-modal').classList.add('hidden');
            await openChat(chatId);
        };
    });
};

document.getElementById('close-search').onclick = () => {
    document.getElementById('search-modal').classList.add('hidden');
};

// ========== НАСТРОЙКИ ==========
document.getElementById('settings-btn').onclick = () => {
    document.getElementById('settings-modal').classList.remove('hidden');
};

document.getElementById('close-settings').onclick = () => {
    document.getElementById('settings-modal').classList.add('hidden');
};

document.getElementById('sidebar-user').onclick = () => {
    alert('👤 ' + currentUser.username);
};

// ========== ПРОВЕРКА НОВЫХ СООБЩЕНИЙ ==========
let messageChecker = null;

function startMessageChecker() {
    if (messageChecker) clearInterval(messageChecker);
    messageChecker = setInterval(async () => {
        if (currentUser && activeChatId) {
            await renderMessages(activeChatId);
        }
        await renderChats();
    }, 2000);
}

// ========== ОТПРАВКА СООБЩЕНИЯ ==========
document.getElementById('send-message').onclick = () => {
    const input = document.getElementById('message-text');
    sendMessage(input.value);
    input.value = '';
};

document.getElementById('message-text').addEventListener('keypress', e => {
    if (e.key === 'Enter') document.getElementById('send-message').click();
});

// ========== ВОССТАНОВЛЕНИЕ СЕССИИ ==========
const savedUser = localStorage.getItem('sg_user');
if (savedUser) {
    const user = JSON.parse(savedUser);
    getUsers().then(users => {
        if (users.find(u => u.id === user.id)) {
            document.getElementById('login-username').value = user.username;
            document.getElementById('login-password').value = user.password;
            document.getElementById('login-btn').click();
        }
    });
}
