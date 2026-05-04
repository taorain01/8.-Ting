import os
import urllib.request
import time

DOMAINS = {
    'Netflix': 'netflix.com',
    'Spotify': 'spotify.com',
    'Canva': 'canva.com',
    'YouTube': 'youtube.com',
    'ChatGPT': 'openai.com',
    'Gemini Pro': 'gemini.google.com',
    'Claude': 'anthropic.com',
    'Perplexity': 'perplexity.ai',
    'Google Account': 'google.com',
    'Google Drive': 'drive.google.com',
    'Microsoft 365': 'microsoft365.com',
    'Apple': 'apple.com',
    'Suno': 'suno.com',
    'Veo 3': 'deepmind.google',
    'Antigravity': 'deepmind.google'
}

# icon.horse is a good fallback for clearbit
def download_logo(name, domain):
    target_dir = os.path.join("assets", "icons", "platforms")
    os.makedirs(target_dir, exist_ok=True)
    filename = name.lower().replace(" ", "_") + ".png"
    filepath = os.path.join(target_dir, filename)
    
    if os.path.exists(filepath):
        print(f"[{name}] Already exists.")
        return
        
    print(f"[{name}] Downloading from {domain}...")
    
    urls = [
        f"https://logo.clearbit.com/{domain}",
        f"https://icon.horse/icon/{domain}"
    ]
    
    for url in urls:
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req) as response:
                content = response.read()
                if len(content) > 100: # Ensure it's not a tiny empty image
                    with open(filepath, 'wb') as f:
                        f.write(content)
                    print(f"  -> Success from {url}")
                    return
        except Exception as e:
            print(f"  -> Failed from {url}: {e}")
            continue
            
    print(f"  -> Could not download logo for {name}")

for name, domain in DOMAINS.items():
    download_logo(name, domain)
    time.sleep(0.5)

print("Done downloading logos.")
