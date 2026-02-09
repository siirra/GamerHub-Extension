// =========================================================
// GamerHub Ultimate 2026 - Official Pro Version (Fixed)
// =========================================================

// 🟢 1. Global Image Error Handler (Fixes CSP & Broken Images)
document.addEventListener('error', function(e) {
    if (e.target.tagName.toLowerCase() === 'img') {
        if (e.target.getAttribute('data-failed')) return;
        
        e.target.setAttribute('data-failed', 'true');
        e.target.src = 'icon.png'; 
        
        if (e.target.classList.contains('store-mini-icon')) {
            e.target.style.display = 'none';
        }
    }
}, true); // Capture Phase

const tabs = document.querySelectorAll('.tab-btn');
const contents = document.querySelectorAll('.tab-content');
const tabTitle = document.getElementById('tab-title');
const searchInput = document.getElementById('game-search');
const searchBtn = document.getElementById('search-btn');
const listContainer = document.getElementById('deals-list');
const suggestionsBox = document.getElementById('search-suggestions');

const cache = {
    set: (key, data) => localStorage.setItem(`gh_cache_${key}`, JSON.stringify({data, time: Date.now()})),
    get: (key) => {
        const item = localStorage.getItem(`gh_cache_${key}`);
        if (!item) return null;
        const parsed = JSON.parse(item);
        if (Date.now() - parsed.time > 3600000) return null; 
        return parsed.data;
    }
};

function activateTab(target, button) {
    if (!target) return; 

    if (!button) {
        button = document.querySelector(`.tab-btn[data-target="${target}"]`);
    }

    tabs.forEach(t => t.classList.remove('active'));
    contents.forEach(c => c.classList.remove('active'));
    
    if (button) { button.classList.add('active'); }
    
    const content = document.getElementById(target);
    if (content) { content.classList.add('active'); }
    
    if (tabTitle && button) {
        tabTitle.innerText = button.getAttribute('title') || target.toUpperCase();
    }
    
    localStorage.setItem('gh_lastTab', target);

    if (target === 'dashboard') { updateDashboardData(); }
    if (target === 'freebies') { fetchFreeGames(); }

    if (target === 'friends' && typeof initFriendsTab === 'function') {
        initFriendsTab();
    }

    const isSearchEmpty = searchInput && searchInput.value.trim() === ""; 
    if (target === 'deals' && listContainer && listContainer.innerHTML.trim() === "" && isSearchEmpty) {
        fetchTopDeals();
    }
}

async function updateDashboardData() {
    chrome.storage.local.get(['gh_alerts'], (data) => {
        const gamesCount = data.gh_alerts ? data.gh_alerts.length : 0;
        const statGames = document.getElementById('stat-games');
        if (statGames) statGames.innerText = gamesCount;
    });

    const rawData = localStorage.getItem('gh_steam_data');
    
    if (rawData) {
        const players = JSON.parse(rawData);
        const online = players.filter(p => p.personastate > 0).length;
        const statFriends = document.getElementById('stat-friends');
        if (statFriends) {
            statFriends.innerText = online;
            statFriends.style.color = online > 0 ? "#00ff88" : "#fff";
        }
    } else {
        const statFriends = document.getElementById('stat-friends');
        if (statFriends) {
            statFriends.innerText = "..."; 
            statFriends.style.color = "#ffaa00";
        }

        if (!localStorage.getItem('gh_last_platform')) {
            localStorage.setItem('gh_last_platform', 'steam');
        }

        if (typeof startSteamProcess === 'function') {
            startSteamProcess(true, true); 
        }
    }

    const userCard = document.getElementById('steam-user-card');
    const warningCard = document.getElementById('steam-login-warning');
    const avatarEl = document.getElementById('dashboard-avatar');
    const nameEl = document.getElementById('dashboard-username');
    const idEl = document.getElementById('dashboard-steamid');
    
    const refreshBtn = document.getElementById('btn-refresh-data');
    const logoutBtn = document.getElementById('btn-logout-steam');

    if (refreshBtn) {
        refreshBtn.onclick = () => {
            refreshBtn.style.transform = "rotate(360deg)";
            localStorage.removeItem('gh_steam_data'); 
            localStorage.removeItem('gh_steam_time');
            
            if (nameEl) nameEl.innerText = "Refreshing...";
            

            if (typeof startSteamProcess === 'function') {
                startSteamProcess(true, true);
            }

            setTimeout(() => {
                updateDashboardData(); 
            }, 1000);
        };
    }

    if (logoutBtn) {
        logoutBtn.onclick = () => {
            localStorage.removeItem('gh_steam_data');
            localStorage.removeItem('gh_steam_time');
            localStorage.removeItem('gh_last_platform'); 
            chrome.tabs.create({ url: "https://steamcommunity.com/" });
            window.close();
        };
    }

    chrome.cookies.getAll({ domain: "steamcommunity.com" }, async (cookies) => {
        let steamID = cookies.find(c => c.name === 'steamLoginSecure')?.value?.split('%7C%7C')[0];

        if (!steamID) {
            if (userCard) userCard.style.display = 'none';
            if (warningCard) warningCard.style.display = 'flex';
            if (document.getElementById('stat-friends')) document.getElementById('stat-friends').innerText = "OFF";
            return;
        }

        if (warningCard) warningCard.style.display = 'none';
        if (userCard) userCard.style.display = 'flex';
        if (idEl) idEl.innerText = `ID: ${steamID}`;

        const apiKey = localStorage.getItem('gh_user_steam_key');
        
        try {
            let data = null;
            if (apiKey) {
                const res = await fetch(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${apiKey}&steamids=${steamID}`);
                const json = await res.json();
                if(json.response.players.length > 0) data = json.response.players[0];
            } 
            
            if (!data) {
                const res = await fetch(`https://steamcommunity.com/profiles/${steamID}/?xml=1`);
                const text = await res.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(text, "text/xml");
                const nameNode = doc.querySelector('steamID');
                const avatarNode = doc.querySelector('avatarFull');
                if (nameNode) {
                    data = { personaname: nameNode.textContent, avatarfull: avatarNode ? avatarNode.textContent : 'icon.png' };
                }
            }

            if (data) {
                if (nameEl) nameEl.innerText = data.personaname;
                if (avatarEl) avatarEl.src = data.avatarfull;
            }
        } catch (e) {
            if (nameEl) nameEl.innerText = "Steam User";
        }
    });
}


tabs.forEach(tab => {
    if (tab.id === 'btn-donate') return; 

    tab.addEventListener('click', () => {
        activateTab(tab.dataset.target, tab);
    });
});

function renderGameCard(item, isSearch = false) {
    const gameID = item.gameID;
    const title = isSearch ? item.external : item.title;
    const thumb = item.thumb;
    const salePrice = isSearch ? item.cheapest : item.salePrice;
    const normalPrice = isSearch ? null : item.normalPrice;

    const wrapper = document.createElement('div');
    wrapper.className = 'card-wrapper';

    const card = document.createElement('div');
    card.className = 'game-card';
    card.id = `card-${gameID}`;

    const img = document.createElement('img');
    img.src = thumb;
    img.className = 'game-img';

    const infoDiv = document.createElement('div');
    infoDiv.className = 'game-info';

    const nameDiv = document.createElement('div');
    nameDiv.className = 'game-name';
    nameDiv.textContent = title; 

    const priceRow = document.createElement('div');
    priceRow.className = 'game-price-row';
    priceRow.id = `main-price-${gameID}`;

    if (normalPrice && parseFloat(normalPrice) > parseFloat(salePrice)) {
        const oldSpan = document.createElement('span');
        oldSpan.className = 'old-price';
        oldSpan.textContent = `$${normalPrice}`;
        priceRow.appendChild(oldSpan);
    }
    
    const newSpan = document.createElement('span');
    newSpan.className = 'new-price';
    newSpan.textContent = `$${salePrice}`;
    priceRow.appendChild(newSpan);

    if (normalPrice && parseFloat(normalPrice) > parseFloat(salePrice)) {
        const discountSpan = document.createElement('span');
        discountSpan.className = 'discount-tag';
        discountSpan.textContent = `-${Math.round(((normalPrice - salePrice) / normalPrice) * 100)}%`;
        priceRow.appendChild(discountSpan);
    }

    infoDiv.append(nameDiv, priceRow);

    const arrowDiv = document.createElement('div');
    arrowDiv.className = 'expand-arrow';
    arrowDiv.textContent = '▼';

    card.append(img, infoDiv, arrowDiv);

    const detailsDiv = document.createElement('div');
    detailsDiv.className = 'price-details';
    detailsDiv.id = `details-${gameID}`;
    
    const loadingMsg = document.createElement('p');
    loadingMsg.className = 'status-msg';
    loadingMsg.style.cssText = 'margin:5px 0; font-size:11px;';
    loadingMsg.textContent = 'Loading comparisons...';
    detailsDiv.appendChild(loadingMsg);

    card.addEventListener('click', (e) => {
        if (e.target.classList.contains('buy-btn')) return;
        card.classList.toggle('open');
        detailsDiv.classList.toggle('active');
        if (detailsDiv.textContent.includes('Loading')) fetchAndPopulateCard(gameID);
    });

    wrapper.append(card, detailsDiv);
    if (listContainer) listContainer.appendChild(wrapper);
}

async function fetchAndPopulateCard(gameID) {
    const cached = cache.get(gameID);
    if (cached) { updatePriceUI(gameID, cached); return; }
    try {
        const response = await fetch(`https://www.cheapshark.com/api/1.0/games?id=${gameID}`);
        const data = await response.json();
        cache.set(gameID, data);
        updatePriceUI(gameID, data);
    } catch (e) { console.warn("API Busy"); }
}

function updatePriceUI(gameID, data) {
    const priceRow = document.getElementById(`main-price-${gameID}`);
    const detailsDiv = document.getElementById(`details-${gameID}`);
    if (!priceRow || !data.deals) return;

    const best = data.deals[0];
    const sP = parseFloat(best.price);
    const rP = parseFloat(best.retailPrice);

    priceRow.replaceChildren();
    
    if (rP > sP) {
        const oldP = document.createElement('span');
        oldP.className = 'old-price';
        oldP.textContent = `$${best.retailPrice}`;
        priceRow.appendChild(oldP);
    }

    const newP = document.createElement('span');
    newP.className = 'new-price';
    newP.textContent = `$${best.price}`;
    priceRow.appendChild(newP);

    if (rP > sP) {
        const tag = document.createElement('span');
        tag.className = 'discount-tag';
        tag.textContent = `-${Math.round(((rP - sP) / rP) * 100)}%`;
        priceRow.appendChild(tag);
    }
    
    detailsDiv.replaceChildren();
    
    const targetStores = { 
        "1": "Steam", 
        "2": "GamersGate",
        "3": "GreenMan",
        "7": "GOG", 
        "11": "Humble",
        "13": "Ubisoft",
        "15": "Fanatical",
        "21": "WinGame",
        "23": "GameBillet",
        "25": "Epic Games",
        "27": "Gamesplanet",
        "29": "Gamesload",
        "30": "2Game",
        "32": "IndieGala",
        "35": "DreamGame"
    };

    const MY_CUSTOM_STORES = Object.keys(targetStores); 

    let hasDeals = false;

    data.deals.forEach(deal => {
        if (targetStores[deal.storeID]) {
            hasDeals = true;
            
       const storeIconsMap = {
                "1": "logos/steam.png",
                "2": "logos/gamersgate.png",
                "3": "logos/greenman.png",
                "7": "logos/gog.png",
                "11": "logos/humble.png",
                "13": "logos/ubisoft.png",
                "15": "logos/fanatical.png",
                "21": "logos/wingame.png",
                "23": "logos/gamebillet.png",
                "25": "logos/epicgames.png",
                "27": "logos/gamesplanet.png",
                "29": "logos/gamesload.png",
                "30": "logos/2game.png",
                "32": "logos/indiegala.png",
                "35": "logos/dreamgame.png"
            };
    let iconName = storeIconsMap[deal.storeID] || "icon.png";

            const row = document.createElement('div');
            row.className = 'store-row';

            const nameGroup = document.createElement('div');
            nameGroup.className = 'store-name-group';
            
            const img = document.createElement('img');
            img.src = iconName;
            img.className = 'store-mini-icon';
            img.onerror = function() { this.src = 'icon.png'; }; 
            
            const nameSpan = document.createElement('span');
            nameSpan.textContent = targetStores[deal.storeID];
            
            nameGroup.append(img, nameSpan);

            const rightGroup = document.createElement('div');
            rightGroup.style.cssText = 'display:flex; align-items:center; gap:8px;';

            if (parseFloat(deal.retailPrice) > parseFloat(deal.price)) {
                const old = document.createElement('span');
                old.className = 'old-price';
                old.style.fontSize = '10px';
                old.textContent = `$${deal.retailPrice}`;
                rightGroup.appendChild(old);
            }

            const current = document.createElement('span');
            current.className = 'new-price';
            current.style.fontSize = '12px';
            current.textContent = `$${deal.price}`;
            rightGroup.appendChild(current);

            const buyLink = document.createElement('a');
            buyLink.className = 'buy-btn';
            
            if (MY_CUSTOM_STORES.includes(deal.storeID)) {
                buyLink.href = `https://go.gamer-hub.shop/?storeId=${deal.storeID}&dealID=${deal.dealID}`;
                buyLink.innerHTML = 'VISIT STORE <span style="font-size:10px">↗</span>';
                buyLink.classList.add('visit-store-btn');
            } else {
                buyLink.href = `https://www.cheapshark.com/redirect?dealID=${deal.dealID}`;
                buyLink.textContent = 'BUY';
            }

            buyLink.target = "_blank";
            buyLink.className = 'buy-btn';

            rightGroup.appendChild(buyLink);
            row.append(nameGroup, rightGroup);
            detailsDiv.appendChild(row);
        }
    });

    if (!hasDeals) {
        const noDeals = document.createElement('p');
        noDeals.className = 'status-msg';
        noDeals.textContent = 'No deals from tracked stores.';
        detailsDiv.appendChild(noDeals);
    }
}

async function startSearch() {
    const query = searchInput.value.trim();
    if (query.length < 2) return;
    localStorage.setItem('gh_lastSearchQuery', query);
    showLoading();
    try {
        const response = await fetch(`https://www.cheapshark.com/api/1.0/games?title=${query}&limit=12`);
        const games = await response.json();
        listContainer.innerHTML = '';
        if (games.length === 0) { listContainer.innerHTML = 'No results.'; return; }
        games.forEach(game => renderGameCard(game, true));
        games.forEach((game, index) => {
            setTimeout(() => fetchAndPopulateCard(game.gameID), index * 300); 
        });
    } catch (e) { listContainer.innerHTML = 'Error.'; }
}

async function fetchTopDeals() {
    showLoading();
    try {
        const response = await fetch(`https://www.cheapshark.com/api/1.0/deals?upperPrice=50&pageSize=20&storeID=1,7,25`);
        const deals = await response.json();
        if (listContainer) {
            listContainer.innerHTML = '';
            deals.forEach(deal => renderGameCard(deal, false));
        }
    } catch (e) { if(listContainer) listContainer.innerHTML = 'Error.'; }
}

function showLoading() {
    if(listContainer) listContainer.innerHTML = `<div class="loader-container"><div class="loader"></div></div>`;
}

let freeGamesData = [];
let freeCurrentPage = 1;

async function fetchFreeGames() {
    const container = document.getElementById('free-games-list');
    
    if (freeGamesData.length > 0) {
        displayFreeGamesPage();
        return;
    }

    if (container) container.innerHTML = '<div class="loader-container"><div class="loader"></div></div>';

    try {
        const response = await fetch(`https://www.gamerpower.com/api/giveaways?type=game&platform=pc&_=${Date.now()}`);
        
        if (!response.ok) throw new Error("Server Error");
        
        const data = await response.json();

        if (!Array.isArray(data)) {
            console.error("API returned invalid data:", data);
            throw new Error("Invalid Data Format");
        }

        freeGamesData = data;
        displayFreeGamesPage();

    } catch (e) {
        console.error("Freebies Fetch Error:", e);
        if (container) {
            container.innerHTML = `
                <div style="text-align:center; padding:30px; animation:fadeIn 0.5s;">
                    <div style="font-size:24px; margin-bottom:10px;">⚠️</div>
                    <div style="color:#ff4444; font-weight:bold; font-size:12px;">Connection Failed</div>
                    <div style="color:#666; font-size:10px; margin-top:5px;">Could not load games.</div>
                    <button id="btn-retry-freebies" style="margin-top:15px; background:#1a1a1a; color:#00ff88; border:1px solid #00ff88; padding:6px 15px; border-radius:4px; cursor:pointer; font-weight:bold; font-size:10px;">RETRY</button>
                </div>
            `;
            setTimeout(() => {
                const btn = document.getElementById('btn-retry-freebies');
                if(btn) btn.onclick = () => { freeGamesData = []; fetchFreeGames(); };
            }, 100);
        }
    }
}
function displayFreeGamesPage() {
    const container = document.getElementById('free-games-list');
    if(!container) return;
    
    container.replaceChildren();
    
    const itemsPerPage = 3; 
    const start = (freeCurrentPage - 1) * itemsPerPage;
    const pageItems = freeGamesData.slice(start, start + itemsPerPage);

    pageItems.forEach(game => {
        const card = document.createElement('div');
        card.className = 'free-game-card-large';
        
        const imgContainer = document.createElement('div');
        imgContainer.className = 'large-img-container';
        
        const img = document.createElement('img');
        img.src = game.image;
        
        const badge = document.createElement('div');
        badge.className = 'platform-badge';
        
        const worthSpan = document.createElement('span');
        worthSpan.style.cssText = 'text-decoration: line-through; opacity: 0.6; margin-right: 5px;';
        worthSpan.textContent = game.worth;
        
        const freeSpan = document.createElement('span');
        freeSpan.style.color = '#00ff88';
        freeSpan.textContent = 'FREE';
        
        badge.append(worthSpan, freeSpan);
        imgContainer.append(img, badge);

        const contentDiv = document.createElement('div');
        contentDiv.className = 'large-content';
        
        const infoRow = document.createElement('div');
        infoRow.className = 'large-info-row';
        
        const titleSpan = document.createElement('span');
        titleSpan.className = 'large-title';
        titleSpan.title = game.title;
        titleSpan.textContent = game.title; 

        infoRow.appendChild(titleSpan);

        const actionsRow = document.createElement('div');
        actionsRow.className = 'large-actions-row';
        actionsRow.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-top: 12px;';

        const storeTag = document.createElement('span');
        storeTag.className = 'store-name-tag';
        storeTag.style.cssText = 'color: var(--primary-glow); font-weight: 900; font-size: 11px; border: 1px solid #333; padding: 3px 8px; border-radius: 4px;';
        storeTag.textContent = game.platforms.split(',')[0].toUpperCase();

        const claimBtn = document.createElement('a');
        claimBtn.href = game.open_giveaway_url;
        claimBtn.target = '_blank';
        claimBtn.className = 'large-claim-btn';
        claimBtn.style.cssText = 'width: auto; padding: 8px 15px; margin: 0;';
        claimBtn.textContent = 'CLAIM GAME';

        actionsRow.append(storeTag, claimBtn);
        contentDiv.append(infoRow, actionsRow);

        card.append(imgContainer, contentDiv);
        container.appendChild(card);
    });

    const totalPages = Math.ceil(freeGamesData.length / itemsPerPage);
    if (totalPages > 1) {
        const nav = document.createElement('div');
        nav.className = 'free-nav-bar';
        
        const btnPrev = document.createElement('button');
        btnPrev.id = 'btnPrevFree';
        btnPrev.textContent = '←';
        if (freeCurrentPage === 1) btnPrev.disabled = true;
        btnPrev.onclick = () => { freeCurrentPage--; displayFreeGamesPage(); };

        const pageNum = document.createElement('span');
        pageNum.className = 'page-num';
        pageNum.textContent = `${freeCurrentPage} / ${totalPages}`;

        const btnNext = document.createElement('button');
        btnNext.id = 'btnNextFree';
        btnNext.textContent = '→';
        if (freeCurrentPage === totalPages) btnNext.disabled = true;
        btnNext.onclick = () => { freeCurrentPage++; displayFreeGamesPage(); };

        nav.append(btnPrev, pageNum, btnNext);
        container.appendChild(nav);
    }
}


let searchTimeout;

if (searchInput) {
    searchInput.addEventListener('input', () => {
        const query = searchInput.value.trim();
        
        clearTimeout(searchTimeout);

        if (query.length < 3) { 
            if(suggestionsBox) {
                suggestionsBox.style.display = 'none';
                suggestionsBox.innerHTML = ''; 
            }
            return; 
        }

        if(suggestionsBox) {
            suggestionsBox.style.display = 'block';
            suggestionsBox.innerHTML = `
                <div style="padding:15px; text-align:center; color:#888; font-size:12px; background:#161616; border-radius:8px;">
                    <span style="display:inline-block; animation:spin 1s linear infinite;">⏳</span> Searching...
                </div>
            `;
        }

        searchTimeout = setTimeout(async () => {
            try {
                const response = await fetch(`https://www.cheapshark.com/api/1.0/games?title=${query}&limit=6`);
                const games = await response.json();
                
                if(suggestionsBox) {
                    suggestionsBox.innerHTML = ''; 

                    if (games.length === 0) {
                        suggestionsBox.innerHTML = '<div style="padding:10px; text-align:center; color:#555; font-size:11px;">No games found.</div>';
                        return;
                    }

                    games.forEach(game => {
                        const div = document.createElement('div');
                        div.className = 'mini-item'; 
                        div.style.marginBottom = '4px'; 
                        div.style.cursor = 'pointer';
                        div.style.border = '1px solid #333';

                        const img = document.createElement('img');
                        img.src = game.thumb;
                        img.className = 'mini-game-img'; 

                        const infoDiv = document.createElement('div');
                        infoDiv.className = 'mini-game-info'; 

                        const nameSpan = document.createElement('span');
                        nameSpan.className = 'mini-game-name';
                        nameSpan.textContent = game.external;

                        const priceSpan = document.createElement('span');
                        priceSpan.className = 'mini-game-price';
                        priceSpan.textContent = `Best: $${game.cheapest}`;

                        infoDiv.append(nameSpan, priceSpan);

                        const iconDiv = document.createElement('div');
                        iconDiv.style.marginLeft = 'auto';
                        iconDiv.innerHTML = '🔍';
                        iconDiv.style.fontSize = '12px';
                        iconDiv.style.opacity = '0.5';
                        iconDiv.style.paddingRight = '5px';

                        div.append(img, infoDiv, iconDiv);

                        div.onclick = () => { 
                            searchInput.value = game.external; 
                            suggestionsBox.style.display = 'none'; 
                            startSearch(); 
                        };
                        
                        suggestionsBox.appendChild(div);
                    });
                }
            } catch (e) {
                console.error("Search Suggestion Error:", e);
                if(suggestionsBox) suggestionsBox.style.display = 'none';
            }
        }, 1000); 
    });
}

document.addEventListener('click', (e) => {
    if (suggestionsBox && e.target !== searchInput && !suggestionsBox.contains(e.target)) {
        suggestionsBox.style.display = 'none';
    }
});

if(searchBtn) searchBtn.onclick = startSearch;
if(searchInput) searchInput.onkeydown = (e) => { if (e.key === 'Enter') startSearch(); };

// ==========================================
// DONATION MODAL LOGIC (FIXED)
// ==========================================
const donateTrigger = document.getElementById('btn-donate');
const donationModal = document.getElementById('donation-modal');
const closeDonation = document.getElementById('close-donation');
const confirmDonate = document.getElementById('confirm-donate-btn');

if (donateTrigger) {
    donateTrigger.onclick = () => {
        if(donationModal) donationModal.style.display = 'flex';
    };
}

if (closeDonation) {
    closeDonation.onclick = () => {
        if(donationModal) donationModal.style.display = 'none';
    };
}

if (donationModal) {
    donationModal.onclick = (e) => {
        if (e.target === donationModal) donationModal.style.display = 'none';
    };
}

if (confirmDonate) {
    confirmDonate.onclick = () => {
        const myLink = ""; 
        chrome.tabs.create({ url: myLink });
        if(donationModal) donationModal.style.display = 'none';
    };
}
// ==========================================
// POP-OUT WINDOW LOGIC
// ==========================================
const popoutBtn = document.getElementById('btn-popout');

if (popoutBtn) {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('mode') === 'window') {
        popoutBtn.style.display = 'none';
    }

    popoutBtn.onclick = () => {
        chrome.windows.create({
            url: chrome.runtime.getURL("popup.html?mode=window"),
            type: "popup",
            width: 520,
            height: 600
        });
        window.close();
    };
}

window.onload = () => {
    const NOW = Date.now();
    const lastTab = localStorage.getItem('gh_lastTab');
    const lastClosedTime = localStorage.getItem('gh_lastClosedTime');
    const lastQuery = localStorage.getItem('gh_lastSearchQuery'); 

    let targetTab = 'dashboard'; 
    if (lastTab && lastClosedTime) {
        if (NOW - parseInt(lastClosedTime) < 30 * 60 * 1000) { targetTab = lastTab; }
    }

    activateTab(targetTab); 
    updateDashboardData();

    if (targetTab === 'deals' && lastQuery) {
        if(searchInput) searchInput.value = lastQuery; 
        startSearch(); 
    }
};

window.onblur = () => {
    localStorage.setItem('gh_lastClosedTime', Date.now().toString());
    
    if (searchInput && searchInput.value.trim() !== "") {
        localStorage.setItem('gh_lastSearchQuery', searchInput.value.trim());
    } else {
        localStorage.removeItem('gh_lastSearchQuery');
    }
};
// ==========================================
// FREEBIES NOTIFICATION TOGGLE LOGIC
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const freebieToggle = document.getElementById('freebies-notify-toggle');
    
    if (freebieToggle) {
        chrome.storage.local.get(['gh_freebies_notify_enabled'], (r) => {
            freebieToggle.checked = r.gh_freebies_notify_enabled !== false;
        });

        freebieToggle.onchange = () => {
            const isEnabled = freebieToggle.checked;
            chrome.storage.local.set({ 'gh_freebies_notify_enabled': isEnabled });
            if(isEnabled) {
                alert("✅ Free Games Notifications ENABLED");
            }
        };
    }
});
document.addEventListener('DOMContentLoaded', () => {
    const invBtn = document.getElementById('btn-open-inventory');
    if (invBtn) {
        invBtn.onclick = () => {
            chrome.windows.create({
                url: chrome.runtime.getURL("inventory.html"),
                type: "popup",
                width: 1280,
                height: 800,
                focused: true
            });
        };
    }
});