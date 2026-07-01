/* Ting! - Platform plan/tag catalog */
(function () {
    const COMMON_PLAN_TAGS = [
        'Free', 'Trial', 'Basic', 'Standard', 'Premium', 'Pro', 'Plus',
        'Family', 'Team', 'Business', 'Enterprise', 'Student', 'Lifetime',
        'Monthly', 'Yearly', 'Shared', 'Credit',
    ];

    const PLATFORM_PLAN_TAGS = {
        google: ['Personal', 'Workspace', 'Family', 'One', 'Storage', '100GB', '200GB', '2TB', 'Business Starter', 'Business Standard'],
        'google-account': ['Personal', 'Workspace', 'Family', 'One', 'Storage'],
        googledrive: ['100GB', '200GB', '2TB', '5TB', 'Workspace', 'Business Standard'],
        'google-ai': ['Free', 'Pro', 'Advanced', 'AI Ultra'],
        'gemini-pro': ['Gemini Pro', 'Gemini Advanced', 'AI Pro', 'AI Ultra', 'Family'],
        'google-veo': ['Veo 3', 'Flow', 'AI Pro', 'AI Ultra', 'Credit'],
        'google-antigravity': ['Free', 'Pro', 'Preview', 'Workspace'],
        googlecloud: ['Free Trial', 'Pay-as-you-go', 'Workspace', 'Credit'],

        openai: ['Free', 'Go', 'Plus', 'Pro', 'Business', 'Team', 'Enterprise', 'API Credit'],
        claude: ['Free', 'Pro', 'Max 5x', 'Max 20x', 'Team', 'Enterprise'],
        anthropic: ['Free', 'Pro', 'Max 5x', 'Max 20x', 'Team', 'Enterprise', 'API Credit'],
        perplexity: ['Free', 'Pro', 'Enterprise Pro'],
        midjourney: ['Basic', 'Standard', 'Pro', 'Mega'],
        suno: ['Free', 'Pro', 'Premier'],
        cursor: ['Free', 'Pro', 'Ultra', 'Team', 'Business'],
        replit: ['Free', 'Core', 'Teams'],
        huggingface: ['Free', 'Pro', 'Team', 'Enterprise'],
        deepseek: ['Free', 'Pro', 'Team', 'Enterprise', 'Credit'],
        mistralai: ['Free', 'Pro', 'Team', 'Enterprise', 'Credit'],
        elevenlabs: ['Free', 'Starter', 'Creator', 'Pro', 'Scale', 'Business', 'Credit'],
        replicate: ['Free', 'Pro', 'Team', 'Enterprise', 'Credit'],
        poe: ['Free', 'Subscription', 'Credit'],
        deepl: ['Free', 'Starter', 'Advanced', 'Ultimate', 'Team'],
        grammarly: ['Free', 'Premium', 'Business', 'Enterprise'],

        kiro: ['Free', 'Pro', 'Pro+', 'Power', 'Credit'],
        grok: ['Free', 'SuperGrok', 'SuperGrok Heavy', 'API Credit'],
        windsurf: ['Free', 'Pro', 'Teams', 'Enterprise'],
        bolt: ['Free', 'Pro', 'Pro 50', 'Pro 100', 'Teams'],
        lovable: ['Free', 'Pro', 'Teams', 'Credit'],
        v0: ['Free', 'Premium', 'Team', 'Credit'],
        runway: ['Free', 'Standard', 'Pro', 'Unlimited', 'Credit'],
        luma: ['Free', 'Lite', 'Plus', 'Unlimited', 'Credit'],
        pika: ['Free', 'Standard', 'Pro', 'Fancy', 'Credit'],
        ideogram: ['Free', 'Basic', 'Plus', 'Pro', 'Credit'],
        leonardo: ['Free', 'Apprentice', 'Artisan', 'Maestro', 'Credit'],
        krea: ['Free', 'Basic', 'Pro', 'Max', 'Credit'],
        kling: ['Free', 'Standard', 'Pro', 'Premier', 'Credit'],
        qwen: ['Free', 'Plus', 'Max', 'API Credit'],
        kimi: ['Free', 'Pro', 'API Credit'],
        notebooklm: ['Free', 'Plus', 'AI Pro', 'AI Ultra'],
        manus: ['Free', 'Starter', 'Pro', 'Team', 'Credit'],
        flux: ['Free', 'Pro', 'Max', 'Credit'],
        udio: ['Free', 'Standard', 'Pro', 'Credit'],
        gamma: ['Free', 'Plus', 'Pro', 'Credit'],
        genspark: ['Free', 'Plus', 'Pro', 'Credit'],
        characterai: ['Free', 'c.ai+', 'Plus'],
        jasper: ['Free', 'Creator', 'Pro', 'Business'],

        netflix: ['Ads', 'Basic', 'Standard', 'Premium', 'Extra Member'],
        spotify: ['Free', 'Individual', 'Duo', 'Family', 'Student'],
        youtube: ['Free', 'Premium Individual', 'Premium Family', 'Music Premium'],
        disneyplus: ['Basic', 'Standard', 'Premium'],
        primevideo: ['Prime', 'Ad-Free', 'Channel Add-on'],
        appletv: ['Individual', 'Family', 'Apple One', 'iCloud+'],
        apple: ['Individual', 'Family', 'Apple One', 'iCloud+'],
        hulu: ['Ads', 'No Ads', 'Live TV', 'Bundle'],
        twitch: ['Turbo', 'Sub Tier 1', 'Sub Tier 2', 'Sub Tier 3'],

        canva: ['Free', 'Pro', 'Teams', 'Enterprise', 'Education'],
        capcut: ['Free', 'Pro', 'Business'],
        adobe: ['Single App', 'All Apps', 'Photography', 'Creative Cloud Pro', 'Student'],
        figma: ['Free', 'Professional', 'Organization', 'Enterprise'],
        notion: ['Free', 'Plus', 'Business', 'Enterprise', 'AI'],
        zoom: ['Basic', 'Pro', 'Business', 'Enterprise'],
        microsoft: ['Personal', 'Family', 'Business Basic', 'Business Standard', 'Business Premium'],
        office365: ['Personal', 'Family', 'Business Basic', 'Business Standard', 'Business Premium'],
        slack: ['Free', 'Pro', 'Business+', 'Enterprise Grid'],
        trello: ['Free', 'Standard', 'Premium', 'Enterprise'],
        dropbox: ['Basic', 'Plus', 'Family', 'Professional', 'Business'],
        airtable: ['Free', 'Team', 'Business', 'Enterprise'],
        miro: ['Free', 'Starter', 'Business', 'Enterprise'],
        asana: ['Personal', 'Starter', 'Advanced', 'Enterprise'],
        linear: ['Free', 'Basic', 'Business', 'Enterprise'],

        github: ['Free', 'Pro', 'Team', 'Enterprise', 'Copilot Individual', 'Copilot Business'],
        gitlab: ['Free', 'Premium', 'Ultimate'],
        bitbucket: ['Free', 'Standard', 'Premium'],
        vercel: ['Hobby', 'Pro', 'Enterprise'],
        netlify: ['Free', 'Pro', 'Business', 'Enterprise'],
        cloudflare: ['Free', 'Pro', 'Business', 'Enterprise'],
        firebase: ['Spark', 'Blaze'],
        supabase: ['Free', 'Pro', 'Team', 'Enterprise'],
        mongodb: ['Free', 'Serverless', 'Dedicated', 'Enterprise'],
        wordpress: ['Free', 'Personal', 'Premium', 'Business', 'Commerce'],
        shopify: ['Basic', 'Grow', 'Advanced', 'Plus'],
        stripe: ['Standard', 'Custom', 'Connect'],

        discord: ['Free', 'Nitro Basic', 'Nitro'],
        telegram: ['Free', 'Premium'],
        whatsapp: ['Free', 'Business'],
        x: ['Free', 'Premium', 'Premium+'],
        facebook: ['Free', 'Meta Verified'],
        instagram: ['Free', 'Meta Verified'],
        linkedin: ['Free', 'Premium Career', 'Sales Navigator', 'Business'],
        reddit: ['Free', 'Premium'],
        pinterest: ['Free', 'Business'],
        '1password': ['Individual', 'Families', 'Teams', 'Business'],
        lastpass: ['Free', 'Premium', 'Families', 'Teams', 'Business'],
        proton: ['Free', 'Mail Plus', 'Unlimited', 'Family', 'Business'],
        protonmail: ['Free', 'Mail Plus', 'Unlimited', 'Family', 'Business'],
        coursera: ['Free', 'Plus', 'Business'],
        udemy: ['Free', 'Personal Plan', 'Business'],
        duolingo: ['Free', 'Super', 'Max', 'Family'],

        // --- Vietnam apps ---
        vneid: ['Mức 1', 'Mức 2', 'Định danh'],
        vssid: ['Cá nhân', 'BHXH', 'BHYT'],
        dichvucong: ['Cá nhân', 'Doanh nghiệp'],
        momo: ['Cá nhân', 'Ví Trả Sau', 'Doanh nghiệp'],
        zalopay: ['Cá nhân', 'Doanh nghiệp'],
        vnpay: ['Cá nhân', 'Doanh nghiệp'],
        viettelmoney: ['Cá nhân', 'Doanh nghiệp'],
        vietcombank: ['Cá nhân', 'Doanh nghiệp', 'Priority'],
        techcombank: ['Cá nhân', 'Inspire', 'Priority', 'Doanh nghiệp'],
        bidv: ['Cá nhân', 'Doanh nghiệp'],
        mbbank: ['Cá nhân', 'Private', 'Doanh nghiệp'],
        vpbank: ['Cá nhân', 'Diamond', 'Doanh nghiệp'],
        acb: ['Cá nhân', 'Privilege', 'Doanh nghiệp'],
        tpbank: ['Cá nhân', 'Doanh nghiệp'],
        agribank: ['Cá nhân', 'Doanh nghiệp'],
        vietinbank: ['Cá nhân', 'Doanh nghiệp'],
        sacombank: ['Cá nhân', 'Doanh nghiệp'],
        shopee: ['Cá nhân', 'Shopee Mall', 'Người bán'],
        lazada: ['Cá nhân', 'LazMall', 'Người bán'],
        tiki: ['Cá nhân', 'TikiNOW', 'Người bán'],
        grab: ['Cá nhân', 'GrabUnlimited', 'Tài xế'],
        be: ['Cá nhân', 'beExtra', 'Tài xế'],
        gojek: ['Cá nhân', 'Tài xế'],
        zingmp3: ['Free', 'VIP', 'Premium'],
        nhaccuatui: ['Free', 'VIP', 'Premium'],
        fptplay: ['Free', 'FPT Play', 'Thể thao', 'K+'],
        vieon: ['Free', 'VIP', 'Premium'],
        galaxyplay: ['Free', 'VIP', 'Premium'],
        kplus: ['Truyền hình', 'K+ App', 'Thể thao'],
        viettel: ['Trả trước', 'Trả sau', 'Data'],
        vinaphone: ['Trả trước', 'Trả sau', 'Data'],
        mobifone: ['Trả trước', 'Trả sau', 'Data'],
        vng: ['Cá nhân', 'Game'],
        garena: ['Cá nhân', 'Free Fire', 'Liên Quân'],
    };

    const TAG_TONE_RULES = [
        { className: 'tag-enterprise', keys: ['enterprise', 'enterprise pro', 'enterprise grid'] },
        { className: 'tag-free', keys: ['free', 'trial', 'hobby', 'spark', 'ads'] },
        { className: 'tag-standard', keys: ['basic', 'standard', 'starter', 'individual', 'personal', 'go'] },
        { className: 'tag-premium', keys: ['premium', 'plus', 'pro', 'advanced', 'ultra', 'max', 'premier', 'mega'] },
        { className: 'tag-family', keys: ['family', 'duo', 'extra member', 'student'] },
        { className: 'tag-team', keys: ['team', 'teams', 'business', 'workspace', 'organization'] },
        { className: 'tag-credit', keys: ['credit', 'api', 'pay as you go', 'pay-as-you-go', 'blaze'] },
        { className: 'tag-lifetime', keys: ['lifetime'] },
    ];

    function normalizeTagText(value) {
        return String(value || '')
            .trim()
            .replace(/\s+/g, ' ');
    }

    function normalizeTagKey(value) {
        if (typeof normalizeSearchText === 'function') return normalizeSearchText(value);
        return String(value || '').toLowerCase().trim();
    }

    function uniqueTags(tags = []) {
        const seen = new Set();
        const result = [];
        tags.forEach(tag => {
            const value = normalizeTagText(tag);
            const key = normalizeTagKey(value);
            if (!value || seen.has(key)) return;
            seen.add(key);
            result.push(value);
        });
        return result;
    }

    function getSuggestedTagsForPlatform(platformOrAccount, accountName = '') {
        const platform = typeof getResolvedPlatform === 'function'
            ? (getResolvedPlatform(platformOrAccount) || getResolvedPlatform({ name: accountName }))
            : (typeof platformOrAccount === 'string' ? platformOrAccount : platformOrAccount?.platform);
        const name = normalizeTagKey(accountName || (typeof platformOrAccount === 'object' ? platformOrAccount?.name : ''));
        const platformTags = PLATFORM_PLAN_TAGS[platform] || [];
        const inferred = [];

        Object.entries(PLATFORM_PLAN_TAGS).forEach(([key, tags]) => {
            if (platform === key) return;
            if (name && normalizeTagKey(key).split(' ').some(part => part && name.includes(part))) inferred.push(...tags);
        });

        COMMON_PLAN_TAGS.forEach(tag => {
            const key = normalizeTagKey(tag);
            if (key && name.includes(key)) inferred.unshift(tag);
        });

        return uniqueTags([...platformTags, ...inferred, ...COMMON_PLAN_TAGS]);
    }

    function getTagToneClass(tag) {
        const key = normalizeTagKey(tag);
        const rule = TAG_TONE_RULES.find(item => item.keys.some(ruleKey => key.includes(ruleKey)));
        return rule?.className || 'tag-default';
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

    function renderTagChip(tag, options = {}) {
        const safe = htmlEscape(tag);
        const tone = getTagToneClass(tag);
        const removable = options.removable;
        const handler = options.removeHandler || 'removeAddTag';
        const tagArg = typeof escapeJsAttr === 'function'
            ? escapeJsAttr(tag)
            : htmlEscape(String(tag).replace(/\\/g, '\\\\').replace(/'/g, "\\'"));
        const onclick = removable ? ` onclick="${handler}('${tagArg}')"` : '';
        return `<span class="account-tag-chip ${tone}">${safe}${removable ? `<button type="button" class="tag-remove"${onclick} aria-label="Remove ${safe}">×</button>` : ''}</span>`;
    }

    function renderAccountTags(tags = [], options = {}) {
        const values = uniqueTags(tags);
        if (!values.length) return '';
        const limit = options.limit ?? values.length;
        const visible = values.slice(0, limit);
        const extra = values.length - visible.length;
        const chips = visible.map(tag => renderTagChip(tag, options)).join('');
        return `<div class="account-tag-row ${options.className || ''}">${chips}${extra > 0 ? `<span class="account-tag-chip tag-more">+${extra}</span>` : ''}</div>`;
    }

    function getAllAccountTags(accounts = []) {
        return uniqueTags(accounts.flatMap(acc => acc?.tags || []))
            .sort((a, b) => a.localeCompare(b, 'vi'));
    }

    function accountMatchesTag(acc, tag) {
        const target = normalizeTagKey(tag);
        if (!target) return true;
        return uniqueTags(acc?.tags || []).some(value => normalizeTagKey(value) === target);
    }

    const root = typeof globalThis !== 'undefined' ? globalThis : window;
    root.COMMON_PLAN_TAGS = COMMON_PLAN_TAGS;
    root.PLATFORM_PLAN_TAGS = PLATFORM_PLAN_TAGS;
    root.normalizeTagText = normalizeTagText;
    root.normalizeTagKey = normalizeTagKey;
    root.normalizeTags = uniqueTags;
    root.getSuggestedTagsForPlatform = getSuggestedTagsForPlatform;
    root.getTagToneClass = getTagToneClass;
    root.renderTagChip = renderTagChip;
    root.renderAccountTags = renderAccountTags;
    root.getAllAccountTags = getAllAccountTags;
    root.accountMatchesTag = accountMatchesTag;
})();
