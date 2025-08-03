import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

// Create __dirname equivalent for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create Express app
const app = express();
const port = process.env.FRONTEND_PORT || 3000;

// Content Security Policy Middleware
app.use((req, res, next) => {
res.setHeader(
  'Content-Security-Policy',
  "default-src 'self'; " +
  "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; " +
  "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; " +
  "font-src 'self' data: https://cdn.jsdelivr.net;" + // Added CDN
  "img-src 'self' data:; " +
  "connect-src 'self' http://localhost:3001 http://backend:3001;"
);
  next();
});

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// API Proxy (if needed)
// app.use('/api', createProxyMiddleware({ 
//   target: process.env.REACT_APP_API_URL,
//   changeOrigin: true 
// }));

// Handle all routes by serving index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(port, () => {
  console.log(`Frontend server running:`);
  console.log(`- Port: ${port}`);
  console.log(`- Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`- Backend URL: ${process.env.REACT_APP_API_URL || 'Not configured'}`);
});