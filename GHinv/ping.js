// =========================================================
// PING COMMANDER & SMART STABILIZED SPEED ENGINE
// =========================================================

const MASTER_SERVER_LIST = {
    'cs2': [
        { name: 'Frankfurt', code: 'DE', region: 'EU', url: 'https://dynamodb.eu-central-1.amazonaws.com' },
        { name: 'Paris', code: 'FR', region: 'EU', url: 'https://dynamodb.eu-west-3.amazonaws.com' },
        { name: 'Stockholm', code: 'SE', region: 'EU', url: 'https://dynamodb.eu-north-1.amazonaws.com' },
        { name: 'Madrid', code: 'ES', region: 'EU', url: 'https://dynamodb.eu-south-2.amazonaws.com' },
        { name: 'Warsaw', code: 'PL', region: 'EU', url: 'https://dynamodb.eu-central-2.amazonaws.com' },
        { name: 'US East', code: 'US', region: 'NA', url: 'https://dynamodb.us-east-1.amazonaws.com' },
        { name: 'US West', code: 'US', region: 'NA', url: 'https://dynamodb.us-west-1.amazonaws.com' },
        { name: 'Sao Paulo', code: 'BR', region: 'SA', url: 'https://dynamodb.sa-east-1.amazonaws.com' },
        { name: 'Singapore', code: 'SG', region: 'AS', url: 'https://dynamodb.ap-southeast-1.amazonaws.com' },
        { name: 'Dubai', code: 'AE', region: 'ME', url: 'https://dynamodb.me-south-1.amazonaws.com' }
    ],
    'valorant': [
        { name: 'Frankfurt', code: 'DE', region: 'EU', url: 'https://dynamodb.eu-central-1.amazonaws.com' },
        { name: 'Paris', code: 'FR', region: 'EU', url: 'https://dynamodb.eu-west-3.amazonaws.com' },
        { name: 'London', code: 'UK', region: 'EU', url: 'https://dynamodb.eu-west-2.amazonaws.com' },
        { name: 'Madrid', code: 'ES', region: 'EU', url: 'https://dynamodb.eu-south-2.amazonaws.com' },
        { name: 'Bahrain', code: 'BH', region: 'ME', url: 'https://dynamodb.me-south-1.amazonaws.com' },
        { name: 'Tokyo', code: 'JP', region: 'AS', url: 'https://dynamodb.ap-northeast-1.amazonaws.com' },
        { name: 'Singapore', code: 'SG', region: 'AS', url: 'https://dynamodb.ap-southeast-1.amazonaws.com' }
    ],
    'apex': [
        { name: 'Belgium', code: 'BE', region: 'EU', url: 'https://dynamodb.eu-west-1.amazonaws.com' },
        { name: 'Frankfurt', code: 'DE', region: 'EU', url: 'https://dynamodb.eu-central-1.amazonaws.com' },
        { name: 'New York', code: 'US', region: 'NA', url: 'https://dynamodb.us-east-1.amazonaws.com' },
        { name: 'Singapore', code: 'SG', region: 'AS', url: 'https://dynamodb.ap-southeast-1.amazonaws.com' },
        { name: 'Bahrain', code: 'BH', region: 'ME', url: 'https://dynamodb.me-south-1.amazonaws.com' }
    ],
    'cod': [
        { name: 'London', code: 'UK', region: 'EU', url: 'https://dynamodb.eu-west-2.amazonaws.com' },
        { name: 'Frankfurt', code: 'DE', region: 'EU', url: 'https://dynamodb.eu-central-1.amazonaws.com' },
        { name: 'US East', code: 'US', region: 'NA', url: 'https://dynamodb.us-east-1.amazonaws.com' }
    ]
};

document.addEventListener('DOMContentLoaded', () => {
    const btnPing = document.getElementById('btn-start-ping');
    if (btnPing) btnPing.addEventListener('click', startPingTest);
    
    const btnSpeed = document.getElementById('btn-speed-test');
    if (btnSpeed) btnSpeed.addEventListener('click', runStableSpeedTest);

    loadPingState();
});

// --- State Management ---
function loadPingState() {
    const savedPrefs = localStorage.getItem('gh_ping_prefs');
    const savedResults = localStorage.getItem('gh_ping_last_results');
    if (savedPrefs) {
        const prefs = JSON.parse(savedPrefs);
        const gameSelect = document.getElementById('ping-game-select');
        const regionSelect = document.getElementById('ping-region-select');
        if(gameSelect) gameSelect.value = prefs.game;
        if(regionSelect) regionSelect.value = prefs.region;
    }
    if (savedResults) {
        const results = JSON.parse(savedResults);
        renderSavedResults(results);
    }
}

function renderSavedResults(servers) {
    const container = document.getElementById('ping-results-container');
    if(!container) return;
    
    container.replaceChildren(); 

    servers.forEach((server, index) => {
        const pingDisplay = server.ping ? `${server.ping}ms` : '...';
        const pingClass = getPingColorClass(server.ping);
        const barWidth = server.ping ? Math.min((server.ping / 250) * 100, 100) : 0;
        const barColor = getPingColorHex(server.ping);

        const row = document.createElement('div');
        row.className = 'ping-row';
        row.id = `ping-row-${index}`;

        const nameDiv = document.createElement('div');
        nameDiv.className = 'server-name';
        
        const badge = document.createElement('span');
        badge.className = 'country-badge';
        badge.textContent = server.code;
        
        nameDiv.append(badge, document.createTextNode(' ' + server.name));

        const rightDiv = document.createElement('div');
        rightDiv.style.cssText = 'display:flex; align-items:center;';

        const barBg = document.createElement('div');
        barBg.className = 'ping-bar-bg';
        
        const barFill = document.createElement('div');
        barFill.className = 'ping-bar-fill';
        barFill.id = `fill-${index}`;
        barFill.style.width = `${barWidth}%`;
        barFill.style.background = barColor;
        
        barBg.appendChild(barFill);

        const valBox = document.createElement('div');
        valBox.className = `ping-value-box ${pingClass}`;
        valBox.id = `val-${index}`;
        valBox.textContent = pingDisplay;

        rightDiv.append(barBg, valBox);
        row.append(nameDiv, rightDiv);
        container.appendChild(row);
    });
}

// --- Ping Logic ---
async function startPingTest() {
    const gameSelect = document.getElementById('ping-game-select');
    const regionSelect = document.getElementById('ping-region-select');
    const container = document.getElementById('ping-results-container');
    const btn = document.getElementById('btn-start-ping');
    
    if(!gameSelect || !regionSelect || !container || !btn) return;

    const gameKey = gameSelect.value;
    const selectedRegion = regionSelect.value;
    
    localStorage.setItem('gh_ping_prefs', JSON.stringify({ game: gameKey, region: selectedRegion }));

    let servers = MASTER_SERVER_LIST[gameKey] || [];
    if (selectedRegion !== 'ALL') {
        servers = servers.filter(s => s.region === selectedRegion);
    }

    let currentSessionResults = servers.map(s => ({...s, ping: null}));

    if (currentSessionResults.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:20px; color:#ff4444; font-size:10px;">No servers found</div>`;
        return;
    }

    btn.disabled = true;
    btn.innerText = "SCAN...";
    btn.style.opacity = "0.7";
    
    renderSavedResults(currentSessionResults);

    for (let i = 0; i < currentSessionResults.length; i++) {
        const row = document.getElementById(`ping-row-${i}`);
        if(row) row.style.background = "#ffffff05";
        
        const ping = await measurePingPrecision(currentSessionResults[i].url);
        
        currentSessionResults[i].ping = ping;
        updatePingUI(i, ping);
        localStorage.setItem('gh_ping_last_results', JSON.stringify(currentSessionResults));

        if(row) row.style.background = "transparent";
        await new Promise(r => setTimeout(r, 100)); 
    }

    btn.disabled = false;
    btn.innerText = "START";
    btn.style.opacity = "1";
}

async function measurePingPrecision(url) {
    const SAMPLES = 4; 
    let totalTime = 0;
    let successfulPings = 0;

    for (let i = 0; i < SAMPLES; i++) {
        try {
            const start = performance.now();
            await fetch(url, { method: 'HEAD', mode: 'no-cors', cache: 'no-store' });
            const end = performance.now();
            if (i > 0) {
                totalTime += (end - start);
                successfulPings++;
            }
            await new Promise(r => setTimeout(r, 100)); 
        } catch (e) { }
    }
    if (successfulPings === 0) return 999;
    return Math.round(totalTime / successfulPings);
}

function updatePingUI(index, ping) {
    const valBox = document.getElementById(`val-${index}`);
    const fillBar = document.getElementById(`fill-${index}`);
    if (!valBox || !fillBar) return;

    valBox.innerText = ping === 999 ? "ERR" : `${ping}ms`;
    const pingClass = getPingColorClass(ping);
    const colorHex = getPingColorHex(ping);
    valBox.className = `ping-value-box ${pingClass}`;
    fillBar.style.backgroundColor = colorHex;
    const percentage = Math.min((ping / 250) * 100, 100);
    fillBar.style.width = `${percentage}%`;
}

function getPingColorClass(ping) {
    if (!ping || ping === 999) return '';
    if (ping > 150) return 'ping-bad';
    if (ping > 90) return 'ping-med';
    return 'ping-good';
}

function getPingColorHex(ping) {
    if (!ping || ping === 999) return '#333';
    if (ping > 150) return '#ff4444';
    if (ping > 90) return '#ffaa00';
    return '#00ff88';
}

// =================================================================
// 🚀 STABLE SPEED TEST (Trimmed Mean Algorithm)
// =================================================================

async function runStableSpeedTest() {
    const btn = document.getElementById('btn-speed-test');
    const dlText = document.getElementById('dl-val');
    const ulText = document.getElementById('ul-val');
    const statusText = document.getElementById('speed-status-text');
    const bar = document.getElementById('speed-progress-bar'); 

    if(!btn) return;

    btn.disabled = true;
    dlText.style.color = "#fff"; dlText.innerText = "0.0";
    ulText.style.color = "#fff"; ulText.innerText = "0.0";
    document.querySelector('.download-side').classList.remove('download-done');
    document.querySelector('.upload-side').classList.remove('upload-done');
    if(bar) bar.style.width = "0%";

    // 1. Download Test (Stabilized)
    statusText.innerText = "Download Test (Stabilizing)...";
    document.querySelector('.download-side').classList.add('active');
    try {
        const dlSpeed = await measureStabilizedSpeed('download', bar, dlText);
        dlText.innerText = dlSpeed;
        document.querySelector('.download-side').classList.add('download-done');
    } catch (e) { dlText.innerText = "ERR"; }
    document.querySelector('.download-side').classList.remove('active');

    // Pause
    if(bar) bar.style.width = "0%";
    await new Promise(r => setTimeout(r, 800));

    // 2. Upload Test (Stabilized)
    statusText.innerText = "Upload Test (Stabilizing)...";
    document.querySelector('.upload-side').classList.add('active');
    try {
        const ulSpeed = await measureStabilizedSpeed('upload', bar, ulText);
        ulText.innerText = ulSpeed;
        document.querySelector('.upload-side').classList.add('upload-done');
    } catch (e) { ulText.innerText = "ERR"; }
    document.querySelector('.upload-side').classList.remove('active');

    statusText.innerText = "Done";
    btn.disabled = false;
    if(bar) bar.style.width = "0%";
}

// --- CORE LOGIC: STABILIZED MEASUREMENT ---
function measureStabilizedSpeed(type, progressBar, textDisplay) {
    return new Promise((resolve) => {
        const workers = 6; 
        const duration = 10000; 
        const warmUpTime = 2000; 
        
        let startTime = performance.now();
        let endTime = startTime + duration;
        let isFinished = false;
        
        const speedSamples = [];
        
        let lastLoadedTotal = 0;
        let lastSampleTime = performance.now();
        const progressMap = new Array(workers).fill(0);

        const samplerInterval = setInterval(() => {
            const now = performance.now();
            
            if (now >= endTime) {
                finishTest();
                return;
            }

            const totalLoadedNow = progressMap.reduce((a, b) => a + b, 0);
            const loadedDiff = totalLoadedNow - lastLoadedTotal;
            const timeDiff = (now - lastSampleTime) / 1000;

            if (timeDiff >= 0.25) {
                const currentSpeed = (loadedDiff * 8) / (timeDiff * 1024 * 1024);
                
                textDisplay.innerText = currentSpeed.toFixed(1);

                if (now - startTime > warmUpTime) {
                    speedSamples.push(currentSpeed);
                }

                if (progressBar) {
                    const percent = ((now - startTime) / duration) * 100;
                    progressBar.style.width = Math.min(percent, 100) + "%";
                }

                lastLoadedTotal = totalLoadedNow;
                lastSampleTime = now;
            }

        }, 250);

        const activeXHRs = [];
        for (let i = 0; i < workers; i++) {
            startWorker(i);
        }

        function startWorker(i) {
            if (isFinished) return;
            const xhr = new XMLHttpRequest();
            activeXHRs.push(xhr);
            
            if (type === 'download') {
                xhr.open("GET", `https://speed.cloudflare.com/__down?bytes=100000000&_=${Math.random()}`, true);
                xhr.responseType = "blob";
                xhr.onprogress = (e) => { progressMap[i] = e.loaded; }; 
            } else {
                xhr.open("POST", "https://speed.cloudflare.com/__up", true);
                const data = new Uint8Array(20000000); 
                xhr.upload.onprogress = (e) => { progressMap[i] = e.loaded; };
                xhr.send(data);
            }
            
            xhr.onload = xhr.onerror = () => {
                if(!isFinished) {
                }
            };
            
            if (type === 'download') xhr.send();
        }

        function finishTest() {
            if (isFinished) return;
            isFinished = true;
            clearInterval(samplerInterval);
            
            activeXHRs.forEach(xhr => xhr.abort());

            speedSamples.sort((a, b) => a - b);
            
            if (speedSamples.length > 2) {
                const removeCount = Math.floor(speedSamples.length * 0.1);
                const cleanSamples = speedSamples.slice(removeCount, speedSamples.length - removeCount);
                
                const sum = cleanSamples.reduce((a, b) => a + b, 0);
                const finalStableSpeed = (sum / cleanSamples.length).toFixed(1);
                
                resolve(finalStableSpeed);
            } else {
                resolve(parseFloat(textDisplay.innerText).toFixed(1));
            }
        }
    });
}