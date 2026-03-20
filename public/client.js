const socket = io();
const stream = document.getElementById('stream');
const queueCountEl = document.getElementById('queue-count');
const signalStrengthEl = document.getElementById('signal-strength');
const tickerContentEl = document.getElementById('ticker-content');
const MAX_DOM_ITEMS = 300; // Limit items in DOM to prevent lag
const MAX_QUEUE_ITEMS = 50000; // Cap queue size

let newsQueue = [];
let isProcessing = false;

socket.on('connect', () => {
    console.log('Connected to server');
    signalStrengthEl.innerText = 'STRONG';
});

socket.on('news-item', (item) => {
    newsQueue.push(item);
    if (newsQueue.length > MAX_QUEUE_ITEMS) {
        newsQueue.shift(); // Remove oldest to cap queue size
    }
    updateQueueStatus();
    if (!isProcessing) {
        isProcessing = true;
        processQueue();
    }
});

function updateQueueStatus() {
    queueCountEl.innerText = newsQueue.length;
    
    // Dynamic status indicator
    if (newsQueue.length > 5000) {
        signalStrengthEl.innerText = 'BUFFER OVERLOAD';
        signalStrengthEl.style.color = 'red';
    } else if (newsQueue.length > 1000) {
        signalStrengthEl.innerText = 'HIGH DENSITY';
        signalStrengthEl.style.color = 'orange';
    } else {
        signalStrengthEl.innerText = 'STABLE';
        signalStrengthEl.style.color = '#fff';
    }
}

async function processQueue() {
    if (newsQueue.length === 0) {
        isProcessing = false;
        return;
    }

    // Dynamic Batch and Timing based on queue size
    let count = 1;
    let baseDelay = 1000; // Default delay
    const qLen = newsQueue.length;

    if (qLen > 5000) {
        count = Math.floor(Math.random() * 20) + 10; // Massively drain
        baseDelay = 100; // Very fast
    } else if (qLen > 1000) {
        count = Math.floor(Math.random() * 8) + 4; // Fast drain
        baseDelay = 250;
    } else if (qLen > 100) {
        count = Math.floor(Math.random() * 3) + 1; // Slight catch up
        baseDelay = 500;
    } else {
        // Normal "Fun" mode with occasional bursts
        const burstChance = Math.random();
        if (burstChance > 0.95) count = Math.floor(Math.random() * 5) + 3;
        else if (burstChance > 0.8) count = Math.floor(Math.random() * 2) + 1;
        baseDelay = 1200;
    }

    for (let i = 0; i < count; i++) {
        if (newsQueue.length > 0) {
            // SHUFFLE FIX: Pick a random item from the first 500 in the queue
            // This mixes sources without getting completely out of sync
            const windowSize = Math.min(newsQueue.length, 500);
            const randomIndex = Math.floor(Math.random() * windowSize);
            const item = newsQueue.splice(randomIndex, 1)[0];
            
            addNewsItem(item);
            
            // Minimal delay during a single batch burst
            if (count > 1 && qLen < 1000) await new Promise(r => setTimeout(r, 30));
        }
    }

    updateQueueStatus();
    stream.scrollTop = stream.scrollHeight;

    // Randomize next delay based on state
    const nextDelay = Math.random() * baseDelay + (baseDelay / 4);
    setTimeout(processQueue, nextDelay);
}

function addNewsItem(item) {
    const div = document.createElement('div');
    div.className = 'news-item';
    
    const randomSize = 0.9 + Math.random() * 0.7;
    div.style.fontSize = `${randomSize}em`;

    const lowerTitle = item.title.toLowerCase();
    if (lowerTitle.includes('breaking')) div.classList.add('breaking');
    if (lowerTitle.includes('live')) div.classList.add('live');
    if (lowerTitle.includes('war') || lowerTitle.includes('conflict')) div.classList.add('war');
    if (lowerTitle.includes('died') || lowerTitle.includes('death') || lowerTitle.includes('killed')) div.classList.add('death');

    const time = new Date().toLocaleTimeString();
    div.innerHTML = `
        <span class="timestamp">[${time}]</span>
        <span class="source">${item.source}</span>
        <span class="title"><a href="${item.link}" target="_blank" style="color: inherit; text-decoration: none;">${item.title}</a></span>
    `;

    div.onclick = (e) => {
        if (e.target.tagName !== 'A') window.open(item.link, '_blank');
    };

    stream.appendChild(div);

    if (stream.children.length > MAX_DOM_ITEMS) {
        stream.removeChild(stream.children[0]);
    }
}

// Global Ticker Data
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
