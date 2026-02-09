// ============================================================================
// GAMERHUB FRIENDS SYSTEM - V40 (Fixed: Tab Switching Glitch)
// ============================================================================

const STEAM_CACHE_DURATION = 20 * 1000;
let USER_STEAM_KEY = localStorage.getItem('gh_user_steam_key') || '';
let USER_FACEIT_KEY = localStorage.getItem('gh_user_faceit_key') || '';
let REFRESH_RATE = parseInt(localStorage.getItem('gh_refresh_rate')) || 1;
let allPlayers = [];
let manualTrackList = []; 
let autoRefreshInterval = null;
let notifyList = []; 


const IGNORED_APPS = [480, 215, 218, 243750]; 

document.addEventListener('DOMContentLoaded', () => {
    chrome.storage.local.get(['gh_notify_list', 'gh_manual_track_list'], (result) => {
        notifyList = result.gh_notify_list || [];
        manualTrackList = result.gh_manual_track_list || [];
        
        setupSettingsLogic();
        setupFaceitSettingsLogic();
        
        if (document.getElementById('friends').classList.contains('active')) {
            initFriendsTab();
        }
    });
});

// 1. SETTINGS LOGIC
function setupSettingsLogic() {
    const apiInput = document.getElementById('setting-api-key-steam');
    const actionBtn = document.getElementById('btn-save-api-steam');
    const title = document.getElementById('api-title-steam');
    const desc = document.getElementById('api-desc-steam');

    function renderState(hasKey) {
        if (hasKey) {
            if(title) { title.innerText = "✅ STEAM API: ACTIVE"; title.style.color = "#00ff88"; }
            if(desc) { desc.innerHTML = '<span style="color:#00ff88; font-weight:bold;">Pro Mode Active</span>. Full features unlocked.'; }
            
            
            if(apiInput) { 
                apiInput.value = USER_STEAM_KEY; 
                apiInput.type = "password"; 
                apiInput.disabled = true; 
                apiInput.style.opacity = "0.5"; 
            }
            
            if(actionBtn) { actionBtn.innerText = "DELETE KEY"; actionBtn.style.background = "#ff4444"; actionBtn.style.color = "#fff"; }
        } else {
            if(title) { title.innerText = "STEAM API CONFIG"; title.style.color = "#00ff88"; }
            if(desc) { desc.innerHTML = 'Required for friends data. <a href="https://steamcommunity.com/dev/apikey" target="_blank" style="color:#00ff88;">Get Free Key</a>.'; }
            
            
            if(apiInput) { 
                apiInput.value = ""; 
                apiInput.type = "text"; 
                apiInput.disabled = false; 
                apiInput.style.opacity = "1"; 
            }
            
            if(actionBtn) { actionBtn.innerText = "SAVE STEAM KEY"; actionBtn.style.background = "#00ff88"; actionBtn.style.color = "#000"; }
        }
    }
    renderState(!!USER_STEAM_KEY);
    
    if (actionBtn) {
        actionBtn.onclick = async () => {
            if (USER_STEAM_KEY) {
                if (confirm("Remove Steam Key? Tracking will stop.")) {
                    localStorage.removeItem('gh_user_steam_key');
                    chrome.storage.local.remove('gh_user_steam_key'); 
                    USER_STEAM_KEY = '';
                    renderState(false);
                    location.reload(); 
                }
            } else {
                const key = apiInput.value.trim();
                if (key.length < 32) { 
                    alert("❌ Invalid Key Format (Too short)"); 
                    return; 
                }

                const originalText = actionBtn.innerText;
                actionBtn.innerText = "VERIFYING...";
                actionBtn.disabled = true;
                actionBtn.style.opacity = "0.7";

                try {
                    const res = await fetch(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${key}&steamids=76561197960287930`);
                    
                    if (res.status === 403) throw new Error("Invalid API Key (Access Denied)");
                    if (!res.ok) throw new Error("Connection Error");
                    const data = await res.json();
                    if (!data.response) throw new Error("Invalid Response Structure");

                    localStorage.setItem('gh_user_steam_key', key);
                    chrome.storage.local.set({ 'gh_user_steam_key': key }); 
                    USER_STEAM_KEY = key;
                    renderState(true);
                    alert("✅ Steam Key Verified & Saved!");
                    
                    if (document.getElementById('friends').classList.contains('active')) initFriendsTab();

                } catch (e) {
                    alert("❌ " + e.message);
                    actionBtn.innerText = originalText;
                    actionBtn.disabled = false;
                    actionBtn.style.opacity = "1";
                }
            }
        };
    }
}

function setupFaceitSettingsLogic() {
    const apiInput = document.getElementById('setting-api-key-faceit');
    const actionBtn = document.getElementById('btn-save-api-faceit');
    const title = document.getElementById('api-title-faceit');
    const desc = document.getElementById('api-desc-faceit');

    function renderState(hasKey) {
        if (hasKey) {
            if(title) { title.innerText = "✅ FACEIT API: ACTIVE"; title.style.color = "#ff5500"; }
            if(desc) { desc.innerHTML = '<span style="color:#ff5500; font-weight:bold;">Faceit Connected</span>. Stats enabled.'; }
            
            if(apiInput) { 
                apiInput.value = USER_FACEIT_KEY; 
                apiInput.type = "password"; 
                apiInput.disabled = true; 
                apiInput.style.opacity = "0.5"; 
            }

            if(actionBtn) { 
                actionBtn.innerText = "DELETE KEY"; 
                actionBtn.style.background = "#ff4444"; 
                actionBtn.style.color = "#fff"; 
                actionBtn.disabled = false;
                actionBtn.style.opacity = "1";
            }
        } else {
            if(title) { title.innerText = "FACEIT API CONFIG"; title.style.color = "#ff5500"; }
            if(desc) { desc.innerHTML = 'Required for stats. <a href="https://developers.faceit.com/" target="_blank" style="color:#ff5500;">Get Free Key</a>.'; }
            
            if(apiInput) { 
                apiInput.value = ""; 
                apiInput.type = "text"; 
                apiInput.disabled = false; 
                apiInput.style.opacity = "1"; 
            }

            if(actionBtn) { actionBtn.innerText = "SAVE FACEIT KEY"; actionBtn.style.background = "#ff5500"; actionBtn.style.color = "#fff"; }
        }
    }
    renderState(!!USER_FACEIT_KEY);
    
    if (actionBtn) {
        actionBtn.onclick = async () => {
            if (USER_FACEIT_KEY) {
                if (confirm("Remove Faceit Key?")) {
                    localStorage.removeItem('gh_user_faceit_key');
                    USER_FACEIT_KEY = '';
                    renderState(false);
                }
            } else {
                const key = apiInput.value.trim();
                
                if (key.length < 10) { 
                    alert("❌ Invalid Key Format (Too short)"); 
                    return; 
                }

                const originalText = actionBtn.innerText;
                actionBtn.innerText = "CHECKING...";
                actionBtn.disabled = true;
                actionBtn.style.opacity = "0.7";

                try {
                    const res = await fetch(`https://open.faceit.com/data/v4/games/cs2`, {
                        headers: { 
                            'Authorization': `Bearer ${key}`,
                            'Accept': 'application/json',
                            'Content-Type': 'application/json'
                        }
                    });

                    if (res.status === 400 || res.status === 401 || res.status === 403) {
                        throw new Error("Invalid API Key");
                    }
                    if (res.status === 429) throw new Error("Rate Limit Reached (Wait a bit)");
                    if (!res.ok) throw new Error(`Server Error: Code ${res.status}`);

                    localStorage.setItem('gh_user_faceit_key', key);
                    USER_FACEIT_KEY = key;
                    
                    actionBtn.disabled = false; 
                    actionBtn.style.opacity = "1";
                    
                    renderState(true);
                    alert("✅ Faceit Key Verified!");

                } catch (e) {
                    alert("❌ " + e.message);
                    actionBtn.innerText = originalText;
                    actionBtn.disabled = false;
                    actionBtn.style.opacity = "1";
                }
            }
        };
    }
}

// ---------------------------------------------------------
// Main Friends Logic
// ---------------------------------------------------------

async function initFriendsTab() {
    if (USER_STEAM_KEY) {
        chrome.storage.local.set({ 'gh_user_steam_key': USER_STEAM_KEY });
    }

    const listData = document.getElementById('friends-list-data');
    const steamSearchInput = document.getElementById('friend-search');
    
    setupNotificationHistoryUI();
    setupTrackingButton();

    chrome.storage.local.get(['gh_permanent_removed'], (result) => {
        const count = result.gh_permanent_removed ? result.gh_permanent_removed.length : 0;
        updateRemovedCounter(count);
    });

    const statsContainer = document.getElementById('stats-container');
    if (statsContainer && !document.getElementById('refresh-rate-btn')) {
        const displayVal = REFRESH_RATE === 0 ? "OFF" : `${REFRESH_RATE}m`;
        const timerHTML = `
            <div id="refresh-rate-btn" title="Click to change auto-refresh speed" 
                 style="margin-left: 10px; cursor: pointer; color: #00c3ff; border: 1px solid #00c3ff; padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 9px; box-shadow: 0 0 5px rgba(0, 195, 255, 0.2); transition: 0.3s; display:flex; align-items:center; gap:3px;">
                 <span>⏱ Auto:</span> <span id="refresh-val">${displayVal}</span>
            </div>
        `;
        statsContainer.insertAdjacentHTML('beforeend', timerHTML);
        document.getElementById('refresh-rate-btn').onclick = () => {
            if (REFRESH_RATE === 1) REFRESH_RATE = 3;
            else if (REFRESH_RATE === 3) REFRESH_RATE = 5;
            else if (REFRESH_RATE === 5) REFRESH_RATE = 10;
            else if (REFRESH_RATE === 10) REFRESH_RATE = 0; 
            else REFRESH_RATE = 1;

            localStorage.setItem('gh_refresh_rate', REFRESH_RATE);
            const newVal = REFRESH_RATE === 0 ? "OFF" : `${REFRESH_RATE}m`;
            document.getElementById('refresh-val').innerText = newVal;
            startAutoRefreshTimer();
        };
    }

    let refreshBtn = document.getElementById('refresh-friends');
    if (refreshBtn) {
        const newBtn = refreshBtn.cloneNode(true);
        refreshBtn.parentNode.replaceChild(newBtn, refreshBtn);
        refreshBtn = newBtn;
    }

    if(refreshBtn) {
        refreshBtn.onclick = () => {
            if (refreshBtn.classList.contains('disabled')) return;
            refreshBtn.classList.add('disabled');
            refreshBtn.style.opacity = '0.4';
            refreshBtn.style.animation = 'spin 1s linear infinite';

            const currentPlatform = localStorage.getItem('gh_last_platform');
            setTimeout(() => {
                refreshBtn.classList.remove('disabled');
                refreshBtn.style.opacity = '1';
                refreshBtn.style.cursor = 'pointer';
                refreshBtn.style.animation = '';
            }, 2000);

            if (currentPlatform === 'faceit') {
                chrome.storage.local.remove('gh_faceit_cache', () => { updatePlatformUI('faceit'); });
            } else {
                startSteamProcess(true, false);
            }
        };
    }

    let savedPlatform = localStorage.getItem('gh_last_platform');
    document.querySelectorAll('.plat-btn').forEach(button => {
        const platform = button.getAttribute('data-platform');
        button.classList.toggle('active', platform === savedPlatform);
        button.onclick = () => {
            document.querySelectorAll('.plat-btn').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            localStorage.setItem('gh_last_platform', platform);
            updatePlatformUI(platform);
        };
    });

    if (!savedPlatform) {
        savedPlatform = 'steam';
        localStorage.setItem('gh_last_platform', 'steam');
    }

    if (steamSearchInput) {
        steamSearchInput.oninput = (e) => {
            const term = e.target.value.toLowerCase();
            if (allPlayers.length > 0) {
                renderFriendsUI(allPlayers.filter(p => p.personaname.toLowerCase().includes(term)), listData, false);
            }
        };
    }

    const removedTrigger = document.getElementById('removed-stat-trigger');
    if(removedTrigger) {
        removedTrigger.onclick = () => showRemovedModal();
    }

    updatePlatformUI(savedPlatform);
    startAutoRefreshTimer();
}

// ---------------------------------------------------------
// [PRO] TRACK NON-FRIEND SYSTEM
// ---------------------------------------------------------

function setupTrackingButton() {
    const header = document.querySelector('.friends-header');
    if (!header || document.getElementById('open-track-modal-btn')) return;

    const trackBtn = document.createElement('button');
    trackBtn.id = "open-track-modal-btn";
    trackBtn.innerHTML = `<span>⚡</span> TRACK NON-FRIEND`;
    trackBtn.title = "Track a player via URL or ID (Requires API Key)";
    trackBtn.style.cssText = "background:rgba(255,170,0,0.1); border:1px solid #ffaa00; color:#ffaa00; padding:5px 10px; border-radius:4px; font-size:9px; font-weight:bold; cursor:pointer; margin-right:10px;";
    
    const refreshBtn = document.getElementById('refresh-friends');
    if(refreshBtn) {
        header.insertBefore(trackBtn, refreshBtn);
    } else {
        header.appendChild(trackBtn);
    }

    trackBtn.onclick = () => {
        if (!USER_STEAM_KEY) {
            alert("⚠️ Locked Feature\n\nYou must enter a valid Steam API Key in the settings to use the Tracking System.");
            return;
        }
        openTrackModal();
    };
}

function openTrackModal() {
    const existing = document.getElementById('track-modal-overlay');
    if (existing) existing.remove();

    const modalHTML = `
    <div id="track-modal-overlay" class="track-modal-overlay">
        <div class="track-modal" style="width:380px;">
            <div class="track-header">
                <span class="track-title">TRACK MANAGER</span>
                <div style="display:flex; gap:10px;">
                    <button id="refresh-track-list" class="close-track-btn" style="font-size:16px;" title="Refresh Data">↻</button>
                    <button class="close-track-btn" id="close-track-modal">×</button>
                </div>
            </div>
            
            <div class="track-input-group">
                <input type="text" id="track-input-id" class="track-input" placeholder="Paste Profile URL or Steam ID64...">
                <button id="btn-add-track" class="track-add-btn">ADD</button>
            </div>

            <div style="font-size:9px; color:#555; text-align:center;">Supports: /profiles/123... or /id/custom_name</div>

            <div class="tracked-users-list" id="tracked-list-container" style="max-height:300px; overflow-y:auto; margin-top:10px;">
                <div style="text-align:center; color:#444; font-size:10px; padding:20px;">Loading tracked users...</div>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const closeBtn = document.getElementById('close-track-modal');
    const overlay = document.getElementById('track-modal-overlay');
    
    if(closeBtn) closeBtn.onclick = () => overlay.remove();
    if(overlay) overlay.onclick = (e) => { if(e.target.id === 'track-modal-overlay') e.target.remove(); };

    const refreshBtn = document.getElementById('refresh-track-list');
    if(refreshBtn) {
        refreshBtn.onclick = () => {
            refreshBtn.style.animation = "spin 1s linear infinite";
            startSteamProcess(true, true);
            setTimeout(() => { refreshBtn.style.animation = ""; }, 2000);
        };
    }

    const addBtn = document.getElementById('btn-add-track');
    if(addBtn) addBtn.onclick = handleAddTrack;
    
    renderTrackedListInModal();
}

async function resolveSteamId(input) {
    input = input.trim();
    if (/^\d{17}$/.test(input)) return input; 

    const profileMatch = input.match(/\/profiles\/(\d{17})/);
    if (profileMatch) return profileMatch[1];

    const vanityMatch = input.match(/\/id\/([\w-]+)/);
    let vanityName = vanityMatch ? vanityMatch[1] : null;
    
    if (!vanityName && !input.includes('/') && !/^\d+$/.test(input)) {
        vanityName = input; 
    }

    if (vanityName && USER_STEAM_KEY) {
        try {
            const res = await fetch(`https://api.steampowered.com/ISteamUser/ResolveVanityURL/v0001/?key=${USER_STEAM_KEY}&vanityurl=${vanityName}`);
            const data = await res.json();
            if (data.response && data.response.success === 1) {
                return data.response.steamid;
            }
        } catch (e) { console.error("Resolution Error", e); }
    }
    return null;
}

async function handleAddTrack() {
    if (!USER_STEAM_KEY) {
        alert("⚠️ API Key Required.");
        return;
    }

    const inputEl = document.getElementById('track-input-id');
    const btn = document.getElementById('btn-add-track');
    const rawInput = inputEl.value;

    btn.innerText = "...";
    btn.disabled = true;

    const steamId = await resolveSteamId(rawInput);

    if (!steamId) {
        alert("❌ Invalid ID or URL / User not found.");
        btn.innerText = "ADD"; btn.disabled = false;
        return;
    }

    chrome.storage.local.get(['gh_manual_track_list', 'gh_notify_list'], async (result) => {
        let manualList = result.gh_manual_track_list || [];
        let notifyList = result.gh_notify_list || [];

        if (manualList.includes(steamId)) {
            alert("⚠️ User already tracked.");
            btn.innerText = "ADD"; btn.disabled = false;
            return;
        }

        try {
            const res = await fetch(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${USER_STEAM_KEY}&steamids=${steamId}`);
            const data = await res.json();
            
            if (!data.response.players || data.response.players.length === 0) {
                alert("❌ User not found on Steam.");
                btn.innerText = "ADD"; btn.disabled = false;
                return;
            }

            const player = data.response.players[0];
            if (player.communityvisibilitystate !== 3) {
                alert("🔒 Profile is Private.\nYou cannot track users with private profiles unless you are friends.");
                btn.innerText = "ADD"; btn.disabled = false;
                return;
            }

            manualList.push(steamId);
            if (!notifyList.includes(steamId)) notifyList.push(steamId);

            await chrome.storage.local.set({ 
                'gh_manual_track_list': manualList,
                'gh_notify_list': notifyList 
            });
            
            manualTrackList = manualList;
            
            const exists = allPlayers.find(p => p.steamid === steamId);
            if (!exists) allPlayers.push(player);

            renderTrackedListInModal();
            alert(`✅ Added: ${player.personaname}`);
            inputEl.value = '';

        } catch (e) {
            alert("❌ Connection Error.");
        }
        btn.innerText = "ADD";
        btn.disabled = false;
    });
}

function renderTrackedListInModal() {
    const container = document.getElementById('tracked-list-container');
    if (!container) return;

    container.replaceChildren();

    if (manualTrackList.length === 0) {
        const msg = document.createElement('div');
        msg.style.cssText = "text-align:center; color:#666; font-size:10px; padding:20px;";
        msg.textContent = "No manual tracking active.";
        container.appendChild(msg);
        return;
    }

    manualTrackList.forEach(id => {
        const p = allPlayers.find(pl => pl.steamid === id);
        
        const name = p ? p.personaname : id;
        const imgUrl = p ? p.avatarfull : "icon.png";
        const url = p ? p.profileurl : `https://steamcommunity.com/profiles/${id}`;
        
        let statusText = "OFFLINE";
        let statusColor = "#777";
        let borderColor = "#333";

        if (p) {
            if (p.gameextrainfo) { 
                statusText = `Playing: ${p.gameextrainfo}`; 
                statusColor = "#00ff88"; 
                borderColor = "#00ff8844";
            }
            else if (p.personastate === 1) { statusText = "ONLINE"; statusColor = "#00ff88"; }
            else if (p.personastate === 2) { statusText = "BUSY"; statusColor = "#ff4444"; }
            else if (p.personastate === 3) { statusText = "AWAY"; statusColor = "#00c3ff"; }
            else { 
                statusText = `Last seen: ${formatTime(p.lastlogoff)}`;
            }
        }

        const row = document.createElement('div');
        row.className = 'tracked-user-row';
        row.style.cssText = `display:flex; align-items:center; gap:10px; padding:10px; background:#161616; border:1px solid ${borderColor}; border-left:3px solid ${statusColor}; border-radius:6px; margin-bottom:5px;`;

        const imgDiv = document.createElement('div');
        imgDiv.style.position = 'relative';
        const img = document.createElement('img');
        img.src = imgUrl;
        img.style.cssText = `width:35px; height:35px; border-radius:50%; border:2px solid ${statusColor};`;
        imgDiv.appendChild(img);

        const infoDiv = document.createElement('div');
        infoDiv.style.cssText = "flex:1; overflow:hidden;";
        
        const nameDiv = document.createElement('div');
        nameDiv.style.cssText = "font-size:12px; font-weight:bold; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;";
        nameDiv.textContent = name; 

        const statusDiv = document.createElement('div');
        statusDiv.style.cssText = `font-size:10px; color:${statusColor}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;`;
        statusDiv.textContent = statusText; 

        infoDiv.append(nameDiv, statusDiv);

        const actionsDiv = document.createElement('div');
        actionsDiv.style.cssText = "display:flex; gap:5px;";

        const createLink = (icon, linkUrl, title) => {
            const a = document.createElement('a');
            a.href = linkUrl;
            a.target = "_blank";
            a.style.cssText = "background:#222; border:1px solid #444; color:#ccc; width:25px; height:25px; display:flex; align-items:center; justify-content:center; border-radius:4px; text-decoration:none;";
            a.title = title;
            a.textContent = icon;
            return a;
        };

        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-track-btn';
        removeBtn.dataset.id = id;
        removeBtn.style.cssText = "background:rgba(255,68,68,0.2); border:1px solid #ff4444; color:#ff4444; width:25px; height:25px; cursor:pointer; border-radius:4px; display:flex; align-items:center; justify-content:center;";
        removeBtn.title = "Stop Tracking";
        removeBtn.textContent = "×";
        
        removeBtn.onclick = () => removeTrackedUser(id);

        actionsDiv.append(
            createLink('👤', url, 'Profile'),
            createLink('🎒', `${url}/inventory/`, 'Inventory'),
            removeBtn
        );

        row.append(imgDiv, infoDiv, actionsDiv);
        container.appendChild(row);
    });
}

async function removeTrackedUser(id) {
    if(!confirm("Stop tracking this user?")) return;

    manualTrackList = manualTrackList.filter(x => x !== id);
    notifyList = notifyList.filter(x => x !== id);
    
    await chrome.storage.local.set({ 
        'gh_manual_track_list': manualTrackList,
        'gh_notify_list': notifyList 
    });
    
    renderTrackedListInModal(); 
    initFriendsTab(); 
}

function startAutoRefreshTimer() {
    if (autoRefreshInterval) clearInterval(autoRefreshInterval);
    if (REFRESH_RATE > 0) {
        autoRefreshInterval = setInterval(() => {
            const current = localStorage.getItem('gh_last_platform') || 'steam';
            if (current === 'steam') { 
                startSteamProcess(true, true);
            } else if (current === 'faceit') {
                 // Optional: Auto refresh faceit if needed
            }
        }, REFRESH_RATE * 60000);
    }
}

function updatePlatformUI(platform) {
    const listData = document.getElementById('friends-list-data');
    const steamSearchBox = document.querySelector('.steam-search-box');

    if(listData) {
        listData.innerHTML = `
            <div id="loader" style="margin:40px auto; width:30px; height:30px; border:3px solid rgba(0,255,136,0.1); border-top:3px solid #00ff88; border-radius:50%; animation:spin 1s linear infinite;"></div>
        `;
    }
    
    if (platform === 'steam') {
        if (steamSearchBox) steamSearchBox.style.display = 'flex';
        const shouldForce = !!USER_STEAM_KEY; 
        startSteamProcess(shouldForce, false);

    } else if (platform === 'faceit') {
        if (steamSearchBox) steamSearchBox.style.display = 'none';
        fetchFaceitData(listData);
    }
}

async function fetchWithTimeout(resource, options = {}) {
    const { timeout = 8000 } = options;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(resource, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
}

// ---------------------------------------------------------
// Logic: Steam Fetching
// ---------------------------------------------------------

function startSteamProcess(forceRefresh = false, isSilent = false) {
    const listData = document.getElementById('friends-list-data');
    if (!forceRefresh) {
        const cachedData = localStorage.getItem('gh_steam_data');
        const cachedTime = localStorage.getItem('gh_steam_time');
        if (cachedData && cachedTime) {
            const now = Date.now();
            if (now - parseInt(cachedTime) < STEAM_CACHE_DURATION) {
                const players = JSON.parse(cachedData);
                allPlayers = players;
                chrome.storage.local.get(['gh_manual_track_list'], (res) => {
                    manualTrackList = res.gh_manual_track_list || [];
                    if(listData) renderFriendsUI(players, listData);
                    updateStats(players);
                    if(document.getElementById('track-modal-overlay')) renderTrackedListInModal();
                });
                return;
            }
        }
    }

    if (!isSilent && listData) {
        const modeText = USER_STEAM_KEY ? "API CONNECT..." : "SCANNING PAGE...";
        listData.innerHTML = `
            <div style="text-align:center; padding-top:40px;">
                <div style="margin:0 auto 10px; width:30px; height:30px; border:3px solid rgba(0,255,136,0.1); border-top:3px solid #00ff88; border-radius:50%; animation:spin 1s linear infinite;"></div>
                <div style="font-size:10px; color:#00ff88; font-weight:bold; letter-spacing:1px; animation:pulse 1.5s infinite;">${modeText}</div>
            </div>
        `;
    }

    if (USER_STEAM_KEY) {
        fetchSteamDataAPI(null, listData, isSilent);
    } else {
        fetchSteamDataScraper(listData, isSilent);
    }
}

async function fetchSteamDataAPI(ignored, container, isSilent = false) {
    try {
        let mySteamID = '';
        try {
            const homeRes = await fetchWithTimeout('https://steamcommunity.com/');
            const homeText = await homeRes.text();
            const match = homeText.match(/g_steamID\s*=\s*"(\d{17})"/);
            if (match && match[1]) mySteamID = match[1];
            else throw new Error("Not Logged In");
        } catch (detectError) {
            if (localStorage.getItem('gh_last_platform') !== 'steam') return; // FIX
            if(!isSilent && container) renderLoginError(container);
            return;
        }

        const listRes = await fetchWithTimeout(`https://api.steampowered.com/ISteamUser/GetFriendList/v1/?key=${USER_STEAM_KEY}&steamid=${mySteamID}&relationship=friend`);
        
        const contentType = listRes.headers.get("content-type");
        if (listRes.status === 403) throw new Error("Invalid API Key");
        if (!contentType || !contentType.includes("application/json")) {
             throw new Error("Steam API returned HTML. Check Key or Proxy.");
        }

        const listData = await listRes.json();
        if (!listData.friendslist) throw new Error("Private");
        const currentFriendIDs = listData.friendslist.friends.map(f => f.steamid);
        
        const storage = await new Promise(resolve => chrome.storage.local.get(['gh_manual_track_list'], resolve));
        const manualList = storage.gh_manual_track_list || [];
        manualTrackList = manualList;

        const combinedIDs = [...new Set([...manualList, ...currentFriendIDs])];
        const idsStr = combinedIDs.slice(0, 100).join(',');

        const [infoRes, banRes] = await Promise.all([ 
            fetchWithTimeout(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${USER_STEAM_KEY}&steamids=${idsStr}`),
            fetchWithTimeout(`https://api.steampowered.com/ISteamUser/GetPlayerBans/v1/?key=${USER_STEAM_KEY}&steamids=${idsStr}`)
        ]);
        
        if (!infoRes.ok || !banRes.ok) throw new Error("API Error");

        const infoData = await infoRes.json();
        const banData = await banRes.json();
        
        allPlayers = infoData.response.players.map(player => {
            const banInfo = banData.players.find(b => b.SteamId === player.steamid);
            return { ...player, vacBanned: banInfo ? banInfo.VACBanned : false };
        });

        checkNotifications(allPlayers);
        archiveFriendsData(allPlayers);
        handleFriendHistory(currentFriendIDs);
        
        if(container) saveAndRender(allPlayers, container);

    } catch (e) {
        if (localStorage.getItem('gh_last_platform') !== 'steam') return; // FIX
        if(!isSilent && container) handleError(e, container);
    }
}

async function fetchSteamDataScraper(container, isSilent = false) {
    try {
        const res = await fetchWithTimeout('https://steamcommunity.com/my/friends/', { timeout: 8000 });
        const htmlText = await res.text();
        
        if (res.url.includes('login') || htmlText.includes('login_btn') || htmlText.includes('Sign In') || htmlText.includes('g_steamID = false')) {
             if (localStorage.getItem('gh_last_platform') !== 'steam') return; // FIX
            if(!isSilent && container) renderLoginError(container);
            return;
        }

        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlText, 'text/html');
        const friendElements = doc.querySelectorAll('.friend_block_v2');
        
        if (friendElements.length === 0) {
            if (localStorage.getItem('gh_last_platform') !== 'steam') return; // FIX
            if(!isSilent && container) {
                container.innerHTML = '<p style="text-align:center; padding:20px; color:#888;">No friends found (or profile private).<br><button onclick="initFriendsTab()" style="margin-top:10px; cursor:pointer;">Retry</button></p>';
            }
            return;
        }

        const scrapedPlayers = Array.from(friendElements).map(el => {
            const steamid = el.getAttribute('data-steamid');
            let name = "Unknown";
            const contentDiv = el.querySelector('.friend_block_content');
            if(contentDiv) {
                for(let node of contentDiv.childNodes) {
                    if(node.nodeType === 3 && node.textContent.trim().length > 0) {
                        name = node.textContent.trim();
                        break;
                    }
                }
            }
            
            const avatar = el.querySelector('.player_avatar img')?.src || "";
            const statusTextEl = el.querySelector('.friend_small_text');
            const rawStatus = statusTextEl ? statusTextEl.textContent.trim() : "";
            
            let state = 0; 
            let gameInfo = null;
            let extractedGameID = null;

            const isOnlineClass = el.classList.contains('online');
            const isInGameClass = el.classList.contains('in-game');

            if (isOnlineClass) state = 1; 

            if (isInGameClass) {
                state = 1;
                gameInfo = rawStatus.replace(/^Playing\s+/i, '').replace(/^In-Game\s+/i, '').trim();
                extractedGameID = null; 
            } else if (isOnlineClass) {
                if (rawStatus.includes('Away') || rawStatus.includes('Snooze')) state = 3;
                else if (rawStatus.includes('Busy')) state = 2; 
                else state = 1;
            } else {
                state = 0;
            }

            return {
                steamid: steamid,
                personaname: name,
                avatarfull: avatar,
                personastate: state, 
                gameextrainfo: gameInfo,
                gameid: extractedGameID, 
                lastlogoff: 0,
                vacBanned: false,
                profileurl: `https://steamcommunity.com/profiles/${steamid}/`
            };
        });

        checkNotifications(scrapedPlayers);
        archiveFriendsData(scrapedPlayers);
        
        const currentFriendIDs = scrapedPlayers.map(p => p.steamid);
        handleFriendHistory(currentFriendIDs);
        
        allPlayers = scrapedPlayers;
        if(container) saveAndRender(allPlayers, container);
} catch (e) {
        if (localStorage.getItem('gh_last_platform') !== 'steam') return; // FIX
        if(!isSilent && container) {
            container.innerHTML = `<div style="text-align:center; padding:30px;"><p style="color:#f44; font-weight:bold; font-size:11px;">Connection Timeout</p><button id="retry-btn-scraper" style="margin-top:10px; background:#1a1a1a; color:#00ff88; border:1px solid #00ff88; padding:5px 15px; border-radius:4px; cursor:pointer;">RETRY</button></div>`;
            
            setTimeout(() => {
                const btn = document.getElementById('retry-btn-scraper');
                if(btn) btn.onclick = () => initFriendsTab();
            }, 0);
        }
    }
}


// ---------------------------------------------------------
// Notifications System (FIXED: Online/Offline Support)
// ---------------------------------------------------------

function checkNotifications(newPlayersData) {
    const oldDataJson = localStorage.getItem('gh_steam_data');
    if (!oldDataJson) return; 
    
    const oldPlayers = JSON.parse(oldDataJson);
    const oldMap = {};
    oldPlayers.forEach(p => oldMap[p.steamid] = p);

    newPlayersData.forEach(newPlayer => {
        if (notifyList.includes(newPlayer.steamid)) {
            const oldPlayer = oldMap[newPlayer.steamid];
            if (oldPlayer) {
                const wasPlaying = oldPlayer.gameextrainfo;
                const isPlaying = newPlayer.gameextrainfo;

                if (isPlaying && (!wasPlaying || wasPlaying !== isPlaying)) {
                    sendNotification(newPlayer.personaname, isPlaying, newPlayer.avatarfull, 'game');
                }

                const oldState = oldPlayer.personastate; // 0 = Offline
                const newState = newPlayer.personastate;

                if (oldState === 0 && newState > 0) {
                    sendNotification(newPlayer.personaname, "Online", newPlayer.avatarfull, 'online');
                }
                else if (oldState > 0 && newState === 0) {
                    sendNotification(newPlayer.personaname, "Offline", newPlayer.avatarfull, 'offline');
                }
            }
        }
    });
}

function sendNotification(playerName, detail, iconUrl, type = 'game') {
    let title = "";
    let message = "";

    if (type === 'game') {
        title = `🎮 ${playerName} is playing!`;
        message = `${playerName} started playing ${detail}`;
    } else if (type === 'online') {
        title = `🟢 ${playerName} is Online`;
        message = `${playerName} is now Online`;
    } else if (type === 'offline') {
        title = `🔴 ${playerName} is Offline`;
        message = `${playerName} went Offline`;
    }

    if (chrome.notifications) {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icon.png', 
            title: title,
            message: message,
            priority: 2
        });
    }
}

function toggleNotification(steamId) {
    if (notifyList.includes(steamId)) {
        notifyList = notifyList.filter(id => id !== steamId);
    } else {
        notifyList.push(steamId);
        sendNotification("System", "Notifications Enabled for this user", "icon.png");
    }
    
    chrome.storage.local.set({ 'gh_notify_list': notifyList }, () => {
        const btn = document.querySelector(`.bell-toggle[data-id="${steamId}"]`);
        if (btn) {
            const isNotified = notifyList.includes(steamId);
            const hasKey = !!USER_STEAM_KEY;
            
            let bellColor, iconType;
            if (!hasKey) {
                bellColor = '#ff4444';
                iconType = 'crossed';
            } else if (isNotified) {
                bellColor = '#00ff88';
                iconType = 'normal';
            } else {
                bellColor = '#00c3ff';
                iconType = 'crossed';
            }

            btn.innerHTML = iconType === 'normal'
                ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${bellColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 0 4px #00ff88);"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>`
                : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${bellColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.8;"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
        }
    });
}

// ---------------------------------------------------------
// Helpers & Renderers
// ---------------------------------------------------------

function archiveFriendsData(players) {
    chrome.storage.local.get(['gh_friends_archive'], (result) => {
        let archive = result.gh_friends_archive || {};
        players.forEach(p => {
            archive[p.steamid] = {
                personaname: p.personaname,
                avatarfull: p.avatarfull,
                profileurl: p.profileurl
            };
        });
        chrome.storage.local.set({ 'gh_friends_archive': archive });
    });
}

function handleFriendHistory(currentIDs) {
    chrome.storage.local.get(['gh_saved_friends', 'gh_permanent_removed', 'gh_friends_archive'], (result) => {
        let savedFriends = result.gh_saved_friends || [];
        let permanentRemoved = result.gh_permanent_removed || []; 
        let archive = result.gh_friends_archive || {};

        const newMissingIDs = savedFriends.filter(id => !currentIDs.includes(id));
        
        if (newMissingIDs.length > 0) {
            let hasChanges = false;
            newMissingIDs.forEach(missingID => {
                const alreadyRemoved = permanentRemoved.find(p => p.steamid === missingID);
                if (!alreadyRemoved) {
                    const archivedData = archive[missingID] || { personaname: "Unknown", avatarfull: "", profileurl: `https://steamcommunity.com/profiles/${missingID}` };
                    permanentRemoved.push({
                        steamid: missingID,
                        personaname: archivedData.personaname,
                        avatarfull: archivedData.avatarfull,
                        profileurl: archivedData.profileurl,
                        removedAt: Date.now()
                    });
                    hasChanges = true;
                }
            });
            if (hasChanges) {
                chrome.storage.local.set({ 'gh_permanent_removed': permanentRemoved });
                updateRemovedCounter(permanentRemoved.length);
            }
        }
        
        chrome.storage.local.set({ 'gh_saved_friends': currentIDs });
        updateRemovedCounter(permanentRemoved.length);
    });
}

function updateRemovedCounter(count) {
    const removedEl = document.getElementById('removed-count');
    const removedTrigger = document.getElementById('removed-stat-trigger');
    if (removedEl) removedEl.innerText = count;
    if (removedTrigger && count > 0) {
        removedTrigger.classList.add('has-removed');
    }
}

function saveAndRender(players, container) {

    if (localStorage.getItem('gh_last_platform') !== 'steam') return; 

    localStorage.setItem('gh_steam_data', JSON.stringify(players));
    localStorage.setItem('gh_steam_time', Date.now().toString());
    chrome.storage.local.get(['gh_permanent_removed'], (r) => {
        const removedCount = r.gh_permanent_removed ? r.gh_permanent_removed.length : 0;
        updateStats(players, removedCount);
        renderFriendsUI(players, container);
        // [UPDATED] Update the tracking modal if it is open
        if(document.getElementById('track-modal-overlay')) {
            renderTrackedListInModal();
        }
    });
}

function renderLoginError(container) {
    if(!container) return;
    container.innerHTML = `
        <div style="text-align:center; padding:20px;">
            <p style="color:#f44; font-weight:bold;">Login Required</p>
            <p style="color:#888; font-size:11px; margin-top:5px;">Please login to Steam to scan friends.</p>
            <a href="https://steamcommunity.com/login/home/" target="_blank" style="display:inline-block; margin-top:10px; background:#1a1a1a; color:#fff; padding:5px 10px; text-decoration:none; border-radius:4px; font-size:10px;">LOGIN NOW</a>
            <br>
            <button id="btn-login-retry" style="margin-top:10px; background:#00ff88; color:#000; border:none; padding:5px 10px; border-radius:4px; cursor:pointer; font-weight:bold; font-size:10px;">RETRY SCAN</button>
        </div>
    `;
    
    setTimeout(() => {
        const btn = document.getElementById('btn-login-retry');
        if(btn) btn.onclick = () => initFriendsTab();
    }, 0);
}

function handleError(e, container) {
    if(!container) return;
    let errorMsg = "Error";
    if (e.message === "Not Logged In") errorMsg = "Login to Steam first";
    else if (e.message === "Invalid API Key") errorMsg = "Invalid API Key! Clear it in settings.";
    else if (e.message === "Private") errorMsg = "Profile Private";
    else if (e.message.includes("HTML")) errorMsg = "API Connection Failed (HTML Response)";
    container.innerHTML = `<p style="color:#f44; text-align:center; font-size:11px; margin-top:20px;">${errorMsg}</p>`;
}

// [UPDATED] Render Main Friend List (Filters out Manual Tracks)
function renderFriendsUI(players, container, sort = true) {
    if(!container) return;
    
    let expandedIds = [];
    document.querySelectorAll('.friend-item-row.expanded').forEach(el => expandedIds.push(el.id));

    container.replaceChildren();

    if (sort) {
        players.sort((a, b) => { 
             const aPlaying = a.gameextrainfo ? 2 : 0;
            const bPlaying = b.gameextrainfo ? 2 : 0;
            const aState = (a.personastate > 0) ? 1 : 0;
            const bState = (b.personastate > 0) ? 1 : 0;
            return (bPlaying + bState) - (aPlaying + aState);
        });
    }

    players.forEach(p => {
        if (manualTrackList.includes(p.steamid)) return;

        const isPlaying = !!p.gameextrainfo;
        const status = getStatusDetails(p);
        const opacity = (p.personastate === 0 && !isPlaying) ? '0.6' : '1';
        const borderColor = isPlaying ? '#00ff8844' : '#222';
        const rowId = `steam-card-${p.steamid}`;

        const wrapper = document.createElement('div');
        
        const row = document.createElement('div');
        row.className = `friend-item-row ${isPlaying ? 'playing-glow' : ''}`;
        row.id = rowId;
        row.style.borderColor = borderColor;
        row.style.opacity = opacity;

        const leftSide = document.createElement('div');
        leftSide.style.cssText = "display: flex; align-items: center; gap: 12px; flex: 1;";

        const imgContainer = document.createElement('div');
        imgContainer.style.position = 'relative';
        
        const avatar = document.createElement('img');
        avatar.src = p.avatarfull;
        avatar.style.cssText = `width: 38px; height: 38px; border-radius: 50%; border: 2px solid ${isPlaying ? '#00ff88' : (p.personastate > 0 ? '#00ff8866' : '#333')};`;
        
        const statusDot = document.createElement('span');
        statusDot.style.cssText = `position:absolute; bottom:1px; right:1px; width:10px; height:10px; border-radius:50%; background:${status.color}; border:2px solid #161616;`;
        
        imgContainer.append(avatar, statusDot);

        const textContainer = document.createElement('div');
        textContainer.style.cssText = "flex: 1; min-width: 0;";
        
        const nameRow = document.createElement('div');
        nameRow.style.cssText = `font-size: 12px; font-weight: bold; color: ${p.personastate > 0 || isPlaying ? '#eee' : '#777'}; display: flex; align-items: center; gap: 6px;`;
        
        const nameSpan = document.createElement('span');
        nameSpan.style.cssText = "overflow: hidden; text-overflow: ellipsis; white-space: nowrap;";
        nameSpan.textContent = p.personaname;
        nameRow.appendChild(nameSpan);

        if (p.vacBanned) {
            const vacSpan = document.createElement('span');
            vacSpan.textContent = "VAC";
            vacSpan.style.cssText = "background:#ff4444; color:#fff; font-size:8px; padding:1px 3px; border-radius:3px;";
            nameRow.appendChild(vacSpan);
        }

        const subRow = document.createElement('div');
        subRow.style.cssText = "display: flex; align-items: center; gap: 8px;";
        
        const statusText = document.createElement('div');
        statusText.style.cssText = `font-size: 10px; color: ${status.color}; opacity: ${p.personastate > 0 || isPlaying ? 1 : 0.6};`;
        statusText.textContent = isPlaying ? `Playing: ${p.gameextrainfo}` : (p.personastate === 0 ? `Last seen: ${formatTime(p.lastlogoff)}` : status.text);

        const bellBtn = document.createElement('div');
        bellBtn.className = 'bell-toggle';
        bellBtn.dataset.id = p.steamid;
        bellBtn.innerHTML = getBellIconSVG(notifyList.includes(p.steamid), !!USER_STEAM_KEY); // دالة مساعدة
        bellBtn.onclick = (e) => {
             e.stopPropagation();
             if (!USER_STEAM_KEY) { alert("API Key Required"); return; }
             toggleNotification(p.steamid);
        };
        
        subRow.append(statusText, bellBtn);
        textContainer.append(nameRow, subRow);
        leftSide.append(imgContainer, textContainer);

        const rightSide = document.createElement('div');
        rightSide.style.cssText = "display: flex; align-items: center;";

        if (USER_STEAM_KEY && isPlaying && p.gameid) {
            const storeLink = document.createElement('a');
            storeLink.href = `https://store.steampowered.com/app/${p.gameid}`;
            storeLink.target = "_blank";
            storeLink.className = "steam-store-btn";
            storeLink.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>`;
            storeLink.onclick = (e) => e.stopPropagation();
            rightSide.appendChild(storeLink);
        }

        const arrowDiv = document.createElement('div');
        arrowDiv.className = "steam-arrow-icon";
        arrowDiv.textContent = "▼"; 
        rightSide.appendChild(arrowDiv);

        row.append(leftSide, rightSide);

        row.onclick = (e) => {
            if (e.target.closest('a') || e.target.closest('.bell-toggle')) return;
            toggleSteamDetails(p.steamid, row);
        };

        const panel = document.createElement('div');
        panel.className = 'steam-details-panel';
        panel.id = `details-${p.steamid}`;

        const activityDiv = document.createElement('div');
        activityDiv.id = `activity-${p.steamid}`;
        activityDiv.style.marginBottom = "10px";
        const loadingSpan = document.createElement('span');
        loadingSpan.style.cssText = "font-size: 10px; color: #666;";
        loadingSpan.textContent = "Loading activity...";
        activityDiv.appendChild(loadingSpan);

        const actionsRow = document.createElement('div');
        actionsRow.className = 'steam-actions-row';

        const createActionBtn = (icon, text, url, isChat = false) => {
            const btn = document.createElement(isChat ? 'div' : 'a');
            btn.className = 'steam-action-btn';
            if (!isChat) { btn.href = url; btn.target = "_blank"; }
            
            const iconSpan = document.createElement('span');
            iconSpan.textContent = icon;
            btn.append(iconSpan, document.createTextNode(" " + text));
            
            if (isChat) {
                btn.style.cursor = "pointer";
                btn.style.userSelect = "none";
                btn.onclick = (e) => {
                    e.stopPropagation();
                    chrome.tabs.update(undefined, { url: url });
                };
            }
            return btn;
        };

        actionsRow.append(
            createActionBtn('👤', 'Profile', p.profileurl),
            createActionBtn('💬', 'Chat', `steam://friends/message/${p.steamid}`, true),
            createActionBtn('🎒', 'Inv', `${p.profileurl}/inventory/`)
        );

        panel.append(activityDiv, actionsRow);

        wrapper.append(row, panel);
        container.appendChild(wrapper);
    });

    expandedIds.forEach(id => {
        const el = document.getElementById(id);
        const sid = id.replace('steam-card-', '');
        if (el) toggleSteamDetails(sid, el);
    });
}

function getBellIconSVG(isActive, hasKey) {
    let color = !hasKey ? '#ff4444' : (isActive ? '#00ff88' : '#00c3ff');
    if (isActive) {
        return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>`;
    } else {
        return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.8;"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
    }
}

async function toggleSteamDetails(sid, rowElement) {
    const detailsPanel = document.getElementById(`details-${sid}`);
    const activityContainer = document.getElementById(`activity-${sid}`);
    const wasExpanded = rowElement.classList.contains('expanded');
    
    document.querySelectorAll('.friend-item-row').forEach(el => el.classList.remove('expanded'));
    document.querySelectorAll('.steam-details-panel').forEach(el => el.style.display = 'none');

    if (!wasExpanded) {
        detailsPanel.style.display = 'block';
        rowElement.classList.add('expanded');

        if (activityContainer.textContent.includes("Loading")) {
            if (!USER_STEAM_KEY) {
                 activityContainer.textContent = ""; // تفريغ
                 const msg = document.createElement('div');
                 msg.style.cssText = "font-size:9px; color:#555; text-align:center;";
                 msg.textContent = "Recent games require API Key.";
                 activityContainer.appendChild(msg);
                 return;
            }
            try {
                const res = await fetch(`https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v1/?key=${USER_STEAM_KEY}&steamid=${sid}&count=3`);
                
                const contentType = res.headers.get("content-type");
                if (contentType && !contentType.includes("application/json")) throw new Error("API Error");

                const data = await res.json();
                
                activityContainer.replaceChildren();

                if (data.response.games && data.response.games.length > 0) {
                    const titleDiv = document.createElement('div');
                    titleDiv.style.cssText = "font-size:9px; color:#555; margin-bottom:5px; text-transform:uppercase; font-weight:bold;";
                    titleDiv.textContent = "Recently Played";
                    activityContainer.appendChild(titleDiv);

                    data.response.games.forEach(g => {
                        const isBlocked = IGNORED_APPS.includes(g.appid);
                        
                        const row = document.createElement('div');
                        row.className = 'recent-game-row';

                        if (isBlocked || !g.img_icon_url) {
                            const unknownIcon = document.createElement('div');
                            unknownIcon.style.cssText = "width:20px; height:20px; border-radius:3px; background:#222; display:flex; align-items:center; justify-content:center; color:#00ff88; font-weight:bold; font-size:10px;";
                            unknownIcon.textContent = "?";
                            row.appendChild(unknownIcon);
                        } else {
                            const img = document.createElement('img');
                            img.src = `http://media.steampowered.com/steamcommunity/public/images/apps/${g.appid}/${g.img_icon_url}.jpg`;
                            img.className = 'recent-game-img';
                            row.appendChild(img);
                        }

                        const infoDiv = document.createElement('div');
                        infoDiv.style.cssText = "flex:1; min-width:0; margin-left:5px;";

                        const nameDiv = document.createElement('div');
                        nameDiv.style.cssText = "font-size:11px; color:#ddd;";
                        nameDiv.textContent = g.name; 

                        const timeDiv = document.createElement('div');
                        timeDiv.style.cssText = "font-size:9px; color:#00ff88;";
                        timeDiv.textContent = `${Math.round(g.playtime_forever/60)} Hours Total`;

                        infoDiv.append(nameDiv, timeDiv);
                        row.appendChild(infoDiv);
                        
                        activityContainer.appendChild(row);
                    });
                } else {
                    const noGamesMsg = document.createElement('div');
                    noGamesMsg.style.cssText = "font-size:10px; color:#ff0000; font-weight:bold; padding:5px; text-align:center;";
                    noGamesMsg.textContent = "NO GAMES / PRIVATE";
                    activityContainer.appendChild(noGamesMsg);
                }
            } catch (e) {
                activityContainer.replaceChildren();
                const errorMsg = document.createElement('div');
                errorMsg.style.cssText = "font-size:10px; color:#ff0000; font-weight:bold; padding:5px; text-align:center;";
                errorMsg.textContent = "ERROR LOADING GAMES";
                activityContainer.appendChild(errorMsg);
            }
        }
    }
}

function formatTime(t) {
    if(!t) return "";
    const s = Math.floor((Date.now() - t * 1000) / 1000);
    if (s < 3600) return Math.floor(s/60) + "M AGO";
    if (s < 86400) return Math.floor(s/3600) + "H AGO";
    return Math.floor(s/86400) + "D AGO";
}

function getStatusDetails(p) {
    if(p.gameextrainfo) return {text: p.gameextrainfo.toUpperCase(), color: '#00ff88'};
    if(p.personastate === 1) return {text: 'ONLINE', color: '#00ff88'};
    if(p.personastate === 2) return {text: 'BUSY', color: '#ff4444'};
    if(p.personastate === 3) return {text: 'AWAY', color: '#00c3ff'};
    return {text: 'OFFLINE', color: '#777'};
}

// ---------------------------------------------------------
// Faceit Logic
// ---------------------------------------------------------
async function fetchFaceitData(container) {
    container.innerHTML = `
        <div class="faceit-search-wrapper">
            <input type="text" id="faceit-nick" class="faceit-modern-input" placeholder="Search nickname...">
            <button id="btn-faceit-search-manual" class="faceit-modern-btn"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg> Search</button>
        </div>
        <div id="faceit-results-list"></div>
        <div id="faceit-loader-box" style="text-align:center; padding:20px; display:none;">
            <div id="loader" style="margin:0 auto 10px; width:25px; height:25px; border:3px solid rgba(255,85,0,0.1); border-top:3px solid #ff5500; border-radius:50%; animation:spin 1s linear infinite;"></div>
            <div id="faceit-sync-status" style="font-size:9px; color:#ff5500; font-weight:bold;">Syncing...</div>
        </div>
    `;

    const resList = document.getElementById('faceit-results-list');
    const loaderBox = document.getElementById('faceit-loader-box');
    const statusDiv = document.getElementById('faceit-sync-status');
    const searchInput = document.getElementById('faceit-nick');
    const searchBtn = document.getElementById('btn-faceit-search-manual');

    if (!USER_FACEIT_KEY) {
        resList.innerHTML = `
            <div style="text-align:center; padding:20px;">
                <p style="color:#ff5500; font-weight:bold; font-size:11px;">FACEIT API KEY MISSING</p>
                <p style="color:#888; font-size:10px; margin-bottom:15px;">Please set your Faceit API Key in the Dashboard.</p>
                <button id="btn-go-settings-faceit" style="background:#1a1a1a; color:#ff5500; border:1px solid #ff5500; padding:5px 15px; border-radius:4px; cursor:pointer;">GO TO SETTINGS</button>
            </div>
        `;
        setTimeout(() => {
            const btn = document.getElementById('btn-go-settings-faceit');
            if(btn) btn.onclick = () => document.querySelector('[data-target="dashboard"]').click();
        }, 100);
        return;
    }

    const rawSteamData = localStorage.getItem('gh_steam_data');
    const friends = rawSteamData ? JSON.parse(rawSteamData) : [];

    async function performSearch() {
        const nick = searchInput.value.trim();
        if(!nick) return;
        loaderBox.style.display = 'block';
        statusDiv.innerText = "Searching...";
        try {
            const r = await fetchWithTimeout(`https://open.faceit.com/data/v4/players?nickname=${nick}`, {
                headers: { 'Authorization': `Bearer ${USER_FACEIT_KEY}` }
            });
            
            if (localStorage.getItem('gh_last_platform') !== 'faceit') return; // FIX
            
            const contentType = r.headers.get("content-type");
            if (contentType && !contentType.includes("application/json")) throw new Error("HTML Error");

            if (r.status === 429) throw new Error("Rate Limit");
            if (!r.ok) throw new Error("Not Found");
            const d = await r.json();
            const stats = await getFaceitStats(d.player_id);
            if (typeof showFaceitProfileModal === 'function') {
                showFaceitProfileModal(d, stats);
            }
            searchInput.value = '';
        } catch(e) {
            statusDiv.innerText = e.message === "Rate Limit" ? "Slow down!" : "Not Found!";
        }
        loaderBox.style.display = 'none';
    }
    searchBtn.onclick = performSearch;
    searchInput.onkeypress = (e) => { if(e.key === 'Enter') performSearch(); };

    if (friends.length === 0) {
        resList.innerHTML = '<p style="color:#888; text-align:center; font-size:10px; margin-top:20px;">No Steam friends synced. Please open STEAM tab first to scan.</p>';
        return;
    }

    const storage = await chrome.storage.local.get(['gh_faceit_cache']);
    let faceitCache = storage.gh_faceit_cache || {}; 

    let displayedCount = 0;
    friends.forEach(friend => {
        const cachedData = faceitCache[friend.steamid];
        if (cachedData && !cachedData.noFaceit) {
            renderFaceitRow(cachedData, friend, resList);
            displayedCount++;
        }
    });

    const now = Date.now();
    const CACHE_DURATION_FACEIT = 3 * 60 * 60 * 1000;
    let friendsToScan = friends.filter(friend => {
        const cachedData = faceitCache[friend.steamid];
        if (!cachedData) return true;
        if (cachedData.noFaceit && (now - cachedData.lastUpdated > 24 * 60 * 60 * 1000)) return true;
        if (!cachedData.noFaceit && (now - cachedData.lastUpdated > CACHE_DURATION_FACEIT)) return true;
        return false;
    });

    if (friendsToScan.length === 0) {
        if(displayedCount === 0) {
             resList.innerHTML = '<p style="color:#666; text-align:center; font-size:10px; margin-top:30px;">Scan Complete: No Faceit players found among your friends.</p>';
        }
        return;
    }

    loaderBox.style.display = 'block';
    statusDiv.innerText = `Syncing ${friendsToScan.length} friends...`;

    async function checkAndCache(friend) {
        try {
            const r = await fetchWithTimeout(`https://open.faceit.com/data/v4/players?game=cs2&game_player_id=${friend.steamid}`, {
                headers: { 'Authorization': `Bearer ${USER_FACEIT_KEY}` },
                timeout: 5000
            });
            if (r.status === 429) return "STOP";
            
            const contentType = r.headers.get("content-type");
            if (contentType && !contentType.includes("application/json")) {
                 faceitCache[friend.steamid] = { noFaceit: true, lastUpdated: Date.now() };
                 await chrome.storage.local.set({ 'gh_faceit_cache': faceitCache });
                 return;
            }

            if (r.ok) {
                const data = await r.json();
                const stats = await getFaceitStats(data.player_id); 
                const playerData = { info: data, stats: stats, lastUpdated: Date.now() };
                faceitCache[friend.steamid] = playerData;
                await chrome.storage.local.set({ 'gh_faceit_cache': faceitCache });
                renderFaceitRow(playerData, friend, resList);
                displayedCount++;
            } else {
                faceitCache[friend.steamid] = { noFaceit: true, lastUpdated: Date.now() };
                await chrome.storage.local.set({ 'gh_faceit_cache': faceitCache });
            }
        } catch (e) { }
    }

    const chunkSize = 5;
    for (let i = 0; i < friendsToScan.length; i += chunkSize) {
        if (document.getElementById('friends-list-data').innerHTML === '') break;
        
        // [CRITICAL CHECK] Stop loop if user switched tabs
        if (localStorage.getItem('gh_last_platform') !== 'faceit') break; 

        const chunk = friendsToScan.slice(i, i + chunkSize);
        const results = await Promise.all(chunk.map(f => checkAndCache(f)));
        if (results.includes("STOP")) {
            statusDiv.innerText = "API Limit Reached. Pausing.";
            break;
        }
        const remaining = friendsToScan.length - (i + chunkSize);
        if (remaining > 0) statusDiv.innerText = `Syncing ${remaining} remaining...`;
        await new Promise(r => setTimeout(r, 1000));
    }
    loaderBox.style.display = 'none';
    
    if(displayedCount === 0 && document.getElementById('faceit-results-list').innerHTML === "") {
         resList.innerHTML = '<p style="color:#666; text-align:center; font-size:10px; margin-top:30px;">Scan Complete: No Faceit players found.</p>';
    }
}

function renderFaceitRow(playerData, friend, container) {
    const data = playerData.info;
    const stats = playerData.stats;
    const existId = `faceit-card-${data.player_id}`;
    if (document.getElementById(existId)) return;

    const winRate = stats?.lifetime['Win Rate %'] || '0';
    const kdRatio = stats?.lifetime['Average K/D Ratio'] || '0.00';
    const lvl = data.games.cs2?.skill_level || 1;
    const elo = data.games.cs2?.faceit_elo || '---';
    const kdColor = getKDColor(kdRatio);
    const wrColor = getWinRateColor(winRate);
    const lvlColor = getLevelColor(lvl);

    const row = document.createElement('div');
    row.id = existId;
    row.className = 'faceit-row-compact';
    row.title = "Click to view full details";
    row.style.cssText = `background: linear-gradient(90deg, #161616 0%, #111 100%); border: 1px solid #222; border-left: 3px solid ${lvlColor}; border-radius: 6px; margin-bottom: 8px; padding: 10px; display: flex; align-items: center; justify-content: space-between; transition: all 0.2s ease; cursor: pointer;`;

    const leftSide = document.createElement('div');
    leftSide.style.cssText = "display: flex; align-items: center; gap: 12px; width: 55%;";

    const imgWrapper = document.createElement('div');
    imgWrapper.style.position = 'relative';

    const avatar = document.createElement('img');
    avatar.src = data.avatar || friend.avatarfull;
    avatar.style.cssText = "width: 40px; height: 40px; border-radius: 8px; border: 1px solid #333;";

    const lvlBadge = document.createElement('div');
    lvlBadge.style.cssText = `position: absolute; bottom: -5px; right: -5px; background: ${lvlColor}; color: #000; font-size: 9px; font-weight: 900; width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; border-radius: 4px; border: 1px solid #000;`;
    lvlBadge.textContent = lvl;

    imgWrapper.append(avatar, lvlBadge);

    const infoDiv = document.createElement('div');
    infoDiv.style.minWidth = "0";

    const nickDiv = document.createElement('div');
    nickDiv.style.cssText = "font-size: 13px; font-weight: 800; color: #eee; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;";
    nickDiv.textContent = data.nickname; 

    const eloDiv = document.createElement('div');
    eloDiv.style.cssText = "font-size: 10px; color: #888;";
    eloDiv.textContent = `${elo} ELO`;

    infoDiv.append(nickDiv, eloDiv);
    leftSide.append(imgWrapper, infoDiv);

    const rightSide = document.createElement('div');
    rightSide.style.cssText = "display: flex; align-items: center; gap: 10px;";

    const statsGroup = document.createElement('div');
    statsGroup.style.cssText = "display: flex; gap: 10px; background: #00000055; padding: 5px 10px; border-radius: 6px; border: 1px solid #222;";

    // KD Block
    const kdBlock = document.createElement('div');
    kdBlock.style.cssText = "text-align: center; width: 35px;";
    const kdVal = document.createElement('div');
    kdVal.style.cssText = `font-size: 12px; font-weight: 900; color: ${kdColor};`;
    kdVal.textContent = kdRatio;
    const kdLabel = document.createElement('div');
    kdLabel.style.cssText = "font-size: 7px; color: #555;";
    kdLabel.textContent = "K/D";
    kdBlock.append(kdVal, kdLabel);

    const divider = document.createElement('div');
    divider.style.cssText = "width: 1px; background: #333;";

    // Win Rate Block
    const wrBlock = document.createElement('div');
    wrBlock.style.cssText = "text-align: center; width: 35px;";
    const wrVal = document.createElement('div');
    wrVal.style.cssText = `font-size: 12px; font-weight: 900; color: ${wrColor};`;
    wrVal.textContent = `${winRate}%`;
    const wrLabel = document.createElement('div');
    wrLabel.style.cssText = "font-size: 7px; color: #555;";
    wrLabel.textContent = "WIN";
    wrBlock.append(wrVal, wrLabel);

    statsGroup.append(kdBlock, divider, wrBlock);
    rightSide.appendChild(statsGroup);

    row.append(leftSide, rightSide);

    row.onclick = () => showFaceitProfileModal(data, stats);

    container.appendChild(row);
}

function showFaceitProfileModal(data, stats) {
    localStorage.setItem('gh_active_modal_data', JSON.stringify({ data, stats }));
    const oldModal = document.getElementById('faceit-profile-modal');
    if(oldModal) oldModal.remove();

    const lvl = data.games.cs2?.skill_level || 1;
    const elo = data.games.cs2?.faceit_elo || '---';
    const region = (data.games.cs2?.region || 'EU').toUpperCase();
    const lifetime = stats?.lifetime || {};
    const kd = lifetime['Average K/D Ratio'] || '0.00';
    const winRate = lifetime['Win Rate %'] || '0';
    const matches = lifetime['Matches'] || '0';
    const headshots = lifetime['Average Headshots %'] || '0';
    const streak = lifetime['Longest Win Streak'] || '0';
    const lvlColor = getLevelColor(lvl);
    const kdColor = getKDColor(kd);
    const wrColor = getWinRateColor(winRate);

    const overlay = document.createElement('div');
    overlay.id = 'faceit-profile-modal';
    overlay.className = 'profile-modal-overlay';

    const card = document.createElement('div');
    card.className = 'profile-card';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-modal-btn';
    closeBtn.id = 'close-faceit-modal';
    closeBtn.textContent = '×';
    
    const header = document.createElement('div');
    header.className = 'card-header';
    header.style.cssText = "text-align:center; background: linear-gradient(180deg, #1a1a1a 0%, #111 100%); padding: 20px; border-bottom: 1px solid #222;";

    const imgContainer = document.createElement('div');
    imgContainer.style.cssText = "position:relative; display:inline-block;";
    
    const avatar = document.createElement('img');
    avatar.src = data.avatar || 'https://assets.faceit-cdn.net/frontend_assets/images/default_avatar_user.jpg';
    avatar.style.cssText = `width: 80px; height: 80px; border-radius: 50%; border: 3px solid ${lvlColor}; box-shadow: 0 0 20px ${lvlColor}44;`;
    
    const lvlSpan = document.createElement('span');
    lvlSpan.style.cssText = `position:absolute; bottom:5px; right:0; background:${lvlColor}; color:#000; font-weight:bold; width:22px; height:22px; border-radius:50%; display:flex; align-items:center; justify-content:center; border:2px solid #111;`;
    lvlSpan.textContent = lvl;

    imgContainer.append(avatar, lvlSpan);

    const nameH2 = document.createElement('h2');
    nameH2.style.cssText = "margin:10px 0 5px; color:#fff;";
    nameH2.textContent = data.nickname; 

    const subInfo = document.createElement('div');
    subInfo.style.cssText = "font-size:11px; color:#888;";
    
    const eloSpan = document.createElement('span');
    eloSpan.style.color = "#ffaa00";
    eloSpan.textContent = `${elo} ELO`;
    
    subInfo.append(document.createTextNode(`${region} • `), eloSpan);

    const profileLinkDiv = document.createElement('div');
    profileLinkDiv.style.marginTop = "10px";
    
    const faceitLink = document.createElement('a');
    faceitLink.href = `https://www.faceit.com/en/players/${data.nickname}`;
    faceitLink.target = "_blank";
    faceitLink.style.cssText = "background:#ff5500; color:#fff; text-decoration:none; font-size:10px; padding:5px 15px; border-radius:20px; font-weight:bold;";
    faceitLink.textContent = "FACEIT PROFILE";
    
    profileLinkDiv.appendChild(faceitLink);
    header.append(imgContainer, nameH2, subInfo, profileLinkDiv);

    const grid = document.createElement('div');
    grid.className = 'stat-grid';
    grid.style.cssText = "display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: #222;";

    const createStatBox = (val, label, color) => {
        const box = document.createElement('div');
        box.className = 'stat-box';
        box.style.cssText = "background: #0f0f0f; padding: 15px; text-align: center;";
        const valDiv = document.createElement('div');
        valDiv.className = 'stat-value';
        valDiv.style.cssText = `color:${color}; font-size:16px; font-weight:900;`;
        valDiv.textContent = val;
        const labelDiv = document.createElement('div');
        labelDiv.className = 'stat-label';
        labelDiv.style.cssText = "font-size:9px; color:#666;";
        labelDiv.textContent = label;
        box.append(valDiv, labelDiv);
        return box;
    };

    grid.append(
        createStatBox(kd, 'K/D RATIO', kdColor),
        createStatBox(`${winRate}%`, 'WIN RATE', wrColor),
        createStatBox(matches, 'MATCHES', '#fff'),
        createStatBox(`${headshots}%`, 'HEADSHOTS', '#ddd'),
        createStatBox(streak, 'WIN STREAK', '#00ff88')
    );

    const recentBox = document.createElement('div');
    recentBox.className = 'stat-box';
    recentBox.style.cssText = "background: #0f0f0f; padding: 15px; text-align: center;";
    
    const badgesContainer = document.createElement('div');
    badgesContainer.style.cssText = "display:flex; justify-content:center; gap:3px;";
    
    const recentResults = stats?.lifetime['Recent Results'] || [];
    if(recentResults.length === 0) {
        badgesContainer.innerHTML = '<span style="color:#555">-</span>';
    } else {
        recentResults.forEach(r => {
            const span = document.createElement('span');
            span.style.cssText = `width:8px; height:8px; border-radius:50%; background:${r === '1' ? '#00ff88' : '#ff4444'}; display:inline-block;`;
            badgesContainer.appendChild(span);
        });
    }
    
    const recentLabel = document.createElement('div');
    recentLabel.className = 'stat-label';
    recentLabel.style.cssText = "font-size:9px; color:#666; margin-top:4px;";
    recentLabel.textContent = "RECENT";
    
    recentBox.append(badgesContainer, recentLabel);
    grid.appendChild(recentBox);

    const footer = document.createElement('div');
    footer.style.cssText = "padding:15px; display:flex; gap:10px;";
    
    const steamLink = document.createElement('a');
    steamLink.href = `https://steamcommunity.com/profiles/${data.steam_id_64}`;
    steamLink.target = "_blank";
    steamLink.style.cssText = "flex:1; background:#1a1a1a; color:#ccc; text-align:center; padding:10px; border-radius:8px; text-decoration:none; font-size:11px; font-weight:bold; border:1px solid #333;";
    steamLink.textContent = "STEAM PROFILE";
    
    footer.appendChild(steamLink);

    card.append(closeBtn, header, grid, footer);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    const closeModal = () => {
        overlay.remove();
        localStorage.removeItem('gh_active_modal_data');
    };
    closeBtn.onclick = closeModal;
    overlay.onclick = (e) => { if(e.target === overlay) closeModal(); };
}

function getKDColor(kd) {
    const val = parseFloat(kd);
    if (val >= 1.5) return '#d32ce6'; 
    if (val >= 1.1) return '#00ff88';
    if (val >= 1.0) return '#fff';    
    return '#ff4444';
}

function getWinRateColor(wr) {
    const val = parseInt(wr);
    if (val >= 60) return '#00ff88';
    if (val >= 50) return '#fff';
    return '#ff4444';
}

function getLevelColor(lvl) {
    const colors = { 10: '#FE1F00', 9: '#FE1F00', 8: '#ff5500', 7: '#ff5500', 6: '#ffaa00', 5: '#ffaa00', 4: '#ffcc00', 3: '#fff', 2: '#fff', 1: '#fff' };
    return colors[lvl] || '#fff';
}

async function getFaceitStats(playerId) {
    try {
        const apiKey = USER_FACEIT_KEY;
        const r = await fetch(`https://open.faceit.com/data/v4/players/${playerId}/stats/cs2`, {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        const contentType = r.headers.get("content-type");
        if (contentType && !contentType.includes("application/json")) return null;
        return r.ok ? await r.json() : null;
    } catch (e) { return null; }
}

function updateStats(players, removedCount) {
    const onlineEl = document.getElementById('online-count');
    const playingEl = document.getElementById('playing-count');
    const removedEl = document.getElementById('removed-count');
    const removedTrigger = document.getElementById('removed-stat-trigger');

    if(onlineEl) onlineEl.innerText = players.filter(p => p.personastate > 0).length;
    if(playingEl) playingEl.innerText = players.filter(p => p.gameextrainfo).length;
    if(removedEl) removedEl.innerText = removedCount;
    if (removedCount > 0 && removedTrigger) removedTrigger.classList.add('has-removed');

    const dashboardStat = document.getElementById('stat-friends');
    if (dashboardStat) {
        const onlineCount = players.filter(p => p.personastate > 0).length;
        dashboardStat.innerText = onlineCount;
        dashboardStat.style.color = onlineCount > 0 ? "#00ff88" : "#fff";
    }
}

async function showRemovedModal(missingIDs) {
    let modal = document.getElementById('removed-modal') || document.createElement('div');
    modal.id = 'removed-modal';
    modal.style.cssText = `position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.95); z-index:999999; display:flex; flex-direction:column; padding:20px; box-sizing:border-box; backdrop-filter: blur(5px); animation: fadeIn 0.2s ease;`;
    
    modal.replaceChildren();

    const header = document.createElement('div');
    header.style.cssText = "display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; border-bottom:1px solid #ff444455; padding-bottom:10px;";
    
    const title = document.createElement('span');
    title.style.cssText = "color:#ff4444; font-size:11px; font-weight:bold;";
    title.textContent = "REMOVED FRIENDS HISTORY";
    
    const closeBtn = document.createElement('button');
    closeBtn.id = 'close-modal';
    closeBtn.style.cssText = "background:none; border:none; color:#fff; cursor:pointer; font-size:20px;";
    closeBtn.textContent = "×";
    closeBtn.onclick = () => modal.style.display = 'none';

    header.append(title, closeBtn);

    const content = document.createElement('div');
    content.id = 'modal-content';
    content.style.cssText = "overflow-y:auto; flex:1";

    const clearBtn = document.createElement('button');
    clearBtn.id = 'clear-history';
    clearBtn.style.cssText = "background:#ff444422; border:1px solid #ff4444; color:#ff4444; padding:10px; border-radius:4px; font-size:9px; cursor:pointer; margin-top:10px;";
    clearBtn.textContent = "CLEAR HISTORY";
    clearBtn.onclick = () => { chrome.storage.local.set({ 'gh_permanent_removed': [] }); location.reload(); };

    modal.append(header, content, clearBtn);
    
    if (!document.getElementById('removed-modal')) {
        document.body.appendChild(modal);
    }
    modal.style.display = 'flex';

    const createRow = (name, img, url, dateStr = null) => {
        const row = document.createElement('div');
        row.className = "friend-item-row";
        row.style.borderColor = "#ff444433";

        const avatar = document.createElement('img');
        avatar.src = img || 'icon.png';
        avatar.style.cssText = "width:30px; height:30px; border-radius:50%; border:1px solid #ff4444;";

        const infoDiv = document.createElement('div');
        infoDiv.style.flex = "1";
        
        const nameDiv = document.createElement('div');
        nameDiv.style.cssText = "font-size:11px; color:#eee;";
        nameDiv.textContent = name; 
        infoDiv.appendChild(nameDiv);

        if (dateStr) {
            const dateDiv = document.createElement('div');
            dateDiv.style.cssText = "font-size:9px; color:#666;";
            dateDiv.textContent = dateStr;
            infoDiv.appendChild(dateDiv);
        }

        const link = document.createElement('a');
        link.href = url;
        link.target = "_blank";
        link.style.cssText = "color:#ff4444; font-size:9px; text-decoration:none; border:1px solid #ff444444; padding:3px 6px; border-radius:4px;";
        link.textContent = "PROFILE";

        row.append(avatar, infoDiv, link);
        return row;
    };

    if (!missingIDs) {
         chrome.storage.local.get(['gh_permanent_removed'], (r) => {
             const data = r.gh_permanent_removed || [];
             content.replaceChildren(); 
             data.forEach(p => {
                 const dateStr = new Date(p.removedAt).toLocaleDateString();
                 content.appendChild(createRow(p.personaname, p.avatarfull, p.profileurl, dateStr));
             });
         });
         return;
    }

    if (missingIDs.length > 0) {
        content.replaceChildren();
        if(USER_STEAM_KEY) {
             const idsStr = missingIDs.join(',');
             const res = await fetch(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${USER_STEAM_KEY}&steamids=${idsStr}`);
             const data = await res.json();
             data.response.players.forEach(p => {
                 content.appendChild(createRow(p.personaname, p.avatarfull, p.profileurl));
             });
        } else {
             missingIDs.forEach(id => {
                 content.appendChild(createRow(id, null, `https://steamcommunity.com/profiles/${id}`));
             });
        }
    }
}

// ==========================================
// NOTIFICATION HISTORY UI (FIXED: Append to Body for Z-Index)
// ==========================================

function setupNotificationHistoryUI() {
    const refreshBtn = document.getElementById('refresh-friends');
    if (!refreshBtn || document.getElementById('notif-history-btn')) return;

    const notifWrapper = document.createElement('div');
    notifWrapper.className = 'notif-wrapper';
    notifWrapper.innerHTML = `
        <button id="notif-history-btn" title="Activity History">
            🔔
            <span id="notif-red-dot"></span>
        </button>
    `;
    refreshBtn.parentNode.insertBefore(notifWrapper, refreshBtn);

    const dropdown = document.createElement('div');
    dropdown.id = 'notif-dropdown';
    dropdown.className = 'notif-dropdown';
    dropdown.innerHTML = `
        <div class="notif-header">
            <span>Recent Activity</span>
            <button id="clean-history-btn">Clean</button>
        </div>
        <div id="notif-list-items" class="notif-list-items">
            <div style="padding:20px; text-align:center; color:#666;">No recent activity</div>
        </div>
    `;
    document.body.appendChild(dropdown);

    chrome.storage.local.get(['gh_has_unread'], (r) => {
        const dot = document.getElementById('notif-red-dot');
        if (r.gh_has_unread) dot.style.display = 'block';
    });

    const btn = document.getElementById('notif-history-btn');
    const dot = document.getElementById('notif-red-dot');

    btn.onclick = (e) => {
        e.stopPropagation();
        const isOpen = dropdown.style.display === 'block';
        
        if (!isOpen) {
            const rect = btn.getBoundingClientRect();
            const topPos = rect.bottom + window.scrollY + 5;
            
            const leftPos = rect.right - 220; 
            dropdown.style.left = (leftPos > 0 ? leftPos : 10) + 'px'; 
            dropdown.style.top = topPos + 'px';
            
            dropdown.style.display = 'block';
            dot.style.display = 'none'; 
            chrome.storage.local.set({ 'gh_has_unread': false }); 
            renderHistoryList(); 
        } else {
            dropdown.style.display = 'none';
        }
    };

    document.addEventListener('scroll', (e) => {
        if (dropdown.contains(e.target)) return;
        dropdown.style.display = 'none';
    }, true);

    document.addEventListener('click', (e) => {
        if (e.target.id !== 'notif-history-btn' && !dropdown.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });

    document.getElementById('clean-history-btn').onclick = () => {
        chrome.storage.local.set({ 'gh_notif_history': [] }, () => {
            renderHistoryList();
        });
    };
}

function renderHistoryList() {
    const listContainer = document.querySelector('#notif-dropdown .notif-list-items');
    if(!listContainer) return;

    chrome.storage.local.get(['gh_notif_history'], (result) => {
        const history = result.gh_notif_history || [];
        
        listContainer.replaceChildren();

        if (history.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.style.cssText = 'padding:20px; text-align:center; color:#555; font-size:10px;';
            emptyMsg.textContent = 'No recent alerts.';
            listContainer.appendChild(emptyMsg);
            return;
        }

        history.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'notif-item';

            const img = document.createElement('img');
            img.src = item.avatar;
            img.className = 'notif-img';

            const textDiv = document.createElement('div');
            textDiv.className = 'notif-text';

            const nameDiv = document.createElement('div');
            nameDiv.className = 'notif-name';
            nameDiv.textContent = item.name; 

            const gameDiv = document.createElement('div');
            gameDiv.className = 'notif-game';
            gameDiv.textContent = item.game; 

            const timeDiv = document.createElement('div');
            timeDiv.className = 'notif-time';
            timeDiv.textContent = formatTimeAgo(item.time);

            textDiv.append(nameDiv, gameDiv, timeDiv);
            itemDiv.append(img, textDiv);
            listContainer.appendChild(itemDiv);
        });
    });
}

function formatTimeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
}