// ==========================================
// INVENTORY MANAGER (FIXED: 429 ERROR & FALLBACKS)
// ==========================================

console.log("✅ New Code Loaded"); 

let loadedItems = [];
let totalValue = 0.0;
let currencySymbol = "$"; 
let currentUserSteamID = ''; 
let currentViewSteamID = ''; 

let skinportPrices = {}; 
let manualPriceCache = {}; 

const CONFIG = {
    DELAY_BETWEEN_REQUESTS: 3500, 
    COOLDOWN_TIME: 65,
    PRICE_CACHE_TIME: 30 * 60 * 1000 
};

function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

document.addEventListener('DOMContentLoaded', () => {
   
    try {
        const savedCache = localStorage.getItem('gh_price_cache');
        if (savedCache) manualPriceCache = JSON.parse(savedCache);
    } catch (e) { manualPriceCache = {}; }

   
    fetchSkinportPrices();
    setupEventListeners(); 

   
    const urlParams = new URLSearchParams(window.location.search);
    const targetProfile = urlParams.get('target');

    chrome.cookies.get({ url: "https://steamcommunity.com", name: "steamLoginSecure" }, (cookie) => {
        if (cookie) {
            currentUserSteamID = cookie.value.split('%7C%7C')[0];

            setupFriendsFeature();

            if (targetProfile) {
                console.log("Loading target from URL:", targetProfile);
                resolveAndLoadUser(targetProfile);
            } else {
                console.log("Loading current user");
                currentViewSteamID = currentUserSteamID;
                loadInventory(currentUserSteamID);
            }

        } else {
            showStatus("⚠️ Please Log in to Steam via Browser", "#ffaa00");
            
            if (targetProfile) {
                resolveAndLoadUser(targetProfile);
            }
        }
    });
});

async function fetchSkinportPrices() {
    try {
        const cachedPrices = localStorage.getItem('gh_skinport_prices');
        const lastFetch = localStorage.getItem('gh_last_fetch_time');
        const now = Date.now();

        if (cachedPrices && lastFetch) {
            const timeDiff = now - parseInt(lastFetch);
            if (timeDiff < CONFIG.PRICE_CACHE_TIME) {
                console.log(`📦 Using cached prices (Last update: ${Math.round(timeDiff / 60000)} mins ago)`);
                skinportPrices = JSON.parse(cachedPrices);
                
                if (loadedItems.length > 0) recalcTotalInventory();
                return; 
            }
        }
    } catch (e) { console.warn("Cache read error:", e); }

    console.log("🔄 Cache expired or empty. Fetching new prices from Skinport...");

    try {
        const response = await fetch('https://api.skinport.com/v1/items?app_id=730&currency=USD&tradable=1');
        
        if (!response.ok) {
            throw new Error(`Skinport Blocked/Error: ${response.status}`);
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
            throw new Error("Invalid Data: Not an array");
        }
        
        skinportPrices = {};
        
        data.forEach(item => {
            if (item.min_price) {
                skinportPrices[item.market_hash_name] = item.min_price;
            }
        });

        console.log(`✅ Loaded ${Object.keys(skinportPrices).length} prices from Skinport`);

        localStorage.setItem('gh_skinport_prices', JSON.stringify(skinportPrices));
        localStorage.setItem('gh_last_fetch_time', Date.now().toString());

        if (loadedItems.length > 0) recalcTotalInventory(); 

    } catch (error) {
        console.warn(`⚠️ Skinport failed (${error.message}). Switching to fallback...`);
        fetchFallbackPrices();
    }
}


async function fetchFallbackPrices() {
    console.log("🔄 Fetching fallback prices...");
    try {
        const response = await fetch('https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/skins.json');
        
        if (!response.ok) throw new Error("Fallback 1 failed");

        const data = await response.json();
        
        Object.values(data).forEach(item => {
            if (item && item.name && item.price) {
                 if (!skinportPrices[item.name]) {
                     skinportPrices[item.name] = parseFloat(item.price);
                 }
            }
        });

        console.log("✅ Loaded fallback prices");

        localStorage.setItem('gh_skinport_prices', JSON.stringify(skinportPrices));
        localStorage.setItem('gh_last_fetch_time', Date.now().toString());

        if (loadedItems.length > 0) recalcTotalInventory();

    } catch (e) {
        console.error("❌ All price sources failed. Showing manual prices only.");
    }
}

function setupEventListeners() {
    const modal = document.getElementById('item-details-modal');
    const closeBtn = document.getElementById('close-modal-btn');
    if(closeBtn) closeBtn.onclick = () => { modal.style.display = 'none'; };
    if(modal) modal.onclick = (e) => { if(e.target === modal) modal.style.display = 'none'; };

    const refreshBtn = document.getElementById('btn-refresh-inv');
    if(refreshBtn) refreshBtn.onclick = () => {
        localStorage.removeItem(`gh_inv_${currentViewSteamID}`);
        loadInventory(currentViewSteamID, true);
    };

    const itemSearch = document.getElementById('item-search');
    const typeFilter = document.getElementById('filter-type'); 
    const rarityFilter = document.getElementById('filter-rarity');
    const sortFilter = document.getElementById('sort-price');

    if (itemSearch) itemSearch.addEventListener('input', debounce(applyFiltersAndSort, 300));
    if (typeFilter) typeFilter.addEventListener('change', applyFiltersAndSort);
    if (rarityFilter) rarityFilter.addEventListener('change', applyFiltersAndSort);
    if (sortFilter) sortFilter.addEventListener('change', applyFiltersAndSort);

    const resetBtn = document.getElementById('btn-reset-filters');
    if (resetBtn) resetBtn.addEventListener('click', resetAllFilters);

    const friendSearchBox = document.getElementById('friend-search-input');
    if (friendSearchBox) friendSearchBox.addEventListener('input', (e) => filterFriendsList(e.target.value));

    const extInput = document.getElementById('external-user-input');
    const extBtn = document.getElementById('btn-search-external');
    if (extBtn) extBtn.onclick = () => resolveAndLoadUser(extInput.value);
    if (extInput) extInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') resolveAndLoadUser(extInput.value); });

    const sidebar = document.getElementById('friends-sidebar');
    const menuBtn = document.getElementById('menu-toggle-btn');
    const closeSidebar = document.getElementById('close-sidebar');
    if(menuBtn) menuBtn.onclick = () => sidebar.classList.add('active');
    if(closeSidebar) closeSidebar.onclick = () => sidebar.classList.remove('active');
}

function updateProfileHeader(name, avatarUrl) {
    const nameEl = document.getElementById('inventory-owner-name');
    const imgEl = document.getElementById('current-user-avatar');
    if(nameEl) nameEl.innerText = name;
    if(imgEl && avatarUrl) imgEl.src = avatarUrl;
}

function applyFiltersAndSort() {
    const searchTerm = document.getElementById('item-search').value.toLowerCase().trim();
    const type = document.getElementById('filter-type').value;
    const rarity = document.getElementById('filter-rarity').value;
    const sortType = document.getElementById('sort-price').value;
    
    const container = document.getElementById('inventory-grid');
    const cards = Array.from(document.querySelectorAll('.item-card')); 
    const noResultsView = document.getElementById('no-results-view');

    let visibleCount = 0;

    cards.forEach(card => {
        if (!card.hasAttribute('data-hash-name')) return;

        const name = card.getAttribute('data-hash-name').toLowerCase();
        const cardTypeRaw = card.getAttribute('data-type').toLowerCase();
        const cardRarity = card.getAttribute('data-rarity') || "Consumer";

        let matchesSearch = !searchTerm || name.includes(searchTerm);
        let matchesRarity = (rarity === 'all') || cardRarity.includes(rarity);
        let matchesType = true;
        
        if (type !== 'all') {
            const filter = type.toLowerCase();
            if (filter === 'knife') matchesType = /knife|bayonet|karambit|dagger|nomad|skeleton|survival|paracord|ursus|navaja|stiletto|talon|classic/.test(cardTypeRaw);
            else if (filter === 'gloves') matchesType = /gloves|wraps/.test(cardTypeRaw);
            else matchesType = cardTypeRaw.includes(filter);
        }

        if (matchesSearch && matchesRarity && matchesType) {
            card.style.display = ''; 
            visibleCount++;
        } else {
            card.style.display = 'none';
        }
    });

    if (visibleCount === 0 && cards.length > 0) {
        if(noResultsView) noResultsView.style.display = 'flex';
    } else {
        if(noResultsView) noResultsView.style.display = 'none';
    }

    if (sortType !== 'default' && visibleCount > 0) {
        const visibleCards = cards.filter(c => c.style.display !== 'none');
        visibleCards.sort((a, b) => {
            const priceTextA = a.querySelector('.card-price-tag').innerText;
            const priceTextB = b.querySelector('.card-price-tag').innerText;
            const priceA = parsePrice(priceTextA);
            const priceB = parsePrice(priceTextB);
            
            if (sortType === 'price_desc') return priceB - priceA;
            if (sortType === 'price_asc') return priceA - priceB;
            return 0;
        });
        
        const fragment = document.createDocumentFragment();
        visibleCards.forEach(card => fragment.appendChild(card));
        container.appendChild(fragment);
        if(noResultsView) container.appendChild(noResultsView);
    }
}

function resetAllFilters() {
    document.getElementById('item-search').value = '';
    document.getElementById('filter-type').value = 'all';
    document.getElementById('filter-rarity').value = 'all';
    document.getElementById('sort-price').value = 'default';
    applyFiltersAndSort();
}

async function loadInventory(steamID, forceFetch = false) {
    const grid = document.getElementById('inventory-grid');
    const countLabel = document.getElementById('total-count');
    
    if(grid) grid.innerHTML = '<div class="status-msg"><div class="loader"></div><p>Loading items...</p></div>';

    const noResultsHtml = `
        <div id="no-results-view" style="display: none;">
            <h3>⚠️ No items found with current filters</h3>
            <button id="btn-reset-filters" class="action-btn">Reset Filters</button>
        </div>`;

    try {
        let data;
        const cacheKey = `gh_inv_${steamID}`;
        const cachedData = localStorage.getItem(cacheKey);
        
        if (!forceFetch && cachedData) {
            data = JSON.parse(cachedData);
        } else {
            const url = `https://steamcommunity.com/inventory/${steamID}/730/2?l=english&count=2000`;
            const response = await fetch(url);
            
            if (response.status === 403) throw new Error("🔒 Private Inventory");
            if (response.status === 429) throw new Error("⏳ Too Many Requests");
            if (!response.ok) throw new Error("API Error");

            const rawData = await response.json();
            if (!rawData.assets) {
                if(grid) grid.innerHTML = '<div class="status-msg"><h3>🎒 Inventory is Empty</h3></div>';
                if(countLabel) countLabel.innerText = "0";
                return;
            }

            data = rawData.assets.map(asset => {
                const desc = rawData.descriptions.find(d => d.classid === asset.classid && d.instanceid === asset.instanceid);
                return { ...asset, ...desc };
            });

            try { localStorage.setItem(cacheKey, JSON.stringify(data)); } catch (e) {}
        }

        loadedItems = data;
        if(countLabel) countLabel.innerText = loadedItems.length;
        if(grid) grid.innerHTML = noResultsHtml; 

        setTimeout(() => {
            const resetBtn = document.getElementById('btn-reset-filters');
            if (resetBtn) resetBtn.addEventListener('click', resetAllFilters);
        }, 0);

        loadedItems.forEach(item => {
            if(grid) createItemCard(item, grid, steamID);
        });
        
        recalcTotalInventory(); 
        applyFiltersAndSort(); 

    } catch (error) {
        showStatus(error.message, "#ff4444");
    }
}

function createItemCard(item, container, steamID) {
    const imgUrl = item.icon_url ? `https://community.cloudflare.steamstatic.com/economy/image/${item.icon_url}/330x192` : 'icon.png';
    let color = '#888';
    let rarityName = "Consumer";
    
    if (item.tags) {
        const tag = item.tags.find(t => t.category === 'Rarity');
        if (tag) {
            color = getHexColor(tag.internal_name || tag.color);
            rarityName = tag.localized_tag_name || tag.name || "Consumer";
        }
    }
    const wearInfo = getWearInfo(item.tags); 

    const card = document.createElement('div');
    card.className = 'item-card';
    card.setAttribute('data-hash-name', item.market_hash_name);
    card.setAttribute('data-rarity', rarityName);
    card.setAttribute('data-type', item.type || "");

    const priceTag = document.createElement('div');
    priceTag.className = 'card-price-tag';
    
    let displayPrice = null;
    let priceColor = '#fff';
    if (manualPriceCache[item.market_hash_name] && manualPriceCache[item.market_hash_name] !== "N/A") {
        displayPrice = manualPriceCache[item.market_hash_name];
        priceColor = '#00ff88'; 
    } else if (skinportPrices[item.market_hash_name]) {
        displayPrice = `$${skinportPrices[item.market_hash_name].toFixed(2)}`;
    }

    priceTag.textContent = displayPrice || '$';
    priceTag.style.display = displayPrice ? 'block' : 'none';
    priceTag.style.color = priceColor;
    card.appendChild(priceTag);

    if (wearInfo.text) {
        const floatBadge = document.createElement('div');
        floatBadge.className = `float-badge ${wearInfo.class}`;
        floatBadge.textContent = wearInfo.text;
        card.appendChild(floatBadge);
    }

    const imgWrapper = document.createElement('div');
    imgWrapper.className = 'img-wrapper';

    const mainImg = document.createElement('img');
    mainImg.src = imgUrl;
    mainImg.loading = 'lazy';
    imgWrapper.appendChild(mainImg);

    if (item.descriptions) {
        const stickerDesc = item.descriptions.find(d => d.value.includes("Sticker:") || d.value.includes("الملصق:"));
        if (stickerDesc) {
            const stickersContainer = document.createElement('div');
            stickersContainer.className = 'card-stickers';
            
            const imgRegex = /<img[^>]+src="([^">]+)"/g;
            let match;
            let count = 0;
            while ((match = imgRegex.exec(stickerDesc.value)) !== null && count < 5) {
                const sImg = document.createElement('img');
                sImg.src = match[1];
                sImg.className = 'card-sticker-img';
                sImg.alt = 's';
                stickersContainer.appendChild(sImg);
                count++;
            }
            if(count > 0) imgWrapper.appendChild(stickersContainer);
        }
    }
    card.appendChild(imgWrapper);

    const rarityStripe = document.createElement('div');
    rarityStripe.className = 'rarity-stripe';
    rarityStripe.style.background = color;
    rarityStripe.style.boxShadow = `0 0 5px ${color}`;
    card.appendChild(rarityStripe);

    const detailsDiv = document.createElement('div');
    detailsDiv.className = 'item-details';

    const itemNameDiv = document.createElement('div');
    itemNameDiv.className = 'item-name';
    itemNameDiv.style.color = (color === '#888' ? '#ddd' : color);
    itemNameDiv.title = item.market_name;
    itemNameDiv.textContent = item.market_name; 

    const itemTypeDiv = document.createElement('div');
    itemTypeDiv.className = 'item-type';
    itemTypeDiv.textContent = item.type;

    detailsDiv.append(itemNameDiv, itemTypeDiv);
    card.appendChild(detailsDiv);

    card.addEventListener('click', () => {
        openItemModal(item, imgUrl, steamID);
        const hasSkinportPrice = !!skinportPrices[item.market_hash_name];
        const hasManualPrice = manualPriceCache[item.market_hash_name] && manualPriceCache[item.market_hash_name] !== "N/A";
        if (item.marketable === 1 && !hasSkinportPrice && !hasManualPrice) {
            updateSingleItemPrice(item, card);
        }
    });

    container.appendChild(card);
}

async function updateSingleItemPrice(item, cardElement) {
    const priceTag = cardElement.querySelector('.card-price-tag');
    
    priceTag.style.display = 'block';
    priceTag.innerText = "⏳";
    priceTag.style.color = "#ffaa00";
    priceTag.style.backgroundColor = "rgba(0,0,0,0.8)";

    try {
        const url = `https://steamcommunity.com/market/priceoverview/?appid=730&currency=1&market_hash_name=${encodeURIComponent(item.market_hash_name)}`;
        const res = await fetch(url);
        
        if (res.status === 429) {
            revertPrice(item.market_hash_name, priceTag);
            return;
        }

        const data = await res.json();
        
        if (data.success && data.lowest_price && data.lowest_price !== "N/A") {
            const newPrice = data.lowest_price; 
            
            manualPriceCache[item.market_hash_name] = newPrice;
            localStorage.setItem('gh_price_cache', JSON.stringify(manualPriceCache));
            
            const sameItems = document.querySelectorAll(`.item-card[data-hash-name="${item.market_hash_name.replace(/"/g, '\\"')}"] .card-price-tag`);
            sameItems.forEach(tag => {
                tag.innerText = newPrice;
                tag.style.color = "#00ff88"; 
                tag.style.display = 'block';
            });

            recalcTotalInventory();
        } else {
            revertPrice(item.market_hash_name, priceTag);
        }

    } catch (e) {
        revertPrice(item.market_hash_name, priceTag);
    }
}

function revertPrice(hashName, priceTag) {
    if (manualPriceCache[hashName] && manualPriceCache[hashName] !== "N/A") {
        priceTag.innerText = manualPriceCache[hashName];
        priceTag.style.color = "#00ff88";
    } else if (skinportPrices[hashName]) {
        priceTag.innerText = `$${skinportPrices[hashName].toFixed(2)}`;
        priceTag.style.color = "#fff";
    } else {
        priceTag.innerText = "N/A";
        priceTag.style.color = "#888";
    }
}

function recalcTotalInventory() {
    let newTotal = 0.0;
    
    loadedItems.forEach(item => {
        const hashName = item.market_hash_name;
        
        if (manualPriceCache[hashName] && manualPriceCache[hashName] !== "N/A") {
            newTotal += parsePrice(manualPriceCache[hashName]);
        } 
        else if (skinportPrices[hashName]) {
            newTotal += skinportPrices[hashName];
        }
    });

    const allCards = document.querySelectorAll('.item-card');
    allCards.forEach(card => {
        const hashName = card.getAttribute('data-hash-name');
        const priceTag = card.querySelector('.card-price-tag');

        if (!priceTag || priceTag.innerText === "⏳") return;

        let displayPrice = null;
        let isManual = false;

        if (manualPriceCache[hashName] && manualPriceCache[hashName] !== "N/A") {
            displayPrice = manualPriceCache[hashName];
            isManual = true;
        } 
        else if (skinportPrices[hashName]) {
            displayPrice = `$${skinportPrices[hashName].toFixed(2)}`;
        }

        if (displayPrice) {
            priceTag.innerText = displayPrice;
            priceTag.style.display = 'block';
            priceTag.style.color = isManual ? '#00ff88' : '#fff';
        }
    });

    totalValue = newTotal;
    updateTotalUI();
}

function updateCardDisplayPrice(hashName, priceStr, isManual) {
    const cards = document.querySelectorAll(`.item-card[data-hash-name="${hashName.replace(/"/g, '\\"')}"]`);
    cards.forEach(card => {
        const badge = card.querySelector('.card-price-tag');
        if(badge && badge.innerText !== "⏳") { 
            badge.innerText = priceStr;
            badge.style.display = 'block';
            if (isManual) badge.style.color = "#00ff88";
            else badge.style.color = "#fff";
        }
    });
}

async function openItemModal(item, imgUrl, steamID) {
    const modal = document.getElementById('item-details-modal');
    
    document.getElementById('modal-img').src = imgUrl;
    document.getElementById('modal-title').innerText = item.market_name;
    document.getElementById('modal-type').innerText = item.type;
    
    document.getElementById('modal-lowest').innerText = "Loading...";
    document.getElementById('modal-median').innerText = "Loading...";
    document.getElementById('modal-volume').innerText = "$";
    
    const canvas = document.getElementById('priceChart');
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0); 
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const tooltip = document.getElementById('chart-tooltip');
    if(tooltip) tooltip.style.display = 'none';
    
    document.getElementById('modal-market-link').href = `https://steamcommunity.com/market/listings/730/${encodeURIComponent(item.market_hash_name)}`;
    
    const inspectGroup = document.getElementById('inspect-group');
    const inspectBtn = document.getElementById('modal-inspect-btn');
    const copyBtn = document.getElementById('modal-copy-btn'); 
    
    const oldFloatBox = document.getElementById('float-display-box');
    if(oldFloatBox) oldFloatBox.remove();

    if (item.actions && item.actions.length > 0 && item.actions[0].link) {
        let inspectLink = item.actions[0].link;
        
        inspectLink = inspectLink.replace('%owner_steamid%', currentViewSteamID); 
        inspectLink = inspectLink.replace('%assetid%', item.assetid || item.id);

        if (item.listingid) {
        inspectLink = inspectLink.replace('%listingid%', item.listingid);
        }

        if (item.d) {
        inspectLink = inspectLink.replace('%d%', item.d);
        }

        inspectBtn.href = inspectLink;
        
        

        inspectBtn.href = inspectLink;
        
        if (copyBtn) {
            copyBtn.style.display = 'flex';
            copyBtn.onclick = () => {
                navigator.clipboard.writeText(inspectLink).then(() => {
                    copyBtn.innerHTML = '✅'; 
                    setTimeout(() => { copyBtn.innerHTML = '📋'; }, 1500);
                });
            };
        }
        if (inspectGroup) inspectGroup.style.display = 'inline-flex';

        fetchItemFloat(inspectLink);

    } else {
        if (inspectGroup) inspectGroup.style.display = 'none';
        inspectBtn.href = '#';
    }

    modal.style.display = 'flex';
    
    if (typeof parseAndShowStickers === "function") {
        parseAndShowStickers(item);
    }
    
    if (item.marketable === 1) {
        fetchPriceOverview(item.market_hash_name);
        fetchAndDrawChart(item.market_hash_name);
    } else {
        document.getElementById('modal-lowest').innerText = "Not Marketable";
    }
}


async function fetchItemFloat(inspectLink) {
    let floatBox = document.getElementById('float-display-box');
    
    if (!floatBox) {
        const container = document.querySelector('.modal-stats-grid') || document.querySelector('.item-details'); 
        
        if(container) {
            floatBox = document.createElement('div');
            floatBox.id = 'float-display-box';
            floatBox.style.cssText = "margin-top: 10px; padding: 10px; background: rgba(0,0,0,0.4); border-radius: 6px; border: 1px solid #444; text-align: center;";
            floatBox.innerHTML = '<strong></strong> <span id="val-float" style="color:#888;">Connecting to Bot...</span>';
            
            container.prepend(floatBox);
        }
    }

    const valSpan = document.getElementById('val-float');

    try {

const response = await fetch(`http://localhost:80/float?url=${encodeURIComponent(inspectLink)}`);        
        const data = await response.json();

        if (data.error) {
            console.error("Bot Error:", data.error);
            if(valSpan) valSpan.innerHTML = '<span style="color:#ff4444;">Bot Error (Check Console)</span>';
            return;
        }

        if (data.iteminfo) {
            const floatVal = data.iteminfo.floatvalue;
            const paintSeed = data.iteminfo.paintseed;
            
            console.log(`✅ Float Found: ${floatVal}`);
            
            let color = "#fff";
            let condition = "";
            
            if(floatVal < 0.07) { color = "#00ff88"; condition = "FN"; }      // Factory New
            else if(floatVal < 0.15) { color = "#aaff00"; condition = "MW"; } // Minimal Wear
            else if(floatVal < 0.38) { color = "#ffcc00"; condition = "FT"; } // Field Tested
            else if(floatVal < 0.45) { color = "#ff9900"; condition = "WW"; } // Well Worn
            else { color = "#ff4444"; condition = "BS"; }                     // Battle Scarred
            
            if(valSpan) {
                valSpan.innerHTML = `
                    <span style="color:${color}; font-family:monospace; font-weight:bold; font-size:1.3em;">${floatVal.toFixed(14)}</span>
                    <span style="color:${color}; font-size:0.8em; margin-left:5px;">(${condition})</span>
                    <br>
                    
                `;
            }
        } 

    } catch (e) {
        console.error("Local Bot Connection Failed:", e);
        if(valSpan) {
            valSpan.innerHTML = '<span style="color:#ff4444; font-size:11px; cursor:pointer;" title="Run: node server.js">⚠️ Bot Offline (Click to retry)</span>';
            valSpan.onclick = () => fetchItemFloat(inspectLink); 
        }
    }
}

async function fetchAndDrawChart(hashName) {
    try {
        const url = `https://steamcommunity.com/market/pricehistory/?appid=730&market_hash_name=${encodeURIComponent(hashName)}`;
        const res = await fetch(url);
        if(!res.ok) throw new Error("Chart Error");
        const data = await res.json(); 
        if (data && data.success && data.prices) {
            const history = data.prices.slice(-100).map(p => ({
                date: new Date(p[0]),
                price: p[1],
                vol: p[2]
            }));
            drawSteamChart(history);
        }
    } catch (e) { console.log("Chart Error", e); }
}

function drawSteamChart(data) {
    const canvas = document.getElementById('priceChart');
    const container = canvas.parentElement;
    const tooltip = document.getElementById('chart-tooltip');
    
    canvas.width = container.clientWidth * 2; 
    canvas.height = container.clientHeight * 2;
    const ctx = canvas.getContext('2d'); 
    ctx.scale(2, 2); 
    
    const width = container.clientWidth; 
    const height = container.clientHeight; 
    const padding = 10;
    
    const prices = data.map(d => d.price);
    const minPrice = Math.min(...prices) * 0.95; 
    const maxPrice = Math.max(...prices) * 1.05; 
    let range = maxPrice - minPrice;
    if (range === 0) range = 1;

    const getX = (i) => (i / (data.length - 1)) * width;
    const getY = (price) => height - ((price - minPrice) / range) * (height - padding * 2) - padding;
    
    ctx.clearRect(0, 0, width, height); 
    
    ctx.strokeStyle = "#222"; ctx.lineWidth = 1; ctx.beginPath();
    for (let i = 1; i < 5; i++) { const y = (height / 5) * i; ctx.moveTo(0, y); ctx.lineTo(width, y); } ctx.stroke();
    
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "rgba(0, 255, 136, 0.2)"); 
    gradient.addColorStop(1, "rgba(0, 255, 136, 0.0)");
    ctx.fillStyle = gradient; ctx.beginPath(); ctx.moveTo(0, height);
    data.forEach((d, i) => ctx.lineTo(getX(i), getY(d.price))); ctx.lineTo(width, height); ctx.fill();
    
    ctx.strokeStyle = "#00ff88"; ctx.lineWidth = 2; ctx.lineJoin = "round"; ctx.beginPath();
    data.forEach((d, i) => i === 0 ? ctx.moveTo(getX(i), getY(d.price)) : ctx.lineTo(getX(i), getY(d.price))); ctx.stroke();
    
    canvas.onmousemove = (e) => {
        const rect = canvas.getBoundingClientRect(); const mouseX = e.clientX - rect.left;
        const index = Math.round((mouseX / width) * (data.length - 1));
        if (index >= 0 && index < data.length) {
            const point = data[index]; const px = getX(index); const py = getY(point.price);
            
            ctx.clearRect(0, 0, width, height);
            ctx.strokeStyle = "#222"; ctx.lineWidth = 1; ctx.beginPath(); for (let i = 1; i < 5; i++) { const y = (height / 5) * i; ctx.moveTo(0, y); ctx.lineTo(width, y); } ctx.stroke();
            ctx.fillStyle = gradient; ctx.beginPath(); ctx.moveTo(0, height); data.forEach((d, i) => ctx.lineTo(getX(i), getY(d.price))); ctx.lineTo(width, height); ctx.fill();
            ctx.strokeStyle = "#00ff88"; ctx.lineWidth = 2; ctx.beginPath(); data.forEach((d, i) => i === 0 ? ctx.moveTo(getX(i), getY(d.price)) : ctx.lineTo(getX(i), getY(d.price))); ctx.stroke();
            
            ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2); ctx.fill();
            
            tooltip.innerHTML = `<div style="font-size:10px; color:#aaa;">${point.date.toLocaleDateString()}</div><div style="color:#00ff88; font-size:13px;">$${point.price.toFixed(2)}</div><div style="color:#666; font-size:9px;">Vol: ${point.vol}</div>`;
            tooltip.style.display = 'block';
            const tipWidth = tooltip.offsetWidth; const tipHeight = tooltip.offsetHeight; const offset = 15;
            let leftPos = mouseX + offset; let topPos = py - tipHeight - offset;
            if (leftPos + tipWidth > width) leftPos = mouseX - tipWidth - offset; if (topPos < 0) topPos = py + offset; if (leftPos < 0) leftPos = 10;
            tooltip.style.left = leftPos + 'px'; tooltip.style.top = topPos + 'px';
        }
    };
    canvas.onmouseleave = () => { tooltip.style.display = 'none'; };
}

function fetchPriceOverview(hashName) {
    const url = `https://steamcommunity.com/market/priceoverview/?appid=730&currency=1&market_hash_name=${encodeURIComponent(hashName)}`;
    fetch(url).then(res => res.json()).then(data => {
        if (data.success) {
            document.getElementById('modal-lowest').innerText = data.lowest_price || "N/A";
            document.getElementById('modal-median').innerText = data.median_price || "N/A";
            document.getElementById('modal-volume').innerText = data.volume || "Low";
            document.getElementById('modal-lowest').style.color = "#00ff88";
        }
    }).catch(() => document.getElementById('modal-lowest').innerText = "N/A");
}

async function resolveAndLoadUser(input) {
    const statusEl = document.getElementById('external-search-status');
    if (statusEl) statusEl.innerHTML = '<span style="color:#888;">Searching...</span>';
    
    if (!input) return;
    input = input.trim();


    input = input.replace(/\/inventory\/?.*$/, '').replace(/\/+$/, '');

    let targetID = '';
    let fetchedName = "Unknown";
    let fetchedAvatar = "";

    const fetchProfileData = async (url) => {
        try {
            console.log("Fetching Profile Data from:", url); 
            const res = await fetch(url);
            const text = await res.text();
            
            // 1. محاولة استخراج ID
            const idMatch = text.match(/"steamid":"(\d{17})"/);
            if (idMatch) targetID = idMatch[1];
            
            // 2. محاولة استخراج الاسم
            const nameMatch = text.match(/<title>Steam Community :: (.+?)<\/title>/);
            if (nameMatch) fetchedName = nameMatch[1];

            // 3. محاولة استخراج الصورة
            const imgMatch = text.match(/<meta property="og:image" content="(.+?)"/);
            if (imgMatch) fetchedAvatar = imgMatch[1];

            return !!targetID;
        } catch(e) { 
            console.error("Fetch Error:", e);
            return false; 
        }
    };

    if (/^\d{17}$/.test(input)) {
        await fetchProfileData(`https://steamcommunity.com/profiles/${input}`);
    } else {
        let cleanUrl = input;
        
        if (!input.startsWith('http')) {
            cleanUrl = 'https://' + input;
        }
        
        if (cleanUrl.includes('/profiles/')) {
            const match = cleanUrl.match(/\/profiles\/(\d{17})/);
            if (match) cleanUrl = `https://steamcommunity.com/profiles/${match[1]}`;
        } else if (!cleanUrl.includes('steamcommunity.com')) {
            cleanUrl = `https://steamcommunity.com/id/${input}`;
        }

        await fetchProfileData(cleanUrl);
    }

    if (targetID) {
        if (statusEl) statusEl.innerHTML = '<span style="color:#00ff88;">Found! Loading...</span>';
        updateProfileHeader(fetchedName, fetchedAvatar); 
        loadFriendInventory(targetID, fetchedName, fetchedAvatar); 
    } else {
        if (statusEl) statusEl.innerHTML = '<span style="color:red;">Not Found/Error</span>';
        console.error("Could not resolve Steam ID from:", input);
    }
}

function loadMyInventory() {
    currentViewSteamID = currentUserSteamID;
    updateProfileHeader("MY INVENTORY", "https://avatars.akamai.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg"); 
    document.querySelectorAll('.friend-card').forEach(c => c.classList.remove('active'));
    const myCard = document.getElementById('my-profile-card');
    if(myCard) myCard.classList.add('active');
    document.getElementById('friends-sidebar').classList.remove('active');
    loadInventory(currentUserSteamID);
}

function loadFriendInventory(steamID, name, avatar, cardElement) {
    currentViewSteamID = steamID;
    updateProfileHeader(name || "FRIEND'S INVENTORY", avatar);
    document.querySelectorAll('.friend-card').forEach(c => c.classList.remove('active'));
    if(cardElement) cardElement.classList.add('active');
    document.getElementById('friends-sidebar').classList.remove('active');
    loadInventory(steamID);
}

function filterFriendsList(query) {
    const term = query.toLowerCase();
    const friendCards = document.querySelectorAll('.friend-card.friend-entry');
    friendCards.forEach(card => {
        const name = card.querySelector('.friend-name').innerText.toLowerCase();
        card.style.display = name.includes(term) ? 'flex' : 'none';
    });
}

async function setupFriendsFeature() {
    const listContainer = document.getElementById('friends-list-container');
    listContainer.innerHTML = ''; 

    const myCard = document.createElement('div');
    myCard.id = 'my-profile-card';
    myCard.className = 'friend-card active';
    myCard.innerHTML = `<div class="friend-avatar" style="background:#333; display:flex; align-items:center; justify-content:center;">👤</div><div class="friend-info"><span class="friend-name">My Inventory</span></div>`;
    myCard.addEventListener('click', loadMyInventory);
    
    const hr = document.createElement('hr');
    hr.style.cssText = 'border:0; border-top:1px solid #333; margin:10px 0;';

    const contentDiv = document.createElement('div');
    contentDiv.id = 'friends-list-content';
    contentDiv.innerHTML = '<div class="loader-small"></div>';

    listContainer.appendChild(myCard);
    listContainer.appendChild(hr);
    listContainer.appendChild(contentDiv);

    try {
        const response = await fetch(`https://steamcommunity.com/profiles/${currentUserSteamID}/friends/`);
        const text = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');
        const friendElements = doc.querySelectorAll('.friend_block_v2');
        
        if(friendElements.length === 0) {
            contentDiv.innerHTML = '<p style="color:#666; text-align:center;">No friends found.</p>';
            return;
        }

        contentDiv.innerHTML = ''; 

        friendElements.forEach(el => {
            const steamID = el.getAttribute('data-steamid');
            const imgEl = el.querySelector('.player_avatar img');
            const nameEl = el.querySelector('.friend_block_content'); 
            let name = "Unknown";
            if (nameEl) {
                const textNodes = Array.from(nameEl.childNodes).filter(node => node.nodeType === Node.TEXT_NODE);
                if(textNodes.length > 0) name = textNodes[0].textContent.trim();
                else name = nameEl.innerText.split('\n')[0].trim();
            }
            const avatarUrl = imgEl ? imgEl.src : '';

            const card = document.createElement('div');
            card.className = 'friend-card friend-entry';
            card.innerHTML = `<img src="${avatarUrl}" class="friend-avatar"><div class="friend-info"><span class="friend-name">${name}</span></div>`;
            
            card.addEventListener('click', () => loadFriendInventory(steamID, name, avatarUrl, card));
            
            contentDiv.appendChild(card);
        });

    } catch (e) {
        contentDiv.innerHTML = '<p style="color:red; font-size:12px;">Failed to load.</p>';
    }
}

function getCardStickersHTML(item) {
    if (!item.descriptions) return '';

    const stickerDesc = item.descriptions.find(d => d.value.includes("Sticker:") || d.value.includes("الملصق:"));
    if (!stickerDesc) return '';

    const imgRegex = /<img[^>]+src="([^">]+)"/g;
    let match;
    let html = '<div class="card-stickers">';
    let count = 0;

    while ((match = imgRegex.exec(stickerDesc.value)) !== null) {
        if(count < 5) { 
            html += `<img src="${match[1]}" class="card-sticker-img" alt="s">`;
        }
        count++;
    }
    
    html += '</div>';
    return count > 0 ? html : '';
}

function parseAndShowStickers(item) {
    const container = document.getElementById('modal-stickers-container');
    if (!container) return;
    
    container.replaceChildren(); 
    container.style.display = 'none'; 

    if (!item.descriptions) return;

    const stickerDesc = item.descriptions.find(d => d.value.includes("Sticker:") || d.value.includes("الملصق:"));

    if (stickerDesc) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(stickerDesc.value, 'text/html');
        const images = doc.getElementsByTagName('img');

        let textOnly = stickerDesc.value.replace(/<[^>]*>?/gm, ''); 
        textOnly = textOnly.replace('Sticker:', '').replace('الملصق:', '').trim();
        const names = textOnly.split(',').map(s => s.trim());

        if (images.length > 0) {
            container.style.display = 'flex'; 
            
            Array.from(images).forEach((img, index) => {
                const slot = document.createElement('div');
                slot.className = 'sticker-slot';

                const stickerImg = document.createElement('img');
                stickerImg.src = img.src;
                stickerImg.className = 'sticker-item';
                
                const stickerName = document.createElement('span');
                stickerName.className = 'sticker-name';
                stickerName.textContent = names[index] || "Sticker"; 

                slot.appendChild(stickerImg);
                slot.appendChild(stickerName);
                container.appendChild(slot);
            });
        }
    }
}

function updateTotalUI() { const el = document.getElementById('inventory-total'); if(el) el.innerText = totalValue.toFixed(2) + currencySymbol; }

function parsePrice(priceStr) { 
    if (!priceStr || priceStr.includes('N/A')) return 0; 
    
    if ((!currencySymbol || currencySymbol === '$') && !priceStr.includes('N/A')) { 
        const match = priceStr.match(/[^0-9.,\s]+/); 
        if (match && match[0] !== 'N/A') currencySymbol = match[0]; 
    } 
    
    let clean = priceStr.replace(/[^0-9.,]/g, ''); 
    if (clean.includes(',') && clean.includes('.')) clean = clean.replace(',', ''); 
    else if (clean.includes(',')) clean = clean.replace(',', '.'); 
    
    return parseFloat(clean) || 0; 
}



function getWearInfo(tags) { if (!tags || !Array.isArray(tags)) return { text: '', class: '' }; const wearTag = tags.find(t => t.category === 'Exterior'); if (wearTag) { const name = (wearTag.internal_name || wearTag.name || '').toUpperCase(); if (name.includes('WEAR_CATEGORY_0') || name.includes('FACTORY NEW')) return { text: 'FN', class: 'wear-FN' }; if (name.includes('WEAR_CATEGORY_1') || name.includes('MINIMAL WEAR')) return { text: 'MW', class: 'wear-MW' }; if (name.includes('WEAR_CATEGORY_2') || name.includes('FIELD-TESTED')) return { text: 'FT', class: 'wear-FT' }; if (name.includes('WEAR_CATEGORY_3') || name.includes('WELL-WORN')) return { text: 'WW', class: 'wear-WW' }; if (name.includes('WEAR_CATEGORY_4') || name.includes('BATTLE-SCARRED')) return { text: 'BS', class: 'wear-BS' }; } return { text: '', class: '' }; }
function showStatus(msg, color) { const grid = document.getElementById('inventory-grid'); if(grid) { grid.innerHTML = ''; const container = document.createElement('div'); container.className = 'status-msg'; const text = document.createElement('h3'); text.style.color = color; text.innerText = msg; container.appendChild(text); grid.appendChild(container); } }
function getHexColor(tagColor) { if (!tagColor) return '#888'; if (tagColor.startsWith('#')) return tagColor; const colors = { 'Rarity_Common_Weapon': '#b0c3d9', 'Rarity_Uncommon_Weapon': '#5e98d9', 'Rarity_Rare_Weapon': '#4b69ff', 'Rarity_Mythical_Weapon': '#8847ff', 'Rarity_Legendary_Weapon': '#d32ce6', 'Rarity_Ancient_Weapon': '#eb4b4b', 'Rarity_Contraband_Weapon': '#e4ae39', 'b0c3d9': '#b0c3d9', '5e98d9': '#5e98d9', '4b69ff': '#4b69ff', '8847ff': '#8847ff', 'd32ce6': '#d32ce6', 'eb4b4b': '#eb4b4b', 'e4ae39': '#e4ae39', 'gray': '#888' }; return colors[tagColor] || '#' + tagColor; }