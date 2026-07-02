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
    // --- Kiro + new AI tools (2026) ---
    'kiro', 'grok', 'windsurf', 'codeium', 'bolt', 'bolt.new', 'lovable', 'v0', 'v0.dev',
    'runway', 'runwayml', 'luma', 'luma ai', 'dream machine', 'pika', 'ideogram',
    'leonardo', 'leonardo ai', 'krea', 'kling', 'qwen', 'kimi', 'moonshot',
    'notebooklm', 'notebook lm', 'manus', 'flux', 'udio', 'gamma', 'genspark',
    'character ai', 'character.ai', 'jasper',
    // --- Vietnam apps ---
    'vneid', 'vssid', 'dich vu cong', 'dichvucong', 'so suc khoe', 'etax', 'vetc', 'epass',
    'momo', 'zalopay', 'zalo pay', 'vnpay', 'viettel money', 'viettelpay', 'shopeepay',
    'vietcombank', 'techcombank', 'bidv', 'mb bank', 'mbbank', 'vpbank', 'acb', 'tpbank',
    'agribank', 'vietinbank', 'sacombank', 'cake', 'timo',
    'shopee', 'lazada', 'tiki', 'sendo',
    'grab', 'gojek', 'baemin', 'be app', 'begroup',
    'zing mp3', 'zingmp3', 'nhaccuatui', 'nhac cua tui', 'fpt play', 'fptplay', 'vieon',
    'galaxy play', 'k+', 'k plus',
    'viettel', 'vinaphone', 'mobifone', 'coc coc', 'coccoc',
    'vng', 'garena', 'vtc game', 'vtc',
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

function stripCredentialFieldLabel(value) {
    return String(value || '')
        .trim()
        .replace(/^(?:user(?:name)?|email|mail|login|account|acc|tk|tai\s*khoan|tài\s*khoản)\s*[:=：-]\s*/i, '')
        .replace(/^(?:pass(?:word)?|pwd|mk|mat\s*khau|mật\s*khẩu)\s*[:=：-]\s*/i, '')
        .replace(/^(?:2fa|2\s*fa|otp|totp|secret|ma\s*2fa|mã\s*2fa|backup\s*code)\s*[:=：-]\s*/i, '')
        .trim();
}

function readCredentialFieldLabel(value) {
    const raw = String(value || '').trim();
    const match = raw.match(/^([^:=：-]{1,28})\s*[:=：-]\s*(.+)$/);
    if (!match) return null;

    const label = normalizeParserToken(match[1]);
    const field = [
        { key: 'username', labels: ['user', 'username', 'email', 'mail', 'login', 'account', 'acc', 'tk', 'tai khoan'] },
        { key: 'password', labels: ['pass', 'password', 'pwd', 'mk', 'mat khau'] },
        { key: 'twoFaCode', labels: ['2fa', '2 fa', 'otp', 'totp', 'secret', 'ma 2fa', 'backup code'] },
        { key: 'serviceName', labels: ['service', 'dich vu', 'platform', 'nen tang', 'app'] },
    ].find(item => item.labels.includes(label));

    return field ? { key: field.key, value: match[2].trim() } : null;
}

function parseLabeledAccountInput(text) {
    const fields = {};
    const segments = String(text || '')
        .split(/\r?\n|[|;]/)
        .map(part => part.trim())
        .filter(Boolean);

    for (const segment of segments) {
        const labeled = readCredentialFieldLabel(segment);
        if (labeled && !fields[labeled.key]) fields[labeled.key] = labeled.value;
    }

    const credentialCount = ['username', 'password', 'twoFaCode'].filter(key => fields[key]).length;
    if (!fields.username && credentialCount < 2) return null;
    const platform = fields.serviceName ? detectPlatform(fields.serviceName) : null;
    return {
        username: fields.username || '',
        password: fields.password || '',
        twoFaCode: fields.twoFaCode || '',
        serviceName: fields.serviceName || '',
        platform,
    };
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
        /;/,
        /\s{2,}/,
    ];

    for (const regex of delimiters) {
        const parts = text.split(regex).map(p => p.trim()).filter(Boolean);
        if (parts.length >= 2) return parts;
    }
    const looseParts = text.split(/\s+/).map(p => p.trim()).filter(Boolean);
    if (looseParts.length >= 2 && isEmailLikePart(looseParts[0])) return looseParts;
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
    const labeled = parseLabeledAccountInput(text);
    if (labeled) return labeled;

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
    if (trimmedName === 'be' || trimmedName === 'be app' || trimmedName === 'begroup' || trimmedName === 'be ride') return 'be';
    
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
        { keys: ['gmail','google mail','google one','google workspace','google'], platform: 'google' },
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
        { keys: ['kiro'], platform: 'kiro' },
        { keys: ['grok','xai'], platform: 'grok' },
        { keys: ['windsurf','codeium'], platform: 'windsurf' },
        { keys: ['bolt.new','bolt new','boltnew'], platform: 'bolt' },
        { keys: ['lovable'], platform: 'lovable' },
        { keys: ['v0.dev','v0 by vercel','v0dev','vercel v0'], platform: 'v0' },
        { keys: ['runwayml','runway ml','runway'], platform: 'runway' },
        { keys: ['luma ai','luma labs','dream machine','lumaai'], platform: 'luma' },
        { keys: ['pika labs','pika art','pika ai','pika'], platform: 'pika' },
        { keys: ['ideogram'], platform: 'ideogram' },
        { keys: ['leonardo ai','leonardo.ai','leonardoai','leonardo'], platform: 'leonardo' },
        { keys: ['krea ai','krea.ai','krea'], platform: 'krea' },
        { keys: ['kling ai','kling'], platform: 'kling' },
        { keys: ['qwen','tongyi','qianwen'], platform: 'qwen' },
        { keys: ['kimi','moonshot'], platform: 'kimi' },
        { keys: ['notebooklm','notebook lm'], platform: 'notebooklm' },
        { keys: ['manus ai','manus.im','manus'], platform: 'manus' },
        { keys: ['flux ai','flux.1','black forest','flux'], platform: 'flux' },
        { keys: ['udio'], platform: 'udio' },
        { keys: ['gamma app','gamma.app','gamma'], platform: 'gamma' },
        { keys: ['genspark'], platform: 'genspark' },
        { keys: ['character ai','character.ai','characterai'], platform: 'characterai' },
        { keys: ['jasper ai','jasper'], platform: 'jasper' },
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
        // --- Vietnam apps ---
        { keys: ['vneid','vn-eid','dinh danh dien tu','định danh điện tử'], platform: 'vneid' },
        { keys: ['vssid','bao hiem xa hoi','bảo hiểm xã hội'], platform: 'vssid' },
        { keys: ['dich vu cong','dịch vụ công','dichvucong','cong dich vu cong'], platform: 'dichvucong' },
        { keys: ['so suc khoe','sổ sức khỏe','so tay suc khoe'], platform: 'thongbaosk' },
        { keys: ['etax','thue dien tu','thuế điện tử'], platform: 'etax' },
        { keys: ['vetc'], platform: 'vetc' },
        { keys: ['epass'], platform: 'epass' },
        { keys: ['shopeepay','shopee pay'], platform: 'shopeepay' },
        { keys: ['momo'], platform: 'momo' },
        { keys: ['zalopay','zalo pay'], platform: 'zalopay' },
        { keys: ['vnpay'], platform: 'vnpay' },
        { keys: ['viettel money','viettelpay','viettel pay'], platform: 'viettelmoney' },
        { keys: ['vietcombank','vcb'], platform: 'vietcombank' },
        { keys: ['techcombank'], platform: 'techcombank' },
        { keys: ['bidv'], platform: 'bidv' },
        { keys: ['mb bank','mbbank'], platform: 'mbbank' },
        { keys: ['vpbank'], platform: 'vpbank' },
        { keys: ['tpbank'], platform: 'tpbank' },
        { keys: ['agribank'], platform: 'agribank' },
        { keys: ['vietinbank'], platform: 'vietinbank' },
        { keys: ['sacombank'], platform: 'sacombank' },
        { keys: ['acb'], platform: 'acb' },
        { keys: ['cake by vpbank','cake bank'], platform: 'cake' },
        { keys: ['timo'], platform: 'timo' },
        { keys: ['shopee'], platform: 'shopee' },
        { keys: ['lazada'], platform: 'lazada' },
        { keys: ['tiki'], platform: 'tiki' },
        { keys: ['sendo'], platform: 'sendo' },
        { keys: ['grab'], platform: 'grab' },
        { keys: ['gojek'], platform: 'gojek' },
        { keys: ['baemin'], platform: 'baemin' },
        { keys: ['zing mp3','zingmp3'], platform: 'zingmp3' },
        { keys: ['nhaccuatui','nhac cua tui'], platform: 'nhaccuatui' },
        { keys: ['fpt play','fptplay'], platform: 'fptplay' },
        { keys: ['vieon'], platform: 'vieon' },
        { keys: ['galaxy play','galaxyplay'], platform: 'galaxyplay' },
        { keys: ['k+','k plus','kplus'], platform: 'kplus' },
        { keys: ['viettel'], platform: 'viettel' },
        { keys: ['vinaphone'], platform: 'vinaphone' },
        { keys: ['mobifone'], platform: 'mobifone' },
        { keys: ['coc coc','coccoc'], platform: 'coccoc' },
        { keys: ['vng'], platform: 'vng' },
        { keys: ['garena','free fire'], platform: 'garena' },
        { keys: ['vtc game','vtcgame'], platform: 'vtcgame' },
    ];
    
    for (const p of platforms) {
        if (p.keys.some(k => name.includes(k))) return p.platform;
    }
    return null;
}

/**
 * Tìm URL đầu tiên trong chuỗi
 */
function extractFirstUrl(text) {
    const raw = String(text || '');
    const match = raw.match(/\bhttps?:\/\/[^\s"'<>|]+/i)
        || raw.match(/\b(?:www\.|t\.me\/|telegram\.me\/|zalo\.me\/|chat\.zalo\.me\/|oa\.zalo\.me\/|zaloapp\.com\/|fb\.com\/|facebook\.com\/|m\.facebook\.com\/|m\.me\/|messenger\.com\/|discord\.gg\/|discord\.com\/invite\/|discordapp\.com\/invite\/)[^\s"'<>|]+/i);
    return match ? match[0].replace(/[.,)\]}>'"]+$/, '') : '';
}

function getSellerPlatformRules() {
    return [
        { platform: 'zalo', hosts: ['zalo.me', 'chat.zalo.me', 'zaloapp.com', 'oa.zalo.me'] },
        { platform: 'telegram', hosts: ['t.me', 'telegram.me', 'telegram.org'] },
        { platform: 'facebook', hosts: ['facebook.com', 'fb.com', 'fb.watch', 'm.facebook.com', 'm.me', 'messenger.com'] },
        { platform: 'discord', hosts: ['discord.gg', 'discord.com', 'discordapp.com', 'discord.new'] },
    ];
}

function normalizeSellerUrl(url) {
    const raw = String(url || '').trim();
    if (!raw) return '';
    const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    try {
        const parsed = new URL(candidate);
        if (!/^https?:$/i.test(parsed.protocol) || !parsed.hostname) return '';
        const normalized = parsed.href.replace(/[.,)\]}>'"]+$/, '');
        if (parsed.pathname === '/' && !parsed.search && !parsed.hash && !/[/?#]$/.test(raw)) {
            return normalized.replace(/\/$/, '');
        }
        return normalized;
    } catch (_) {
        return '';
    }
}

function inferSellerPlatformFromUrl(url) {
    const normalized = normalizeSellerUrl(url);
    if (!normalized) return 'other';
    try {
        const host = new URL(normalized).hostname.replace(/^www\./i, '').toLowerCase();
        const matched = getSellerPlatformRules().find(rule => rule.hosts.some(h => host === h || host.endsWith(`.${h}`)));
        return matched ? matched.platform : 'other';
    } catch (_) {
        return 'other';
    }
}

function cleanSellerPathToken(value) {
    let token = String(value || '').trim();
    if (!token || /\s/.test(token)) return '';
    token = token
        .replace(/^@+/, '')
        .replace(/^\/+|\/+$/g, '')
        .replace(/[<>"'`]/g, '')
        .replace(/[.,)\]}]+$/, '');
    return token && !/^[?#]+$/.test(token) ? token : '';
}

function normalizeSellerLink(value, platform = 'other') {
    const raw = String(value || '').trim();
    if (!raw) return '';

    const directUrl = extractFirstUrl(raw);
    if (directUrl) return normalizeSellerUrl(directUrl);

    const selected = String(platform || 'other').toLowerCase();
    if (!selected || selected === 'other' || selected === 'web') return '';

    const token = cleanSellerPathToken(raw);
    if (!token) return '';
    const encoded = encodeURIComponent(token).replace(/%2B/g, '+');

    if (selected === 'telegram') return `https://t.me/${encoded}`;
    if (selected === 'facebook') return `https://facebook.com/${encoded}`;
    if (selected === 'zalo') return `https://zalo.me/${encoded}`;
    if (selected === 'discord') return `https://discord.gg/${encoded}`;
    return '';
}

function resolveSellerLinkInput(name, platform = 'other', fallbackLink = '') {
    const sellerName = String(name || '').trim();
    if (!sellerName) return '';
    const selected = String(platform || 'other').toLowerCase();
    const fromName = normalizeSellerLink(sellerName, selected);
    if (fromName) return fromName;

    const fallback = normalizeSellerLink(fallbackLink, 'other');
    if (!fallback) return '';
    const fallbackPlatform = inferSellerPlatformFromUrl(fallback);
    if (selected && selected !== 'other' && selected !== 'web' && fallbackPlatform !== selected) return '';
    return fallback;
}

/**
 * Nhận diện nguồn/người bán từ link dán vào.
 * Trả về { platform, url, name, host } hoặc null.
 * Zalo -> zalo, Telegram -> telegram, Facebook -> facebook, Discord -> discord, còn lại -> other (Web)
 */
function detectSellerFromText(text) {
    const url = normalizeSellerLink(text, 'other');
    if (!url) return null;

    let host = '';
    let pathname = '';
    try {
        const parsed = new URL(url);
        host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
        pathname = parsed.pathname || '';
    } catch (_) {
        return null;
    }
    if (!host) return null;

    const platform = inferSellerPlatformFromUrl(url);
    const segments = pathname.split('/').filter(Boolean).map(seg => {
        try { return decodeURIComponent(seg); } catch (_) { return seg; }
    });
    let name = '';
    if (platform === 'telegram') {
        const handle = segments[0] || '';
        name = handle ? (handle.startsWith('@') ? handle : `@${handle}`) : 'Telegram';
    } else if (platform === 'zalo') {
        name = segments[segments.length - 1] || 'Nhóm Zalo';
    } else if (platform === 'discord') {
        name = segments[segments.length - 1] || 'Discord';
    } else if (platform === 'facebook') {
        name = segments[0] || 'Facebook';
    } else {
        name = host;
    }

    return { platform, url, name: name || host, host };
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
