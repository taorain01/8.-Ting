const fs = require('fs');
const https = require('https');
const path = require('path');

const SIMPLE_ICONS_VERSION = '16.16.0';
const ICON_DIR = path.join(__dirname, '..', 'assets', 'platform-icons');
const BASE_URLS = [
    `https://cdn.jsdelivr.net/npm/simple-icons@${SIMPLE_ICONS_VERSION}/icons/`,
    'https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/',
];

const ICONS = [
    { key: 'netflix', label: 'Netflix', color: '#E50914', slugs: ['netflix'] },
    { key: 'spotify', label: 'Spotify', color: '#1DB954', slugs: ['spotify'] },
    { key: 'youtube', label: 'YouTube', color: '#FF0000', slugs: ['youtube'] },
    { key: 'disneyplus', label: 'Disney+', color: '#113CCF', slugs: ['disneyplus'] },
    { key: 'primevideo', label: 'Prime Video', color: '#00A8E1', slugs: ['primevideo', 'amazonprime'] },
    { key: 'hulu', label: 'Hulu', color: '#1CE783', slugs: ['hulu'] },
    { key: 'appletv', label: 'Apple TV', color: '#000000', slugs: ['appletv'] },
    { key: 'twitch', label: 'Twitch', color: '#9146FF', slugs: ['twitch'] },
    { key: 'tiktok', label: 'TikTok', color: '#000000', slugs: ['tiktok'] },
    { key: 'instagram', label: 'Instagram', color: '#E4405F', slugs: ['instagram'] },
    { key: 'facebook', label: 'Facebook', color: '#0866FF', slugs: ['facebook'] },
    { key: 'x', label: 'X', color: '#000000', slugs: ['x'] },
    { key: 'telegram', label: 'Telegram', color: '#26A5E4', slugs: ['telegram'] },
    { key: 'whatsapp', label: 'WhatsApp', color: '#25D366', slugs: ['whatsapp'] },
    { key: 'discord', label: 'Discord', color: '#5865F2', slugs: ['discord'] },
    { key: 'reddit', label: 'Reddit', color: '#FF4500', slugs: ['reddit'] },
    { key: 'linkedin', label: 'LinkedIn', color: '#0A66C2', slugs: ['linkedin'] },
    { key: 'pinterest', label: 'Pinterest', color: '#BD081C', slugs: ['pinterest'] },
    { key: 'canva', label: 'Canva', color: '#00C4CC', slugs: ['canva'] },
    { key: 'capcut', label: 'CapCut', color: '#000000', slugs: ['capcut'] },
    { key: 'adobe', label: 'Adobe', color: '#FF0000', slugs: ['adobe'] },
    { key: 'figma', label: 'Figma', color: '#F24E1E', slugs: ['figma'] },
    { key: 'notion', label: 'Notion', color: '#000000', slugs: ['notion'] },
    { key: 'zoom', label: 'Zoom', color: '#0B5CFF', slugs: ['zoom'] },
    { key: 'slack', label: 'Slack', color: '#4A154B', slugs: ['slack'] },
    { key: 'trello', label: 'Trello', color: '#0052CC', slugs: ['trello'] },
    { key: 'dropbox', label: 'Dropbox', color: '#0061FF', slugs: ['dropbox'] },
    { key: 'googledrive', label: 'Google Drive', color: '#1A73E8', slugs: ['googledrive'] },
    { key: 'gmail', label: 'Gmail', color: '#EA4335', slugs: ['gmail'] },
    { key: 'google', label: 'Google', color: '#4285F4', slugs: ['google'] },
    { key: 'microsoft', label: 'Microsoft', color: '#5E5E5E', slugs: ['microsoft'] },
    { key: 'office365', label: 'Microsoft 365', color: '#D83B01', slugs: ['microsoft365', 'microsoftoffice'] },
    { key: 'apple', label: 'Apple', color: '#000000', slugs: ['apple'] },
    { key: 'github', label: 'GitHub', color: '#181717', slugs: ['github'] },
    { key: 'gitlab', label: 'GitLab', color: '#FC6D26', slugs: ['gitlab'] },
    { key: 'bitbucket', label: 'Bitbucket', color: '#0052CC', slugs: ['bitbucket'] },
    { key: 'wordpress', label: 'WordPress', color: '#21759B', slugs: ['wordpress'] },
    { key: 'shopify', label: 'Shopify', color: '#7AB55C', slugs: ['shopify'] },
    { key: 'paypal', label: 'PayPal', color: '#003087', slugs: ['paypal'] },
    { key: 'stripe', label: 'Stripe', color: '#635BFF', slugs: ['stripe'] },
    { key: 'cloudflare', label: 'Cloudflare', color: '#F38020', slugs: ['cloudflare'] },
    { key: 'vercel', label: 'Vercel', color: '#000000', slugs: ['vercel'] },
    { key: 'netlify', label: 'Netlify', color: '#00C7B7', slugs: ['netlify'] },
    { key: 'openai', label: 'ChatGPT / OpenAI', color: '#10A37F', slugs: ['openai'] },
    { key: 'anthropic', label: 'Anthropic', color: '#191919', slugs: ['anthropic'] },
    { key: 'claude', label: 'Claude', color: '#D97757', slugs: ['claude'] },
    { key: 'google-ai', label: 'Gemini', color: '#4285F4', slugs: ['googlegemini', 'googlebard'] },
    { key: 'perplexity', label: 'Perplexity', color: '#1FB8CD', slugs: ['perplexity'] },
    { key: 'cursor', label: 'Cursor', color: '#000000', slugs: ['cursor'] },
    { key: 'replit', label: 'Replit', color: '#F26207', slugs: ['replit'] },
    { key: 'huggingface', label: 'Hugging Face', color: '#FFD21E', slugs: ['huggingface'] },
    { key: 'midjourney', label: 'Midjourney', color: '#000000', slugs: ['midjourney'] },
    { key: 'suno', label: 'Suno', color: '#6C5CE7', slugs: ['suno'] },
    { key: 'stabilityai', label: 'Stability AI', color: '#000000', slugs: ['stabilityai'] },
    { key: 'ollama', label: 'Ollama', color: '#000000', slugs: ['ollama'] },
    { key: 'deepseek', label: 'DeepSeek', color: '#4D6BFE', slugs: ['deepseek', 'deepseekai'] },
    { key: 'mistralai', label: 'Mistral AI', color: '#FA520F', slugs: ['mistralai'] },
    { key: 'elevenlabs', label: 'ElevenLabs', color: '#000000', slugs: ['elevenlabs'] },
    { key: 'replicate', label: 'Replicate', color: '#000000', slugs: ['replicate'] },
    { key: 'poe', label: 'Poe', color: '#5D5CDE', slugs: ['poe', 'quora'] },
    { key: 'deepl', label: 'DeepL', color: '#0F2B46', slugs: ['deepl'] },
    { key: 'grammarly', label: 'Grammarly', color: '#15C39A', slugs: ['grammarly'] },
    { key: 'zapier', label: 'Zapier', color: '#FF4A00', slugs: ['zapier'] },
    { key: 'make', label: 'Make', color: '#6D00CC', slugs: ['make'] },
    { key: 'n8n', label: 'n8n', color: '#EA4B71', slugs: ['n8n'] },
    { key: 'todoist', label: 'Todoist', color: '#E44332', slugs: ['todoist'] },
    { key: '1password', label: '1Password', color: '#3B66BC', slugs: ['1password'] },
    { key: 'lastpass', label: 'LastPass', color: '#D32D27', slugs: ['lastpass'] },
    { key: 'proton', label: 'Proton', color: '#6D4AFF', slugs: ['proton'] },
    { key: 'protonmail', label: 'Proton Mail', color: '#6D4AFF', slugs: ['protonmail'] },
    { key: 'coursera', label: 'Coursera', color: '#0056D2', slugs: ['coursera'] },
    { key: 'udemy', label: 'Udemy', color: '#A435F0', slugs: ['udemy'] },
    { key: 'duolingo', label: 'Duolingo', color: '#58CC02', slugs: ['duolingo'] },
    { key: 'linear', label: 'Linear', color: '#5E6AD2', slugs: ['linear'] },
    { key: 'asana', label: 'Asana', color: '#F06A6A', slugs: ['asana'] },
    { key: 'airtable', label: 'Airtable', color: '#18BFFF', slugs: ['airtable'] },
    { key: 'miro', label: 'Miro', color: '#050038', slugs: ['miro'] },
    { key: 'firebase', label: 'Firebase', color: '#DD2C00', slugs: ['firebase'] },
    { key: 'googlecloud', label: 'Google Cloud', color: '#4285F4', slugs: ['googlecloud'] },
    { key: 'mongodb', label: 'MongoDB', color: '#47A248', slugs: ['mongodb'] },
    { key: 'supabase', label: 'Supabase', color: '#3FCF8E', slugs: ['supabase'] },
];

function fetchText(url, redirects = 3) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'Ting icon downloader' } }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) {
                res.resume();
                const nextUrl = new URL(res.headers.location, url).toString();
                fetchText(nextUrl, redirects - 1).then(resolve, reject);
                return;
            }

            if (res.statusCode !== 200) {
                res.resume();
                resolve(null);
                return;
            }

            let body = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => { body += chunk; });
            res.on('end', () => resolve(body));
        }).on('error', reject);
    });
}

function normalizeSvg(svg, label) {
    const title = `<title>${escapeXml(label)}</title>`;
    let output = svg.replace(/<title>[\s\S]*?<\/title>/i, title);
    if (!/<title>[\s\S]*?<\/title>/i.test(output)) {
        output = output.replace(/<svg([^>]*)>/i, `<svg$1>${title}`);
    }
    if (!/\sfill=/.test(output.slice(0, 160))) {
        output = output.replace(/<svg([^>]*)>/i, '<svg$1 fill="currentColor">');
    }
    return output.trim() + '\n';
}

function fallbackSvg(icon) {
    const initials = icon.label
        .replace(/[^a-z0-9+ ]/gi, ' ')
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase() || icon.key.slice(0, 2).toUpperCase();

    return `<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
<title>${escapeXml(icon.label)}</title>
<rect x="2" y="2" width="20" height="20" rx="5" fill="currentColor"/>
<text x="12" y="15.5" text-anchor="middle" font-family="Arial, sans-serif" font-size="8" font-weight="700" fill="#fff">${escapeXml(initials)}</text>
</svg>
`;
}

function escapeXml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

async function downloadIcon(icon) {
    for (const base of BASE_URLS) {
        for (const slug of icon.slugs) {
            const url = `${base}${slug}.svg`;
            const svg = await fetchText(url);
            if (svg && svg.includes('<svg')) {
                return { svg: normalizeSvg(svg, icon.label), source: url, fallback: false };
            }
        }
    }
    return { svg: fallbackSvg(icon), source: null, fallback: true };
}

async function main() {
    fs.mkdirSync(ICON_DIR, { recursive: true });
    const manifest = {
        source: 'Simple Icons via jsDelivr',
        sourceUrl: `https://cdn.jsdelivr.net/npm/simple-icons@${SIMPLE_ICONS_VERSION}/icons/`,
        generatedAt: new Date().toISOString(),
        icons: {},
    };

    for (const icon of ICONS) {
        const result = await downloadIcon(icon);
        const fileName = `${icon.key}.svg`;
        fs.writeFileSync(path.join(ICON_DIR, fileName), result.svg, 'utf8');
        manifest.icons[icon.key] = {
            label: icon.label,
            color: icon.color,
            file: fileName,
            source: result.source || 'generated fallback',
            fallback: result.fallback,
        };
        console.log(`${result.fallback ? 'fallback' : 'downloaded'} ${fileName}`);
    }

    fs.writeFileSync(path.join(ICON_DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
