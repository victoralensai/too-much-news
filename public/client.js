const socket = io();
const stream = document.getElementById('stream');
const queueCountEl = document.getElementById('queue-count');
const signalStrengthEl = document.getElementById('signal-strength');
const tickerContentEl = document.getElementById('ticker-content');
const pauseToggleEl = document.getElementById('pause-toggle');
const helpModalEl = document.getElementById('help-modal');
const faviconDynamicEl = document.getElementById('favicon-dynamic');

const MAX_DOM_ITEMS = 300;
const MAX_QUEUE_ITEMS = 20000;
const MAX_RANDOM_PICK_WINDOW = 500;
const OVERLOAD_THRESHOLD = 5000;
const HIGH_DENSITY_THRESHOLD = 1000;
const HEALTH_POLL_INTERVAL_MS = 2000;
const INITIAL_BUFFER_FUZZY_WINDOW_MS = 5000;

let newsQueue = [];
let isProcessing = false;
let droppedItemCount = 0;
const pageLoadedAtMs = Date.now();
let newestArticleAgeMs = null;
let newestArticleAgeSampledAtMs = Date.now();
let isPaused = false;
let focusedArticleIndex = -1;
let faviconIsMindblown = false;

const GLITCH_CHARS = '01$#@%&*<>?/';

if (pauseToggleEl) {
    pauseToggleEl.addEventListener('click', () => {
        togglePause();
    });
}

if (helpModalEl) {
    helpModalEl.addEventListener('click', (event) => {
        if (event.target === helpModalEl) {
            setHelpModalVisible(false);
        }
    });
}

window.addEventListener('keydown', (event) => {
    if (event.key === '?') {
        event.preventDefault();
        setHelpModalVisible(helpModalEl?.getAttribute('aria-hidden') !== 'false');
        return;
    }

    if (event.key === 'Escape') {
        setHelpModalVisible(false);
        return;
    }

    if (helpModalEl?.getAttribute('aria-hidden') === 'false') {
        return;
    }

    if (event.key === ' ') {
        event.preventDefault();
        togglePause();
        return;
    }

    if (event.key === 'ArrowUp' || event.key === 'k') {
        event.preventDefault();
        moveFocus(-1);
        return;
    }

    if (event.key === 'g') {
        event.preventDefault();
        jumpFocusToBoundary(false);
        return;
    }

    if (event.key === 'ArrowDown' || event.key === 'j') {
        event.preventDefault();
        moveFocus(1);
        return;
    }

    if (event.key === 'G') {
        event.preventDefault();
        jumpFocusToBoundary(true);
        return;
    }

    if (event.key === 'Enter') {
        event.preventDefault();
        openFocusedArticle();
    }
});

setInterval(() => {
    if (!faviconDynamicEl) {
        return;
    }

    faviconIsMindblown = !faviconIsMindblown;
    faviconDynamicEl.setAttribute('href', faviconIsMindblown ? '/favicon-mindblown.svg' : '/favicon-newspaper.svg');
}, 1000);

socket.on('connect', () => {
    updateQueueStatus();
    if (!isProcessing && newsQueue.length > 0) {
        isProcessing = true;
        processQueue();
    }
});

socket.on('disconnect', () => {
    updateQueueStatus();
});

socket.io.on('reconnect_attempt', () => {
    updateQueueStatus();
});

socket.on('connect_error', () => {
    updateQueueStatus();
});

socket.on('news-item', (item) => {
    try {
        if (!isValidNewsItem(item)) {
            return;
        }

        newsQueue.push(item);
        if (newsQueue.length > MAX_QUEUE_ITEMS) {
            const overflow = newsQueue.length - MAX_QUEUE_ITEMS;
            if (overflow > 0) {
                newsQueue.splice(0, overflow);
                droppedItemCount += overflow;
            }
        }

        updateQueueStatus();

        if (!isProcessing) {
            isProcessing = true;
            processQueue();
        }
    } catch (error) {
        console.error('[Client] Failed to queue item:', error);
    }
});

function updateQueueStatus() {
    queueCountEl.innerText = getDisplayQueueCount(newsQueue.length);

    if (newsQueue.length === 0) {
        signalStrengthEl.innerText = '🔴 Real-time';
        signalStrengthEl.style.color = '#fff';
        return;
    }

    signalStrengthEl.innerText = `Newest: ${formatAge(getEffectiveNewestArticleAgeMs())}`;
    signalStrengthEl.style.color = '#fff';
}

function togglePause() {
    isPaused = !isPaused;
    document.body.classList.toggle('paused', isPaused);
    if (pauseToggleEl) {
        pauseToggleEl.innerText = isPaused ? 'RESUME' : 'PAUSE';
        pauseToggleEl.setAttribute('aria-pressed', String(isPaused));
    }

    if (!isPaused && !isProcessing && newsQueue.length > 0) {
        isProcessing = true;
        processQueue();
    }
}

function setHelpModalVisible(isVisible) {
    if (!helpModalEl) {
        return;
    }

    helpModalEl.setAttribute('aria-hidden', isVisible ? 'false' : 'true');
}

function getNewsItemElements() {
    return Array.from(stream.querySelectorAll('.news-item'));
}

function moveFocus(delta) {
    const items = getNewsItemElements();
    if (items.length === 0) {
        focusedArticleIndex = -1;
        return;
    }

    if (focusedArticleIndex === -1) {
        focusedArticleIndex = delta > 0 ? 0 : items.length - 1;
    } else {
        focusedArticleIndex = Math.max(0, Math.min(items.length - 1, focusedArticleIndex + delta));
    }

    applyFocusedItem(items);
}

function jumpFocusToBoundary(goToLatest) {
    const items = getNewsItemElements();
    if (items.length === 0) {
        focusedArticleIndex = -1;
        return;
    }

    focusedArticleIndex = goToLatest ? items.length - 1 : 0;
    applyFocusedItem(items);
}

function applyFocusedItem(items, options) {
    const shouldScroll = options?.scroll !== false;
    const itemList = items || getNewsItemElements();
    itemList.forEach((item, index) => {
        item.classList.toggle('news-item-focused', index === focusedArticleIndex);
    });

    const focused = itemList[focusedArticleIndex];
    if (focused && shouldScroll) {
        focused.scrollIntoView({ block: 'nearest' });
    }
}

function openFocusedArticle() {
    const items = getNewsItemElements();
    if (items.length === 0) {
        return;
    }

    const normalizedIndex = Math.max(0, Math.min(items.length - 1, focusedArticleIndex));
    focusedArticleIndex = normalizedIndex;
    applyFocusedItem(items);
    const focused = items[normalizedIndex];
    const linkEl = focused.querySelector('a.news-title');
    if (linkEl && linkEl.href) {
        window.open(linkEl.href, '_blank', 'noopener,noreferrer');
    }
}

function getDisplayQueueCount(queueLength) {
    if (queueLength <= 0) {
        return '0';
    }

    const withinFuzzyWindow = Date.now() - pageLoadedAtMs <= INITIAL_BUFFER_FUZZY_WINDOW_MS;
    if (!withinFuzzyWindow) {
        return String(queueLength);
    }

    const multiplier = 0.95 + Math.random() * 0.1;
    return String(Math.max(1, Math.round(queueLength * multiplier)));
}

function getEffectiveNewestArticleAgeMs() {
    if (newestArticleAgeMs === null) {
        return null;
    }

    const elapsedSinceSample = Date.now() - newestArticleAgeSampledAtMs;
    return Math.max(0, newestArticleAgeMs + elapsedSinceSample);
}

function formatAge(ageMs) {
    if (ageMs === null) {
        return '--';
    }

    const totalSeconds = Math.floor(ageMs / 1000);
    if (totalSeconds < 60) {
        return `${totalSeconds}s ago`;
    }

    const totalMinutes = Math.floor(totalSeconds / 60);
    if (totalMinutes < 60) {
        return `${totalMinutes}m ago`;
    }

    const totalHours = Math.floor(totalMinutes / 60);
    return `${totalHours}h ago`;
}

async function refreshHealth() {
    try {
        const response = await fetch('/health', { cache: 'no-store' });
        if (!response.ok) {
            return;
        }

        const payload = await response.json();
        const nextAge = payload?.newestArticleAgeMs;
        if (typeof nextAge === 'number' || nextAge === null) {
            newestArticleAgeMs = nextAge;
            newestArticleAgeSampledAtMs = Date.now();
            updateQueueStatus();
        }
    } catch (error) {
        console.debug('[Client] Health refresh failed:', error);
    }
}

async function processQueue() {
    try {
        if (isPaused) {
            isProcessing = false;
            return;
        }

        if (newsQueue.length === 0) {
            isProcessing = false;
            return;
        }

        let count = 1;
        let baseDelay = 1000;
        const qLen = newsQueue.length;

        if (qLen > OVERLOAD_THRESHOLD) {
            count = Math.floor(Math.random() * 30) + 20;
            baseDelay = 50;
        } else if (qLen > HIGH_DENSITY_THRESHOLD) {
            count = Math.floor(Math.random() * 15) + 5;
            baseDelay = 150;
        } else if (qLen > 400) {
            count = Math.floor(Math.random() * 10) + 5;
            baseDelay = 200;
        } else if (qLen > 100) {
            count = Math.floor(Math.random() * 5) + 2;
            baseDelay = 400;
        } else {
            const burstChance = Math.random();
            if (burstChance > 0.95) count = Math.floor(Math.random() * 5) + 3;
            else if (burstChance > 0.8) count = Math.floor(Math.random() * 2) + 1;
            baseDelay = 1000;
        }

        for (let i = 0; i < count; i++) {
            if (newsQueue.length === 0) {
                break;
            }

            const item = dequeueRandomItem();
            if (!item) {
                continue;
            }

            addNewsItem(item);

            if (count > 1 && qLen < HIGH_DENSITY_THRESHOLD) {
                await new Promise((resolve) => setTimeout(resolve, 30));
            }
        }

        updateQueueStatus();
        stream.scrollTop = stream.scrollHeight;

        const nextDelay = Math.random() * baseDelay + baseDelay / 4;
        setTimeout(processQueue, nextDelay);
    } catch (error) {
        console.error('[Client] Queue processing failed:', error);
        setTimeout(processQueue, 500);
    }
}

function dequeueRandomItem() {
    if (newsQueue.length === 0) {
        return null;
    }

    const windowSize = Math.min(newsQueue.length, MAX_RANDOM_PICK_WINDOW);
    const fromTail = Math.floor(Math.random() * windowSize);
    const randomIndex = newsQueue.length - 1 - fromTail;
    const lastIndex = newsQueue.length - 1;

    const selected = newsQueue[randomIndex];
    newsQueue[randomIndex] = newsQueue[lastIndex];
    newsQueue.pop();

    return selected;
}

function scrambleText(element, originalText) {
    let iterations = 0;
    const maxIterations = 5;
    
    const interval = setInterval(() => {
        element.innerText = originalText.split("")
            .map((char, index) => {
                if (Math.random() > 0.9 && char !== " ") {
                    return GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
                }
                return char;
            })
            .join("");
        
        iterations++;
        if (iterations >= maxIterations) {
            clearInterval(interval);
            element.innerText = originalText;
        }
    }, 100);
}

function addNewsItem(item) {
    const div = document.createElement('div');
    div.className = 'news-item';
    
    const randomSize = 0.9 + Math.random() * 0.7;
    div.style.fontSize = `${randomSize}em`;

    const lowerTitle = item.title.toLowerCase();
    const isHighImpact = lowerTitle.includes('breaking') || 
                         lowerTitle.includes('live') || 
                         lowerTitle.includes('war') || 
                         lowerTitle.includes('conflict') || 
                         lowerTitle.includes('died') || 
                         lowerTitle.includes('death') || 
                         lowerTitle.includes('killed');

    if (lowerTitle.includes('breaking')) div.classList.add('breaking');
    if (lowerTitle.includes('live')) div.classList.add('live');
    if (lowerTitle.includes('war') || lowerTitle.includes('conflict')) div.classList.add('war');
    if (lowerTitle.includes('died') || lowerTitle.includes('death') || lowerTitle.includes('killed')) div.classList.add('death');

    // Rare Glitch Effects - Only triggered by high impact keywords or very rare chance
    const effectChance = Math.random();
    if (isHighImpact && effectChance > 0.7) {
        div.classList.add('glitch-flicker');
    } else if (effectChance > 0.99) { // Extremely rare for non-impact news
        div.classList.add('glitch-flicker');
    }
    
    const sourcePulseChance = Math.random();
    const sourceClass = (isHighImpact && sourcePulseChance > 0.5) || (sourcePulseChance > 0.98) 
        ? 'source source-pulse' 
        : 'source';

    const time = new Date().toLocaleTimeString();
    const timestampEl = document.createElement('span');
    timestampEl.className = 'timestamp';
    timestampEl.innerText = `[${time}]`;

    const sourceEl = document.createElement('span');
    sourceEl.className = sourceClass;
    sourceEl.innerText = item.source;

    const titleContainer = document.createElement('span');
    titleContainer.className = 'title-container';

    const titleLink = document.createElement('a');
    titleLink.className = 'news-title';
    titleLink.style.color = 'inherit';
    titleLink.style.textDecoration = 'none';
    titleLink.target = '_blank';
    titleLink.rel = 'noopener noreferrer';
    titleLink.href = safeUrl(item.link);
    titleLink.innerText = item.title;

    titleContainer.appendChild(titleLink);
    div.appendChild(timestampEl);
    div.appendChild(sourceEl);
    div.appendChild(titleContainer);

    const titleEl = titleLink;
    
    // Scramble effect check - Rare, tied to impact
    if ((isHighImpact && Math.random() > 0.6) || (Math.random() > 0.99)) {
        setTimeout(() => scrambleText(titleEl, item.title), Math.random() * 2000);
    }

    div.onclick = (e) => {
        if (e.target.tagName !== 'A') {
            window.open(safeUrl(item.link), '_blank', 'noopener,noreferrer');
        }
    };

    stream.appendChild(div);

    if (stream.children.length > MAX_DOM_ITEMS) {
        stream.removeChild(stream.children[0]);
        if (focusedArticleIndex > 0) {
            focusedArticleIndex -= 1;
        } else {
            focusedArticleIndex = -1;
        }
    }

    if (focusedArticleIndex !== -1) {
        applyFocusedItem(undefined, { scroll: false });
    }
}

function updateTicker() {
    const stockSymbols = ['DOW', 'NASDAQ', 'S&P 500', 'BTC', 'ETH', 'TSLA', 'AAPL', 'NVDA', 'INTC', 'MSFT'];
    const cities = ['London', 'New York', 'Tokyo', 'Paris', 'Mars', 'Cyberia', 'Atlantis', 'Lagos', 'Dubai', 'Singapore'];
    const markets = ['NIKKEI', 'FTSE', 'CAC 40', 'DAX', 'HANG SENG', 'SENSEX'];
    const commodities = ['GOLD', 'SILVER', 'BRENT', 'WTI', 'NAT GAS', 'URANIUM'];
    const systemMetrics = ['CPU', 'MEM', 'NET', 'QUEUE PRESSURE', 'EVENT RATE'];
    const satellites = ['NOAA-19', 'ISS', 'SENTINEL-2A', 'GAIA', 'TESS'];
    const sectors = ['AI', 'ENERGY', 'BIO', 'AEROSPACE', 'SUPPLY CHAIN'];
    const facts = [
        'GLOBAL POPULATION: 8,102,492,103',
        'SIGNAL STRENGTH: 98%',
        'REDACTED: [ACCESS DENIED]',
        'ALERT: ATMOSPHERIC NOISE DETECTED',
        'CRISIS LEVEL: NOMINAL',
        'BANDWIDTH: SATURATED',
        'INTERCEPTED: PROJECT HAIL MARY STATUS...',
        `ITEMS RENDERED: ${stream.children.length}`,
        `QUEUE SIZE: ${newsQueue.length}`,
        `DROPPED SINCE LOAD: ${droppedItemCount}`
    ];

    let tickerText = '';
    
    stockSymbols.forEach(s => {
        const val = (Math.random() * 1000 - 500).toFixed(2);
        const sign = val > 0 ? '▲' : '▼';
        tickerText += ` ${s}: ${val} ${sign} | `;
    });

    cities.forEach(c => {
        const temp = Math.floor(Math.random() * 40 - 10);
        tickerText += ` ${c.toUpperCase()}: ${temp}°C | `;
    });

    markets.forEach((m) => {
        const level = (Math.random() * 9000 + 1000).toFixed(1);
        const drift = (Math.random() * 6 - 3).toFixed(2);
        const sign = Number(drift) >= 0 ? '▲' : '▼';
        tickerText += ` ${m}: ${level} (${drift}%) ${sign} | `;
    });

    commodities.forEach((name) => {
        const price = (Math.random() * 3000 + 10).toFixed(2);
        const delta = (Math.random() * 4 - 2).toFixed(2);
        tickerText += ` ${name}: $${price} ${delta}% | `;
    });

    systemMetrics.forEach((metric) => {
        const reading = Math.floor(Math.random() * 100);
        tickerText += ` ${metric}: ${reading}% | `;
    });

    satellites.forEach((sat) => {
        const passIn = Math.floor(Math.random() * 90) + 1;
        tickerText += ` ${sat} PASS IN: ${passIn}M | `;
    });

    sectors.forEach((sector) => {
        const pulse = Math.floor(Math.random() * 10) + 90;
        tickerText += ` ${sector} MOMENTUM: ${pulse}/100 | `;
    });

    tickerText += facts.join(' | ');
    tickerText += ' | ' + tickerText;

    tickerContentEl.innerText = tickerText;
}

updateTicker();
setInterval(updateTicker, 60000);
refreshHealth();
setInterval(refreshHealth, HEALTH_POLL_INTERVAL_MS);

function safeUrl(url) {
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return '#';
        }
        return parsed.toString();
    } catch {
        return '#';
    }
}

function isValidNewsItem(item) {
    if (!item || typeof item !== 'object') {
        return false;
    }

    return (
        typeof item.title === 'string' &&
        typeof item.link === 'string' &&
        typeof item.source === 'string'
    );
}
