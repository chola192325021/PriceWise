const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
    title: { type: String, required: true },
    brand: { type: String },
    category: { type: String },
    imageUrl: { type: String },
    platforms: [{
        name: { type: String, required: true }, // e.g., "Amazon", "Flipkart"
        price: { type: Number, required: true },
        url: { type: String },
        isSmartDeal: { type: Boolean, default: false }
    }],
    priceHistory: [{
        date: { type: Date, default: Date.now },
        price: { type: Number }
    }],
    aiPrediction: {
        trend: { type: String, enum: ['drop', 'stable', 'rise'] },
        expectedPrice: { type: Number },
        recommendation: { type: String }, // e.g., "Wait 4 days", "Buy Now"
        confidence: { type: Number }
    }
});

module.exports = mongoose.model('Product', ProductSchema);