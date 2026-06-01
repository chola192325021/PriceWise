const axios = require('axios');

async function seedData() {
    const queries = ['t-shirt', 'sneakers', 'sofa', 'bedsheet'];
    console.log("Starting to seed database via live search...");

    for (let query of queries) {
        console.log(`Searching for: ${query}...`);
        try {
            const response = await axios.get(`http://localhost:5000/products/search-live?q=${query}`);
            console.log(`Success! Found ${response.data.data.length} items for ${query}.`);
        } catch (error) {
            console.error(`Failed to fetch for ${query}:`, error.message);
        }
    }
    console.log("Seeding complete!");
}

seedData();
