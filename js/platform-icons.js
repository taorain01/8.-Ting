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
        // --- AI tools (2026) ---
        kiro: { label: 'Kiro', color: '#8B5CF6' },
        grok: { label: 'Grok', color: '#000000', mark: 'xA' },
        windsurf: { label: 'Windsurf', color: '#09B6A2', mark: 'Wf' },
        bolt: { label: 'Bolt.new', color: '#006FEE', mark: 'Bo' },
        lovable: { label: 'Lovable', color: '#F25D5D', mark: 'Lv' },
        v0: { label: 'v0 by Vercel', color: '#000000', mark: 'v0' },
        runway: { label: 'Runway', color: '#000000', mark: 'Rw' },
        luma: { label: 'Luma AI', color: '#111111', mark: 'Lu' },
        pika: { label: 'Pika', color: '#E0115F', mark: 'Pk' },
        ideogram: { label: 'Ideogram', color: '#111111', mark: 'Id' },
        leonardo: { label: 'Leonardo AI', color: '#111111', mark: 'Le' },
        krea: { label: 'Krea AI', color: '#000000', mark: 'Kr' },
        kling: { label: 'Kling AI', color: '#111111', mark: 'Kl' },
        qwen: { label: 'Qwen', color: '#615CED', mark: 'Qw' },
        kimi: { label: 'Kimi', color: '#111111', mark: 'Ki' },
        notebooklm: { label: 'NotebookLM', color: '#1A73E8', mark: 'NL' },
        manus: { label: 'Manus', color: '#111111', mark: 'Ma' },
        flux: { label: 'Flux', color: '#000000', mark: 'Fx' },
        udio: { label: 'Udio', color: '#111111', mark: 'Ud' },
        gamma: { label: 'Gamma', color: '#7C3AED', mark: 'Ga' },
        genspark: { label: 'Genspark', color: '#111111', mark: 'Gs' },
        characterai: { label: 'Character.AI', color: '#111111', mark: 'cA' },
        jasper: { label: 'Jasper', color: '#FF7A59', mark: 'Ja' },
        // --- Security (new) ---
        bitwarden: { label: 'Bitwarden', color: '#175DDC' },
        // --- Gaming (new) ---
        steam: { label: 'Steam', color: '#000000' },
        epicgames: { label: 'Epic Games', color: '#313131' },
        roblox: { label: 'Roblox', color: '#000000' },
        // --- Backend (new) ---
        aws: { label: 'AWS', color: '#FF9900' },
        // --- Vietnam: government / identity ---
        vneid: { label: 'VNeID', color: '#0A5FBF', mark: 'eI' },
        vssid: { label: 'VssID', color: '#1A7A3D', mark: 'Vs' },
        dichvucong: { label: 'Dịch vụ công', color: '#C8102E', mark: 'DV' },
        thongbaosk: { label: 'Sổ sức khỏe điện tử', color: '#0EA5A4', mark: 'SK' },
        etax: { label: 'eTax', color: '#0B6B3A', mark: 'eT' },
        vetc: { label: 'VETC', color: '#004A98', mark: 'ET' },
        epass: { label: 'ePass', color: '#0072BC', mark: 'eP' },
        // --- Vietnam: e-wallets & payment ---
        momo: { label: 'MoMo', color: '#A50064', mark: 'Mo' },
        zalopay: { label: 'ZaloPay', color: '#0068FF', mark: 'ZP' },
        vnpay: { label: 'VNPAY', color: '#005BAA', mark: 'VP' },
        viettelmoney: { label: 'Viettel Money', color: '#EE0033', mark: 'VM' },
        shopeepay: { label: 'ShopeePay', color: '#EE4D2D', mark: 'SP' },
        // --- Vietnam: banks ---
        vietcombank: { label: 'Vietcombank', color: '#007A33', mark: 'VC' },
        techcombank: { label: 'Techcombank', color: '#E4002B', mark: 'TC' },
        bidv: { label: 'BIDV', color: '#00625D', mark: 'BI' },
        mbbank: { label: 'MB Bank', color: '#1B3D6D', mark: 'MB' },
        vpbank: { label: 'VPBank', color: '#00A54F', mark: 'VB' },
        acb: { label: 'ACB', color: '#00558C', mark: 'AC' },
        tpbank: { label: 'TPBank', color: '#582C83', mark: 'TP' },
        agribank: { label: 'Agribank', color: '#7A1E22', mark: 'AG' },
        vietinbank: { label: 'VietinBank', color: '#004A98', mark: 'CT' },
        sacombank: { label: 'Sacombank', color: '#003DA5', mark: 'ST' },
        cake: { label: 'Cake', color: '#E4007F', mark: 'Ck' },
        timo: { label: 'Timo', color: '#00C4B3', mark: 'Tm' },
        // --- Vietnam: e-commerce ---
        shopee: { label: 'Shopee', color: '#EE4D2D', mark: 'Sh' },
        lazada: { label: 'Lazada', color: '#0F146D', mark: 'Lz' },
        tiki: { label: 'Tiki', color: '#1A94FF', mark: 'Ti' },
        sendo: { label: 'Sendo', color: '#E5242A', mark: 'Se' },
        // --- Vietnam: ride & delivery ---
        grab: { label: 'Grab', color: '#00B14F', mark: 'Gr' },
        be: { label: 'Be', color: '#E0A200', mark: 'Be' },
        gojek: { label: 'Gojek', color: '#00AA13', mark: 'Go' },
        baemin: { label: 'Baemin', color: '#2AC1BC', mark: 'Ba' },
        // --- Vietnam: streaming & music ---
        zingmp3: { label: 'Zing MP3', color: '#6A5AF9', mark: 'Zi' },
        nhaccuatui: { label: 'NhacCuaTui', color: '#0072BC', mark: 'NC' },
        fptplay: { label: 'FPT Play', color: '#F37021', mark: 'FP' },
        vieon: { label: 'VieON', color: '#C99700', mark: 'Vi' },
        galaxyplay: { label: 'Galaxy Play', color: '#E4002B', mark: 'GP' },
        kplus: { label: 'K+', color: '#0098D7', mark: 'K+' },
        // --- Vietnam: telecom & internet ---
        viettel: { label: 'Viettel', color: '#EE0033', mark: 'Vt' },
        vinaphone: { label: 'VinaPhone', color: '#00539B', mark: 'Vn' },
        mobifone: { label: 'MobiFone', color: '#005BAB', mark: 'MF' },
        coccoc: { label: 'Cốc Cốc', color: '#2A7DE1', mark: 'CC' },
        // --- Vietnam: tech / gaming ---
        vng: { label: 'VNG', color: '#F05A28', mark: 'Vg' },
        garena: { label: 'Garena', color: '#EE3E38', mark: 'Gn' },
        vtcgame: { label: 'VTC Game', color: '#E11B22', mark: 'VG' },
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
        // --- Merge: Gmail is now part of Google ---
        gmail: 'google',
        googlemail: 'google',
        // --- Kiro + AI tools (2026) aliases ---
        kiroide: 'kiro',
        awskiro: 'kiro',
        grokai: 'grok',
        xai: 'grok',
        codeium: 'windsurf',
        boltnew: 'bolt',
        stackblitzbolt: 'bolt',
        lovabledev: 'lovable',
        vzero: 'v0',
        v0dev: 'v0',
        runwayml: 'runway',
        lumaai: 'luma',
        dreammachine: 'luma',
        pikalabs: 'pika',
        pikaart: 'pika',
        leonardoai: 'leonardo',
        kreaai: 'krea',
        klingai: 'kling',
        qwenai: 'qwen',
        tongyi: 'qwen',
        kimiai: 'kimi',
        moonshot: 'kimi',
        notebooklmgoogle: 'notebooklm',
        manusai: 'manus',
        fluxai: 'flux',
        blackforestlabs: 'flux',
        udioai: 'udio',
        gammaapp: 'gamma',
        gensparkai: 'genspark',
        'character-ai': 'characterai',
        characterai: 'characterai',
        jasperai: 'jasper',
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
        // --- Vietnam aliases ---
        'vn-eid': 'vneid',
        vneidapp: 'vneid',
        dinhdanhdientu: 'vneid',
        vnied: 'vneid',
        vss: 'vssid',
        vssidbhxh: 'vssid',
        bhxh: 'vssid',
        baohiemxahoi: 'vssid',
        cong: 'dichvucong',
        congdichvucong: 'dichvucong',
        dvc: 'dichvucong',
        dichvucongquocgia: 'dichvucong',
        sotuckhoe: 'thongbaosk',
        sosuckhoe: 'thongbaosk',
        sosuckhoedientu: 'thongbaosk',
        thongbao: 'thongbaosk',
        thue: 'etax',
        etaxmobile: 'etax',
        thuedientu: 'etax',
        momoapp: 'momo',
        vimomo: 'momo',
        vizalopay: 'zalopay',
        vnpayqr: 'vnpay',
        viettelpay: 'viettelmoney',
        vcb: 'vietcombank',
        vietcom: 'vietcombank',
        digibank: 'bidv',
        smartbanking: 'bidv',
        tcb: 'techcombank',
        mb: 'mbbank',
        mbmoney: 'mbbank',
        vpb: 'vpbank',
        neo: 'vpbank',
        ictg: 'vietinbank',
        vietin: 'vietinbank',
        ipay: 'vietinbank',
        agri: 'agribank',
        stb: 'sacombank',
        shopeevn: 'shopee',
        lazadavn: 'lazada',
        tikivn: 'tiki',
        grabapp: 'grab',
        beapp: 'be',
        begroup: 'be',
        gojekvn: 'gojek',
        zing: 'zingmp3',
        zingmp3app: 'zingmp3',
        nct: 'nhaccuatui',
        fpt: 'fptplay',
        fptplayvn: 'fptplay',
        vieonapp: 'vieon',
        kplusapp: 'kplus',
        kpluss: 'kplus',
        vietteltelecom: 'viettel',
        mytel: 'viettel',
        vina: 'vinaphone',
        vnpt: 'vinaphone',
        mobi: 'mobifone',
        coccocbrowser: 'coccoc',
        vnggames: 'vng',
        garenavn: 'garena',
        freefire: 'garena',
        vtc: 'vtcgame',
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
