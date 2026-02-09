const alertInput = document.getElementById('wishlist-search');
const alertResults = document.getElementById('wishlist-results');
const trackedContainer = document.getElementById('tracked-games-list');
const addTrigger = document.getElementById('add-trigger-card');
const searchWrapper = document.getElementById('search-wrapper');
const closeSearch = document.getElementById('close-search');

let storeNames = {};

async function fetchStoreNames() {
    try {
        const res = await fetch('https://www.cheapshark.com/api/1.0/stores');
        const data = await res.json();
        data.forEach(s => storeNames[s.storeID] = s.storeName);
    } catch (e) { console.error("Stores fetch error", e); }
}

if (addTrigger) {
    addTrigger.onclick = () => {
        addTrigger.style.display = 'none';
        searchWrapper.style.display = 'block';
        alertInput.focus();
    };
}

if (closeSearch) {
    closeSearch.onclick = () => {
        searchWrapper.style.display = 'none';
        addTrigger.style.display = 'flex';
        alertInput.value = '';
        alertResults.innerHTML = '';
    };
}

let alertTimeout; 
if (alertInput) {
    alertInput.oninput = () => { 
        const query = alertInput.value.trim();
        
        clearTimeout(alertTimeout);

        if (query.length < 3) { 
            alertResults.replaceChildren(); 
            return; 
        }

        alertResults.innerHTML = `
            <div style="padding:15px; text-align:center; color:#888; font-size:12px;">
                <span style="display:inline-block; animation:spin 1s linear infinite;">⏳</span> Searching...
            </div>
        `;

        alertTimeout = setTimeout(async () => {
            try {
                const res = await fetch(`https://www.cheapshark.com/api/1.0/games?title=${query}&limit=5`);
                const games = await res.json();
                
                alertResults.replaceChildren();

                if (games.length === 0) {
                    const noRes = document.createElement('p');
                    noRes.className = 'status-msg';
                    noRes.textContent = 'No games found.';
                    alertResults.appendChild(noRes);
                    return;
                }

                games.forEach(g => {
                    const itemDiv = document.createElement('div');
                    itemDiv.className = 'mini-item';
                    itemDiv.dataset.id = g.gameID;
                    itemDiv.dataset.name = g.external;
                    itemDiv.dataset.thumb = g.thumb;

                    const img = document.createElement('img');
                    img.src = g.thumb;
                    img.className = 'mini-game-img';

                    const infoDiv = document.createElement('div');
                    infoDiv.className = 'mini-game-info';
                    
                    const nameSpan = document.createElement('span');
                    nameSpan.className = 'mini-game-name';
                    nameSpan.textContent = g.external;

                    const priceSpan = document.createElement('span');
                    priceSpan.className = 'mini-game-price';
                    priceSpan.textContent = `Best: $${g.cheapest}`;

                    infoDiv.append(nameSpan, priceSpan);

                    const btnDiv = document.createElement('div');
                    btnDiv.className = 'add-alert-btn';
                    btnDiv.textContent = '🔔';

                    itemDiv.append(img, infoDiv, btnDiv);

                    itemDiv.onclick = () => saveToAlerts(g.gameID, g.external, g.thumb);

                    alertResults.appendChild(itemDiv);
                });

            } catch (e) { 
                console.error(e);
                alertResults.innerHTML = '<p class="status-msg" style="color:#ff4444">Search Error.</p>';
            }
        }, 500); 
    };
}

function saveToAlerts(id, name, thumb) {
    chrome.storage.local.get(['gh_alerts'], (result) => {
        let alerts = result.gh_alerts || [];
        if (!alerts.find(x => x.id === id)) {
            alerts.push({ id, name, thumb });
            chrome.storage.local.set({ gh_alerts: alerts }, () => {
                renderAlerts(); 
                if(closeSearch) closeSearch.click();
            });
        }
    });
}

async function renderAlerts() {
    await fetchStoreNames();
    chrome.storage.local.get(['gh_alerts'], (result) => {
        const alerts = result.gh_alerts || [];
        
        trackedContainer.replaceChildren();

        if (alerts.length === 0) {
            const emptyMsg = document.createElement('p');
            emptyMsg.className = 'status-msg';
            emptyMsg.textContent = 'No games tracked yet.';
            trackedContainer.appendChild(emptyMsg);
            return;
        }

        alerts.forEach(g => {
            const cardDiv = document.createElement('div');
            cardDiv.className = 'tracked-card';

            const itemDiv = document.createElement('div');
            itemDiv.className = 'tracked-item';
            itemDiv.dataset.gameId = g.id;

            const img = document.createElement('img');
            img.src = g.thumb || 'icon.png';
            img.className = 'mini-game-img';

            const textDiv = document.createElement('div');
            textDiv.style.cssText = 'flex:1; margin-left:10px;';
            
            const titleDiv = document.createElement('div');
            titleDiv.className = 'tracked-game-title';
            titleDiv.textContent = g.name; 

            const statusDiv = document.createElement('div');
            statusDiv.className = 'search-status';
            statusDiv.id = `status-${g.id}`;
            statusDiv.textContent = '🔍 Searching for deals...';

            textDiv.append(titleDiv, statusDiv);

            const arrowDiv = document.createElement('div');
            arrowDiv.className = 'arrow-icon';
            arrowDiv.id = `arrow-${g.id}`;
            arrowDiv.textContent = '▼';

            const removeDiv = document.createElement('div');
            removeDiv.className = 'remove-track';
            removeDiv.dataset.id = g.id;
            removeDiv.textContent = '×';
            removeDiv.onclick = (e) => {
                e.stopPropagation();
                removeAlert(g.id);
            };

            itemDiv.append(img, textDiv, arrowDiv, removeDiv);

            const dropdownDiv = document.createElement('div');
            dropdownDiv.className = 'deals-dropdown';
            dropdownDiv.id = `deals-${g.id}`;
            dropdownDiv.style.display = 'none';

            itemDiv.onclick = (e) => {
                if(e.target.classList.contains('remove-track')) return;
                const isHidden = dropdownDiv.style.display === 'none';
                dropdownDiv.style.display = isHidden ? 'block' : 'none';
                arrowDiv.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
            };

            cardDiv.append(itemDiv, dropdownDiv);
            trackedContainer.appendChild(cardDiv);

            fetch(`https://www.cheapshark.com/api/1.0/games?id=${g.id}`)
                .then(res => res.json())
                .then(details => {
                    const statusEl = document.getElementById(`status-${g.id}`);
                    const dealsEl = document.getElementById(`deals-${g.id}`);
                    
                    if (statusEl) statusEl.textContent = "✅ All Deals Loaded";
                    
                    if (dealsEl) {
                        dealsEl.replaceChildren(); 
                        
                        const MY_CUSTOM_STORES = ["1", "2", "3", "7", "11", "13", "15", "21", "23", "25", "27", "29", "30", "32", "35"];

                        details.deals.forEach(deal => {
                            const row = document.createElement('div');
                            row.className = 'store-row-item';

                            const nameSpan = document.createElement('span');
                            nameSpan.className = 's-name';
                            nameSpan.textContent = storeNames[deal.storeID] || 'Store';

                            const leftSide = document.createElement('div');
                            leftSide.className = 's-left-side';

                            const pricesSpan = document.createElement('span');
                            pricesSpan.className = 's-prices';
                            
                            const oldP = document.createElement('span');
                            oldP.className = 'old-p';
                            oldP.textContent = `$${deal.retailPrice}`;

                            const newP = document.createElement('span');
                            newP.className = 'new-p';
                            newP.textContent = `$${deal.price}`;

                            pricesSpan.append(oldP, newP);

                            const buyBtn = document.createElement('button');
                            buyBtn.className = 'buy-now-btn';

                            if (MY_CUSTOM_STORES.includes(deal.storeID)) {
                                buyBtn.textContent = 'VISIT';
                                buyBtn.style.color = "#000000";     
                                buyBtn.style.borderColor = "#000000";
                                buyBtn.onclick = (e) => {
                                    e.stopPropagation();
                                    chrome.tabs.create({ 
                                        url: `https://go.gamer-hub.shop/?storeId=${deal.storeID}&dealID=${deal.dealID}`
                                    });
                                };
                            } else {
                                buyBtn.textContent = 'BUY';
                                buyBtn.onclick = (e) => {
                                    e.stopPropagation();
                                    chrome.tabs.create({ url: `https://www.cheapshark.com/redirect?dealID=${deal.dealID}` });
                                };
                            }

                            leftSide.append(pricesSpan, buyBtn);
                            row.append(nameSpan, leftSide);
                            dealsEl.appendChild(row);
                        });
                    }
                })
                .catch(err => console.error(err));
        });
    });
}

function removeAlert(id) {
    chrome.storage.local.get(['gh_alerts'], (result) => {
        let alerts = (result.gh_alerts || []).filter(x => x.id !== id);
        chrome.storage.local.set({ gh_alerts: alerts }, renderAlerts);
    });
}

document.addEventListener('DOMContentLoaded', renderAlerts);