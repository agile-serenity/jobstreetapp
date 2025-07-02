require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');

// Initialize Express app
const app = express();

// Enhanced CORS configuration
app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    optionsSuccessStatus: 200
}));

// Body parser middleware
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Improved MongoDB connection with robust error handling
const connectWithRetry = () => {
  mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/fallbackdb', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 30000,
    maxPoolSize: 10,
    retryWrites: true,
    w: 'majority'
  })
  .then(() => console.log('✅ MongoDB connected successfully'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    console.log('🔄 Retrying connection in 5 seconds...');
    setTimeout(connectWithRetry, 5000);
  });
};

connectWithRetry();

// MongoDB connection events
mongoose.connection.on('connected', () => {
  console.log('📊 MongoDB connected to:', mongoose.connection.host);
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️ MongoDB disconnected');
});

// Import Lamaran Model with better error handling
let Lamaran;
try {
    Lamaran = require('./models/lamaran'); // Changed from '../models' to './models'
} catch (err) {
    console.error("❌ Failed to load Lamaran model:", err);
    process.exit(1);
}

// Health check endpoint with detailed DB status
app.get('/api/health', (req, res) => {
    const dbStatus = mongoose.connection.readyState;
    const statusMap = {
        0: 'disconnected',
        1: 'connected',
        2: 'connecting',
        3: 'disconnecting'
    };
    
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date(),
        database: statusMap[dbStatus] || 'unknown',
        dbHost: mongoose.connection.host || 'unknown',
        dbName: mongoose.connection.name || 'unknown'
    });
});

// Submit lamaran endpoint with proper timeout handling
app.post('/api/submit-lamaran', async (req, res) => {
    console.log('📥 Received submission:', {
        headers: req.headers,
        body: req.body
    });

    try {
        // Validate request body
        if (!req.body || Object.keys(req.body).length === 0) {
            return res.status(400).json({
                success: false,
                message: "Request body cannot be empty"
            });
        }

        const lamaranData = new Lamaran(req.body);
        
        // Create a timeout promise
        const saveWithTimeout = new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Save operation timed out after 15 seconds'));
            }, 15000);

            lamaranData.save()
                .then(result => {
                    clearTimeout(timeout);
                    resolve(result);
                })
                .catch(err => {
                    clearTimeout(timeout);
                    reject(err);
                });
        });

        const savedData = await saveWithTimeout;
        
        console.log('💾 Saved successfully:', savedData._id);
        
        res.status(201).json({ 
            success: true, 
            message: "Lamaran berhasil disimpan!",
            data: savedData 
        });
    } catch (error) {
        console.error('❌ Error saving lamaran:', error);
        
        let statusCode = 500;
        let errorMessage = error.message;
        
        if (error.name === 'ValidationError') {
            statusCode = 400;
            errorMessage = Object.values(error.errors).map(e => e.message).join(', ');
        } else if (error.message.includes('timed out')) {
            errorMessage = 'Database operation timed out. Please try again.';
        }
        
        res.status(statusCode).json({ 
            success: false, 
            message: errorMessage,
            errorType: error.name,
            ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
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
    const server = app.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
        console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
        console.log(`📝 Submit endpoint: http://localhost:${PORT}/api/submit-lamaran`);
    });

    // Handle server timeouts
    server.setTimeout(30000); // 30 seconds timeout
}