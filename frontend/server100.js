import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

// Get directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const express = require('express');
const path = require('path');
const morgan = require('morgan');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');

const app = express();
const port = process.env.FRONTEND_PORT || 3000;

// Security and performance middleware

// Add this middleware before your static files middleware
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; " +
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; " +
    "font-src 'self' data:; " +
    "img-src 'self' data:; " +
    "connect-src 'self' http://localhost:3001;"
  );
  next();
});

app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*'
}));
app.use(compression());
app.use(morgan('combined'));

// Static files configuration
const staticOptions = {
  maxAge: '1y',
  immutable: true,
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
};

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// API proxy configuration (if needed)
if (process.env.API_PROXY === 'true') {
  const { createProxyMiddleware } = require('http-proxy-middleware');
  app.use('/api', createProxyMiddleware({
    target: process.env.BACKEND_URL || 'http://backend:3001/api',
    changeOrigin: true,
    pathRewrite: { '^/api': '' },
    logLevel: 'debug'
  }));
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy',
    version: process.env.npm_package_version,
    environment: process.env.NODE_ENV || 'development'
  });
});

// Serve index.html for all routes (SPA behavior)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'), {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  });
});

app.get('/test.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'test.js'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Frontend server error:', err.stack);
  res.status(500).sendFile(path.join(__dirname, 'public', 'error.html'));
});

app.get('/test-backend', async (req, res) => {
  try {
    const response = await fetch('http://backend:3001/health');
    if (!response.ok) throw new Error(`Backend responded with ${response.status}`);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(502).json({
      error: "Backend connection failed",
      details: err.message
    });
  }
});

app.get('/api-test', async (req, res) => {
  try {
    const apiResponse = await fetch('http://backend:3001/health');
    const data = await apiResponse.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start server
app.listen(port, '0.0.0.0', () => {
  console.log(`
  Frontend server running:
  - Port: ${port}
  - Environment: ${process.env.NODE_ENV || 'development'}
  - Proxy enabled: ${process.env.API_PROXY === 'true'}
  - Backend URL: ${process.env.BACKEND_URL || 'Not configured'}
  `);
});

// Handle shutdown gracefully
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully');
  server.close(() => {
    console.log('Frontend server terminated');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully');
  server.close(() => {
    console.log('Frontend server terminated');
  });
});