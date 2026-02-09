// content.js - GamerHub Button Injector V7 (With GH Logo)

function createGamerHubButton() {
    if (document.getElementById('gamerhub-inv-btn')) return;

    const btn = document.createElement('a');
    btn.id = 'gamerhub-inv-btn';
    btn.href = "#";
    
    btn.style.cssText = `
        background: linear-gradient(to bottom, #00ff88 5%, #00cc6a 95%);
        border: 1px solid #00cc6a;
        color: #000000 !important;
        text-shadow: none;
        padding: 8px 12px;
        margin-top: 10px;
        margin-bottom: 10px;
        border-radius: 4px;
        cursor: pointer;
        font-weight: 800;
        font-size: 13px;
        font-family: "Motiva Sans", Sans-serif;
        text-decoration: none;
        display: flex;             
        align-items: center;       
        justify-content: center;   
        box-shadow: 0 0 10px rgba(0, 255, 136, 0.4);
        transition: all 0.2s ease;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    `;

    btn.onmouseover = () => {
        btn.style.background = "linear-gradient(to bottom, #33ff99 5%, #00ff88 95%)";
        btn.style.boxShadow = "0 0 15px rgba(0, 255, 136, 0.8)";
        btn.style.transform = "translateY(-1px)";
    };
    btn.onmouseout = () => {
        btn.style.background = "linear-gradient(to bottom, #00ff88 5%, #00cc6a 95%)";
        btn.style.boxShadow = "0 0 10px rgba(0, 255, 136, 0.4)";
        btn.style.transform = "translateY(0)";
    };

    const iconUrl = chrome.runtime.getURL("icon.png");

    const btnImg = document.createElement('img');
    btnImg.src = iconUrl;
    btnImg.style.cssText = "width: 16px; height: 16px; margin-right: 8px; vertical-align: middle;";
    
    const btnText = document.createTextNode(" View CS2 Inventory");

    btn.replaceChildren(btnImg, btnText);

    btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        chrome.runtime.sendMessage({
            action: "open_inventory_tab",
            url: window.location.href
        });
    };

    if (window.location.href.includes('/inventory')) {
        let targetContainer = document.querySelector('.inventory_rightnav') || 
                              document.querySelector('.inventory_links') || 
                              document.querySelector('.profile_small_header_texture');

        if (targetContainer) {
            btn.className = 'btn_small btn_grey_white_innerfade';
            
            btn.style.display = "inline-flex"; 
            btn.style.padding = "4px 10px";
            btn.style.fontSize = "12px";
            btn.style.margin = "0 0 0 10px";
            btn.style.float = "right";
            btn.style.width = "auto";
            btn.style.transform = "none";
            btn.style.boxShadow = "0 0 5px rgba(0, 255, 136, 0.4)"; 
            
            const smallImg = document.createElement('img');
            smallImg.src = iconUrl;
            smallImg.style.cssText = "width: 14px; height: 14px; margin-right: 5px;";
            
            const smallText = document.createTextNode("View CS2 Inv");
            
            btn.replaceChildren(smallImg, smallText);

            if (targetContainer.classList.contains('inventory_links')) {
                 btn.style.float = 'left';
                 btn.style.marginLeft = '0';
                 btn.style.marginRight = '10px';
            }
            targetContainer.appendChild(btn);
            
            btn.onmouseover = () => {
                 btn.style.background = "linear-gradient(to bottom, #33ff99 5%, #00ff88 95%)";
                 btn.style.boxShadow = "0 0 10px rgba(0, 255, 136, 0.8)";
            };
             btn.onmouseout = () => {
                 btn.style.background = "linear-gradient(to bottom, #00ff88 5%, #00cc6a 95%)";
                 btn.style.boxShadow = "0 0 5px rgba(0, 255, 136, 0.4)";
            };
            return; 
        }
    }


    const rightCol = document.querySelector('.profile_rightcol');
    if (rightCol) {
        const links = rightCol.querySelectorAll('a');
        for (let link of links) {
            if (link.href.includes('/inventory')) {
                const parentDiv = link.parentNode;
                if (parentDiv) {
                    parentDiv.appendChild(btn);
                }
                return;
            }
        }
    }
}

createGamerHubButton();
const observer = new MutationObserver(() => createGamerHubButton());
observer.observe(document.body, { childList: true, subtree: true });