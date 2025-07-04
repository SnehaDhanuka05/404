// --- Your API Keys Go Here! ---
const TMDB_API_KEY = '1265ef256afc1066afd9827d9002edc1';
const GIPHY_API_KEY = 'Y1KTxmgqNwrULjr0QbP4kJWWV7SVVxB7';
const GIPHY_HOURLY_LIMIT = 100; // From your GIPHY dashboard

// --- Grab the HTML elements ---
const actor1Input = document.getElementById('actor1-input');
const actor2Input = document.getElementById('actor2-input');
const findButton = document.getElementById('find-button');
const resultsContainer = document.getElementById('results-container');
const messageArea = document.getElementById('message-area');
const appContainer = document.getElementById('app-container');
const waitingRoomContainer = document.getElementById('waiting-room-container');
const countdownSpan = document.getElementById('countdown');

// --- Feature 2: The API Request Counter ---
const apiLimiter = {
    // Check and initialize the counter from browser's local storage
    initialize: function() {
        let count = localStorage.getItem('giphyRequestCount');
        let resetTime = localStorage.getItem('giphyResetTime');
        const now = new Date().getTime();

        if (!resetTime || now > parseInt(resetTime)) {
            // If it's time to reset, set a new reset time (1 hour from now)
            localStorage.setItem('giphyRequestCount', '0');
            localStorage.setItem('giphyResetTime', (now + 3600 * 1000).toString());
        }
    },
    // Check if we can make a request
    canRequest: function() {
        this.initialize();
        const count = parseInt(localStorage.getItem('giphyRequestCount'));
        return count < GIPHY_HOURLY_LIMIT;
    },
    // Increment the counter after a successful request
    increment: function() {
        let count = parseInt(localStorage.getItem('giphyRequestCount'));
        localStorage.setItem('giphyRequestCount', (count + 1).toString());
    },
    // Get how many requests are left
    getRemaining: function() {
        this.initialize();
        return GIPHY_HOURLY_LIMIT - parseInt(localStorage.getItem('giphyRequestCount'));
    }
};

// --- Helper Functions ---

async function findActorId(actorName) {
    const response = await fetch(`https://api.themoviedb.org/3/search/person?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(actorName)}`);
    const data = await response.json();
    if (data.results.length === 0) return null;
    return data.results[0]; // Return the whole actor object
}

async function getMoviesForActor(actorId) {
    const response = await fetch(`https://api.themoviedb.org/3/person/${actorId}/movie_credits?api_key=${TMDB_API_KEY}`);
    const data = await response.json();
    return data.cast;
}

async function getActorsForMovie(movieId) {
    const response = await fetch(`https://api.themoviedb.org/3/movie/${movieId}/credits?api_key=${TMDB_API_KEY}`);
    const data = await response.json();
    return data.cast;
}

async function getGif(searchTerm) {
    if (!apiLimiter.canRequest()) {
        throw new Error("GIPHY API rate limit reached.");
    }
    const response = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(searchTerm)}&limit=1`);
    apiLimiter.increment(); // Count this request
    const data = await response.json();
    if (data.data.length === 0) return 'https://via.placeholder.com/150/000000/FFFFFF/?text=Not+Found';
    return data.data[0].images.fixed_width.url;
}

// --- Feature 1: The "Six Degrees" Pathfinding Logic (BFS Algorithm) ---
async function findConnectionPath(startActor, endActor) {
    const queue = [[startActor]]; // A queue of paths to explore
    const visited = new Set([startActor.id]); // Keep track of visited actors to avoid loops

    while (queue.length > 0) {
        const currentPath = queue.shift();
        const currentActor = currentPath[currentPath.length - 1];

        messageArea.textContent = `Searching... Currently exploring connections for ${currentActor.name}.`;

        const movies = await getMoviesForActor(currentActor.id);

        for (const movie of movies) {
            const cast = await getActorsForMovie(movie.id);
            for (const castMember of cast) {
                if (castMember.id === endActor.id) {
                    // Found it! Return the completed path.
                    return [...currentPath, movie, endActor];
                }
                if (!visited.has(castMember.id)) {
                    visited.add(castMember.id);
                    const newPath = [...currentPath, movie, castMember];
                    queue.push(newPath);
                }
            }
        }
    }
    return null; // No path found
}

// --- New Display Logic ---
async function displayResults(path) {
    resultsContainer.innerHTML = ''; // Clear previous results
    for (let i = 0; i < path.length; i++) {
        const item = path[i];
        let element = document.createElement('div');
        element.className = 'path-item';

        if (item.gender !== undefined) { // It's an actor
            const gifUrl = await getGif(item.name);
            element.innerHTML = `
                <img src="${gifUrl}" alt="${item.name}">
                <p>${item.name}</p>
            `;
        } else { // It's a movie
            const gifUrl = await getGif(`${item.title} movie`);
            element.innerHTML = `
                <img src="${gifUrl}" alt="${item.title}">
                <p><em>${item.title}</em></p>
            `;
        }
        resultsContainer.appendChild(element);

        // Add an arrow between items
        if (i < path.length - 1) {
            let arrow = document.createElement('span');
            arrow.className = 'path-arrow';
            arrow.textContent = '➡️';
            resultsContainer.appendChild(arrow);
        }
    }
}

// --- Main Event Listener ---
findButton.addEventListener('click', async () => {
    const actor1Name = actor1Input.value;
    const actor2Name = actor2Input.value;

    if (!actor1Name || !actor2Name) {
        alert("Please enter both actor names!");
        return;
    }

    resultsContainer.innerHTML = '';
    messageArea.textContent = 'Initializing search...';

    try {
        const startActor = await findActorId(actor1Name);
        const endActor = await findActorId(actor2Name);

        if (!startActor || !endActor) {
            messageArea.textContent = "One or both actors not found. Please check spelling.";
            return;
        }

        // --- Core pathfinding call ---
        const path = await findConnectionPath(startActor, endActor);

        if (path) {
            messageArea.textContent = `Found a connection in ${Math.floor(path.length / 2)} steps! Fetching GIFs... (Remaining: ${apiLimiter.getRemaining()})`;
            await displayResults(path);
            messageArea.textContent = `Connection found! (API Requests Remaining: ${apiLimiter.getRemaining()})`;
        } else {
            messageArea.textContent = "Could not find a connection path between these actors.";
        }

    } catch (error) {
        if (error.message.includes("rate limit")) {
            // --- Feature 3: The Waiting Room ---
            showWaitingRoom();
        } else {
            console.error("An error occurred:", error);
            messageArea.textContent = "Oops! Something went wrong. Check the console.";
        }
    }
});

// --- Feature 3: Waiting Room and Minigame Logic ---
function showWaitingRoom() {
    appContainer.classList.add('hidden');
    waitingRoomContainer.classList.remove('hidden');

    const resetTime = parseInt(localStorage.getItem('giphyResetTime'));
    
    const timerInterval = setInterval(() => {
        const now = new Date().getTime();
        const distance = resetTime - now;

        if (distance < 0) {
            clearInterval(timerInterval);
            countdownSpan.textContent = "Ready!";
            // Optional: Auto-reload the page
            window.location.reload();
            return;
        }

        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        
        countdownSpan.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    }, 1000);

    startMiniGame();
}

function startMiniGame() {
    kaboom({
        global: true,
        canvas: document.getElementById("minigame-canvas"),
        scale: 1,
        background: [0, 0, 0],
    });

    add([
        text("Vibe Jumper", { size: 24 }),
        pos(center().x, 20),
        origin("center"),
    ]);

    const player = add([
        rect(30, 30),
        pos(80, height() - 80),
        origin("center"),
        color(255, 255, 255),
        area(),
        body(), // Gives it gravity
    ]);

    // Floor
    add([
        rect(width(), 20),
        pos(0, height() - 10),
        origin("botleft"),
        area(),
        solid(),
    ]);

    onKeyPress("space", () => {
        if (player.isGrounded()) {
            player.jump();
        }
    });

    loop(1.5, () => {
        add([
            rect(20, 50),
            pos(width(), height() - 20),
            origin("botright"),
            color(220, 50, 50),
            area(),
            move(LEFT, 240),
            "obstacle",
        ]);
    });

    player.onCollide("obstacle", () => {
        shake(12);
        go("game"); // Restart the minigame scene on collision
    });
}
