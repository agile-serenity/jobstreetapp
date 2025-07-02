require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;


app.use(cors({
    origin: '*', // Frontend yang boleh mengakses
    methods: ['GET', 'POST', 'PUT', 'DELETE'], // Metode yang diizinkan
    allowedHeaders: ['Content-Type', 'Authorization'], // Header yang diizinkan
    preflightContinue: false,
    optionsSuccessStatus: 200,  // Status sukses untuk preflight requests
}));


// Body parser middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log("Connected to MongoDB"))
.catch(err => console.log("MongoDB connection error:", err));

// Import Lamaran Model
const Lamaran = require('./models/lamaran');

// Test route
app.get('/', (req, res) => {
    res.json({ message: "Server is running!", timestamp: new Date() });
});

// Test CORS route
app.get('/test-cors', (req, res) => {
    res.json({ 
        message: "CORS is working!", 
        origin: req.headers.origin,
        method: req.method 
    });
});

// Route to receive lamaran data
app.post('/submit-lamaran', async (req, res) => {
    console.log('=== REQUEST RECEIVED ===');
    console.log('Method:', req.method);
    console.log('Origin:', req.headers.origin);
    console.log('Content-Type:', req.headers['content-type']);
    console.log('Body:', req.body);
    console.log('========================');
    
    try {
        const lamaranData = new Lamaran(req.body);
        await lamaranData.save();
        
        res.status(200).json({ 
            success: true, 
            message: "Lamaran berhasil disimpan!",
            data: lamaranData 
        });
    } catch (error) {
        console.error('Error saving lamaran:', error);
        res.status(500).json({ 
            success: false, 
            message: "Error menyimpan lamaran: " + error.message 
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    res.status(500).json({ 
        success: false, 
        message: 'Internal server error' 
    });
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Server also accessible on http://127.0.0.1:5001`);
    console.log('CORS configured to allow all origins for testing');
});