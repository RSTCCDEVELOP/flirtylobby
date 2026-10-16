"""SEO settings: defaults, bot lists and validation. Edit BOTS to support more crawlers."""

# group -> (label, [(key, user-agent token, label)])
BOTS = {
    "search": ("Zoekmachines", [
        ("googlebot", "Googlebot", "Google"), ("bingbot", "Bingbot", "Bing"), ("duckduckbot", "DuckDuckBot", "DuckDuckGo"),
        ("yandex", "YandexBot", "Yandex"), ("baidu", "Baiduspider", "Baidu"), ("applebot", "Applebot", "Apple (Siri, Spotlight)"),
    ]),
    "ai_search": ("AI-assistenten en AI-zoekmachines (halen live pagina's op)", [
        ("oai_search", "OAI-SearchBot", "ChatGPT Search"), ("chatgpt_user", "ChatGPT-User", "ChatGPT (gebruiker vraagt een pagina op)"),
        ("claude_user", "Claude-User", "Claude (gebruiker vraagt een pagina op)"), ("claude_search", "Claude-SearchBot", "Claude zoeken"),
        ("perplexity", "PerplexityBot", "Perplexity"),
    ]),
    "ai_training": ("AI-training (verzamelt data om modellen te trainen)", [
        ("gptbot", "GPTBot", "OpenAI GPTBot"), ("claudebot", "ClaudeBot", "Anthropic ClaudeBot"), ("anthropic_ai", "anthropic-ai", "Anthropic (anthropic-ai)"),
        ("google_extended", "Google-Extended", "Google Gemini-training"), ("applebot_ext", "Applebot-Extended", "Apple AI-training"),
        ("ccbot", "CCBot", "Common Crawl"), ("bytespider", "Bytespider", "ByteDance"), ("meta_ai", "Meta-ExternalAgent", "Meta AI"),
        ("amazonbot", "Amazonbot", "Amazon"), ("cohere", "cohere-ai", "Cohere"), ("diffbot", "Diffbot", "Diffbot"),
    ]),
    "social": ("Sociale media (linkvoorbeelden)", [
        ("facebook", "facebookexternalhit", "Facebook"), ("twitter", "Twitterbot", "X / Twitter"), ("linkedin", "LinkedInBot", "LinkedIn"),
        ("slack", "Slackbot", "Slack"), ("whatsapp", "WhatsApp", "WhatsApp"),
    ]),
    "tools": ("SEO-tools en overige crawlers", [
        ("ahrefs", "AhrefsBot", "Ahrefs"), ("semrush", "SemrushBot", "Semrush"), ("mj12", "MJ12bot", "Majestic"), ("dotbot", "DotBot", "Moz"),
    ]),
}
# AI training bots are blocked by default; everything else is allowed
BLOCKED_BY_DEFAULT = {k for k, _, _ in BOTS["ai_training"][1]} | {"mj12", "dotbot"}

DEFAULTS = {
    "site": {
        "name": "Studio2", "site_url": "", "title_template": "%s | Studio2", "default_title": "Studio2",
        "default_description": "", "default_og_media": None, "twitter": "", "theme_color": "",
        "allow_indexing": True, "ai_meta": "allow",   # allow | noai
    },
    "verification": {"google": "", "bing": "", "yandex": "", "pinterest": ""},
    "bots": {k: (k not in BLOCKED_BY_DEFAULT) for _, (_, items) in BOTS.items() for k, _, _ in items} | {"other": True},
    "robots": {"disallow": ["/dashboard", "/login"], "crawl_delay": 0, "extra": ""},
    "sitemap": {"enabled": True, "changefreq": "weekly", "priority": 0.7},
    "llms": {"enabled": True, "summary": "", "include_pages": True, "extra": ""},
    "schema": {"enabled": True, "type": "Organization", "legal_name": "", "description": "", "email": "", "phone": "", "same_as": []},
}
KNOWN_PAGES = [("/", "Homepage", None), ("/privacy", "Privacybeleid", "privacy_pages"), ("/cookies", "Cookiebeleid", "privacy_pages")]
FREQ = ["always", "hourly", "daily", "weekly", "monthly", "yearly", "never"]
SCHEMA_TYPES = ["Organization", "LocalBusiness", "Person", "EducationalOrganization", "ProfessionalService"]
