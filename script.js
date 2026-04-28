// ==================== КОНФИГУРАЦИЯ SUPABASE ====================
const SUPABASE_URL = 'https://bntfmxwakwmsgskgtkgho.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJudGZteHdha3dtZ3NrZ3RrZ2hvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczODQ3OTUsImV4cCI6MjA5Mjk2MDc5NX0.JYlvN1wVUaQsw7O_w8-f_dhEHYeMQ1BUSi4ByYK2i38';

// ==================== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ====================
let currentUser = null;
let activeChatId = null;
let tempCode = null;
let tempCodeUser = null;
let mediaRecorder = null;
let audioChunks = [];
let soundEnabled = true;
let lastMessagesCount = {};

// БОТ
const BOT_USER = {
    id: 'bot_speedgram',
    username: 'SpeedGramBot',
    avatar: 'https://cdn-icons-png.flaticon.com/512/906/906347.png',
    isBot: true,
    bio: 'Я официальный бот SpeedGram 🤖'
};

// ==================== SUPABASE ФУНКЦИИ ====================
async function supabaseRequest(endpoint, method = 'GET', body = null) {
    const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
    const headers = {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
    };
    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);
    const response = await fetch(url, options);
    if (method === 'GET') return response.json();
    return response;
}

async function loadUsers() {
    return await supabaseRequest('users?select=*');
}

async function saveUser(user) {
    const users = await loadUsers();
    const exists = users.find(u => u.id === user.id);
    if (!exists) {
        await supabaseRequest('users', 'POST', user);
    }
}

async function loadChats() {
    return await supabaseRequest('chats?select=*');
}

async function saveChat(chat) {
    const chats = await loadChats();
    const exists = chats.find(c => c.id === chat.id);
    if (exists) {
        await supabaseRequest(`chats?id=eq.${chat.id}`, 'PUT', chat);
    } else {
        await supabaseRequest('chats', 'POST', chat);
    }
}

// ==================== ЗВУК ====================
function playNotificationSound() {
    if (!soundEnabled) return;
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        oscillator.connect(gain);
        gain.connect(audioCtx.destination);
        oscillator.frequency.value = 880;
        gain.gain.value = 0.2;
        oscillator.start();
        gain.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.3);
        oscillator.stop(audioCtx.currentTime + 0.3);
        if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch(e) { console.log('Sound error'); }
}

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================
function findUserByUsername(username, users) {
    return users.find(u => u.username === username);
}

function findUserById(id, users) {
    if (id === BOT_USER.id) return BOT_USER;
    return users.find(u => u.id === id);
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => m === '&' ? '&amp;' : (m === '<' ? '&lt;' : '&gt;'));
}

// ==================== ПОИСК НОВЫХ СООБЩЕНИЙ ====================
async function checkNewMessages() {
    if (!currentUser) return;
    const chats = await loadChats();
    const myChats = chats.filter(c => c.participants && c.participants.includes(currentUser.id));
    
    for (const chat of myChats) {
        const currentCount = chat.messages?.length || 0;
        const lastCount = lastMessagesCount[chat.id] || 0;
        
        if (currentCount > lastCount && chat.messages) {
            const newMessages = chat.messages.slice(lastCount);
            for (const msg of newMessages) {
                if (msg.senderId !== currentUser.id && activeChatId !== chat.id) {
                    playNotificationSound();
                }
            }
            if (activeChatId === chat.id) {
                renderMessages(chat.id);
            }
            renderChats();
        }
        lastMessagesCount[chat.id] = currentCount;
    }
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

document.getElementById('reg-username')?.addEventListener('input', async function() {
    const username = this.value.trim();
    const status = document.getElementById('reg-status');
    if (username.length < 3) {
        status.innerHTML = '❌ Минимум 3 символа';
        return;
    }
    const users = await loadUsers();
    const exists = findUserByUsername(username, users);
    status.innerHTML = exists ? '❌ Занят' : '✅ Доступен';
    status.style.color = exists ? '#f0a3a3' : '#6fcf97';
});

document.getElementById('register-btn')?.addEventListener('click', async () => {
    const username = document.getElementById('reg-username').value.trim();
    const password = document.getElementById('reg-password').value;
    const password2 = document.getElementById('reg-password2').value;
    if (!username || !password) return alert('Заполните поля');
    if (username.length < 3) return alert('Юзернейм минимум 3 символа');
    if (password.length < 3) return alert('Пароль минимум 3 символа');
    if (password !== password2) return alert('Пароли не совпадают');
    
    const users = await loadUsers();
    if (findUserByUsername(username, users)) return alert('Юзернейм занят');
    
    const newUser = {
        id: 'u' + Date.now(),
        username,
        password,
        avatar: 'https://i.pravatar.cc/100?img=' + Math.floor(Math.random() * 70),
        bio: 'Новый пользователь SpeedGram',
        created_at: new Date().toISOString()
    };
    await saveUser(newUser);
    alert('✅ Регистрация успешна! Войдите.');
    document.querySelector('.auth-tab[data-tab="login"]').click();
    document.getElementById('login-username').value = username;
});

document.getElementById('login-btn')?.addEventListener('click', async () => {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const users = await loadUsers();
    const user = users.find(u => u.username === username && u.password === password);
    if (user) loginSuccess(user);
    else alert('Неверные данные');
});

document.getElementById('login-code-btn')?.addEventListener('click', async () => {
    const username = document.getElementById('login-username').value.trim();
    const users = await loadUsers();
    const user = findUserByUsername(username, users);
    if (!user) return alert('Пользователь не найден');
    tempCode = Math.floor(100000 + Math.random() * 900000).toString();
    tempCodeUser = user;
    document.getElementById('code-display').innerHTML = `Ваш код: ${tempCode}`;
    document.getElementById('code-modal').classList.remove('hidden');
});

document.getElementById('verify-code')?.addEventListener('click', () => {
    const code = document.getElementById('code-input').value;
    if (code === tempCode && tempCodeUser) {
        loginSuccess(tempCodeUser);
        document.getElementById('code-modal').classList.add('hidden');
        tempCode = null;
    } else alert('Неверный код');
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
                text: 'Привет! Я бот SpeedGram 🤖 Напиши "помощь" для команд.',
                time: Date.now(),
                read: false
            }]
        };
        await saveChat(botChat);
        lastMessagesCount[botChatId] = 1;
    }
    
    await renderChats();
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
        let otherUser = findUserById(otherId, users);
        let name = chat.type === 'private' ? (otherUser?.username || 'unknown') : chat.name;
        let avatar = chat.type === 'private' ? (otherUser?.avatar || 'https://via.placeholder.com/48') : (chat.avatar || 'https://via.placeholder.com/48');
        let lastMsg = chat.messages?.[chat.messages.length-1]?.text || 'Нет сообщений';
        const unreadCount = chat.messages?.filter(m => m.senderId !== currentUser.id && !m.read).length || 0;
        
        const div = document.createElement('div');
        div.className = `chat-item ${activeChatId === chat.id ? 'active' : ''}`;
        div.innerHTML = `
            <img src="${avatar}" onerror="this.src='https://via.placeholder.com/48'">
            <div class="chat-details">
                <strong>${escapeHtml(name)}</strong>
                <div><small>${escapeHtml(lastMsg.substring(0, 30))}</small></div>
            </div>
            ${unreadCount > 0 ? `<div style="background:#4e9eff;border-radius:12px;padding:2px 8px;font-size:12px;">${unreadCount}</div>` : ''}
        `;
        div.onclick = () => openChat(chat.id);
        container.appendChild(div);
    }
}

async function openChat(chatId) {
    activeChatId = chatId;
    await renderChats();
    const chats = await loadChats();
    const users = await loadUsers();
    const chat = chats.find(c => c.id === chatId);
    if (!chat) return;
    
    let otherId = chat.participants?.find(p => p !== currentUser.id);
    let otherUser = findUserById(otherId, users);
    let name = chat.type === 'private' ? (otherUser?.username || 'unknown') : chat.name;
    let avatar = chat.type === 'private' ? (otherUser?.avatar || 'https://via.placeholder.com/48') : (chat.avatar || 'https://via.placeholder.com/48');
    
    document.getElementById('chat-name').innerText = name;
    document.getElementById('chat-avatar').src = avatar;
    document.getElementById('chat-status').innerText = chat.type === 'group' ? 'Группа' : (otherUser?.isBot ? 'Бот 🤖' : 'онлайн');
    
    await renderMessages(chatId);
    await markAsRead(chatId);
}

async function markAsRead(chatId) {
    const chats = await loadChats();
    const chat = chats.find(c => c.id === chatId);
    if (!chat) return;
    let updated = false;
    chat.messages.forEach(msg => {
        if (msg.senderId !== currentUser.id && !msg.read) {
            msg.read = true;
            updated = true;
        }
    });
    if (updated) {
        await saveChat(chat);
        await renderMessages(chatId);
        await renderChats();
    }
}

let editingMessageId = null;
let editingChatId = null;

async function renderMessages(chatId) {
    const chats = await loadChats();
    const chat = chats.find(c => c.id === chatId);
    if (!chat) return;
    const container = document.getElementById('messages-list');
    container.innerHTML = '';
    
    if (!chat.messages || chat.messages.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:#7f8fa4;">Напишите первое сообщение</div>';
        return;
    }
    
    for (const msg of chat.messages) {
        const isOwn = msg.senderId === currentUser.id;
        const isBot = msg.senderId === BOT_USER.id;
        
        const div = document.createElement('div');
        let className = `message ${isOwn ? 'own' : ''}`;
        if (isBot && !isOwn) className += ' bot-message';
        div.className = className;
        
        let content = '';
        if (msg.type === 'text') content = `<div class="message-text">${escapeHtml(msg.text)}${msg.edited ? ' <small>(ред.)</small>' : ''}</div>`;
        if (msg.type === 'image') content = `<img src="${msg.url}" style="max-width:200px;border-radius:12px;"><div class="message-text">${escapeHtml(msg.caption||'')}</div>`;
        if (msg.type === 'voice') content = `<audio controls src="${msg.url}" style="max-width:200px;"></audio>`;
        
        const time = new Date(msg.time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
        
        div.innerHTML = `
            <strong class="message-username">${escapeHtml(msg.senderName)}</strong>
            ${content}
            <div class="message-time">${time}</div>
            ${isOwn ? `<div class="message-actions"><button class="edit-msg-btn" data-msg-id="${msg.id}" data-msg-text="${escapeHtml(msg.text)}">✏️ Ред.</button><button class="delete-msg-btn" data-msg-id="${msg.id}">🗑️ Уд.</button></div>` : ''}
        `;
        container.appendChild(div);
    }
    
    document.querySelectorAll('.delete-msg-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const msgId = parseInt(btn.dataset.msgId);
            const chats2 = await loadChats();
            const chat2 = chats2.find(c => c.id === chatId);
            if (chat2) {
                chat2.messages = chat2.messages.filter(m => m.id !== msgId);
                await saveChat(chat2);
                lastMessagesCount[chatId] = chat2.messages.length;
                await renderMessages(chatId);
                await renderChats();
            }
        });
    });
    
    document.querySelectorAll('.edit-msg-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            editingMessageId = parseInt(btn.dataset.msgId);
            editingChatId = chatId;
            document.getElementById('edit-msg-input').value = btn.dataset.msgText;
            document.getElementById('edit-msg-modal').classList.remove('hidden');
        });
    });
    
    document.getElementById('messages-container').scrollTop = document.getElementById('messages-container').scrollHeight;
}

document.getElementById('save-edit-msg')?.addEventListener('click', async () => {
    if (editingMessageId && editingChatId) {
        const newText = document.getElementById('edit-msg-input').value.trim();
        if (newText) {
            const chats = await loadChats();
            const chat = chats.find(c => c.id === editingChatId);
            if (chat && chat.messages) {
                const msgIndex = chat.messages.findIndex(m => m.id === editingMessageId);
                if (msgIndex !== -1 && chat.messages[msgIndex].senderId === currentUser.id) {
                    chat.messages[msgIndex].text = newText;
                    chat.messages[msgIndex].edited = true;
                    await saveChat(chat);
                    await renderMessages(editingChatId);
                    await renderChats();
                }
            }
        }
        document.getElementById('edit-msg-modal').classList.add('hidden');
        editingMessageId = null;
        editingChatId = null;
    }
});

document.getElementById('close-edit-msg')?.addEventListener('click', () => {
    document.getElementById('edit-msg-modal').classList.add('hidden');
    editingMessageId = null;
    editingChatId = null;
});

async function sendMessage(type, content, caption = '') {
    if (!activeChatId) return alert('Выберите чат');
    const chats = await loadChats();
    let chat = chats.find(c => c.id === activeChatId);
    if (!chat) return;
    
    const msg = {
        id: Date.now(),
        senderId: currentUser.id,
        senderName: currentUser.username,
        type,
        text: type === 'text' ? content : caption,
        url: type !== 'text' ? content : null,
        time: Date.now(),
        read: false,
        edited: false
    };
    if (!chat.messages) chat.messages = [];
    chat.messages.push(msg);
    await saveChat(chat);
    lastMessagesCount[activeChatId] = chat.messages.length;
    await renderMessages(activeChatId);
    await renderChats();
}

// Отправка сообщения
document.getElementById('send-message')?.addEventListener('click', () => {
    const input = document.getElementById('message-text');
    if (input.value.trim()) sendMessage('text', input.value.trim());
    input.value = '';
});

document.getElementById('message-text')?.addEventListener('keypress', e => {
    if (e.key === 'Enter') document.getElementById('send-message').click();
});

// Фото
document.getElementById('attach-photo')?.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => sendMessage('image', ev.target.result, '📷 Фото');
        reader.readAsDataURL(file);
    };
    input.click();
});

// Голосовые
document.getElementById('voice-record')?.addEventListener('mousedown', async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
        mediaRecorder.onstop = () => {
            const blob = new Blob(audioChunks, { type: 'audio/webm' });
            const url = URL.createObjectURL(blob);
            sendMessage('voice', url, '🎤 Голосовое');
            stream.getTracks().forEach(t => t.stop());
        };
        mediaRecorder.start();
        document.getElementById('voice-record').style.color = '#ff4444';
    } catch(e) { alert('Нет доступа к микрофону'); }
});

document.getElementById('voice-record')?.addEventListener('mouseup', () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        document.getElementById('voice-record').style.color = '';
    }
});

// ==================== НАСТРОЙКИ ====================
document.getElementById('settings-btn')?.addEventListener('click', () => {
    document.getElementById('settings-modal').classList.remove('hidden');
    updateAccountsList();
});

document.getElementById('close-settings')?.addEventListener('click', () => {
    document.getElementById('settings-modal').classList.add('hidden');
});

document.getElementById('change-avatar-btn')?.addEventListener('click', () => {
    document.getElementById('avatar-upload').click();
});

document.getElementById('avatar-upload')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
        currentUser.avatar = ev.target.result;
        const users = await loadUsers();
        const idx = users.findIndex(u => u.id === currentUser.id);
        if (idx !== -1) {
            users[idx] = currentUser;
            await supabaseRequest(`users?id=eq.${currentUser.id}`, 'PUT', currentUser);
        }
        document.getElementById('sidebar-avatar').src = currentUser.avatar;
        document.getElementById('settings-avatar').src = currentUser.avatar;
        await renderChats();
    };
    reader.readAsDataURL(file);
});

// Фоны чата
document.querySelectorAll('.bg-preset').forEach(preset => {
    preset.addEventListener('click', async () => {
        const color = preset.dataset.bg;
        currentUser.bgColor = color;
        document.querySelector('.messages-container').style.backgroundColor = color;
        const users = await loadUsers();
        const idx = users.findIndex(u => u.id === currentUser.id);
        if (idx !== -1) {
            users[idx] = currentUser;
            await supabaseRequest(`users?id=eq.${currentUser.id}`, 'PUT', currentUser);
        }
    });
});

// Темы
document.getElementById('theme-dark-btn')?.addEventListener('click', () => {
    document.body.classList.remove('light', 'lava', 'ocean', 'sunset', 'forest');
    localStorage.setItem('sg_theme', 'dark');
});
document.getElementById('theme-light-btn')?.addEventListener('click', () => {
    document.body.classList.remove('lava', 'ocean', 'sunset', 'forest');
    document.body.classList.add('light');
    localStorage.setItem('sg_theme', 'light');
});
document.getElementById('theme-lava-btn')?.addEventListener('click', () => {
    document.body.classList.remove('light', 'ocean', 'sunset', 'forest');
    document.body.classList.add('lava');
    localStorage.setItem('sg_theme', 'lava');
});
document.getElementById('theme-ocean-btn')?.addEventListener('click', () => {
    document.body.classList.remove('light', 'lava', 'sunset', 'forest');
    document.body.classList.add('ocean');
    localStorage.setItem('sg_theme', 'ocean');
});
document.getElementById('theme-sunset-btn')?.addEventListener('click', () => {
    document.body.classList.remove('light', 'lava', 'ocean', 'forest');
    document.body.classList.add('sunset');
    localStorage.setItem('sg_theme', 'sunset');
});
document.getElementById('theme-forest-btn')?.addEventListener('click', () => {
    document.body.classList.remove('light', 'lava', 'ocean', 'sunset');
    document.body.classList.add('forest');
    localStorage.setItem('sg_theme', 'forest');
});

// Звук
document.getElementById('sound-on-btn')?.addEventListener('click', () => {
    soundEnabled = true;
    localStorage.setItem('sg_sound_enabled', 'true');
    playNotificationSound();
});
document.getElementById('sound-off-btn')?.addEventListener('click', () => {
    soundEnabled = false;
    localStorage.setItem('sg_sound_enabled', 'false');
});

function restoreTheme() {
    const savedTheme = localStorage.getItem('sg_theme');
    document.body.classList.remove('light', 'lava', 'ocean', 'sunset', 'forest');
    if (savedTheme === 'light') document.body.classList.add('light');
    else if (savedTheme === 'lava') document.body.classList.add('lava');
    else if (savedTheme === 'ocean') document.body.classList.add('ocean');
    else if (savedTheme === 'sunset') document.body.classList.add('sunset');
    else if (savedTheme === 'forest') document.body.classList.add('forest');
}

async function updateAccountsList() {
    const users = await loadUsers();
    const container = document.getElementById('accounts-list');
    container.innerHTML = '';
    users.slice(0, 3).forEach(u => {
        const div = document.createElement('div');
        div.className = 'account-item';
        div.innerHTML = `
            <span><img src="${u.avatar}" style="width:32px;height:32px;border-radius:50%;vertical-align:middle;margin-right:8px;"> ${u.username}</span>
            ${u.id !== currentUser.id ? `<button class="btn-small switch-acc-btn" data-id="${u.id}">Переключиться</button>` : '<span>✅ текущий</span>'}
        `;
        container.appendChild(div);
    });
    document.querySelectorAll('.switch-acc-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const users = await loadUsers();
            const newUser = users.find(u => u.id === btn.dataset.id);
            if (newUser && newUser.id !== currentUser.id) {
                currentUser = newUser;
                localStorage.setItem('sg_current_user_id', currentUser.id);
                document.getElementById('sidebar-name').innerText = currentUser.username;
                document.getElementById('sidebar-avatar').src = currentUser.avatar;
                document.querySelector('.messages-container').style.backgroundColor = currentUser.bgColor || '#0e1621';
                await renderChats();
                activeChatId = null;
                document.getElementById('chat-name').innerText = 'Выберите чат';
                document.getElementById('messages-list').innerHTML = '';
                updateAccountsList();
                alert(`Переключено на ${currentUser.username}`);
            }
        });
    });
}

// ==================== ПОИСК ====================
document.getElementById('search-btn')?.addEventListener('click', () => {
    document.getElementById('search-modal').classList.remove('hidden');
    document.getElementById('search-results').innerHTML = '';
});

document.getElementById('do-search')?.addEventListener('click', async () => {
    const query = document.getElementById('search-query').value.trim();
    if (!query) return;
    const users = await loadUsers();
    const results = document.getElementById('search-results');
    results.innerHTML = '';
    
    for (const user of users) {
        if (user.username.toLowerCase().includes(query.toLowerCase()) && user.id !== currentUser.id) {
            const div = document.createElement('div');
            div.className = 'search-result-item';
            div.innerHTML = `<strong>👤 ${escapeHtml(user.username)}</strong><br><small>Нажмите для чата</small>`;
            div.onclick = async () => {
                const chatId = [currentUser.id, user.id].sort().join('_');
                const chats = await loadChats();
                let chat = chats.find(c => c.id === chatId);
                if (!chat) {
                    chat = {
                        id: chatId,
                        type: 'private',
                        participants: [currentUser.id, user.id],
                        name: user.username,
                        avatar: user.avatar,
                        messages: []
                    };
                    await saveChat(chat);
                    lastMessagesCount[chatId] = 0;
                }
                openChat(chatId);
                document.getElementById('search-modal').classList.add('hidden');
            };
            results.appendChild(div);
        }
    }
});

document.getElementById('close-search')?.addEventListener('click', () => {
    document.getElementById('search-modal').classList.add('hidden');
});

// ==================== ПРОФИЛЬ ====================
function showUserProfile(userId) {
    // Функция для показа профиля (можно добавить позже)
    alert('Функция профиля будет добавлена');
}

document.getElementById('sidebar-user')?.addEventListener('click', () => {
    showUserProfile(currentUser.id);
});

// Закрытие модалок
document.querySelectorAll('#close-code, #close-new-acc, .modal .btn-secondary, #close-edit-msg, #profile-close, #close-info').forEach(btn => {
    if (btn) btn.addEventListener('click', function() {
        const modal = this.closest('.modal');
        if (modal) modal.classList.add('hidden');
    });
});

// Загрузка сессии
const savedSound = localStorage.getItem('sg_sound_enabled');
if (savedSound !== null) soundEnabled = savedSound === 'true';

const savedUserId = localStorage.getItem('sg_current_user_id');
if (savedUserId) {
    loadUsers().then(users => {
        const user = users.find(u => u.id === savedUserId);
        if (user) loginSuccess(user);
    });
}

restoreTheme();