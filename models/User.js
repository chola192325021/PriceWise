const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    profilePhoto: {
        type: String,
        default: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=1000&auto=format&fit=crop"
    },
    memberSince: {
        type: String,
        default: () => {
            const date = new Date();
            const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            return `Member since ${months[date.getMonth()]} ${date.getFullYear()}`;
        }
    },
    watchlist: {
        type: [String],
        default: []
    },
    alerts: [{
        productId: String,
        targetPrice: Number
    }],
    createdAt: {
        type: Date,
        default: Date.now
    },
    resetPasswordCode: {
        type: String
    },
    resetPasswordExpires: {
        type: Date
    }
});

module.exports = mongoose.model('User', UserSchema);