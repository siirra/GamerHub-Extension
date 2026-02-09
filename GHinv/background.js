// =========================================================
// BACKGROUND.JS - V32 (Friends Tracking + Free Games Alerts)
// =========================================================

chrome.runtime.onInstalled.addListener(() => {
    console.log("GamerHub: Installed.");
    startEngine();
});

chrome.runtime.onStartup.addListener(() => {
    console.log("GamerHub: Browser Started.");
    startEngine();
});

function startEngine() {
    chrome.alarms.create("checkFriendsAPI", { periodInMinutes: 1 });
    
    chrome.alarms.create("checkFreebies", { periodInMinutes: 30 });

    checkFriendsViaAPI();
    checkFreebiesViaAPI();
}

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "checkFriendsAPI") {
        checkFriendsViaAPI();
    } else if (alarm.name === "checkFreebies") {
        checkFreebiesViaAPI();
    }
});


async function checkFriendsViaAPI() {
    try {
        const storage = await chrome.storage.local.get([
            'gh_user_steam_key', 
            'gh_notify_list',       
            'gh_manual_track_list', 
            'gh_last_known_game',   
            'gh_last_online_state'  
        ]);
        
        const apiKey = storage.gh_user_steam_key;
        let notifyList = storage.gh_notify_list || [];
        const manualList = storage.gh_manual_track_list || [];
        
        let lastGames = storage.gh_last_known_game || {};
        let lastStates = storage.gh_last_online_state || {};

        const combinedList = [...new Set([...notifyList, ...manualList])];

        if (!apiKey || combinedList.length === 0) return;

        const chunkSize = 100;
        for (let i = 0; i < combinedList.length; i += chunkSize) {
            const chunk = combinedList.slice(i, i + chunkSize);
            const idsString = chunk.join(',');

            const response = await fetch(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${apiKey}&steamids=${idsString}&_=${Date.now()}`);
            
            if (!response.ok) continue;

            const data = await response.json();
            const players = data.response.players;

            let dataChanged = false;

            players.forEach(player => {
                const steamId = player.steamid;
                const playerName = player.personaname;
                const avatar = player.avatarfull; 
                
                const currentGame = player.gameextrainfo || null;
                const currentState = player.personastate; 

                const oldGame = lastGames[steamId] || null;
                const oldState = lastStates[steamId]; 


                if (currentGame && currentGame !== oldGame) {
                    showNotification(playerName, `is playing ${currentGame}`, avatar, `🎮 ${playerName} Started Playing`, null);
                }
                
                else if (oldGame && !currentGame && currentState > 0) {
                    showNotification(playerName, `stopped playing ${oldGame}`, avatar, `🛑 ${playerName} Stopped Playing`, null);
                }

                if (oldState !== undefined && oldState === 0 && currentState > 0) {
                    showNotification(playerName, "is now Online", avatar, `🟢 ${playerName} is Online`, null);
                }

                if (oldState !== undefined && oldState > 0 && currentState === 0) {
                    showNotification(playerName, "went Offline", avatar, `🔴 ${playerName} is Offline`, null);
                }


                if (lastGames[steamId] !== currentGame || lastStates[steamId] !== currentState) {
                    lastGames[steamId] = currentGame;
                    lastStates[steamId] = currentState;
                    dataChanged = true;
                }
            });

            if (dataChanged) {
                chrome.storage.local.set({ 
                    'gh_last_known_game': lastGames,
                    'gh_last_online_state': lastStates
                });
            }
        }

    } catch (error) {
        console.error("API Check Error:", error);
    }
}

// =========================================================
// 2. FREE GAMES ALERT SYSTEM (NEW 🎁)
// =========================================================

async function checkFreebiesViaAPI() {
    try {
        const storage = await chrome.storage.local.get(['gh_seen_freebies', 'gh_freebies_notify_enabled']);
        let seenFreebies = storage.gh_seen_freebies || [];
        
        const isNotifyEnabled = storage.gh_freebies_notify_enabled !== false; 

        const response = await fetch(`https://www.gamerpower.com/api/giveaways?type=game&platform=pc&_=${Date.now()}`);
        if (!response.ok) return;
        
        const games = await response.json();
        
        if (seenFreebies.length === 0) {
            const currentIds = games.map(g => g.id);
            chrome.storage.local.set({ 'gh_seen_freebies': currentIds });
            return;
        }

        let newGamesFound = false;
        
        for (let i = 0; i < Math.min(games.length, 5); i++) {
            const game = games[i];
            
            if (!seenFreebies.includes(game.id)) {
                if (isNotifyEnabled) {
                    showNotification(
                        "FREE GAME ALERT! 🎁", 
                        game.title, 
                        game.image, 
                        "New Free Game Available", 
                        game.open_giveaway_url
                    );
                }
                seenFreebies.push(game.id);
                newGamesFound = true;
            }
        }

        if (newGamesFound) {
            if (seenFreebies.length > 50) {
                seenFreebies = seenFreebies.slice(seenFreebies.length - 50);
            }
            chrome.storage.local.set({ 'gh_seen_freebies': seenFreebies });
        }

    } catch (e) {
        console.error("Freebies Check Error:", e);
    }
}

// =========================================================
// 3. NOTIFICATION HANDLER & CLICK LISTENER
// =========================================================

function showNotification(name, message, iconUrl, title, clickUrl) {
    const notificationId = clickUrl ? `url|${clickUrl}|${Date.now()}` : `msg|${Date.now()}`;

    chrome.notifications.create(notificationId, {
        type: 'basic',
        iconUrl: iconUrl || 'icon.png',
        title: title,
        message: message, 
        priority: 2,
        silent: false
    });

    if (!clickUrl) {
        chrome.storage.local.get(['gh_notif_history'], (result) => {
            let history = result.gh_notif_history || [];
            history.unshift({
                name: name,
                game: message, 
                avatar: iconUrl || 'icon.png',
                time: Date.now()
            });
            if (history.length > 20) history = history.slice(0, 20);
            chrome.storage.local.set({ 
                'gh_notif_history': history,
                'gh_has_unread': true 
            });
        });
    }
}

chrome.notifications.onClicked.addListener((notificationId) => {
    if (notificationId.startsWith('url|')) {
        const parts = notificationId.split('|');
        const url = parts[1];
        if (url) {
            chrome.tabs.create({ url: url });
        }
    }
});

// =========================================================
// 4. MESSAGE LISTENER FOR CONTENT SCRIPT
// =========================================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "open_inventory_tab") {
        const targetUrl = chrome.runtime.getURL(`inventory.html?target=${encodeURIComponent(request.url)}`);
        chrome.tabs.create({ url: targetUrl });
    }
});