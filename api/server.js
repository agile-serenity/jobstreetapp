require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');

// Initialize Express app
const app = express();

// Enhanced CORS configuration
app.use(cors({
    origin: process.env.FRONTEND_URL || '*', // Better security than '*'
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    optionsSuccessStatus: 200
}));

// Body parser middleware
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// MongoDB connection with improved configuration
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000
})
.then(() => console.log("✅ Connected to MongoDB"))
.catch(err => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
});

// Import Lamaran Model using dynamic import for better error handling
let Lamaran;
try {
    Lamaran = require('./models/lamaran');
} catch (err) {
    console.error("❌ Failed to load Lamaran model:", err);
    process.exit(1);
}

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date(),
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

// Submit lamaran endpoint with enhanced validation
app.post('/api/submit-lamaran', async (req, res) => {
    console.log('📥 Received submission:', {
        headers: req.headers,
        body: req.body
    });

    try {
        // Basic validation
        if (!req.body || Object.keys(req.body).length === 0) {
            return res.status(400).json({
                success: false,
                message: "Request body cannot be empty"
            });
        }

        const lamaranData = new Lamaran(req.body);
        const savedData = await lamaranData.save();
        
        console.log('💾 Saved successfully:', savedData._id);
        
        res.status(201).json({ 
            success: true, 
            message: "Lamaran berhasil disimpan!",
            data: savedData 
        });
    } catch (error) {
        console.error('❌ Error saving lamaran:', error);
        
        // Handle different error types
        let statusCode = 500;
        let errorMessage = error.message;
        
        if (error.name === 'ValidationError') {
            statusCode = 400;
            errorMessage = Object.values(error.errors).map(e => e.message).join(', ');
        }
        
        res.status(statusCode).json({ 
            success: false, 
            message: errorMessage,
            errorType: error.name
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('🔥 Server Error:', err.stack);
    res.status(500).json({ 
        success: false, 
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// For Vercel deployment
module.exports = app;

// For local development
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
        console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
        console.log(`📝 Submit endpoint: http://localhost:${PORT}/api/submit-lamaran`);
    });
}