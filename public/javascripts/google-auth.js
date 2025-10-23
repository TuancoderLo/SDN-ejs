// Google Authentication functions using Firebase CDN
async function signInWithGoogle() {
    try {
        // Wait for Firebase to be initialized
        let attempts = 0;
        while ((!window.firebaseAuth || !window.firebaseGoogleProvider) && attempts < 10) {
            await new Promise(resolve => setTimeout(resolve, 500));
            attempts++;
        }
        
        if (!window.firebaseAuth || !window.firebaseGoogleProvider) {
            throw new Error('Firebase not initialized. Please refresh the page.');
        }
        
        const result = await firebase.auth().signInWithPopup(window.firebaseGoogleProvider);
        const user = result.user;
        
        // Get the ID token for backend verification
        const idToken = await user.getIdToken();
        
        // Send the token to your backend for verification and user creation/login
        const response = await fetch(`${window.location.origin}/api/auth/google`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                idToken: idToken,
                email: user.email,
                name: user.displayName,
                photoURL: user.photoURL
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Store the token and user data
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            
            // Update UI
            if (typeof updateUIForLoggedInUser === 'function') {
                updateUIForLoggedInUser();
            }
            
            // Show success message
            if (typeof showNotification === 'function') {
                showNotification('Google login successful!', 'success');
            }
            
            // Redirect to home page
            window.location.href = '/';
        } else {
            throw new Error(data.message || 'Google authentication failed');
        }
    } catch (error) {
        console.error('Google sign-in error:', error);
        if (typeof showNotification === 'function') {
            showNotification('Google login failed: ' + error.message, 'error');
        }
    }
}

async function signOutGoogle() {
    try {
        // Wait for Firebase to be initialized
        let attempts = 0;
        while (!window.firebaseAuth && attempts < 10) {
            await new Promise(resolve => setTimeout(resolve, 500));
            attempts++;
        }
        
        if (!window.firebaseAuth) {
            throw new Error('Firebase not initialized. Please refresh the page.');
        }
        
        await firebase.auth().signOut();
        // Clear local storage
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        // Update UI
        if (typeof updateUIForLoggedOutUser === 'function') {
            updateUIForLoggedOutUser();
        }
        
        // Show success message
        if (typeof showNotification === 'function') {
            showNotification('Logged out successfully', 'success');
        }
        
        // Redirect to home page
        window.location.href = '/';
    } catch (error) {
        console.error('Google sign-out error:', error);
        if (typeof showNotification === 'function') {
            showNotification('Logout failed: ' + error.message, 'error');
        }
    }
}

// Listen for auth state changes
if (typeof firebase !== 'undefined') {
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            console.log('User signed in:', user.email);
        } else {
            console.log('User signed out');
        }
    });
}

// Make functions available globally
window.signInWithGoogle = signInWithGoogle;
window.signOutGoogle = signOutGoogle;
