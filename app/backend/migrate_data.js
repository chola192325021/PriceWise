require('dotenv').config();
const { MongoClient } = require('mongodb');
const supabase = require('./supabase');

const uri = "mongodb+srv://Chola:chola12345@cluster0.f90qp0o.mongodb.net/pricewise?retryWrites=true&w=majority&appName=Cluster0";

async function run() {
    const client = new MongoClient(uri);

    try {
        await client.connect();
        const db = client.db('pricewise');
        const productsCollection = db.collection('products');
        const products = await productsCollection.find({}).toArray();

        console.log(`Found ${products.length} products in MongoDB.`);

        for (const product of products) {
            // Map MongoDB fields to Supabase snake_case schema
            const supaProduct = {
                title: product.title,
                brand: product.brand || null,
                category: product.category || null,
                image_url: product.imageUrl || null,
                platforms: product.platforms || [],
                price_history: product.priceHistory || [],
                ai_prediction: product.aiPrediction || {}
            };

            const { data, error } = await supabase.from('products').insert([supaProduct]);
            if (error) {
                console.error(`Error migrating product ${product.title}:`, error.message);
            } else {
                console.log(`Migrated product ${product.title} successfully.`);
            }
        }

        console.log("Product Migration complete!");

    } catch (e) {
        console.error("Migration script failed:", e);
    } finally {
        await client.close();
    }
}

run();
