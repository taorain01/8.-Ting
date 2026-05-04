/* Ting! — Smart Parser
   Tự động tách username/password/2FA từ chuỗi paste */

const PARSER_PLATFORM_LINE_ALIASES = [
    'youtube premium', 'youtube', 'yt', 'netflix', 'spotify', 'disney plus', 'disney+', 'disney',
    'prime video', 'amazon prime video', 'amazon prime', 'hulu', 'apple tv', 'appletv',
    'twitch', 'tiktok', 'tik tok', 'instagram', 'insta', 'facebook', 'fb', 'x', 'twitter',
    'telegram', 'whatsapp', 'discord', 'reddit', 'linkedin', 'pinterest', 'canva', 'capcut',
    'photoshop', 'premiere', 'illustrator', 'lightroom', 'adobe', 'figma', 'notion', 'zoom',
    'slack', 'trello', 'dropbox', 'google account', 'account google', 'acc google',
    'tai khoan google', 'google personal', 'google ca nhan', 'google veo 3', 'veo 3',
    'google veo', 'veo', 'google antigravity', 'antigravity', 'gemini pro',
    'google gemini pro', 'gemini advanced', 'google cloud', 'gcp', 'google drive', 'gdrive',
    'gmail', 'google one', 'google workspace', 'google', 'office 365', 'microsoft 365',
    'ms 365', 'office', 'microsoft', 'icloud', 'apple', 'github copilot', 'copilot',
    'github', 'gitlab', 'bitbucket', 'wordpress', 'shopify', 'paypal', 'stripe',
    'cloudflare', 'vercel', 'netlify', 'chatgpt', 'openai', 'gpt', 'claude', 'anthropic',
    'gemini', 'bard', 'google ai', 'perplexity', 'cursor', 'replit', 'hugging face',
    'huggingface', 'midjourney', 'mj', 'suno', 'stability ai', 'stable diffusion',
    'ollama', 'deepseek', 'deep seek', 'mistral ai', 'mistral', 'elevenlabs',
    'eleven labs', 'replicate', 'poe', 'deepl', 'deep l', 'grammarly', 'zapier',
    'make.com', 'make automation', 'n8n', 'todoist', '1password', 'one password',
    'lastpass', 'last pass', 'proton mail', 'protonmail', 'proton', 'coursera',
    'udemy', 'duolingo', 'linear', 'asana', 'airtable', 'miro', 'firebase', 'mongodb',
    'mongo db', 'supabase',
];

function normalizeParserToken(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/&/g, ' and ')
        .replace(/\+/g, ' plus ')
        .replace(/[^a-z0-9.#\s-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function addParserAlias(set, value) {
    const normalized = normalizeParserToken(value);
    if (!normalized) return;
    set.add(normalized);
    set.add(normalized.replace(/[\s._#-]+/g, ''));
}

function getParserPlatformAliasSet() {
    const set = new Set();
    PARSER_PLATFORM_LINE_ALIASES.forEach(alias => addParserAlias(set, alias));

    const iconMap = typeof globalThis !== 'undefined' ? globalThis.TING_PLATFORM_ICONS : null;
    if (iconMap && typeof iconMap === 'object') {
        Object.entries(iconMap).forEach(([key, config]) => {
            addParserAlias(set, key);
            addParserAlias(set, String(key).replace(/-/g, ' '));
            if (config?.label) {
                addParserAlias(set, config.label);
                String(config.label).split('/').forEach(part => addParserAlias(set, part));
            }
        });
    }
    return set;
}

function isEmailLikePart(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function isLikelyPlatformPart(value) {
    const raw = String(value || '').trim();
    if (!raw || raw.length > 48) return false;
    if (isEmailLikePart(raw) || /(?:https?:\/\/|www\.|\\|\/)/i.test(raw)) return false;
    if (/[^A-Za-z0-9À-ỹ\s.+#&_-]/.test(raw)) return false;

    const normalized = normalizeParserToken(raw);
    const compact = normalized.replace(/[\s._#-]+/g, '');
    const aliases = getParserPlatformAliasSet();
    return aliases.has(normalized) || aliases.has(compact);
}

function splitAccountInputParts(text) {
    const delimiters = [
        /\|/,
        /\n/,
        /\t/,
        /\s*:\s*/,
        /\s{2,}/,
    ];

    for (const regex of delimiters) {
        const parts = text.split(regex).map(p => p.trim()).filter(Boolean);
        if (parts.length >= 2) return parts;
    }
    return [text.trim()].filter(Boolean);
}

function stripPlatformOnlyParts(parts) {
    const clean = [...parts];
    const removed = [];

    while (clean.length >= 3 && isLikelyPlatformPart(clean[0])) {
        removed.push(clean.shift());
    }
    while (clean.length >= 3 && isLikelyPlatformPart(clean[clean.length - 1])) {
        removed.push(clean.pop());
    }

    return {
        parts: clean,
        serviceName: removed[0] || '',
        platform: removed[0] ? detectPlatform(removed[0]) : null,
    };
}

/**
 * Parse chuỗi input thành {username, password, twoFaCode}
 * Hỗ trợ nhiều delimiter: | > \n > \t > " : " > nhiều spaces
 */
function parseAccountInput(raw) {
    if (!raw || !raw.trim()) return null;
    const text = raw.trim();
    const parsed = stripPlatformOnlyParts(splitAccountInputParts(text));
    const parts = parsed.parts;
    if (parts.length >= 2) {
        return {
            username: parts[0] || '',
            password: parts[1] || '',
            twoFaCode: parts[2] || '',
            serviceName: parsed.serviceName,
            platform: parsed.platform,
        };
    }
    return { username: text, password: '', twoFaCode: '', serviceName: '', platform: null };
    
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
    const trimmedName = name.trim();
    if (trimmedName === 'x' || trimmedName === 'x premium') return 'x';
    
    const platforms = [
        { keys: ['youtube premium','youtube','yt'], platform: 'youtube' },
        { keys: ['netflix'], platform: 'netflix' },
        { keys: ['spotify'], platform: 'spotify' },
        { keys: ['disney plus','disney+','disney'], platform: 'disneyplus' },
        { keys: ['prime video','amazon prime video','amazon prime'], platform: 'primevideo' },
        { keys: ['hulu'], platform: 'hulu' },
        { keys: ['apple tv','appletv'], platform: 'appletv' },
        { keys: ['twitch'], platform: 'twitch' },
        { keys: ['tiktok','tik tok'], platform: 'tiktok' },
        { keys: ['instagram','insta'], platform: 'instagram' },
        { keys: ['facebook','fb'], platform: 'facebook' },
        { keys: ['twitter',' x '], platform: 'x' },
        { keys: ['telegram'], platform: 'telegram' },
        { keys: ['whatsapp'], platform: 'whatsapp' },
        { keys: ['discord','nitro'], platform: 'discord' },
        { keys: ['reddit'], platform: 'reddit' },
        { keys: ['linkedin'], platform: 'linkedin' },
        { keys: ['pinterest'], platform: 'pinterest' },
        { keys: ['canva'], platform: 'canva' },
        { keys: ['capcut'], platform: 'capcut' },
        { keys: ['photoshop','premiere','illustrator','lightroom','adobe'], platform: 'adobe' },
        { keys: ['figma'], platform: 'figma' },
        { keys: ['notion'], platform: 'notion' },
        { keys: ['zoom'], platform: 'zoom' },
        { keys: ['slack'], platform: 'slack' },
        { keys: ['trello'], platform: 'trello' },
        { keys: ['dropbox'], platform: 'dropbox' },
        { keys: ['google account','account google','acc google','tai khoan google','tài khoản google','google tai khoan','google tài khoản','google personal','google ca nhan','google cá nhân'], platform: 'google-account' },
        { keys: ['google veo 3','veo 3','google veo','veo'], platform: 'google-veo' },
        { keys: ['google antigravity','antigravity'], platform: 'google-antigravity' },
        { keys: ['gemini pro','google gemini pro','gemini advanced'], platform: 'gemini-pro' },
        { keys: ['google cloud','gcp'], platform: 'googlecloud' },
        { keys: ['google drive','gdrive'], platform: 'googledrive' },
        { keys: ['gmail'], platform: 'gmail' },
        { keys: ['google one','google workspace','google'], platform: 'google' },
        { keys: ['office 365','microsoft 365','ms 365','office'], platform: 'office365' },
        { keys: ['microsoft'], platform: 'microsoft' },
        { keys: ['icloud','apple'], platform: 'apple' },
        { keys: ['github copilot','copilot','github'], platform: 'github' },
        { keys: ['gitlab'], platform: 'gitlab' },
        { keys: ['bitbucket'], platform: 'bitbucket' },
        { keys: ['wordpress'], platform: 'wordpress' },
        { keys: ['shopify'], platform: 'shopify' },
        { keys: ['paypal'], platform: 'paypal' },
        { keys: ['stripe'], platform: 'stripe' },
        { keys: ['cloudflare'], platform: 'cloudflare' },
        { keys: ['vercel'], platform: 'vercel' },
        { keys: ['netlify'], platform: 'netlify' },
        { keys: ['chatgpt','openai','gpt'], platform: 'openai' },
        { keys: ['claude'], platform: 'claude' },
        { keys: ['anthropic'], platform: 'anthropic' },
        { keys: ['gemini','bard','google ai'], platform: 'google-ai' },
        { keys: ['perplexity'], platform: 'perplexity' },
        { keys: ['cursor'], platform: 'cursor' },
        { keys: ['replit'], platform: 'replit' },
        { keys: ['hugging face','huggingface'], platform: 'huggingface' },
        { keys: ['midjourney','mj'], platform: 'midjourney' },
        { keys: ['suno'], platform: 'suno' },
        { keys: ['stability ai','stable diffusion'], platform: 'stabilityai' },
        { keys: ['ollama'], platform: 'ollama' },
        { keys: ['deepseek','deep seek'], platform: 'deepseek' },
        { keys: ['mistral ai','mistral'], platform: 'mistralai' },
        { keys: ['elevenlabs','eleven labs'], platform: 'elevenlabs' },
        { keys: ['replicate'], platform: 'replicate' },
        { keys: ['poe'], platform: 'poe' },
        { keys: ['deepl','deep l'], platform: 'deepl' },
        { keys: ['grammarly'], platform: 'grammarly' },
        { keys: ['zapier'], platform: 'zapier' },
        { keys: ['make.com','make automation'], platform: 'make' },
        { keys: ['n8n'], platform: 'n8n' },
        { keys: ['todoist'], platform: 'todoist' },
        { keys: ['1password','one password'], platform: '1password' },
        { keys: ['lastpass','last pass'], platform: 'lastpass' },
        { keys: ['proton mail','protonmail'], platform: 'protonmail' },
        { keys: ['proton'], platform: 'proton' },
        { keys: ['coursera'], platform: 'coursera' },
        { keys: ['udemy'], platform: 'udemy' },
        { keys: ['duolingo'], platform: 'duolingo' },
        { keys: ['linear'], platform: 'linear' },
        { keys: ['asana'], platform: 'asana' },
        { keys: ['airtable'], platform: 'airtable' },
        { keys: ['miro'], platform: 'miro' },
        { keys: ['firebase'], platform: 'firebase' },
        { keys: ['mongodb','mongo db'], platform: 'mongodb' },
        { keys: ['supabase'], platform: 'supabase' },
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
        apple:'🍎', 'google-ai':'✨', 'google-account':'🔵', 'gemini-pro':'✨',
        'google-veo':'🎞️', 'google-antigravity':'✨', anthropic:'🧠', suno:'🎶'
    };
    return map[platform] || '🔑';
}
