const mongoose = require('mongoose');

// Define schema for lamaran data
const lamaranSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },

});

// Model for MongoDB
const Lamaran = mongoose.model('Lamaran', lamaranSchema);

module.exports = Lamaran;
