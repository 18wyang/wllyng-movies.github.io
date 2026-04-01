import { MOVIES } from './movies.js';
import * as api from './api.js';

// Elements
const screens = {
    welcome: document.getElementById('welcome-screen'),
    rating: document.getElementById('rating-screen'),
    results: document.getElementById('results-screen'),
    participants: document.getElementById('participants-screen')
};

const loginForm = document.getElementById('login-form');
const firstnameInput = document.getElementById('firstname-input');
const lastnameInput = document.getElementById('lastname-input');

// Ranking Elements
const rankedListEl = document.getElementById('ranked-list');
const activeMovieZone = document.getElementById('active-movie-zone');
const activeMoviePanel = document.getElementById('active-movie-panel');
const unseenListEl = document.getElementById('unseen-list');
const toggleUnseenBtn = document.getElementById('toggle-unseen-btn');
const skipBtn = document.getElementById('skip-btn');
const saveRankingsBtn = document.getElementById('save-rankings-btn');
const rankCountDisplay = document.getElementById('rank-count');

// Modal Elements
const userModal = document.getElementById('user-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const modalUserName = document.getElementById('modal-user-name');
const modalTierList = document.getElementById('modal-tier-list');

// State
let currentUser = '';
let isAdmin = false;
let userRatings = {}; 

let globalUsers = [];
let globalSettings = { matchmaker_revealed: false, final_matches: [] };

let sortableRanked;
let unratedPool = []; // Stack of movies yet to be seen

// Initialize
async function init() {
    showScreen('welcome');
    
    globalSettings = await api.getSettings();
    globalUsers = await api.getUsers();
    
    const logoutBtn = document.getElementById('global-logout-btn');
    logoutBtn.style.display = 'none';
        
    if (globalSettings.matchmaker_revealed) {
        document.getElementById('welcome-matches-container').style.display = 'block';
        renderMatchesGrid('welcome-matches-grid', globalSettings.final_matches);
    } else {
        document.getElementById('welcome-matches-container').style.display = 'none';
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const first = firstnameInput.value.trim();
        const last = lastnameInput.value.trim();
        
        const startBtn = document.getElementById('start-btn');
        startBtn.textContent = 'Loading...';
        startBtn.disabled = true;

        if (first.toLowerCase() === 'admin') {
            isAdmin = true;
            currentUser = 'Admin Host';
            await showResults();
            return;
        }

        if (first) {
            currentUser = last ? `${first} ${last}` : first;
            await loadUserSession();
        }
    });

    // Initialize Sequential Drag and Drop instances
    if (window.Sortable) {
        sortableRanked = new Sortable(rankedListEl, {
            group: 'shared',
            animation: 150,
            ghostClass: 'sortable-ghost',
            dragClass: 'sortable-drag',
            onAdd: function (evt) {
                // Instantly load next movie when dropped from the active zone
                setTimeout(() => {
                    loadNextMovie();
                    syncAndSave();
                }, 50);
            },
            onSort: () => {
                updateRankCount();
                syncAndSave();
            }
        });

        new Sortable(activeMovieZone, {
            group: {
                name: 'shared',
                pull: true,
                put: false // Items cannot be dropped back here
            },
            animation: 150,
            sort: false, // Cannot sort within the single item
            ghostClass: 'sortable-ghost',
            dragClass: 'sortable-drag'
        });
    }

    skipBtn.addEventListener('click', () => {
        if (unratedPool.length > 0) {
            const currentMovie = unratedPool[0];
            
            unseenListEl.insertAdjacentHTML('beforeend', createMovieCardHTML(currentMovie));
            
            activeMovieZone.innerHTML = ''; 
            loadNextMovie();
            syncAndSave();
        }
    });

    document.querySelector('.draggable-container').addEventListener('click', (e) => {
        const btn = e.target.closest('.remove-from-list-btn');
        if (btn) {
            const card = btn.closest('.drag-movie-card');
            
            if (card.parentElement.id === 'active-movie-zone') return;
            
            const movieId = card.dataset.id;
            const movie = MOVIES.find(m => m.id === movieId);
            if (movie) {
                card.remove();
                unratedPool.push(movie); 
                updateRankCount();
                syncAndSave();
                
                if (activeMoviePanel.style.display === 'none') {
                    renderActiveMovie();
                }
            }
        }
    });

    toggleUnseenBtn.addEventListener('click', () => {
        if (unseenListEl.style.display === 'none') {
            unseenListEl.style.display = 'flex';
            toggleUnseenBtn.innerHTML = `<i class="fa-solid fa-eye"></i> Hide Haven't Seen It (${unseenListEl.children.length}) <i class="fa-solid fa-chevron-up" style="margin-left: 0.5rem;"></i>`;
        } else {
            unseenListEl.style.display = 'none';
            toggleUnseenBtn.innerHTML = `<i class="fa-regular fa-eye-slash"></i> View Haven't Seen It (${unseenListEl.children.length}) <i class="fa-solid fa-chevron-down" style="margin-left: 0.5rem;"></i>`;
        }
    });
    
    saveRankingsBtn.addEventListener('click', async () => {
        await finishRating();
    });

    document.getElementById('edit-ratings-btn').addEventListener('click', () => {
        startRatingPhase();
    });

    document.getElementById('view-participants-btn').addEventListener('click', () => {
        showParticipantsScreen();
    });
    
    document.getElementById('back-to-results-btn').addEventListener('click', () => {
        showResults();
    });

    closeModalBtn.addEventListener('click', () => {
        userModal.classList.remove('active');
        setTimeout(() => userModal.style.display = 'none', 300);
    });

    window.viewUser = openUserModal;

    window.deleteParticipant = async (name) => {
        if (!isAdmin) return;
        if (confirm(`Are you sure you want to delete ${name}'s data? (This modifies the live database)`)) {
            await api.deleteUser(name);
            globalUsers = await api.getUsers();
            showParticipantsScreen();
        }
    };

    document.getElementById('global-logout-btn').addEventListener('click', async () => {
        currentUser = '';
        isAdmin = false;
        userRatings = {};
        firstnameInput.value = '';
        lastnameInput.value = '';
        
        const startBtn = document.getElementById('start-btn');
        startBtn.textContent = 'Continue';
        startBtn.disabled = false;
        
        globalSettings = await api.getSettings();
        if (globalSettings.matchmaker_revealed) {
            document.getElementById('welcome-matches-container').style.display = 'block';
            renderMatchesGrid('welcome-matches-grid', globalSettings.final_matches);
        } else {
            document.getElementById('welcome-matches-container').style.display = 'none';
        }

        showScreen('welcome');
    });
}

function showScreen(screenId) {
    Object.values(screens).forEach(screen => {
        if(screen) screen.classList.remove('active');
    });
    if(screens[screenId]) screens[screenId].classList.add('active');
    
    const logoutBtn = document.getElementById('global-logout-btn');
    if (screenId === 'welcome') {
        logoutBtn.style.display = 'none';
    } else {
        logoutBtn.style.display = 'block';
    }
}

async function loadUserSession() {
    globalUsers = await api.getUsers();
    const existingUser = globalUsers.find(u => u.name.toLowerCase() === currentUser.toLowerCase());
    
    userRatings = {};

    if (existingUser && existingUser.ratings) {
        userRatings = existingUser.ratings;
        if (Object.keys(userRatings).length >= MOVIES.length) {
            await showResults();
            return;
        }
    }
    
    startRatingPhase();
}

// --- Sequential Rating Phase ---
function createMovieCardHTML(movie) {
    return `
        <div class="drag-movie-card" data-id="${movie.id}" style="width:100%; max-width: 400px; margin: 0 auto;">
            <div class="drag-movie-info">
                <span class="drag-movie-title">${movie.title}</span>
                <span class="drag-movie-year">${movie.year}</span>
            </div>
            <div style="display:flex; align-items:center; gap: 0.5rem;">
                <button class="remove-from-list-btn" title="Return to Queue"><i class="fa-solid fa-times"></i></button>
                <div class="drag-handle"><i class="fa-solid fa-grip-lines"></i></div>
            </div>
        </div>
    `;
}

function startRatingPhase() {
    showScreen('rating');
    
    rankedListEl.innerHTML = '';
    unseenListEl.innerHTML = '';
    activeMovieZone.innerHTML = '';
    
    let ratedItems = [];
    let unseenItems = [];
    unratedPool = [];

    MOVIES.forEach(movie => {
        const val = userRatings[movie.id];
        if (val !== undefined && val !== null) {
            ratedItems.push({ movie, rank: val });
        } else if (val === null) {
            unseenItems.push(movie);
        } else if (val === undefined) {
            unratedPool.push(movie);
        }
    });

    // Randomize the incoming movie deck
    unratedPool.sort(() => Math.random() - 0.5);

    // Populate previously ranked list
    ratedItems.sort((a, b) => a.rank - b.rank);
    ratedItems.forEach(item => {
        rankedListEl.insertAdjacentHTML('beforeend', createMovieCardHTML(item.movie));
    });
    
    unseenItems.forEach(movie => {
        unseenListEl.insertAdjacentHTML('beforeend', createMovieCardHTML(movie));
    });
    
    updateRankCount();

    if (unratedPool.length > 0) {
        renderActiveMovie();
    } else {
        showFinishPhase();
    }
}

function renderActiveMovie() {
    activeMovieZone.innerHTML = ''; 
    const movie = unratedPool[0];
    activeMovieZone.innerHTML = createMovieCardHTML(movie);
    
    activeMoviePanel.style.display = 'flex';
    saveRankingsBtn.style.display = 'none';
}

function loadNextMovie() {
    unratedPool.shift(); 
    updateRankCount();
    
    if (unratedPool.length > 0) {
        renderActiveMovie();
    } else {
        showFinishPhase();
    }
}

function showFinishPhase() {
    activeMoviePanel.style.display = 'none';
    saveRankingsBtn.style.display = 'block';
}

function updateRankCount() {
    const listCount = rankedListEl.children.length;
    rankCountDisplay.textContent = `${listCount} Sorted  (${unratedPool.length} left)`;
    
    if (unseenListEl.style.display === 'none') {
        toggleUnseenBtn.innerHTML = `<i class="fa-regular fa-eye-slash"></i> View Haven't Seen It (${unseenListEl.children.length}) <i class="fa-solid fa-chevron-down" style="margin-left: 0.5rem;"></i>`;
    } else {
        toggleUnseenBtn.innerHTML = `<i class="fa-solid fa-eye"></i> Hide Haven't Seen It (${unseenListEl.children.length}) <i class="fa-solid fa-chevron-up" style="margin-left: 0.5rem;"></i>`;
    }
}

function syncAndSave() {
    userRatings = {};
    
    const rankedCards = Array.from(rankedListEl.children);
    rankedCards.forEach((card, index) => {
        userRatings[card.dataset.id] = index + 1;
    });

    const unseenCards = Array.from(unseenListEl.children);
    unseenCards.forEach((card) => {
        userRatings[card.dataset.id] = null;
    });

    api.saveUser(currentUser, userRatings).catch(console.error);
}

async function finishRating() {
    saveRankingsBtn.textContent = 'Saving...';
    saveRankingsBtn.disabled = true;

    syncAndSave();
    
    await api.saveUser(currentUser, userRatings);
    globalUsers = await api.getUsers();
    
    saveRankingsBtn.textContent = 'Finish & Save';
    saveRankingsBtn.disabled = false;

    await showResults();
}

// --- Results Phase ---
function generateSortedHtmlList(ratingsObj) {
    const sortedRated = Object.entries(ratingsObj)
        .filter(([id, val]) => val !== null && val !== undefined)
        .sort((a, b) => a[1] - b[1]) // ASC Rank (1 is top)
        .map(([id, val]) => {
            const m = MOVIES.find(x => x.id === id);
            return { ...m, rating: val };
        });

    const unrated = Object.entries(ratingsObj)
        .filter(([id, val]) => val === null)
        .map(([id]) => MOVIES.find(x => x.id === id));

    let html = '';
    
    if (sortedRated.length > 0) {
        sortedRated.forEach(movie => {
            html += `<div class="list-item" style="padding:0.75rem; justify-content:flex-start; align-items:center; gap: 1rem;">
                <div class="rank-number" style="font-size: 1.2rem; min-width: 40px; color: var(--primary-color); font-weight: bold;">#${movie.rating}</div>
                <div>
                    <span style="font-weight:600;">${movie.title}</span> 
                    <span style="font-size:0.8rem;color:var(--text-secondary)">${movie.year}</span>
                </div>
            </div>`;
        });
    }

    if (unrated.length > 0) {
        html += `<div style="margin-top:1rem; padding-top:1rem; border-top:1px solid rgba(255,255,255,0.1);">
            <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:0.5rem;">Haven't Seen:</p>`;
        unrated.forEach(movie => {
            html += `<div class="list-item" style="padding:0.5rem; opacity:0.6;">
                <span style="font-weight:400; font-size:0.9rem;">${movie.title}</span>
            </div>`;
        });
        html += `</div>`;
    }

    return html;
}

async function showResults() {
    showScreen('results');
    
    const listContainer = document.getElementById('user-tier-list');
    listContainer.innerHTML = '';
    const activeMatchPanel = document.getElementById('active-match-panel');
    activeMatchPanel.style.display = 'none';
    
    if (isAdmin) {
        listContainer.innerHTML = '<p style="text-align:center; padding: 2rem;">You are in Admin Mode.</p>';
        document.getElementById('edit-ratings-btn').style.display = 'none';
        
        document.getElementById('admin-panel').style.display = 'flex';
        document.getElementById('view-participants-btn').style.display = 'block';
        document.getElementById('waiting-message').style.display = 'none';
        document.getElementById('admin-preview-panel').style.display = 'block';
        
        globalSettings = await api.getSettings();
        
        const isRevealed = globalSettings.matchmaker_revealed;
        const matchBtn = document.getElementById('match-everyone-btn');
        matchBtn.textContent = isRevealed ? "Hide Matches (Off)" : "Reveal Matches (On)";
        
        matchBtn.onclick = async () => {
            globalSettings = await api.getSettings();
            if (globalSettings.matchmaker_revealed) {
                await api.updateSettings(false, globalSettings.final_matches);
                globalSettings.matchmaker_revealed = false;
                matchBtn.textContent = "Reveal Matches (On)";
            } else {
                await generateMatches();
            }
        };

        const simulateBtn = document.getElementById('simulate-users-btn');
        simulateBtn.onclick = async () => {
            simulateBtn.textContent = "Simulating...";
            await createMockUsers(10);
            await updateAdminPreview();
            simulateBtn.textContent = "Simulate 10 Random Users";
            alert("10 random users added to the database!");
        };

        const clearBtn = document.getElementById('clear-users-btn');
        clearBtn.onclick = async () => {
             if (confirm("Are you sure you want to clear ALL participant data and matches from the database?")) {
                await api.clearAllUsers();
                await api.updateSettings(false, []);
                globalSettings = await api.getSettings();
                globalUsers = [];
                matchBtn.textContent = "Reveal Matches (On)";
                await updateAdminPreview();
                alert("Database completely cleared.");
            }
        };

        if(window._previewInt) clearInterval(window._previewInt);
        await updateAdminPreview(); 
        window._previewInt = setInterval(updateAdminPreview, 3000); // Backed off for API limits
        
    } else {
        document.getElementById('edit-ratings-btn').style.display = 'inline-block';
        listContainer.innerHTML += generateSortedHtmlList(userRatings);
        
        document.getElementById('admin-panel').style.display = 'none';
        document.getElementById('admin-preview-panel').style.display = 'none';
        checkMatchRevealStatus();
        pollForMatchReveal();
    }
}

function checkMatchRevealStatus() {
    const isRevealed = globalSettings.matchmaker_revealed;
    if (isRevealed && !isAdmin) {
        document.getElementById('waiting-message').style.display = 'none';
        document.getElementById('edit-ratings-btn').style.display = 'none';
        
        const matches = globalSettings.final_matches;
        const myMatch = matches.find(m => m.uA.name === currentUser || m.uB.name === currentUser || (m.uC && m.uC.name === currentUser));
        
        const matchPanel = document.getElementById('active-match-panel');
        if (myMatch) {
            let partners = [myMatch.uA.name, myMatch.uB.name];
            if (myMatch.uC) partners.push(myMatch.uC.name);
            partners = partners.filter(n => n !== currentUser);
            
            const partnerText = partners.join(' & ');
            
            document.getElementById('match-announcement').textContent = `🎉 Your Match: ${partnerText}`;
            document.getElementById('match-score').textContent = `Group Compatibility: ~${myMatch.score}% (${myMatch.shared} shared movies approx)`;
            
            document.getElementById('view-match-btn').onclick = () => openUserModal(partners[0]);
            
            if(partners.length > 1) {
                 document.getElementById('view-match-btn').textContent = `View First Partner's Rankings`;
            } else {
                 document.getElementById('view-match-btn').textContent = `View Their Rankings`;
            }
            document.getElementById('view-match-btn').style.display = 'block';
        } else {
             document.getElementById('match-announcement').textContent = `No unique match found :(`;
             document.getElementById('match-score').textContent = `Try convincing more people to join!`;
             document.getElementById('view-match-btn').style.display = 'none';
        }
        matchPanel.style.display = 'block';
        document.getElementById('view-participants-btn').style.display = 'block';
        
    } else if (!isAdmin) {
        document.getElementById('waiting-message').style.display = 'block';
        document.getElementById('active-match-panel').style.display = 'none';
        document.getElementById('view-participants-btn').style.display = 'none';
        document.getElementById('edit-ratings-btn').style.display = 'inline-block';
    }
}

function pollForMatchReveal() {
    if(window._pollingInt) clearInterval(window._pollingInt);
    
    window._pollingInt = setInterval(async () => {
        globalSettings = await api.getSettings();
        globalUsers = await api.getUsers(); 
        checkMatchRevealStatus();
    }, 3000);
}

// --- Participants Directory ---
function showParticipantsScreen() {
    showScreen('participants');
    
    const container = document.getElementById('participants-list');
    const displayCount = document.getElementById('participants-count');
    container.innerHTML = '';
    
    displayCount.textContent = `Total Joined: ${globalUsers.length}`;
    
    if (globalUsers.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding:1rem;">No participants yet.</p>';
        return;
    }
    
    globalUsers.forEach(user => {
        const ratedCount = Object.values(user.ratings).filter(r => r !== null).length;
        
        const deleteHtml = isAdmin ? `<button class="delete-user-btn" onclick="window.deleteParticipant('${user.name}'); event.stopPropagation();" title="Remove User"><i class="fa-solid fa-times"></i></button>` : '';

        container.innerHTML += `
            <div class="list-item" style="justify-content:space-between; padding:1rem;">
                <div style="flex:1; display:flex; justify-content:space-between; cursor:pointer;" class="clickable-name" onclick="window.viewUser('${user.name}')">
                    <span style="font-size:1.1rem; font-weight:600;">${user.name}</span>
                    <span style="font-size:0.9rem; color:var(--text-secondary);">${ratedCount}/${MOVIES.length} ranked</span>
                </div>
                ${deleteHtml}
            </div>
        `;
    });

    const isRevealed = globalSettings.matchmaker_revealed;
    if (isRevealed) {
        const matches = globalSettings.final_matches;
        document.getElementById('participants-matches-container').style.display = 'block';
        renderMatchesGrid('participants-matches-grid', matches);
    } else {
        document.getElementById('participants-matches-container').style.display = 'none';
    }
}


// --- Math: Similarity via Percentile Ranking ---
function calculateCompatibility(ratingsA, ratingsB) {
    let sharedMovies = 0;
    let totalA = 0;
    let totalB = 0;

    for (const m of MOVIES) if (ratingsA[m.id] !== null && ratingsA[m.id] !== undefined) totalA++;
    for (const m of MOVIES) if (ratingsB[m.id] !== null && ratingsB[m.id] !== undefined) totalB++;

    let sumPercentileDiffs = 0;
    
    for (const movie of MOVIES) {
        const rA = ratingsA[movie.id];
        const rB = ratingsB[movie.id];
        
        if (rA !== null && rA !== undefined && rB !== null && rB !== undefined) {
            sharedMovies++;
            
            // Map 1-N rank to 0.0-1.0 Percentile (0.0 is best, 1.0 is worst)
            const pctA = totalA > 1 ? (rA - 1) / (totalA - 1) : 0;
            const pctB = totalB > 1 ? (rB - 1) / (totalB - 1) : 0;
            
            sumPercentileDiffs += Math.abs(pctA - pctB);
        }
    }
    
    if (sharedMovies === 0) {
        return { score: 0, shared: 0 };
    }
    
    let avgDiff = sumPercentileDiffs / sharedMovies;
    let similarity = 1 - avgDiff;
    
    const threshold = 10;
    if (sharedMovies < threshold) {
        similarity = similarity * (sharedMovies / threshold);
    }
    
    return {
        score: Math.max(0, Math.round(similarity * 100)),
        shared: sharedMovies
    };
}

// --- Matching Logic Engine ---
function computeMatches(allUsers) {
    if (allUsers.length < 2) return [];

    let pairsScores = [];
    for (let i = 0; i < allUsers.length; i++) {
        for (let j = i + 1; j < allUsers.length; j++) {
            const comp = calculateCompatibility(allUsers[i].ratings, allUsers[j].ratings);
            pairsScores.push({ uA: allUsers[i], uB: allUsers[j], score: comp.score, shared: comp.shared });
        }
    }
    
    pairsScores.sort((a, b) => b.score - a.score);
    let matchedUsers = new Set();
    let finalMatches = [];
    
    for (const pair of pairsScores) {
        if (!matchedUsers.has(pair.uA.name) && !matchedUsers.has(pair.uB.name)) {
            finalMatches.push({...pair});
            matchedUsers.add(pair.uA.name);
            matchedUsers.add(pair.uB.name);
        }
    }

    if (matchedUsers.size < allUsers.length) {
        const leftoverUser = allUsers.find(u => !matchedUsers.has(u.name));
        if (leftoverUser && finalMatches.length > 0) {
            let bestPairIndex = 0;
            let bestAvgScore = -1;
            
            for (let i = 0; i < finalMatches.length; i++) {
                const pair = finalMatches[i];
                const compA = calculateCompatibility(leftoverUser.ratings, pair.uA.ratings);
                const compB = calculateCompatibility(leftoverUser.ratings, pair.uB.ratings);
                
                const avgScore = (compA.score + compB.score) / 2;
                
                if (avgScore > bestAvgScore) {
                    bestAvgScore = avgScore;
                    bestPairIndex = i;
                }
            }
            
            finalMatches[bestPairIndex].uC = leftoverUser;
            finalMatches[bestPairIndex].score = Math.round((finalMatches[bestPairIndex].score + bestAvgScore) / 2);
        }
    }
    
    return finalMatches;
}

async function generateMatches() {
    globalUsers = await api.getUsers();
    if (globalUsers.length < 2) {
        alert("Not enough people have joined to create matches.");
        return;
    }

    const finalMatches = computeMatches(globalUsers);

    await api.updateSettings(true, finalMatches);
    globalSettings = await api.getSettings();
    
    const matchBtn = document.getElementById('match-everyone-btn');
    matchBtn.textContent = "Hide Matches (Off)";
    
    alert("Matches generated and revealed to all active users!");
}

function renderMatchesGrid(containerId, matches) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    
    if (!matches || matches.length === 0) return;

    for (const match of matches) {
        let titleNode = `
            <span class="clickable-name" onclick="window.viewUser('${match.uA.name}')">${match.uA.name}</span> 
            <span>&</span> 
            <span class="clickable-name" onclick="window.viewUser('${match.uB.name}')">${match.uB.name}</span>
        `;
        if (match.uC) {
            titleNode += ` <span style="color:var(--accent-red);">&</span> <span class="clickable-name" onclick="window.viewUser('${match.uC.name}')" style="color:var(--accent-red);">${match.uC.name}</span>`;
        }

        const card = document.createElement('div');
        card.className = 'match-card';
        card.style.transform = 'scale(0.9)';
        card.style.padding = '1rem';
        card.innerHTML = `
            <div class="match-names" style="font-size: 1.2rem; line-height: 1.5;">
                ${titleNode}
            </div>
            <div class="compatibility-score" style="font-size: 1.5rem;">${match.score}%</div>
        `;
        container.appendChild(card);
    }
}

async function updateAdminPreview() {
    if (!isAdmin) return;
    globalUsers = await api.getUsers(); 
    
    const container = document.getElementById('admin-matches-container');
    container.innerHTML = '';
    
    if (globalUsers.length < 2) {
        container.innerHTML = '<p style="text-align:center; color:var(--text-secondary); width: 100%;">Not enough users to preview matches.</p>';
        return;
    }

    const finalMatches = computeMatches(globalUsers);
    renderMatchesGrid('admin-matches-container', finalMatches);
}

function openUserModal(name) {
    const user = globalUsers.find(u => u.name === name);
    
    if (user) {
        modalUserName.textContent = `${user.name}'s Rankings`;
        modalTierList.innerHTML = generateSortedHtmlList(user.ratings);
        
        userModal.style.display = 'flex';
        setTimeout(() => userModal.classList.add('active'), 10);
    }
}

async function createMockUsers(count) {
    const names = ['Emma', 'Liam', 'Olivia', 'Charlotte', 'Ava', 'Elijah', 'Isabella', 'James', 'Sophia', 'William', 'Mia', 'Benjamin', 'Chloe', 'Lucas', 'Amelia', 'Henry'];
    
    let promises = [];
    for (let i = 0; i < count; i++) {
        const randName = `${names[Math.floor(Math.random() * names.length)]} ${Math.floor(Math.random()*1000)}`;
        let fakeRatings = {};
        
        let seen = [];
        MOVIES.forEach(m => {
            if (Math.random() > 0.3) {
                seen.push(m);
            } else {
                fakeRatings[m.id] = null;
            }
        });
        
        seen.sort(() => Math.random() - 0.5);
        seen.forEach((m, index) => {
            fakeRatings[m.id] = index + 1; // 1-indexed random ranking
        });

        promises.push(api.saveUser(randName, fakeRatings));
    }
    
    await Promise.all(promises);
}

// Boot up
document.addEventListener('DOMContentLoaded', init);
