const mongoose = require('mongoose');
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

const products = [
    { title: "Men's Casual T-Shirt", category: "Fashion", price: 399, img: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab" },
    { title: "Running Shoes Sneakers", category: "Fashion", price: 1299, img: "https://images.unsplash.com/photo-1542291026-7eec264c27ff" },
    { title: "Cotton Bedsheet Double", category: "General", price: 799, img: "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af" },
    { title: "Wooden Coffee Table", category: "General", price: 3499, img: "https://images.unsplash.com/photo-1532372320572-cda25653a26d" }
];

async function seed() {
    await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/pricewise");
    console.log("Connected to MongoDB");

    for (let p of products) {
        const history = [];
        for (let d = 7; d >= 0; d--) {
            const date = new Date();
            date.setDate(date.getDate() - d);
            history.push({ price: p.price * (1 + (Math.random() * 0.1 - 0.05)), date });
        }
        await Product.create({
            title: p.title,
            category: p.category,
            imageUrl: p.img,
            priceHistory: history
        });
    }
    console.log("Seed successful!");
    process.exit(0);
}

seed();
