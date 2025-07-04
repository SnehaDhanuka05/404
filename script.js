// --- Your API Keys Go Here! ---
const TMDB_API_KEY = '1265ef256afc1066afd9827d9002edc1';
const GIPHY_API_KEY = 'Y1KTxmgqNwrULjr0QbP4kJWWV7SVVxB7';

// --- Grab the HTML elements we need to work with ---
const actor1Input = document.getElementById('actor1-input');
const actor2Input = document.getElementById('actor2-input');
const findButton = document.getElementById('find-button');
const resultsContainer = document.getElementById('results-container');

// --- Helper Functions (These are all perfect!) ---

// This function asks TMDb for an actor's ID number
async function findActorId(actorName) {
    const response = await fetch(`https://api.themoviedb.org/3/search/person?api_key=${TMDB_API_KEY}&query=${actorName}`);
    const data = await response.json();
    // Add a check in case the actor isn't found!
    if (data.results.length === 0) {
        return null;
    }
    return data.results[0].id; // We take the first result's ID
}

// This function asks TMDb for all movies an actor has been in
async function findMoviesByActor(actorId) {
    const response = await fetch(`https://api.themoviedb.org/3/person/${actorId}/movie_credits?api_key=${TMDB_API_KEY}`);
    const data = await response.json();
    return data.cast; // 'cast' is the list of movies
}

// This function compares two lists of movies and finds one they share
function findCommonMovie(actor1Movies, actor2Movies) {
    for (const movie1 of actor1Movies) {
        for (const movie2 of actor2Movies) {
            if (movie1.id === movie2.id) {
                return movie1; // Found a match!
            }
        }
    }
    return null; // No match found
}

// This function asks GIPHY for a GIF based on a search term
async function getGif(searchTerm) {
    const response = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${searchTerm}&limit=1`);
    const data = await response.json();
    // Add a check in case no GIF is found
    if (data.data.length === 0) {
        // Return a placeholder or a "not found" image URL
        return 'https://via.placeholder.com/150/000000/FFFFFF/?text=Not+Found'; 
    }
    return data.data[0].images.original.url; // The URL of the first GIF
}


// --- THE FIX IS HERE: A SINGLE, CLEAN EVENT LISTENER ---

findButton.addEventListener('click', async () => {
    // 1. Get the names the user typed in
    const actor1Name = actor1Input.value;
    const actor2Name = actor2Input.value;

    if (!actor1Name || !actor2Name) {
        alert("Please enter both actor names!");
        return;
    }

    resultsContainer.innerHTML = "<span>Searching...</span>"; // Show a loading message

    try {
        // 2. Find the ID for each actor
        const actor1Id = await findActorId(actor1Name);
        const actor2Id = await findActorId(actor2Name);

        if (!actor1Id || !actor2Id) {
            resultsContainer.innerHTML = "<span>One or both actors not found! Please check the spelling.</span>";
            return;
        }

        // 3. Find the movie list for each actor
        const actor1Movies = await findMoviesByActor(actor1Id);
        const actor2Movies = await findMoviesByActor(actor2Id);

        // 4. Find the movie they have in common
        const commonMovie = findCommonMovie(actor1Movies, actor2Movies);

        if (commonMovie) {
            // 5. If we found a movie, get GIFs for everything!
            const actor1Gif = await getGif(actor1Name);
            const movieGif = await getGif(commonMovie.title + " movie");
            const actor2Gif = await getGif(actor2Name);

            // 6. Display the results!
            resultsContainer.innerHTML = `
                <img src="${actor1Gif}" alt="${actor1Name}">
                <span>➡️</span>
                <img src="${movieGif}" alt="${commonMovie.title}">
                <span>➡️</span>
                <img src="${actor2Gif}" alt="${actor2Name}">
            `;
        } else {
            resultsContainer.innerHTML = "<span>Could not find a direct connection!</span>";
        }
    } catch (error) {
        console.error("An error occurred:", error);
        resultsContainer.innerHTML = "<span>Oops! Something went wrong. Check the console for details.</span>";
    }
});
