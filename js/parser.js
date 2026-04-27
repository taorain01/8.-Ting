/* Ting! — Smart Parser
   Tự động tách username/password/2FA từ chuỗi paste */

/**
 * Parse chuỗi input thành {username, password, twoFaCode}
 * Hỗ trợ nhiều delimiter: | > \n > \t > " : " > nhiều spaces
 */
function parseAccountInput(raw) {
    if (!raw || !raw.trim()) return null;
    const text = raw.trim();
    
    // Thử các delimiter theo thứ tự ưu tiên
    const delimiters = [
        { sep: '|',    regex: /\|/ },
        { sep: '\n',   regex: /\n/ },
        { sep: '\t',   regex: /\t/ },
        { sep: ' : ',  regex: /\s*:\s*/ },
        { sep: '  ',   regex: /\s{2,}/ },
    ];
    
    for (const { regex } of delimiters) {
        const parts = text.split(regex).map(p => p.trim()).filter(Boolean);
        if (parts.length >= 2) {
            return {
                username: parts[0] || '',
                password: parts[1] || '',
                twoFaCode: parts[2] || '',
            };
        }
    }
    
    // Nếu không tách được, coi toàn bộ là username
    return { username: text, password: '', twoFaCode: '' };
}

/**
 * Detect nền tảng từ tên dịch vụ
 * Trả về platform key để map logo
 */
function detectPlatform(serviceName) {
    if (!serviceName) return null;
    const name = serviceName.toLowerCase();
    
    const platforms = [
        { keys: ['youtube','yt'], platform: 'youtube' },
        { keys: ['canva'], platform: 'canva' },
        { keys: ['capcut'], platform: 'capcut' },
        { keys: ['netflix'], platform: 'netflix' },
        { keys: ['spotify'], platform: 'spotify' },
        { keys: ['adobe','photoshop','premiere','illustrator'], platform: 'adobe' },
        { keys: ['google one','google drive','gdrive'], platform: 'google' },
        { keys: ['microsoft','office 365','ms 365'], platform: 'microsoft' },
        { keys: ['chatgpt','openai','gpt'], platform: 'openai' },
        { keys: ['midjourney','mj'], platform: 'midjourney' },
        { keys: ['github','copilot'], platform: 'github' },
        { keys: ['discord','nitro'], platform: 'discord' },
        { keys: ['notion'], platform: 'notion' },
        { keys: ['figma'], platform: 'figma' },
        { keys: ['zoom'], platform: 'zoom' },
        { keys: ['icloud','apple'], platform: 'apple' },
        { keys: ['gemini','antigravity'], platform: 'google-ai' },
        { keys: ['claude','anthropic'], platform: 'anthropic' },
        { keys: ['suno'], platform: 'suno' },
    ];
    
    for (const p of platforms) {
        if (p.keys.some(k => name.includes(k))) return p.platform;
    }
    return null;
}

/**
 * Lấy emoji/icon cho platform (fallback)
 */
function getPlatformEmoji(platform) {
    const map = {
        youtube:'▶️', canva:'🎨', capcut:'✂️', netflix:'🎬', spotify:'🎵',
        adobe:'🅰️', google:'🔵', microsoft:'Ⓜ️', openai:'🤖', midjourney:'🎭',
        github:'🐙', discord:'💬', notion:'📝', figma:'🖌️', zoom:'📹',
        apple:'🍎', 'google-ai':'✨', anthropic:'🧠', suno:'🎶'
    };
    return map[platform] || '🔑';
}
