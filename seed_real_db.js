const mongoose = require('mongoose');
const axios = require('axios');
require('dotenv').config();

const ProductSchema = new mongoose.Schema({
    title: String,
    category: String,
    imageUrl: String,
    priceHistory: [{
        price: Number,
        date: Date
    }]
});
const Product = mongoose.model('Product', ProductSchema);

async function seedRealData() {
    await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/pricewise");
    console.log("Connected to MongoDB");

    // Remove simulated products
    const simTitles = ["Men's Casual T-Shirt", "Running Shoes Sneakers", "Cotton Bedsheet Double", "Wooden Coffee Table"];
    await Product.deleteMany({ title: { $in: simTitles } });
    console.log("Removed simulated products.");

    const queries = ['t-shirt', 'sneakers', 'sofa', 'bedsheet'];
    console.log("Starting to seed database via live search...");

    for (let query of queries) {
        console.log(`Searching for real products for: ${query}...`);
        try {
            const response = await axios.get(`http://localhost:5000/products/search-live?query=${encodeURIComponent(query)}`);
            console.log(`Success! Found ${response.data.data.length} items for ${query}.`);
        } catch (error) {
            console.error(`Failed to fetch for ${query}:`, error.message);
        }
    }
    
    console.log("Seeding complete!");
    process.exit(0);
}

seedRealData();
