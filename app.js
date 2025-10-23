var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var cors = require('cors');
// load env
require('dotenv').config();
const mongoose = require('mongoose');

// connect to MongoDB
const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/assignment-mernstack';
mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected:', mongoUri))
  .catch(err => console.error('MongoDB connection error:', err));

mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected');
});

// Removed unused routes: index.js and users.js
var authRouter = require('./routes/auth.routes');
var perfumesRouter = require('./routes/perfumes.routes');
var membersRouter = require('./routes/members.routes');
var brandsRouter = require('./routes/brands.routes');
var publicRouter = require('./routes/public.routes');
// Removed unused config routes

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(cors());
app.use(logger('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));
app.use(cookieParser());

// Add headers to help with COOP warnings
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
  next();
});

// Main page route
app.get('/', (req, res) => {
  res.render('index', { 
    title: 'perume sdn',
    user: null // Will be populated by client-side JavaScript
  });
});

// Auth pages routes
app.get('/login', (req, res) => {
  res.render('login', { 
    title: 'Login - perume sdn',
    error: null,
    success: null
  });
});

app.get('/register', (req, res) => {
  res.render('register', { 
    title: 'Register - perume sdn',
    error: null,
    success: null
  });
});

app.get('/admin', (req, res) => {
  res.render('admin', { 
    title: 'Admin Panel - perume sdn'
  });
});

// Add redirects for clean URLs (remove .html extension)
app.get('/register.html', (req, res) => {
  res.redirect('/register');
});

app.get('/login.html', (req, res) => {
  res.redirect('/login');
});

// Static files middleware (after specific routes)
app.use(express.static(path.join(__dirname, 'public')));

// Perfume detail page (after static files to avoid conflicts)
app.get('/perfume/:id', (req, res) => {
  res.render('perfume-detail', { 
    title: 'Perfume Detail - Perfume SDN',
    perfumeId: req.params.id
  });
});

// Removed unused route handlers
// mount API routes
app.use('/api/auth', authRouter);
app.use('/api/perfumes', perfumesRouter);
app.use('/api/members', membersRouter);
app.use('/api/brands', brandsRouter);
// Removed unused config routes
app.use('/api', publicRouter); // Public routes for viewing

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error', { 
    title: 'Error - Perfume SDN',
    message: err.message,
    error: err
  });
});

module.exports = app;

