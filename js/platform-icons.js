/* Ting! - Offline platform icon helpers */
(function () {
    const ICON_BASE = '/assets/platform-icons/';
    const ICONS = {
        netflix: { label: 'Netflix', color: '#E50914' },
        spotify: { label: 'Spotify', color: '#1DB954' },
        youtube: { label: 'YouTube', color: '#FF0000' },
        disneyplus: { label: 'Disney+', color: '#113CCF' },
        primevideo: { label: 'Prime Video', color: '#00A8E1' },
        hulu: { label: 'Hulu', color: '#1CE783' },
        appletv: { label: 'Apple TV', color: '#000000' },
        twitch: { label: 'Twitch', color: '#9146FF' },
        tiktok: { label: 'TikTok', color: '#000000' },
        instagram: { label: 'Instagram', color: '#E4405F' },
        facebook: { label: 'Facebook', color: '#0866FF' },
        zalo: { label: 'Zalo', color: '#0068FF', mark: 'Za' },
        x: { label: 'X', color: '#000000' },
        telegram: { label: 'Telegram', color: '#26A5E4' },
        whatsapp: { label: 'WhatsApp', color: '#25D366' },
        discord: { label: 'Discord', color: '#5865F2' },
        reddit: { label: 'Reddit', color: '#FF4500' },
        linkedin: { label: 'LinkedIn', color: '#0A66C2' },
        pinterest: { label: 'Pinterest', color: '#BD081C' },
        canva: { label: 'Canva', color: '#00C4CC' },
        capcut: { label: 'CapCut', color: '#000000' },
        adobe: { label: 'Adobe', color: '#FF0000' },
        figma: { label: 'Figma', color: '#F24E1E' },
        notion: { label: 'Notion', color: '#000000' },
        zoom: { label: 'Zoom', color: '#0B5CFF' },
        slack: { label: 'Slack', color: '#4A154B' },
        trello: { label: 'Trello', color: '#0052CC' },
        dropbox: { label: 'Dropbox', color: '#0061FF' },
        googledrive: { label: 'Google Drive', color: '#1A73E8' },
        gmail: { label: 'Gmail', color: '#EA4335' },
        google: { label: 'Google', color: '#4285F4' },
        'google-account': { label: 'Google Account', color: '#4285F4', file: 'google.svg' },
        'gemini-pro': { label: 'Gemini Pro', color: '#4285F4', file: 'google-ai.svg' },
        'google-veo': { label: 'Veo 3', color: '#4285F4', file: 'google-ai.svg' },
        'google-antigravity': { label: 'Antigravity', color: '#4285F4', file: 'google-ai.svg' },
        microsoft: { label: 'Microsoft', color: '#5E5E5E' },
        office365: { label: 'Microsoft 365', color: '#D83B01' },
        apple: { label: 'Apple', color: '#000000' },
        github: { label: 'GitHub', color: '#181717' },
        gitlab: { label: 'GitLab', color: '#FC6D26' },
        bitbucket: { label: 'Bitbucket', color: '#0052CC' },
        wordpress: { label: 'WordPress', color: '#21759B' },
        shopify: { label: 'Shopify', color: '#7AB55C' },
        paypal: { label: 'PayPal', color: '#003087' },
        stripe: { label: 'Stripe', color: '#635BFF' },
        cloudflare: { label: 'Cloudflare', color: '#F38020' },
        vercel: { label: 'Vercel', color: '#000000' },
        netlify: { label: 'Netlify', color: '#00C7B7' },
        openai: { label: 'ChatGPT / OpenAI', color: '#10A37F' },
        anthropic: { label: 'Anthropic', color: '#191919' },
        claude: { label: 'Claude', color: '#D97757' },
        'google-ai': { label: 'Gemini', color: '#4285F4' },
        perplexity: { label: 'Perplexity', color: '#1FB8CD' },
        cursor: { label: 'Cursor', color: '#000000' },
        replit: { label: 'Replit', color: '#F26207' },
        huggingface: { label: 'Hugging Face', color: '#FFD21E' },
        midjourney: { label: 'Midjourney', color: '#000000' },
        suno: { label: 'Suno', color: '#6C5CE7' },
        stabilityai: { label: 'Stability AI', color: '#000000' },
        ollama: { label: 'Ollama', color: '#000000' },
        deepseek: { label: 'DeepSeek', color: '#4D6BFE' },
        mistralai: { label: 'Mistral AI', color: '#FA520F' },
        elevenlabs: { label: 'ElevenLabs', color: '#000000' },
        replicate: { label: 'Replicate', color: '#000000' },
        poe: { label: 'Poe', color: '#5D5CDE' },
        deepl: { label: 'DeepL', color: '#0F2B46' },
        grammarly: { label: 'Grammarly', color: '#15C39A' },
        zapier: { label: 'Zapier', color: '#FF4A00' },
        make: { label: 'Make', color: '#6D00CC' },
        n8n: { label: 'n8n', color: '#EA4B71' },
        todoist: { label: 'Todoist', color: '#E44332' },
        '1password': { label: '1Password', color: '#3B66BC' },
        lastpass: { label: 'LastPass', color: '#D32D27' },
        proton: { label: 'Proton', color: '#6D4AFF' },
        protonmail: { label: 'Proton Mail', color: '#6D4AFF' },
        coursera: { label: 'Coursera', color: '#0056D2' },
        udemy: { label: 'Udemy', color: '#A435F0' },
        duolingo: { label: 'Duolingo', color: '#58CC02' },
        linear: { label: 'Linear', color: '#5E6AD2' },
        asana: { label: 'Asana', color: '#F06A6A' },
        airtable: { label: 'Airtable', color: '#18BFFF' },
        miro: { label: 'Miro', color: '#050038' },
        firebase: { label: 'Firebase', color: '#DD2C00' },
        googlecloud: { label: 'Google Cloud', color: '#4285F4' },
        mongodb: { label: 'MongoDB', color: '#47A248' },
        supabase: { label: 'Supabase', color: '#3FCF8E' },
        // --- Browsers ---
        ucbrowser: { label: 'UC Browser', color: '#FF6D00' },
        googlechrome: { label: 'Google Chrome', color: '#4285F4' },
        firefox: { label: 'Firefox', color: '#FF7139' },
        brave: { label: 'Brave', color: '#FB542B' },
        opera: { label: 'Opera', color: '#FF1B2D' },
        microsoftedge: { label: 'Microsoft Edge', color: '#0078D7' },
        safari: { label: 'Safari', color: '#006CFF' },
        // --- Social (new) ---
        snapchat: { label: 'Snapchat', color: '#FFFC00' },
        threads: { label: 'Threads', color: '#000000' },
        mastodon: { label: 'Mastodon', color: '#6364FF' },
        signal: { label: 'Signal', color: '#3A76F0' },
        line: { label: 'LINE', color: '#00C300' },
        wechat: { label: 'WeChat', color: '#07C160' },
        viber: { label: 'Viber', color: '#7360F2' },
        // --- Streaming (new) ---
        youtubemusic: { label: 'YouTube Music', color: '#FF0000' },
        crunchyroll: { label: 'Crunchyroll', color: '#F47521' },
        // --- Design (new) ---
        sketch: { label: 'Sketch', color: '#F7B500' },
        // --- Cloud (new) ---
        onedrive: { label: 'OneDrive', color: '#0078D4' },
        icloud: { label: 'iCloud', color: '#3693F3' },
        // --- Dev (new) ---
        stackoverflow: { label: 'Stack Overflow', color: '#F58025' },
        docker: { label: 'Docker', color: '#2496ED' },
        npm: { label: 'npm', color: '#CB3837' },
        jira: { label: 'Jira', color: '#0052CC' },
        // --- E-commerce (new) ---
        amazon: { label: 'Amazon', color: '#FF9900' },
        ebay: { label: 'eBay', color: '#E53238' },
        wise: { label: 'Wise', color: '#00B9FF' },
        // --- Hosting (new) ---
        digitalocean: { label: 'DigitalOcean', color: '#0080FF' },
        heroku: { label: 'Heroku', color: '#430098' },
        // --- AI (new) ---
        copilot: { label: 'Microsoft Copilot', color: '#6264A7' },
        // --- Security (new) ---
        bitwarden: { label: 'Bitwarden', color: '#175DDC' },
        // --- Gaming (new) ---
        steam: { label: 'Steam', color: '#000000' },
        epicgames: { label: 'Epic Games', color: '#313131' },
        roblox: { label: 'Roblox', color: '#000000' },
        // --- Backend (new) ---
        aws: { label: 'AWS', color: '#FF9900' },
    };

    const ALIASES = {
        chatgpt: 'openai',
        gpt: 'openai',
        gemini: 'google-ai',
        googlegemini: 'google-ai',
        bard: 'google-ai',
        googlebard: 'google-ai',
        googleone: 'google',
        googleaccount: 'google-account',
        googlepersonal: 'google-account',
        accgoogle: 'google-account',
        taikhoangoogle: 'google-account',
        googlecanhan: 'google-account',
        geminipro: 'gemini-pro',
        geminiadvanced: 'gemini-pro',
        googlegeminipro: 'gemini-pro',
        veo: 'google-veo',
        veo3: 'google-veo',
        googleveo: 'google-veo',
        googleveo3: 'google-veo',
        antigravity: 'google-antigravity',
        googleantigravity: 'google-antigravity',
        gdrive: 'googledrive',
        drive: 'googledrive',
        microsoft365: 'office365',
        office: 'office365',
        office365: 'office365',
        ms365: 'office365',
        twitter: 'x',
        zalochat: 'zalo',
        zaloapp: 'zalo',
        prime: 'primevideo',
        amazonprime: 'primevideo',
        amazonprimevideo: 'primevideo',
        disney: 'disneyplus',
        disneyplus: 'disneyplus',
        apple_tv: 'appletv',
        appletvplus: 'appletv',
        hf: 'huggingface',
        hugging_face: 'huggingface',
        anthropicclaude: 'claude',
        mistral: 'mistralai',
        eleven: 'elevenlabs',
        eleven_labs: 'elevenlabs',
        proton_mail: 'protonmail',
        google_cloud: 'googlecloud',
        gcp: 'googlecloud',
        // --- New aliases ---
        uc: 'ucbrowser',
        ucweb: 'ucbrowser',
        chrome: 'googlechrome',
        edge: 'microsoftedge',
        msedge: 'microsoftedge',
        firefoxbrowser: 'firefox',
        snap: 'snapchat',
        ytmusic: 'youtubemusic',
        youtube_music: 'youtubemusic',
        microsoftonedrive: 'onedrive',
        stack_overflow: 'stackoverflow',
        epic: 'epicgames',
        epic_games: 'epicgames',
        amazonwebservices: 'aws',
        microsoftcopilot: 'copilot',
        githubcopilot: 'copilot',
        digital_ocean: 'digitalocean',
        wechatapp: 'wechat',
        weixin: 'wechat',
    };

    function cleanPlatformKey(value) {
        const raw = String(value || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/&/g, 'and')
            .replace(/\+/g, 'plus')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        return ALIASES[raw] || ALIASES[raw.replace(/-/g, '')] || raw;
    }

    function resolvePlatformKey(platformOrAccount) {
        const rawPlatform = typeof platformOrAccount === 'string'
            ? platformOrAccount
            : platformOrAccount?.platform;
        let key = cleanPlatformKey(rawPlatform);
        if ((!key || key === 'other') && typeof platformOrAccount === 'object' && platformOrAccount?.name && typeof detectPlatform === 'function') {
            key = cleanPlatformKey(detectPlatform(platformOrAccount.name));
        }
        return ALIASES[key] || key;
    }

    function getPlatformIconConfig(platformOrAccount) {
        const key = resolvePlatformKey(platformOrAccount);
        const config = ICONS[key];
        if (!config) return null;
        const file = config.file || `${key}.svg`;
        return {
            ...config,
            key,
            file,
            url: `${ICON_BASE}${file}`,
        };
    }

    function hexToRgba(hex, alpha = 0.12) {
        const match = String(hex || '').match(/^#?([a-f0-9]{6})$/i);
        if (!match) return `rgba(108, 92, 231, ${alpha})`;
        const intValue = parseInt(match[1], 16);
        const r = (intValue >> 16) & 255;
        const g = (intValue >> 8) & 255;
        const b = intValue & 255;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    function htmlEscape(value) {
        if (typeof escapeHtml === 'function') return escapeHtml(value);
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function getPlatformLogoStyle(platformOrAccount, seed = '') {
        const icon = getPlatformIconConfig(platformOrAccount);
        if (icon) return `background:${hexToRgba(icon.color, 0.11)};color:${icon.color}`;
        const baseColor = typeof stringToColor === 'function' ? stringToColor(seed || resolvePlatformKey(platformOrAccount) || 'platform') : '#6C5CE7';
        return `background:${baseColor}15;color:${baseColor}`;
    }

    function renderPlatformLogoMark(platformOrAccount, fallbackText = '', className = '') {
        const icon = getPlatformIconConfig(platformOrAccount);
        const extraClass = className ? ` ${htmlEscape(className)}` : '';
        if (icon) {
            if (icon.mark) {
                const style = `--platform-color:${icon.color}`;
                return `<span class="platform-logo-text${extraClass}" style="${style}" title="${htmlEscape(icon.label)}" aria-label="${htmlEscape(icon.label)}">${htmlEscape(icon.mark)}</span>`;
            }
            const style = `--platform-color:${icon.color};--platform-icon:url('${icon.url}')`;
            return `<span class="platform-logo-mask${extraClass}" style="${style}" title="${htmlEscape(icon.label)}" aria-label="${htmlEscape(icon.label)}"></span>`;
        }

        const key = resolvePlatformKey(platformOrAccount);
        const fallback = fallbackText || (typeof getPlatformEmoji === 'function' ? getPlatformEmoji(key) : '?');
        return `<span class="platform-logo-fallback${extraClass}" aria-hidden="true">${htmlEscape(fallback)}</span>`;
    }

    function renderPlatformDetect(platform) {
        const iconHtml = renderPlatformLogoMark(platform);
        const label = getPlatformIconConfig(platform)?.label || platform;
        return `<span class="platform-detect-chip"><span class="quick-select-icon" style="${getPlatformLogoStyle(platform, label)}">${iconHtml}</span> Nh&#7853;n di&#7879;n: <strong>${htmlEscape(label)}</strong></span>`;
    }

    function renderQuickPlatformChip(platform, label) {
        const safeLabel = htmlEscape(label);
        return `<span class="quick-select-icon" style="${getPlatformLogoStyle(platform, label)}">${renderPlatformLogoMark(platform)}</span><span>${safeLabel}</span>`;
    }

    const root = typeof globalThis !== 'undefined' ? globalThis : window;
    root.TING_PLATFORM_ICONS = ICONS;
    root.getPlatformIconConfig = getPlatformIconConfig;
    root.getPlatformLogoStyle = getPlatformLogoStyle;
    root.renderPlatformLogoMark = renderPlatformLogoMark;
    root.renderPlatformDetect = renderPlatformDetect;
    root.renderQuickPlatformChip = renderQuickPlatformChip;
    if (typeof window !== 'undefined' && window !== root) {
        window.TING_PLATFORM_ICONS = ICONS;
        window.getPlatformIconConfig = getPlatformIconConfig;
        window.getPlatformLogoStyle = getPlatformLogoStyle;
        window.renderPlatformLogoMark = renderPlatformLogoMark;
        window.renderPlatformDetect = renderPlatformDetect;
        window.renderQuickPlatformChip = renderQuickPlatformChip;
    }
})();
