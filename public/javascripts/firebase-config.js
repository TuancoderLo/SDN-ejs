// Firebase configuration using CDN (no imports needed)
// Firebase SDK is loaded via CDN in HTML files

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAnCGHbIVHoV3DJshQI1HfmV4NLplzEYA8",
  authDomain: "skincare-6bced.firebaseapp.com",
  projectId: "skincare-6bced",
  storageBucket: "skincare-6bced.firebasestorage.app",
  messagingSenderId: "914998642899",
  appId: "1:914998642899:web:59e0d385fbaee94989ac26",
  measurementId: "G-HZ70FRDEGM"
};

// Wait for Firebase to be available and initialize
function initializeFirebase() {
  if (typeof firebase !== 'undefined' && firebase.apps.length === 0) {
    try {
      // Initialize Firebase
      const app = firebase.initializeApp(firebaseConfig);
      const analytics = firebase.analytics();
      const auth = firebase.auth();
      const googleProvider = new firebase.auth.GoogleAuthProvider();

      // Configure Google provider
      googleProvider.setCustomParameters({
        prompt: 'select_account'
      });

      // Make Firebase services available globally
      window.firebaseApp = app;
      window.firebaseAuth = auth;
      window.firebaseGoogleProvider = googleProvider;
      window.firebaseAnalytics = analytics;

      console.log('Firebase initialized successfully');
      return true;
    } catch (error) {
      console.error('Firebase initialization error:', error);
      return false;
    }
  } else if (firebase.apps.length > 0) {
    // Firebase already initialized
    window.firebaseApp = firebase.app();
    window.firebaseAuth = firebase.auth();
    window.firebaseGoogleProvider = new firebase.auth.GoogleAuthProvider();
    window.firebaseAnalytics = firebase.analytics();
    console.log('Firebase already initialized');
    return true;
  }
  return false;
}

// Try to initialize Firebase immediately
if (!initializeFirebase()) {
  // If Firebase is not ready, wait for it
  const checkFirebase = setInterval(() => {
    if (initializeFirebase()) {
      clearInterval(checkFirebase);
    }
  }, 100);
  
  // Stop checking after 10 seconds
  setTimeout(() => {
    clearInterval(checkFirebase);
    console.error('Firebase failed to initialize after 10 seconds');
  }, 10000);
}
