import express from 'express';
import session from 'express-session';
import passport from 'passport';
import dotenv from 'dotenv';
import './auth/gAuth.js';
import connection from './db/config.js'
import shortUrl from './routes/shortUrlRoutes.js'

const PORT=process.env.PORT || 5353;

dotenv.config();

const app = express();

app.use(express.json());


// Session Configuration
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
}));
app.set('view engine', 'ejs');
app.use(passport.initialize());
app.use(passport.session());

app.use('/api',shortUrl)

// Home Route
app.get('/', (req, res) => {
  res.render('login');
});

// Google Auth Initiation Route
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

//Google OAuth Callback Route
app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    // Successful authentication, redirect to dashboard
    res.redirect('/dashboard');
  }
);

// Protected Dashboard Route
app.get('/dashboard', (req, res) => {
  if (req.isAuthenticated()) {
    res.render('Dashboard', { user: req.user }); 
  } else {
    res.redirect('/');
  }
});

// Logout Route
app.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    req.session.destroy(); // Clear the session
    res.redirect('/');
  });
});


connection()
  .then(() => {
    console.log("connected");
    app.listen(PORT,'0.0.0.0', () => {
      console.log(`Server is running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.log(err);
  });

