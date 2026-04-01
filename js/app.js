import { MOVIES } from './movies.js';

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

// Rating Elements
const titleDisplay = document.getElementById('movie-title-display');
const yearDisplay = document.getElementById('movie-year-display');
const posterBg = document.getElementById('poster-bg');
const starsContainer = document.getElementById('stars-container');
const starBtns = document.querySelectorAll('.star-btn');
const skipBtn = document.getElementById('skip-btn');
const prevBtn = document.getElementById('prev-btn');
const ratingProgress = document.getElementById('ranking-progress');
const matchupCounter = document.getElementById('matchup-counter');

// Modal Elements
const userModal = document.getElementById('user-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const modalUserName = document.getElementById('modal-user-name');
const modalTierList = document.getElementById('modal-tier-list');

// State
let currentUser = '';
let isAdmin = false;
let moviePool = [];
let currentMovieIndex = 0;
let userRatings = {}; 

// Initialize
function init() {
    showScreen('welcome');
    moviePool = MOVIES; 

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const first = firstnameInput.value.trim();
        const last = lastnameInput.value.trim();
        
        if (first.toLowerCase() === 'admin') {
            isAdmin = true;
            currentUser = 'Admin Host';
            finishRating();
            return;
        }

        if (first) {
            currentUser = last ? `${first} ${last}` : first;
            loadUserSession();
        }
    });

    setupStarInteractions();
    
    skipBtn.addEventListener('click', () => {
        recordRating(null);
    });

    prevBtn.addEventListener('click', () => {
        if (currentMovieIndex > 0) {
            currentMovieIndex--;
            showCurrentMovie();
        }
    });

    document.getElementById('edit-ratings-btn').addEventListener('click', () => {
        currentMovieIndex = 0; 
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

    window.deleteParticipant = (name) => {
        if (!isAdmin) return;
        if (confirm(`Are you sure you want to delete ${name}'s data?`)) {
            let allUsers = JSON.parse(localStorage.getItem('matchmaker_users') || '[]');
            allUsers = allUsers.filter(u => u.name !== name);
            localStorage.setItem('matchmaker_users', JSON.stringify(allUsers));
            showParticipantsScreen(); 
        }
    };

    document.getElementById('global-logout-btn').addEventListener('click', () => {
        currentUser = '';
        isAdmin = false;
        userRatings = {};
        currentMovieIndex = 0;
        firstnameInput.value = '';
        lastnameInput.value = '';
        showScreen('welcome');
    });
}

function showScreen(screenId) {
    Object.values(screens).forEach(screen => {
        if(screen) screen.classList.remove('active');
    });
    if(screens[screenId]) screens[screenId].classList.add('active');
    
    // Toggle global logout button
    const logoutBtn = document.getElementById('global-logout-btn');
    if (screenId === 'welcome') {
        logoutBtn.style.display = 'none';
        
        // Welcome Screen Matches Panel
        const isRevealed = localStorage.getItem('matchmaker_revealed') === 'true';
        if (isRevealed) {
            const matches = JSON.parse(localStorage.getItem('matchmaker_final_matches') || '[]');
            document.getElementById('welcome-matches-container').style.display = 'block';
            renderMatchesGrid('welcome-matches-grid', matches);
        } else {
            document.getElementById('welcome-matches-container').style.display = 'none';
        }
    } else {
        logoutBtn.style.display = 'block';
    }
}

function loadUserSession() {
    const allUsers = JSON.parse(localStorage.getItem('matchmaker_users') || '[]');
    const existingUser = allUsers.find(u => u.name.toLowerCase() === currentUser.toLowerCase());
    
    userRatings = {};
    currentMovieIndex = 0;

    if (existingUser && existingUser.ratings) {
        userRatings = existingUser.ratings;
        if (Object.keys(userRatings).length >= moviePool.length) {
            finishRating();
            return;
        } else {
            const unratedIndex = moviePool.findIndex(m => userRatings[m.id] === undefined);
            currentMovieIndex = unratedIndex >= 0 ? unratedIndex : 0;
        }
    }
    
    startRatingPhase();
}

// --- Rating Phase ---
function startRatingPhase() {
    showScreen('rating');
    showCurrentMovie();
}

function showCurrentMovie() {
    if (currentMovieIndex >= moviePool.length) {
        finishRating();
        return;
    }

    const movie = moviePool[currentMovieIndex];
    titleDisplay.textContent = movie.title;
    yearDisplay.textContent = movie.year;
    posterBg.style.background = `linear-gradient(135deg, ${movie.colors[0]}, ${movie.colors[1]})`;
    
    if (currentMovieIndex > 0) {
        prevBtn.style.opacity = '1';
        prevBtn.style.pointerEvents = 'auto';
    } else {
        prevBtn.style.opacity = '0';
        prevBtn.style.pointerEvents = 'none';
    }

    const existingVal = userRatings[movie.id];
    starBtns.forEach(btn => {
        const rv = parseInt(btn.dataset.rating);
        if (existingVal && rv <= existingVal) {
            btn.classList.add('hover-active');
        } else {
            btn.classList.remove('hover-active');
        }
        btn.style.color = '';
    });

    const pct = (currentMovieIndex / moviePool.length) * 100;
    ratingProgress.style.width = `${pct}%`;
    matchupCounter.textContent = `Movie ${currentMovieIndex + 1} of ${moviePool.length}`;
}

function setupStarInteractions() {
    starBtns.forEach(btn => {
        btn.addEventListener('mouseenter', (e) => {
            const ratingValue = parseInt(e.target.dataset.rating);
            starBtns.forEach(b => {
                if (parseInt(b.dataset.rating) <= ratingValue) {
                    b.classList.add('hover-active');
                } else {
                    b.classList.remove('hover-active');
                }
            });
        });

        btn.addEventListener('mouseleave', () => {
            const movie = moviePool[currentMovieIndex];
            const existingVal = userRatings[movie.id];
            starBtns.forEach(b => {
                const rv = parseInt(b.dataset.rating);
                if (existingVal && rv <= existingVal) {
                    b.classList.add('hover-active');
                } else {
                    b.classList.remove('hover-active');
                }
            });
        });

        btn.addEventListener('click', (e) => {
            const target = e.target.closest('.star-btn');
            const ratingValue = parseInt(target.dataset.rating);
            recordRating(ratingValue);
        });
    });
}

function recordRating(stars) {
    const movie = moviePool[currentMovieIndex];
    userRatings[movie.id] = stars;
    
    document.getElementById('current-movie-card').style.transform = 'scale(0.95)';
    setTimeout(() => {
        document.getElementById('current-movie-card').style.transform = 'scale(1)';
        currentMovieIndex++;
        showCurrentMovie();
    }, 150);
}

function finishRating() {
    if (!isAdmin) {
        ratingProgress.style.width = `100%`;
        matchupCounter.textContent = `Finished!`;
        
        const allUsers = JSON.parse(localStorage.getItem('matchmaker_users') || '[]');
        
        const existingIndex = allUsers.findIndex(u => u.name.toLowerCase() === currentUser.toLowerCase());
        const userData = {
            name: currentUser,
            ratings: userRatings
        };
        
        if (existingIndex >= 0) {
            allUsers[existingIndex] = userData;
        } else {
            allUsers.push(userData);
        }
        
        localStorage.setItem('matchmaker_users', JSON.stringify(allUsers));
    }
    showResults();
}

// --- Results Phase ---
function generateSortedHtmlList(ratingsObj) {
    const sortedRated = Object.entries(ratingsObj)
        .filter(([id, val]) => val !== null)
        .sort((a, b) => b[1] - a[1]) 
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
            const starsHtml = '<i class="fa-solid fa-star" style="color:#f1c40f;font-size:0.75rem;margin-left:2px;"></i>'.repeat(movie.rating);
            html += `<div class="list-item" style="padding:0.75rem; justify-content:space-between;">
                <div><span style="font-weight:600;">${movie.title}</span> <span style="font-size:0.8rem;color:var(--text-secondary)">${movie.year}</span></div>
                <div style="min-width: 60px; text-align:right;">${starsHtml}</div>
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

function showResults() {
    showScreen('results');
    
    const listContainer = document.getElementById('user-tier-list');
    listContainer.innerHTML = '';
    const activeMatchPanel = document.getElementById('active-match-panel');
    activeMatchPanel.style.display = 'none';
    
    if (isAdmin) {
        listContainer.innerHTML = '<p style="text-align:center; padding: 2rem;">You are in Admin Mode.</p>';
        document.getElementById('edit-ratings-btn').style.display = 'none';
        
        document.getElementById('admin-panel').style.display = 'flex';
        document.getElementById('waiting-message').style.display = 'none';
        document.getElementById('admin-preview-panel').style.display = 'block';
        
        const isRevealed = localStorage.getItem('matchmaker_revealed') === 'true';
        const matchBtn = document.getElementById('match-everyone-btn');
        matchBtn.textContent = isRevealed ? "Hide Matches (Off)" : "Reveal Matches (On)";
        
        matchBtn.onclick = () => {
            if (localStorage.getItem('matchmaker_revealed') === 'true') {
                localStorage.setItem('matchmaker_revealed', 'false');
                matchBtn.textContent = "Reveal Matches (On)";
            } else {
                generateMatches();
            }
        };

        const simulateBtn = document.getElementById('simulate-users-btn');
        simulateBtn.onclick = () => {
            createMockUsers(10);
            setTimeout(updateAdminPreview, 100);
            alert("10 random users added to the lobby!");
        };

        const clearBtn = document.getElementById('clear-users-btn');
        clearBtn.onclick = () => {
            if (confirm("Are you sure you want to clear ALL participant data and matches?")) {
                localStorage.removeItem('matchmaker_users');
                localStorage.removeItem('matchmaker_final_matches');
                localStorage.setItem('matchmaker_revealed', 'false');
                matchBtn.textContent = "Reveal Matches (On)";
                updateAdminPreview();
                alert("All data cleared.");
            }
        };

        if(window._previewInt) clearInterval(window._previewInt);
        updateAdminPreview(); 
        window._previewInt = setInterval(updateAdminPreview, 2000);
        
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
    const isRevealed = localStorage.getItem('matchmaker_revealed') === 'true';
    if (isRevealed && !isAdmin) {
        document.getElementById('waiting-message').style.display = 'none';
        
        const matches = JSON.parse(localStorage.getItem('matchmaker_final_matches') || '[]');
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
                 document.getElementById('view-match-btn').textContent = `View First Partner's Ratings`;
                 // Since they have 2 partners, maybe add a second button or clarify. A single modal is fine for MVP.
            } else {
                 document.getElementById('view-match-btn').textContent = `View Their Ratings`;
            }
            document.getElementById('view-match-btn').style.display = 'block';
        } else {
             document.getElementById('match-announcement').textContent = `No unique match found :(`;
             document.getElementById('match-score').textContent = `Try convincing more people to join!`;
             document.getElementById('view-match-btn').style.display = 'none';
        }
        matchPanel.style.display = 'block';
        
    } else if (!isAdmin) {
        document.getElementById('waiting-message').style.display = 'block';
        document.getElementById('active-match-panel').style.display = 'none';
    }
}

function pollForMatchReveal() {
    if(window._pollingInt) clearInterval(window._pollingInt);
    
    window._pollingInt = setInterval(() => {
        checkMatchRevealStatus();
    }, 2000);
}

// --- Participants Directory ---
function showParticipantsScreen() {
    showScreen('participants');
    const allUsers = JSON.parse(localStorage.getItem('matchmaker_users') || '[]');
    const container = document.getElementById('participants-list');
    const displayCount = document.getElementById('participants-count');
    container.innerHTML = '';
    
    displayCount.textContent = `Total Joined: ${allUsers.length}`;
    
    if (allUsers.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding:1rem;">No participants yet.</p>';
        return;
    }
    
    allUsers.forEach(user => {
        const ratedCount = Object.values(user.ratings).filter(r => r !== null).length;
        
        const deleteHtml = isAdmin ? `<button class="delete-user-btn" onclick="window.deleteParticipant('${user.name}'); event.stopPropagation();" title="Remove User"><i class="fa-solid fa-times"></i></button>` : '';

        container.innerHTML += `
            <div class="list-item" style="justify-content:space-between; padding:1rem;">
                <div style="flex:1; display:flex; justify-content:space-between; cursor:pointer;" class="clickable-name" onclick="window.viewUser('${user.name}')">
                    <span style="font-size:1.1rem; font-weight:600;">${user.name}</span>
                    <span style="font-size:0.9rem; color:var(--text-secondary);">${ratedCount}/20 rated</span>
                </div>
                ${deleteHtml}
            </div>
        `;
    });

    const isRevealed = localStorage.getItem('matchmaker_revealed') === 'true';
    if (isRevealed) {
        const matches = JSON.parse(localStorage.getItem('matchmaker_final_matches') || '[]');
        document.getElementById('participants-matches-container').style.display = 'block';
        renderMatchesGrid('participants-matches-grid', matches);
    } else {
        document.getElementById('participants-matches-container').style.display = 'none';
    }
}


// --- Math: Rating Similarity ---
function calculateCompatibility(ratingsA, ratingsB) {
    let sharedMovies = 0;
    let sumDiffs = 0;
    let maxPossibleDiffs = 0;
    
    for (const movie of MOVIES) {
        const rA = ratingsA[movie.id];
        const rB = ratingsB[movie.id];
        
        if (rA !== null && rA !== undefined && rB !== null && rB !== undefined) {
            sharedMovies++;
            const diff = Math.abs(rA - rB);
            sumDiffs += diff;
            maxPossibleDiffs += 4;
        }
    }
    
    if (sharedMovies === 0) {
        return { score: 0, shared: 0 };
    }
    
    let similarity = 1 - (sumDiffs / maxPossibleDiffs);
    
    const threshold = 10;
    if (sharedMovies < threshold) {
        similarity = similarity * (sharedMovies / threshold);
    }
    
    return {
        score: Math.round(similarity * 100),
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
    
    // First Pass: 1-to-1 pairs
    for (const pair of pairsScores) {
        if (!matchedUsers.has(pair.uA.name) && !matchedUsers.has(pair.uB.name)) {
            finalMatches.push({...pair}); // Clone to allow uC mutation safely
            matchedUsers.add(pair.uA.name);
            matchedUsers.add(pair.uB.name);
        }
    }

    // Second Pass: Odd person out (if exists) -> create trio
    if (matchedUsers.size < allUsers.length) {
        const leftoverUser = allUsers.find(u => !matchedUsers.has(u.name));
        if (leftoverUser && finalMatches.length > 0) {
            let bestPairIndex = 0;
            let bestAvgScore = -1;
            
            for (let i = 0; i < finalMatches.length; i++) {
                const pair = finalMatches[i];
                const compA = calculateCompatibility(leftoverUser.ratings, pair.uA.ratings);
                const compB = calculateCompatibility(leftoverUser.ratings, pair.uB.ratings);
                
                // Weights compatibility equally between the existing two
                const avgScore = (compA.score + compB.score) / 2;
                
                if (avgScore > bestAvgScore) {
                    bestAvgScore = avgScore;
                    bestPairIndex = i;
                }
            }
            
            finalMatches[bestPairIndex].uC = leftoverUser;
            // Slightly recalculate the composite score for the UI
            finalMatches[bestPairIndex].score = Math.round((finalMatches[bestPairIndex].score + bestAvgScore) / 2);
        }
    }
    
    return finalMatches;
}

function generateMatches() {
    const allUsers = JSON.parse(localStorage.getItem('matchmaker_users') || '[]');
    if (allUsers.length < 2) {
        alert("Not enough people have joined to create matches.");
        return;
    }

    const finalMatches = computeMatches(allUsers);

    localStorage.setItem('matchmaker_final_matches', JSON.stringify(finalMatches));
    localStorage.setItem('matchmaker_revealed', 'true');
    
    const matchBtn = document.getElementById('match-everyone-btn');
    matchBtn.textContent = "Hide Matches (Off)";
    
    alert("Matches generated and revealed to all active users!");
}

// --- Admin Live Preview ---
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

// --- Admin Live Preview ---
let lastUserCount = -1;
function updateAdminPreview() {
    if (!isAdmin) return;
    const allUsers = JSON.parse(localStorage.getItem('matchmaker_users') || '[]');
    
    if (allUsers.length === lastUserCount) return;
    lastUserCount = allUsers.length;

    const container = document.getElementById('admin-matches-container');
    container.innerHTML = '';
    
    if (allUsers.length < 2) {
        container.innerHTML = '<p style="text-align:center; color:var(--text-secondary); width: 100%;">Not enough users to preview matches.</p>';
        return;
    }

    const finalMatches = computeMatches(allUsers);
    renderMatchesGrid('admin-matches-container', finalMatches);
}

// --- User Profile Modal ---
function openUserModal(name) {
    const allUsers = JSON.parse(localStorage.getItem('matchmaker_users') || '[]');
    const user = allUsers.find(u => u.name === name);
    
    if (user) {
        modalUserName.textContent = `${user.name}'s Ratings`;
        modalTierList.innerHTML = generateSortedHtmlList(user.ratings);
        
        userModal.style.display = 'flex';
        setTimeout(() => userModal.classList.add('active'), 10);
    }
}

function createMockUsers(count) {
    const allUsers = JSON.parse(localStorage.getItem('matchmaker_users') || '[]');
    const names = ['Emma', 'Liam', 'Olivia', 'Noah', 'Ava', 'Elijah', 'Isabella', 'James', 'Sophia', 'William', 'Mia', 'Benjamin', 'Charlotte', 'Lucas', 'Amelia', 'Henry'];
    
    for (let i = 0; i < count; i++) {
        const randName = `${names[Math.floor(Math.random() * names.length)]} ${Math.floor(Math.random()*1000)}`;
        let fakeRatings = {};
        
        MOVIES.forEach(m => {
            // 80% chance they saw it
            if (Math.random() > 0.2) {
                // Bias towards 3-5 stars
                fakeRatings[m.id] = Math.floor(Math.random() * 3) + 3;
            } else {
                fakeRatings[m.id] = null;
            }
        });

        allUsers.push({
            name: randName,
            ratings: fakeRatings
        });
    }
    
    localStorage.setItem('matchmaker_users', JSON.stringify(allUsers));
}

// Boot up
document.addEventListener('DOMContentLoaded', init);
