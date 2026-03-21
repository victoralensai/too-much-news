const socket = io();
const stream = document.getElementById('stream');
const queueCountEl = document.getElementById('queue-count');
const signalStrengthEl = document.getElementById('signal-strength');
const tickerContentEl = document.getElementById('ticker-content');

const MAX_DOM_ITEMS = 300;
const MAX_QUEUE_ITEMS = 20000;
const MAX_RANDOM_PICK_WINDOW = 500;
const OVERLOAD_THRESHOLD = 5000;
const HIGH_DENSITY_THRESHOLD = 1000;

let newsQueue = [];
let isProcessing = false;
let droppedItemCount = 0;
let currentConnectionState = 'CONNECTING';

const GLITCH_CHARS = '01$#@%&*<>?/';

socket.on('connect', () => {
    currentConnectionState = 'CONNECTED';
    updateQueueStatus();
    if (!isProcessing && newsQueue.length > 0) {
        isProcessing = true;
        processQueue();
    }
});

socket.on('disconnect', () => {
    currentConnectionState = 'DISCONNECTED';
    updateQueueStatus();
});

socket.io.on('reconnect_attempt', () => {
    currentConnectionState = 'RECONNECTING';
    updateQueueStatus();
});

socket.on('connect_error', () => {
    currentConnectionState = 'DEGRADED';
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
    queueCountEl.innerText = String(newsQueue.length);

    if (currentConnectionState !== 'CONNECTED') {
        signalStrengthEl.innerText = currentConnectionState;
        signalStrengthEl.style.color = '#ff5555';
        return;
    }

    if (newsQueue.length > OVERLOAD_THRESHOLD) {
        const droppedText = droppedItemCount > 0 ? ` (DROP ${droppedItemCount})` : '';
        signalStrengthEl.innerText = `BUFFER OVERLOAD${droppedText}`;
        signalStrengthEl.style.color = 'red';
    } else if (newsQueue.length > HIGH_DENSITY_THRESHOLD) {
        signalStrengthEl.innerText = 'HIGH DENSITY';
        signalStrengthEl.style.color = 'orange';
    } else {
        signalStrengthEl.innerText = 'STABLE';
        signalStrengthEl.style.color = '#fff';
    }
}

async function processQueue() {
    try {
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
    }
}

function updateTicker() {
    const stockSymbols = ['DOW', 'NASDAQ', 'S&P 500', 'BTC', 'ETH', 'TSLA', 'AAPL', 'NVDA', 'INTC', 'MSFT'];
    const cities = ['London', 'New York', 'Tokyo', 'Paris', 'Mars', 'Cyberia', 'Atlantis', 'Lagos', 'Dubai', 'Singapore'];
    const facts = [
        'GLOBAL POPULATION: 8,102,492,103',
        'SIGNAL STRENGTH: 98%',
        'REDACTED: [ACCESS DENIED]',
        'ALERT: ATMOSPHERIC NOISE DETECTED',
        'CRISIS LEVEL: NOMINAL',
        'BANDWIDTH: SATURATED',
        'INTERCEPTED: PROJECT HAIL MARY STATUS...'
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

    tickerText += facts.join(' | ');
    tickerText += ' | ' + tickerText;

    tickerContentEl.innerText = tickerText;
}

updateTicker();
setInterval(updateTicker, 60000);

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
