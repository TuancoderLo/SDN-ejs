// API Base URL - dynamic (same origin) to avoid hardcoding localhost/ports
const API_URL = `${window.location.origin}/api`;

// State management
let currentUser = null;
let allPerfumes = [];
let allBrands = [];
let currentEditId = null;

// Helper functions
function safeGetFromStorage(key) {
  try {
    const item = localStorage.getItem(key);
    return item && item !== "null" && item !== "undefined" ? item : null;
  } catch (error) {
    console.error(`Error getting ${key} from localStorage:`, error);
    return null;
  }
}

// Return freshest current user from storage
function getStoredUser() {
  const userString = safeGetFromStorage("user");
  const user = safeParseJSON(userString);
  // Debug log to see stored user data
  console.log("Stored user data:", user);
  if (user) {
    console.log("YOB from stored user:", user.YOB);
  }
  return user;
}

function getStoredRedirectUrl() {
  return safeGetFromStorage("redirectAfterLogin");
}

function storeRedirectUrl(url) {
  // Only store URL if it's not a login/register page and not an error page
  if (
    url &&
    !url.includes("/login") &&
    !url.includes("/register") &&
    !url.includes("/error") &&
    !url.includes("/admin")
  ) {
    localStorage.setItem("redirectAfterLogin", url);
    console.log("✅ Stored redirect URL:", url);
    return true;
  } else {
    console.log("❌ URL not stored (invalid or excluded):", url);
    return false;
  }
}

function safeParseJSON(jsonString) {
  try {
    return jsonString ? JSON.parse(jsonString) : null;
  } catch (error) {
    console.error("Error parsing JSON:", error);
    return null;
  }
}

// Initialize app - Cache bust: v2.1
document.addEventListener("DOMContentLoaded", () => {
  try {
    checkAuth();
    const isMainPage = !!document.getElementById("perfumes");
    const isAdminPage = !!document.getElementById("admin");

    if (isMainPage) {
      loadPerfumes();
      loadBrands();

      // Check for section parameter in URL
      const urlParams = new URLSearchParams(window.location.search);
      const section = urlParams.get("section");
      if (section === "profile") {
        setTimeout(() => {
          showSection("profile");
          loadProfileData(); // Load profile data when showing profile section
        }, 100);
      }
    } else if (isAdminPage) {
      // Auto-load admin members tab with a small delay to ensure DOM is ready
      setTimeout(async () => {
        console.log("Initializing admin page...");
        await loadAllAdminData(); // Load all data first
        showAdminTab("members"); // Then show members tab
      }, 100);
    }

    setupEventListeners();
  } catch (error) {
    console.error("Error initializing app:", error);
    // Only show notification if the toast elements exist
    const toast = document.getElementById("toast");
    if (toast) {
      showNotification("Error initializing application", "error");
    }
  }
});

// Setup event listeners
function setupEventListeners() {
  // Login form
  document.getElementById("loginForm")?.addEventListener("submit", handleLogin);

  // Register form
  document
    .getElementById("registerForm")
    ?.addEventListener("submit", handleRegister);

  // Profile forms
  document
    .getElementById("profileForm")
    ?.addEventListener("submit", handleProfileUpdate);
  document
    .getElementById("passwordForm")
    ?.addEventListener("submit", handlePasswordChange);

  // Search and filter
  document
    .getElementById("searchInput")
    ?.addEventListener("input", filterPerfumes);
  document
    .getElementById("brandFilter")
    ?.addEventListener("change", filterPerfumes);

  // Admin forms
  document
    .getElementById("brandForm")
    ?.addEventListener("submit", handleBrandSubmit);
  document
    .getElementById("perfumeForm")
    ?.addEventListener("submit", handlePerfumeSubmit);
  document
    .getElementById("editBrandForm")
    ?.addEventListener("submit", updateBrandFromModal);

  // Comment form (dynamically added)
  document.addEventListener("submit", function (e) {
    if (e.target.id === "commentForm") {
      e.preventDefault();
      handleCommentSubmit(e);
    }
  });

  // Store current page URL when clicking login/register links
  document.getElementById("loginLink")?.addEventListener("click", function (e) {
    console.log("🔗 Login link clicked, storing URL:", window.location.href);
    const success = storeRedirectUrl(window.location.href);
    console.log("Storage result:", success);
    // Don't prevent default - let the link work normally
  });
  document
    .getElementById("loginLinkMobile")
    ?.addEventListener("click", function (e) {
      console.log(
        "🔗 Mobile login link clicked, storing URL:",
        window.location.href
      );
      const success = storeRedirectUrl(window.location.href);
      console.log("Storage result:", success);
    });
  document
    .getElementById("registerLink")
    ?.addEventListener("click", function (e) {
      console.log(
        "🔗 Register link clicked, storing URL:",
        window.location.href
      );
      const success = storeRedirectUrl(window.location.href);
      console.log("Storage result:", success);
    });
  document
    .getElementById("registerLinkMobile")
    ?.addEventListener("click", function (e) {
      console.log(
        "🔗 Mobile register link clicked, storing URL:",
        window.location.href
      );
      const success = storeRedirectUrl(window.location.href);
      console.log("Storage result:", success);
    });
}

// Authentication functions
function checkAuth() {
  const token = safeGetFromStorage("token");
  const userString = safeGetFromStorage("user");

  if (token && userString) {
    const user = safeParseJSON(userString);
    if (user) {
      // Check if account is blocked
      if (user.isBlocked) {
        const blockReason = user.blockReason || "No reason provided";
        const blockDate = user.blockedAt
          ? new Date(user.blockedAt).toLocaleDateString()
          : "Unknown";
        showNotification(
          `🚫 Your account has been blocked. Reason: ${blockReason}. Blocked on: ${blockDate}`,
          "error"
        );

        // Clear stored data and redirect to login
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        currentUser = null;
        updateUIForLoggedOutUser();
        window.location.href = "/login";
        return;
      }

      currentUser = user;
      updateUIForLoggedInUser();
      return;
    }
  }

  // If we only have token (or invalid user), fetch profile
  if (token && !userString) {
    fetchCurrentUser();
  }
}

async function fetchCurrentUser() {
  const token = safeGetFromStorage("token");
  if (!token) return null;
  try {
    const resp = await fetch(`${API_URL}/members/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await resp.json();
    if (resp.ok && data && data.member) {
      // Debug log to see member data structure
      console.log("Member data from API:", data.member);
      console.log("YOB field in member:", data.member.YOB);

      currentUser = data.member;
      localStorage.setItem("user", JSON.stringify(currentUser));
      updateUIForLoggedInUser();
      return currentUser;
    } else if (resp.status === 403) {
      // Handle blocked account
      if (data.message === "Account is blocked") {
        const blockReason = data.reason || "No reason provided";
        const blockDate = data.blockedAt
          ? new Date(data.blockedAt).toLocaleDateString()
          : "Unknown";
        showNotification(
          `🚫 Your account has been blocked. Reason: ${blockReason}. Blocked on: ${blockDate}`,
          "error"
        );
        // Clear stored data and redirect to login
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        currentUser = null;
        updateUIForLoggedOutUser();
        window.location.href = "/login";
      }
    }
  } catch (err) {
    console.error("Failed to fetch current user:", err);
  }
  return null;
}

async function handleLogin(e) {
  e.preventDefault();

  // Check if elements exist before accessing their values
  const emailElement = document.getElementById("loginEmail");
  const passwordElement = document.getElementById("loginPassword");

  if (!emailElement || !passwordElement) {
    console.error("Login form elements not found");
    showNotification("Login form not found", "error");
    return;
  }

  const email = emailElement.value;
  const password = passwordElement.value;

  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (response.ok) {
      localStorage.setItem("token", data.token);
      // Try to use user from response if present, otherwise fetch /members/me
      if (data.user) {
        localStorage.setItem("user", JSON.stringify(data.user));
        currentUser = data.user;
      } else {
        await fetchCurrentUser();
      }
      showNotification("Login successful!", "success");
      updateUIForLoggedInUser();

      // Get the page to redirect to after login
      const storedUrl = getStoredRedirectUrl();
      console.log("🔍 Checking redirect after login...");
      console.log("Current page:", window.location.pathname);
      console.log("Stored URL:", storedUrl);

      // Add a small delay to show the success notification
      setTimeout(() => {
        // Clear the stored redirect URL AFTER we've used it
        localStorage.removeItem("redirectAfterLogin");

        // If we have a stored URL, redirect to it
        if (storedUrl) {
          // Validate the stored URL before redirecting
          try {
            const url = new URL(storedUrl, window.location.origin);
            // Only redirect to same origin URLs for security
            if (url.origin === window.location.origin) {
              console.log("✅ Redirecting to stored URL:", storedUrl);
              window.location.href = storedUrl;
            } else {
              console.log("❌ Invalid origin, redirecting to home");
              window.location.href = "/";
            }
          } catch (error) {
            console.error("❌ Invalid stored URL:", storedUrl, error);
            window.location.href = "/";
          }
        } else {
          // No stored URL, go to home
          console.log("🔄 No stored URL, redirecting to home page");
          window.location.href = "/";
        }
      }, 1000); // 1 second delay to show notification
    } else {
      // Handle blocked account
      if (response.status === 403 && data.message === "Account is blocked") {
        const blockReason = data.reason || "No reason provided";
        const blockDate = data.blockedAt
          ? new Date(data.blockedAt).toLocaleDateString()
          : "Unknown";
        showNotification(
          `🚫 Your account has been blocked. Reason: ${blockReason}. Blocked on: ${blockDate}`,
          "error"
        );
      } else {
        showNotification(data.message || "Login failed", "error");
      }
    }
  } catch (error) {
    showNotification("Error connecting to server", "error");
    console.error("Login error:", error);
  }
}

async function handleRegister(e) {
  e.preventDefault();

  // Check if elements exist before accessing their values
  const emailElement = document.getElementById("registerEmail");
  const passwordElement = document.getElementById("registerPassword");
  const nameElement = document.getElementById("registerName");
  const confirmPasswordElement = document.getElementById("confirmPassword");
  const yobElement = document.getElementById("regYOB");
  const genderElement = document.getElementById("regGender");

  if (
    !emailElement ||
    !passwordElement ||
    !nameElement ||
    !confirmPasswordElement ||
    !yobElement ||
    !genderElement
  ) {
    console.error("Register form elements not found");
    showNotification("Register form not found", "error");
    return;
  }

  const email = emailElement.value;
  const password = passwordElement.value;
  const name = nameElement.value;
  const confirmPassword = confirmPasswordElement.value;
  const YOB = parseInt(yobElement.value);
  const gender = genderElement.value === "true";

  // Validate password confirmation
  if (password !== confirmPassword) {
    showNotification("Passwords do not match", "error");
    return;
  }

  // Validate required fields
  if (!YOB || YOB < 1900 || YOB > 2024) {
    showNotification("Please enter a valid year of birth", "error");
    return;
  }

  if (genderElement.value === "") {
    showNotification("Please select your gender", "error");
    return;
  }

  try {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password, name, YOB, gender }),
    });

    const data = await response.json();

    if (response.ok) {
      showNotification("Registration successful! Please login.", "success");
      document.getElementById("registerForm").reset();
      // Redirect to login page immediately
      window.location.href = "/login";
    } else {
      showNotification(data.message || "Registration failed", "error");
    }
  } catch (error) {
    showNotification("Error connecting to server", "error");
    console.error("Register error:", error);
  }
}

function logout() {
  // Store current page URL for redirect after login (except for special pages)
  storeRedirectUrl(window.location.href);

  // Show logout notification first
  showNotification("👋 You have been logged out successfully", "success");

  // Clear user data
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  currentUser = null;
  updateUIForLoggedOutUser();

  // Special handling for certain pages with delay to show notification
  setTimeout(() => {
    if (location.pathname === "/admin") {
      // Admin page requires login, redirect to home
      window.location.href = "/";
    } else if (
      location.pathname === "/login" ||
      location.pathname === "/register"
    ) {
      // Login/register pages - redirect to home after logout
      window.location.href = "/";
    } else if (location.pathname.startsWith("/error")) {
      // Error pages - redirect to home after logout
      window.location.href = "/";
    } else {
      // Stay on current page after logout, just reload to update UI
      window.location.reload();
    }
  }, 1500); // 1.5 second delay to show notification
}

function updateUIForLoggedInUser() {
  // Hide login/register buttons
  const authButtons = document.getElementById("authButtons");
  const loginLinkMobile = document.getElementById("loginLinkMobile");
  const registerLinkMobile = document.getElementById("registerLinkMobile");

  if (authButtons) authButtons.style.display = "none";
  if (loginLinkMobile) loginLinkMobile.style.display = "none";
  if (registerLinkMobile) registerLinkMobile.style.display = "none";

  // Show profile and logout
  const profileLink = document.getElementById("profileLink");
  const profileLinkMobile = document.getElementById("profileLinkMobile");
  const logoutButton = document.getElementById("logoutButton");
  const logoutLinkMobile = document.getElementById("logoutLinkMobile");

  if (profileLink) profileLink.style.display = "block";
  if (profileLinkMobile) profileLinkMobile.style.display = "block";
  if (logoutButton) logoutButton.style.display = "block";
  if (logoutLinkMobile) logoutLinkMobile.style.display = "block";

  // Show admin link in footer if user is admin
  const adminFooterLink = document.getElementById("adminFooterLink");
  if (adminFooterLink && currentUser && currentUser.isAdmin) {
    adminFooterLink.style.display = "block";
  }

  // Show admin link if admin
  if (currentUser && currentUser.isAdmin) {
    const adminLink = document.getElementById("adminLink");
    const adminLinkMobile = document.getElementById("adminLinkMobile");
    if (adminLink) adminLink.style.display = "block";
    if (adminLinkMobile) adminLinkMobile.style.display = "block";

    const fab = document.getElementById("addPerfumeFab");
    if (fab) fab.style.display = "block";

    // Show quick action buttons in search card
    const addPerfBtn = document.getElementById("searchAddPerfumeBtn");
    const addBrandBtn = document.getElementById("searchAddBrandBtn");
    if (addPerfBtn) addPerfBtn.style.display = "inline-flex";
    if (addBrandBtn) addBrandBtn.style.display = "inline-flex";
  }

  // Debug log before calling loadUserProfile
  console.log("About to call loadUserProfile, currentUser:", currentUser);
  loadUserProfile();
}

function updateUIForLoggedOutUser() {
  // Show login/register buttons
  const authButtons = document.getElementById("authButtons");
  const loginLinkMobile = document.getElementById("loginLinkMobile");
  const registerLinkMobile = document.getElementById("registerLinkMobile");

  if (authButtons) authButtons.style.display = "flex";
  if (loginLinkMobile) loginLinkMobile.style.display = "block";
  if (registerLinkMobile) registerLinkMobile.style.display = "block";

  // Hide profile and logout
  const profileLink = document.getElementById("profileLink");
  const profileLinkMobile = document.getElementById("profileLinkMobile");
  const logoutButton = document.getElementById("logoutButton");
  const logoutLinkMobile = document.getElementById("logoutLinkMobile");
  const adminLink = document.getElementById("adminLink");
  const adminLinkMobile = document.getElementById("adminLinkMobile");

  if (profileLink) profileLink.style.display = "none";
  if (profileLinkMobile) profileLinkMobile.style.display = "none";
  if (logoutButton) logoutButton.style.display = "none";
  if (logoutLinkMobile) logoutLinkMobile.style.display = "none";
  if (adminLink) adminLink.style.display = "none";
  if (adminLinkMobile) adminLinkMobile.style.display = "none";

  // Hide admin link in footer
  const adminFooterLink = document.getElementById("adminFooterLink");
  if (adminFooterLink) adminFooterLink.style.display = "none";
  const fab = document.getElementById("addPerfumeFab");
  if (fab) fab.style.display = "none";
  const addPerfBtn = document.getElementById("searchAddPerfumeBtn");
  const addBrandBtn = document.getElementById("searchAddBrandBtn");
  if (addPerfBtn) addPerfBtn.style.display = "none";
  if (addBrandBtn) addBrandBtn.style.display = "none";
}

// Profile functions
async function loadUserProfile() {
  if (!currentUser) return;

  // Debug log to see current user data
  console.log("Current user data in loadUserProfile:", currentUser);
  console.log("YOB from currentUser:", currentUser.YOB);

  const profileName = document.getElementById("profileName");
  const profileYOB = document.getElementById("profileYOB");
  const profileGender = document.getElementById("profileGender");

  if (profileName) profileName.value = currentUser.name || "";
  if (profileYOB) profileYOB.value = currentUser.YOB || currentUser.yob || "";
  if (profileGender)
    profileGender.value = currentUser.gender ? "true" : "false";
}

async function handleProfileUpdate(e) {
  e.preventDefault();

  // Check if elements exist before accessing their values
  const nameElement = document.getElementById("profileName");
  const yobElement = document.getElementById("profileYOB");
  const genderElement = document.getElementById("profileGender");

  if (!nameElement || !yobElement || !genderElement) {
    console.error("Profile form elements not found");
    showNotification("Profile form not found", "error");
    return;
  }

  const name = nameElement.value;
  const YOB = parseInt(yobElement.value);
  const gender = genderElement.value === "true";

  try {
    const response = await fetch(`${API_URL}/members/me`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${safeGetFromStorage("token")}`,
      },
      body: JSON.stringify({ name, YOB, gender }),
    });

    const data = await response.json();

    if (response.ok) {
      currentUser = { ...currentUser, name, YOB, gender };
      localStorage.setItem("user", JSON.stringify(currentUser));
      showNotification("Profile updated successfully", "success");
    } else {
      showNotification(data.message || "Update failed", "error");
    }
  } catch (error) {
    showNotification("Error updating profile", "error");
    console.error("Profile update error:", error);
  }
}

async function handlePasswordChange(e) {
  e.preventDefault();

  // Check if elements exist before accessing their values
  const oldPasswordElement = document.getElementById("oldPassword");
  const newPasswordElement = document.getElementById("newPassword");

  if (!oldPasswordElement || !newPasswordElement) {
    console.error("Password form elements not found");
    showNotification("Password form not found", "error");
    return;
  }

  const oldPassword = oldPasswordElement.value;
  const newPassword = newPasswordElement.value;

  try {
    const response = await fetch(`${API_URL}/members/me/password`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${safeGetFromStorage("token")}`,
      },
      body: JSON.stringify({ oldPassword, newPassword }),
    });

    const data = await response.json();

    if (response.ok) {
      showNotification("Password changed successfully", "success");
      document.getElementById("passwordForm").reset();
    } else {
      showNotification(data.message || "Password change failed", "error");
    }
  } catch (error) {
    showNotification("Error changing password", "error");
    console.error("Password change error:", error);
  }
}

// Perfume functions
async function loadPerfumes() {
  // Show loading skeleton
  showLoadingSkeleton();

  try {
    const response = await fetch(`${API_URL}/public/perfumes`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    allPerfumes = data || [];
    displayPerfumes(allPerfumes);
  } catch (error) {
    console.error("Error loading perfumes:", error);
    allPerfumes = [];
    displayPerfumes([]);
    showNotification("Failed to load perfumes", "error");
  }
}

function showLoadingSkeleton() {
  const grid = document.getElementById("perfumesGrid");
  grid.innerHTML = `
        ${Array.from(
          { length: 8 },
          (_, i) => `
            <div class="card luxury-glass premium-shadow animate-pulse border border-white/20 rounded-3xl overflow-hidden" style="animation-delay: ${
              i * 0.1
            }s;">
                <figure class="relative overflow-hidden bg-gradient-to-br from-white/10 to-white/5">
                    <div class="h-64 w-full relative">
                        <div class="absolute inset-4 bg-gradient-to-br from-white/20 to-white/10 rounded-2xl animate-shimmer"></div>
                        <!-- Premium badge skeleton -->
                        <div class="absolute top-4 left-4 w-16 h-6 bg-white/30 rounded-full animate-pulse"></div>
                    </div>
                </figure>
                <div class="card-body p-6 space-y-4">
                    <div class="h-6 bg-gradient-to-r from-white/20 to-white/10 rounded w-3/4 mx-auto animate-pulse"></div>
                    <div class="h-4 bg-gradient-to-r from-white/20 to-white/10 rounded w-1/2 mx-auto animate-pulse"></div>
                    <div class="h-8 bg-gradient-to-r from-white/20 to-white/10 rounded-full w-20 mx-auto animate-pulse"></div>
                    <div class="h-3 bg-gradient-to-r from-white/20 to-white/10 rounded w-16 mx-auto animate-pulse"></div>
                    <div class="flex justify-center items-center space-x-2 mt-4">
                        <div class="w-1 h-1 bg-white/30 rounded-full animate-pulse"></div>
                        <div class="w-2 h-2 bg-white/30 rounded-full animate-pulse"></div>
                        <div class="w-1 h-1 bg-white/30 rounded-full animate-pulse"></div>
                    </div>
                </div>
            </div>
        `
        ).join("")}
    `;
}

// Function to navigate to perfume detail page
function goToPerfumeDetail(perfumeId) {
  if (perfumeId) {
    window.location.href = `/perfume/${perfumeId}`;
  } else {
    console.error("Perfume ID is required");
    showNotification("Error: Perfume ID not found", "error");
  }
}

function displayPerfumes(perfumes) {
  const grid = document.getElementById("perfumesGrid");
  if (!grid) {
    console.error("perfumesGrid element not found");
    return;
  }

  if (perfumes.length === 0) {
    grid.innerHTML = `
            <div class="col-span-full text-center py-20">
                <div class="hero bg-white/90 backdrop-blur-sm shadow-xl rounded-3xl p-16 border border-gray-200 animate-fadeInUp">
                    <div class="hero-content text-center">
                        <div class="max-w-lg">
                            <div class="mb-8 animate-bounce-in">
                                <div class="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full mb-6 animate-float">
                                    <i class="fas fa-search text-4xl text-white"></i>
                                </div>
                            </div>
                            <h3 class="text-4xl font-bold mb-6 text-gray-800 animate-slide-in-left">No perfumes found</h3>
                            <p class="text-xl text-gray-600 mb-8 leading-relaxed animate-slide-in-right">
                                We couldn't find any perfumes matching your criteria. Try adjusting your search or filter settings to discover amazing fragrances.
                            </p>
                            <div class="flex flex-col sm:flex-row gap-4 justify-center animate-fadeInUp">
                                <button class="btn btn-lg bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg transition-all duration-300" onclick="document.getElementById('searchInput').value=''; filterPerfumes();">
                                    <i class="fas fa-refresh mr-2"></i>
                                    Clear Search
                                </button>
                                <button class="btn btn-lg bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white shadow-lg transition-all duration-300" onclick="document.getElementById('brandFilter').value=''; filterPerfumes();">
                                    <i class="fas fa-filter mr-2"></i>
                                    Clear Filter
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    return;
  }

  grid.innerHTML = perfumes
    .map(
      (perfume, index) => `
        <div class="perfume-card" style="animation-delay: ${
          index * 0.05
        }s;" onclick="goToPerfumeDetail('${perfume._id}')">
            <!-- Premium Badge -->
            <div class="perfume-premium-badge">
                <i class="fas fa-crown mr-1"></i>Premium
            </div>
            
            <!-- Image Section -->
            <div class="perfume-card-image">
                <img src="${perfume.imageUrl || perfume.uri || ""}" 
                     alt="${perfume.perfumeName || "Unknown Perfume"}" 
                     onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                <div class="flex items-center justify-center w-full h-full bg-gray-100 text-gray-400" style="display: none;">
                    <div class="text-center">
                        <i class="fas fa-image text-4xl mb-2"></i>
                        <p class="text-sm">No Image</p>
                    </div>
                </div>
            </div>
            
            <!-- Content Section -->
            <div class="perfume-card-content">
                <h3 class="perfume-card-title">${
                  perfume.perfumeName || "Unknown Perfume"
                }</h3>
                
                <button class="perfume-card-brand ${
                  perfume.brand?.isDeleted ? "opacity-60" : ""
                }" 
                        onclick="event.stopPropagation(); selectBrandFilter('${
                          perfume.brand?._id || ""
                        }')">
                    ${
                      perfume.brand ? perfume.brand.brandName : "Unknown Brand"
                    }${perfume.brand?.isDeleted ? " (Deleted)" : ""}
                </button>
                
                <div class="perfume-card-details">
                    <span class="perfume-detail-badge ${
                      perfume.targetAudience || "unisex"
                    }">
                        <i class="fas ${
                          perfume.targetAudience === "male"
                            ? "fa-mars"
                            : perfume.targetAudience === "female"
                            ? "fa-venus"
                            : "fa-venus-mars"
                        }"></i>
                        ${perfume.targetAudience || "unisex"}
                    </span>
                    <span class="perfume-detail-badge">
                        <i class="fas fa-flask"></i>
                        ${perfume.volume || "100"}ml
                    </span>
                    ${
                      perfume.price
                        ? `<span class="perfume-detail-badge">
                        <i class="fas fa-dollar-sign"></i>
                        $${perfume.price}
                    </span>`
                        : ""
                    }
                </div>
                
                <div class="perfume-card-actions">
                    <a href="#" class="perfume-btn perfume-btn-view" onclick="event.preventDefault(); event.stopPropagation(); goToPerfumeDetail('${
                      perfume._id
                    }')">
                        <i class="fas fa-eye"></i>
                        View
                    </a>
                    ${
                      (() => {
                        try {
                          const user = getStoredUser();
                          return user && user.isAdmin;
                        } catch (e) {
                          console.error("Error checking admin status:", e);
                          return false;
                        }
                      })()
                        ? `
                    <a href="#" class="perfume-btn perfume-btn-edit" onclick="event.preventDefault(); event.stopPropagation(); editPerfume('${perfume._id}')">
                        <i class="fas fa-edit"></i>
                        Edit
                    </button>
                </div>
                    </a>
                    `
                        : ""
                    }
                </div>
            </div>
        </div>
    `
    )
    .join("");
}

// Quick brand filter when clicking brand name on a card
function selectBrandFilter(brandId) {
  const filter = document.getElementById("brandFilter");
  if (!filter) return;
  filter.value = brandId || "";
  filterPerfumes();
}

async function showPerfumeDetail(id) {
  currentPerfumeId = id; // Store current perfume ID for comments
  // Ensure we have the latest auth state before rendering modal
  const latestUser = getStoredUser();
  if (latestUser) {
    currentUser = latestUser;
  }
  try {
    const response = await fetch(`${API_URL}/public/perfumes/${id}`);
    const perfume = await response.json();

    if (response.ok) {
      const modal = document.getElementById("perfumeModal");
      const detail = document.getElementById("perfumeDetail");

      detail.innerHTML = `
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div>
                        <img src="${
                          perfume.uri ||
                          "https://via.placeholder.com/400x400?text=No+Image"
                        }" 
                             alt="${perfume.perfumeName}" 
                             class="w-full h-96 object-cover rounded-xl"
                             onerror="this.src='https://via.placeholder.com/400x400?text=No+Image'">
                    </div>
                    <div class="space-y-6">
                        <div>
                            <h1 class="text-4xl font-bold mb-2">${
                              perfume.perfumeName
                            }</h1>
                            <p class="text-2xl text-primary font-semibold ${
                              perfume.brand?.isDeleted ? "opacity-60" : ""
                            }">
                                ${
                                  perfume.brand
                                    ? perfume.brand.brandName
                                    : "Unknown Brand"
                                }${perfume.brand?.isDeleted ? " (Deleted)" : ""}
                            </p>
                        </div>
                        
                        <div class="flex flex-wrap gap-2">
                            <div class="badge badge-primary badge-lg">${
                              perfume.concentration || "Unknown"
                            }</div>
                            <div class="badge badge-secondary badge-lg">${
                              perfume.targetAudience || "Unknown"
                            }</div>
                            <div class="badge badge-accent badge-lg">${
                              perfume.volume || "Unknown"
                            }ml</div>
                            <div class="badge badge-info badge-lg">$${
                              perfume.price || "Unknown"
                            }</div>
                        </div>
                        
                        <div>
                            <h3 class="text-xl font-bold mb-2">Description</h3>
                            <p class="text-base-content/80">${
                              perfume.description || "No description available"
                            }</p>
                        </div>
                        
                        <div>
                            <h3 class="text-xl font-bold mb-2">Ingredients</h3>
                            <p class="text-base-content/80">${
                              perfume.ingredients || "No ingredients listed"
                            }</p>
                        </div>
                    </div>
                </div>
                
                <!-- Comments Section -->
                <div class="divider"></div>
                <div class="space-y-6">
                    <h3 class="text-2xl font-bold">Reviews & Ratings</h3>
                    
                    <!-- Add Comment Form (only for logged in users) -->
                    ${
                      currentUser
                        ? `
                        <div class="card bg-base-200">
                            <div class="card-body">
                                <h4 class="card-title">Add Your Review</h4>
                                <form id="commentForm" class="space-y-4">
                                    <div class="form-control">
                                        <label class="label">
                                            <span class="label-text font-semibold">Rating</span>
                                        </label>
                                        <div class="rating rating-lg">
                                            <input type="radio" name="rating" value="1" class="mask mask-star-2 bg-orange-400" />
                                            <input type="radio" name="rating" value="2" class="mask mask-star-2 bg-orange-400" />
                                            <input type="radio" name="rating" value="3" class="mask mask-star-2 bg-orange-400" />
                                            <input type="radio" name="rating" value="4" class="mask mask-star-2 bg-orange-400" />
                                            <input type="radio" name="rating" value="5" class="mask mask-star-2 bg-orange-400" />
                                        </div>
                                    </div>
                                    <div class="form-control">
                                        <label class="label">
                                            <span class="label-text font-semibold">Your Review</span>
                                        </label>
                                        <textarea id="commentContent" class="textarea textarea-bordered" rows="3" placeholder="Share your thoughts about this perfume..."></textarea>
                                    </div>
                                    <div class="card-actions justify-end">
                                        <button type="submit" class="btn btn-primary">
                                            <i class="fas fa-paper-plane mr-2"></i>
                                            Submit Review
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    `
                        : `
                        <div class="alert alert-info">
                            <i class="fas fa-info-circle"></i>
                            <span>Please <a href="#" onclick="showSection('login')" class="link link-primary">login</a> to add a review</span>
                        </div>
                    `
                    }
                    
                    <!-- Comments Display -->
                    <div id="commentsList" class="space-y-4">
                        ${
                          perfume.comments && perfume.comments.length > 0
                            ? perfume.comments
                                .map(
                                  (comment) => `
                                <div class="card bg-base-100 shadow-sm">
                                    <div class="card-body">
                                        <div class="flex items-center gap-3 mb-2">
                                            <div class="avatar placeholder">
                                                <div class="bg-neutral text-neutral-content rounded-full w-8">
                                                    <span class="text-xs">${
                                                      comment.author
                                                        ? comment.author.name
                                                            .charAt(0)
                                                            .toUpperCase()
                                                        : "U"
                                                    }</span>
                                                </div>
                                            </div>
                                            <div>
                                                <div class="font-semibold">${
                                                  comment.author
                                                    ? comment.author.name
                                                    : "Anonymous"
                                                }</div>
                                                <div class="flex items-center gap-2">
                                                    <div class="rating rating-sm">
                                                        ${[1, 2, 3, 4, 5]
                                                          .map(
                                                            (i) =>
                                                              `<input type="radio" class="mask mask-star-2 bg-orange-400" ${
                                                                i <=
                                                                comment.rating
                                                                  ? "checked"
                                                                  : ""
                                                              } disabled />`
                                                          )
                                                          .join("")}
                                                    </div>
                                                    <span class="text-sm text-base-content/60">${new Date(
                                                      comment.createdAt
                                                    ).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <p class="text-base-content/80">${
                                          comment.content
                                        }</p>
                                    </div>
                                </div>
                            `
                                )
                                .join("")
                            : '<div class="text-center py-8 text-base-content/60"><i class="fas fa-comment-slash text-4xl mb-4"></i><p>No reviews yet. Be the first to review this perfume!</p></div>'
                        }
                    </div>
                </div>
            `;

      modal.showModal();
    }
  } catch (error) {
    console.error("Error loading perfume details:", error);
    showNotification("Error loading perfume details", "error");
  }
}

function filterPerfumes() {
  const searchInput = document.getElementById("searchInput");
  const brandFilterElement = document.getElementById("brandFilter");

  // Check if elements exist
  if (!searchInput || !brandFilterElement) {
    console.log("Search or filter elements not found");
    return;
  }

  const searchTerm = searchInput.value.toLowerCase();
  const brandFilter = brandFilterElement.value;

  let filtered = allPerfumes;

  if (searchTerm) {
    filtered = filtered.filter(
      (p) =>
        p.perfumeName.toLowerCase().includes(searchTerm) ||
        p.brand?.brandName.toLowerCase().includes(searchTerm) ||
        p.description.toLowerCase().includes(searchTerm) ||
        (p.brand?.isDeleted &&
          `deleted ${p.brand.brandName}`.toLowerCase().includes(searchTerm))
    );
  }

  if (brandFilter) {
    filtered = filtered.filter((p) => p.brand?._id === brandFilter);
  }

  displayPerfumes(filtered);
}

// Brand functions
async function loadBrands() {
  try {
    console.log("Loading brands from:", `${API_URL}/public/brands`);
    const response = await fetch(`${API_URL}/public/brands`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Brands loaded:", data);
    allBrands = data || [];
    updateBrandFilters();
  } catch (error) {
    console.error("Error loading brands:", error);
    // Use default brands as fallback
    allBrands = [
      { _id: "1", brandName: "Chanel" },
      { _id: "2", brandName: "Dior" },
      { _id: "3", brandName: "Tom Ford" },
      { _id: "4", brandName: "Yves Saint Laurent" },
    ];
    updateBrandFilters();
    showNotification("Using default brands", "warning");
  }
}

function updateBrandFilters() {
  console.log("Updating brand filters with brands:", allBrands);
  const brandFilter = document.getElementById("brandFilter");
  const perfumeBrandSelect = document.getElementById("perfumeBrand");

  // Separate active and deleted brands
  const activeBrands = allBrands.filter((brand) => !brand.isDeleted);
  const deletedBrands = allBrands.filter((brand) => brand.isDeleted);

  console.log("Active brands:", activeBrands);
  console.log("Deleted brands:", deletedBrands);

  // Create options for brand filter (show all brands, with deleted ones marked)
  const activeOptions = activeBrands
    .map((brand) => `<option value="${brand._id}">${brand.brandName}</option>`)
    .join("");

  const deletedOptions = deletedBrands
    .map(
      (brand) =>
        `<option value="${brand._id}" style="color: #ef4444; font-style: italic;">${brand.brandName} (Deleted)</option>`
    )
    .join("");

  // Only update brandFilter if it exists (main page only)
  if (brandFilter) {
    brandFilter.innerHTML =
      '<option value="">All Brands</option>' + activeOptions + deletedOptions;
    console.log("Updated brand filter dropdown");
  } else {
    console.log("brandFilter element not found (not on main page)");
  }

  // Always try to update perfume brand select if it exists
  if (perfumeBrandSelect) {
    // For perfume form, show all brands including deleted ones
    const activeOptions = activeBrands
      .map(
        (brand) => `<option value="${brand._id}">${brand.brandName}</option>`
      )
      .join("");

    const deletedOptions = deletedBrands
      .map(
        (brand) =>
          `<option value="${brand._id}" style="color: #ef4444; font-style: italic; background-color: #fef2f2;">${brand.brandName} (Đã xóa)</option>`
      )
      .join("");

    perfumeBrandSelect.innerHTML =
      '<option value="">Chọn thương hiệu</option>' +
      activeOptions +
      deletedOptions;
    console.log(
      "Updated perfume brand dropdown with",
      activeBrands.length + deletedBrands.length,
      "brands"
    );
  } else {
    console.log("perfumeBrandSelect element not found");
  }
}

// Image preview function
function updatePreview() {
  const imageUrl = document.getElementById("perfumeImageUrl")?.value;
  const uri = document.getElementById("perfumeUri")?.value;
  const preview = document.getElementById("perfumePreview");

  if (preview) {
    // Use imageUrl first, then uri, then placeholder
    const src =
      imageUrl ||
      uri ||
      "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg==";
    preview.src = src;
  }
}

// Admin functions
async function loadAllAdminData() {
  try {
    console.log("Loading all admin data...");

    // Load all data in parallel for better performance
    const [membersResult, brandsResult, perfumesResult] =
      await Promise.allSettled([
        loadMembers(),
        loadAdminBrands(),
        loadAdminPerfumes(),
      ]);

    console.log("Admin data loading results:", {
      members: membersResult.status,
      brands: brandsResult.status,
      perfumes: perfumesResult.status,
    });

    // Log any errors
    if (membersResult.status === "rejected") {
      console.error("Error loading members:", membersResult.reason);
    }
    if (brandsResult.status === "rejected") {
      console.error("Error loading brands:", brandsResult.reason);
    }
    if (perfumesResult.status === "rejected") {
      console.error("Error loading perfumes:", perfumesResult.reason);
    }

    console.log("All admin data loaded successfully");
  } catch (error) {
    console.error("Error loading admin data:", error);
    showNotification("Error loading admin data", "error");
  }
}

async function showAdminTab(tab) {
  try {
    console.log("Switching to admin tab:", tab);

    // Hide all admin tabs
    document
      .querySelectorAll(".admin-tab")
      .forEach((t) => t.classList.add("hidden"));
    document
      .querySelectorAll(".tab")
      .forEach((b) => b.classList.remove("active"));

    // Show selected tab
    const targetTab = document.getElementById(
      "admin" + tab.charAt(0).toUpperCase() + tab.slice(1)
    );
    if (targetTab) {
      targetTab.classList.remove("hidden");
    }

    // Activate the corresponding tab button
    const tabButton = document.querySelector(
      `[onclick="showAdminTab('${tab}')"]`
    );
    if (tabButton) {
      tabButton.classList.add("active");
    }

    // Load data for selected tab with await to ensure completion
    if (tab === "members") {
      console.log("Loading members data...");
      await loadMembers();
    } else if (tab === "brands") {
      console.log("Loading brands data...");
      await loadAdminBrands();
    } else if (tab === "perfumes") {
      console.log("Loading perfumes data...");
      await loadAdminPerfumes();
    } else if (tab === "profile") {
      console.log("Loading profile data...");
      await loadAdminProfile();
    }

    console.log("Admin tab data loaded successfully for:", tab);
  } catch (error) {
    console.error("Error in showAdminTab:", error);
    showNotification("Error loading admin data", "error");
  }
}

async function loadMembers() {
  try {
    const response = await fetch(`${API_URL}/members/collectors`, {
      headers: {
        Authorization: `Bearer ${safeGetFromStorage("token")}`,
      },
    });

    const users = await response.json();

    if (response.ok) {
      console.log(
        "Loaded all members:",
        users.length,
        users.map((u) => ({
          name: u.name,
          email: u.email,
          isBlocked: u.isBlocked,
        }))
      );

      const activeMembers = users.filter((user) => !user.isBlocked);
      const blockedMembers = users.filter((user) => user.isBlocked);

      const table = document.getElementById("membersTable");
      if (!table) {
        console.error("membersTable element not found");
        return;
      }
      table.innerHTML = `
                <div class="mb-4 p-4 bg-gray-50 rounded-lg">
                    <div class="flex justify-between items-center">
                        <h3 class="text-lg font-semibold">Member Statistics</h3>
                        <div class="flex gap-4">
                            <span class="badge badge-success">Active: ${
                              activeMembers.length
                            }</span>
                            <span class="badge badge-error">Blocked: ${
                              blockedMembers.length
                            }</span>
                            <span class="badge badge-info">Total: ${
                              users.length
                            }</span>
                        </div>
                    </div>
                </div>
                <div class="overflow-x-auto">
                    <table class="table table-zebra w-full">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>YOB</th>
                                <th>Gender</th>
                                <th>Admin</th>
                                <th>Status</th>
                                <th>Blocked Date</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${users
                              .map((user) => {
                                const isBlocked = user.isBlocked;
                                const statusBadge = isBlocked
                                  ? '<span class="badge badge-error">Blocked</span>'
                                  : '<span class="badge badge-success">Active</span>';
                                const blockedDate = user.blockedAt
                                  ? new Date(
                                      user.blockedAt
                                    ).toLocaleDateString()
                                  : "-";

                                const actionButtons = isBlocked
                                  ? `<button class="btn btn-success btn-sm" onclick="unblockMember('${user._id}')">Unblock</button>`
                                  : `<button class="btn btn-warning btn-sm" onclick="blockMember('${user._id}')">Block</button>`;

                                return `
                                    <tr class="${
                                      isBlocked ? "opacity-60 bg-red-50" : ""
                                    }">
                                        <td class="font-semibold ${
                                          isBlocked ? "text-red-600" : ""
                                        }">${user.name}</td>
                                        <td>${user.email}</td>
                                        <td>${user.YOB}</td>
                                        <td>${
                                          user.gender ? "Male" : "Female"
                                        }</td>
                                        <td>${user.isAdmin ? "Yes" : "No"}</td>
                                        <td>${statusBadge}</td>
                                        <td>${blockedDate}</td>
                                        <td>
                                            <div class="flex gap-2">
                                                ${actionButtons}
                                                ${
                                                  isBlocked
                                                    ? `<button class="btn btn-info btn-sm" onclick="viewMemberDetails('${user._id}')">View</button>`
                                                    : ""
                                                }
                                            </div>
                                        </td>
                                    </tr>
                                `;
                              })
                              .join("")}
                        </tbody>
                    </table>
                </div>
            `;
    }
  } catch (error) {
    console.error("Error loading members:", error);
  }
}

async function blockMember(id) {
  const reason = prompt("Enter reason for blocking this member (optional):");
  if (reason === null) return; // User cancelled

  try {
    const response = await fetch(`${API_URL}/members/${id}/block`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${safeGetFromStorage("token")}`,
      },
      body: JSON.stringify({ reason: reason || "No reason provided" }),
    });

    if (response.ok) {
      showNotification("Member blocked successfully!", "success");
      loadMembers();
    } else {
      const errorData = await response.json();
      showNotification(errorData.message || "Failed to block member", "error");
    }
  } catch (error) {
    console.error("Error blocking member:", error);
    showNotification("Error blocking member", "error");
  }
}

async function unblockMember(id) {
  if (!confirm("Are you sure you want to unblock this member?")) return;

  try {
    const response = await fetch(`${API_URL}/members/${id}/unblock`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${safeGetFromStorage("token")}`,
      },
    });

    if (response.ok) {
      showNotification("Member unblocked successfully!", "success");
      loadMembers();
    } else {
      const errorData = await response.json();
      showNotification(
        errorData.message || "Failed to unblock member",
        "error"
      );
    }
  } catch (error) {
    console.error("Error unblocking member:", error);
    showNotification("Error unblocking member", "error");
  }
}

async function viewMemberDetails(id) {
  try {
    const response = await fetch(`${API_URL}/members/collectors`, {
      headers: {
        Authorization: `Bearer ${safeGetFromStorage("token")}`,
      },
    });

    const users = await response.json();
    const member = users.find((u) => u._id === id);

    if (!member) {
      showNotification("Member not found", "error");
      return;
    }

    // Create modal content
    const modalContent = `
            <div class="modal-box max-w-md">
                <h3 class="font-bold text-lg mb-4">Member Details</h3>
                <div class="space-y-3">
                    <div>
                        <label class="font-semibold">Name:</label>
                        <p class="text-lg">${member.name || "N/A"}</p>
                    </div>
                    <div>
                        <label class="font-semibold">Email:</label>
                        <p>${member.email}</p>
                    </div>
                    <div>
                        <label class="font-semibold">Year of Birth:</label>
                        <p>${member.YOB || "N/A"}</p>
                    </div>
                    <div>
                        <label class="font-semibold">Gender:</label>
                        <p>${member.gender ? "Male" : "Female"}</p>
                    </div>
                    <div>
                        <label class="font-semibold">Admin:</label>
                        <p>${member.isAdmin ? "Yes" : "No"}</p>
                    </div>
                    <div>
                        <label class="font-semibold">Status:</label>
                        <p>${
                          member.isBlocked
                            ? '<span class="badge badge-error">Blocked</span>'
                            : '<span class="badge badge-success">Active</span>'
                        }</p>
                    </div>
                    <div>
                        <label class="font-semibold">Created:</label>
                        <p>${new Date(member.createdAt).toLocaleString()}</p>
                    </div>
                    ${
                      member.isBlocked
                        ? `
                    <div>
                        <label class="font-semibold">Blocked:</label>
                        <p>${new Date(member.blockedAt).toLocaleString()}</p>
                    </div>
                    <div>
                        <label class="font-semibold">Block Reason:</label>
                        <p class="text-red-600">${
                          member.blockReason || "No reason provided"
                        }</p>
                    </div>
                    `
                        : ""
                    }
                </div>
                <div class="modal-action">
                    <button class="btn btn-primary" onclick="closeModal()">Close</button>
                    ${
                      member.isBlocked
                        ? `<button class="btn btn-success" onclick="unblockMember('${member._id}'); closeModal();">Unblock Member</button>`
                        : ""
                    }
                </div>
            </div>
        `;

    showModal(modalContent);
  } catch (error) {
    console.error("Error viewing member details:", error);
    showNotification("Error loading member details", "error");
  }
}

async function deleteUser(id) {
  if (!confirm("Are you sure you want to delete this user?")) return;

  try {
    const response = await fetch(`${API_URL}/members/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${safeGetFromStorage("token")}`,
      },
    });

    if (response.ok) {
      showNotification("User deleted successfully", "success");
      loadMembers();
    }
  } catch (error) {
    console.error("Error deleting user:", error);
  }
}

// Navigation
function showSection(sectionId) {
  // Check authentication for profile section
  if (sectionId === "profile") {
    const currentUser = getStoredUser();
    if (!currentUser) {
      // Store current page URL for redirect after login
      storeRedirectUrl(window.location.href);
      showNotification("Please login to access your profile", "error");
      setTimeout(() => {
        window.location.href = "/login";
      }, 1500);
      return;
    }
  }

  document
    .querySelectorAll(".section")
    .forEach((s) => s.classList.remove("active"));
  const targetSection = document.getElementById(sectionId);

  if (targetSection) {
    targetSection.classList.add("active");
  }

  // Load data for specific sections
  if (sectionId === "profile") {
    loadProfileData();
  }

  // If trying to access admin section from main page, redirect to admin page
  if (sectionId === "admin") {
    window.location.href = "/admin";
    return;
  }

  // If trying to access profile from admin page, redirect to main page with profile section
  if (sectionId === "profile" && window.location.pathname === "/admin") {
    window.location.href = "/?section=profile";
    return;
  }
}

// Theme
function changeTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("theme", theme);
}

// Load saved theme
const savedTheme = localStorage.getItem("theme");
if (savedTheme) {
  document.documentElement.setAttribute("data-theme", savedTheme);
}

// Notifications
function showNotification(message, type = "info") {
  const toast = document.getElementById("toast");
  const toastMessage = document.getElementById("toast-message");
  const toastIcon = document.getElementById("toast-icon");
  const toastClose = document.getElementById("toast-close");
  const toastProgress = document.getElementById("toast-progress");

  // Check if all required elements exist
  if (!toast || !toastMessage || !toastIcon || !toastClose) {
    console.error("Toast elements not found");
    // Fallback to alert if toast is not available
    alert(message);
    return;
  }

  // Set message
  toastMessage.textContent = message;

  // Set toast type, styling, and icon
  toast.className =
    "alert shadow-2xl border border-base-200/50 backdrop-blur-md animate-fadeInUp relative";
  if (type === "success") {
    toast.classList.add("alert-success");
    toastIcon.innerHTML = '<i class="fas fa-check-circle text-green-500"></i>';
  } else if (type === "error") {
    toast.classList.add("alert-error");
    toastIcon.innerHTML =
      '<i class="fas fa-exclamation-circle text-red-500"></i>';
  } else if (type === "warning") {
    toast.classList.add("alert-warning");
    toastIcon.innerHTML =
      '<i class="fas fa-exclamation-triangle text-yellow-500"></i>';
  } else {
    toast.classList.add("alert-info");
    toastIcon.innerHTML = '<i class="fas fa-info-circle text-blue-500"></i>';
  }

  // Reset progress bar (if exists)
  if (toastProgress) {
    toastProgress.style.width = "100%";
  }

  // Show toast
  toast.classList.remove("hidden");

  // Start progress bar animation (if exists)
  if (toastProgress) {
    setTimeout(() => {
      toastProgress.style.width = "0%";
    }, 100);
  }

  // Auto hide after 8 seconds (increased for better readability)
  setTimeout(() => {
    // Add fade out animation before hiding
    toast.classList.add("animate-fadeOutDown");
    setTimeout(() => {
      toast.classList.add("hidden");
      toast.classList.remove("animate-fadeOutDown");
    }, 300); // Wait for animation to complete
  }, 8000);

  // Close button functionality
  toastClose.onclick = () => {
    // Add fade out animation before hiding
    toast.classList.add("animate-fadeOutDown");
    setTimeout(() => {
      toast.classList.add("hidden");
      toast.classList.remove("animate-fadeOutDown");
    }, 300); // Wait for animation to complete
  };
}

// Comment functions
async function handleCommentSubmit(e) {
  // Refresh auth state
  currentUser = getStoredUser();
  if (!currentUser) {
    // Store current page URL for redirect after login
    storeRedirectUrl(window.location.href);
    showNotification("Please login to add a review", "error");
    // Add delay to show notification before redirect
    setTimeout(() => {
      window.location.href = "/login";
    }, 1500);
    return;
  }

  const rating = document.querySelector('input[name="rating"]:checked')?.value;
  const content = document.getElementById("commentContent").value;

  if (!rating || !content.trim()) {
    showNotification("Please provide both rating and review content", "error");
    return;
  }

  try {
    const response = await fetch(
      `${API_URL}/perfumes/${currentPerfumeId}/comments`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${safeGetFromStorage("token")}`,
        },
        body: JSON.stringify({
          rating: parseInt(rating),
          content: content.trim(),
        }),
      }
    );

    const data = await response.json();

    if (response.ok) {
      showNotification("Review submitted successfully!", "success");
      document.getElementById("commentForm").reset();
      // Reload perfume details to show new comment
      showPerfumeDetail(currentPerfumeId);
    } else {
      showNotification(data.message || "Failed to submit review", "error");
    }
  } catch (error) {
    showNotification("Error submitting review", "error");
    console.error("Comment submit error:", error);
  }
}

// Admin functions
async function handleBrandSubmit(e) {
  e.preventDefault();

  const brandNameElement = document.getElementById("brandName");
  if (!brandNameElement) {
    console.error("Brand name element not found");
    showNotification("Brand form not found", "error");
    return;
  }

  const brandName = brandNameElement.value;

  try {
    const response = await fetch(`${API_URL}/brands`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${safeGetFromStorage("token")}`,
      },
      body: JSON.stringify({ brandName }),
    });

    const data = await response.json();

    if (response.ok) {
      showNotification("Brand added successfully!", "success");
      document.getElementById("brandForm").reset();
      closeModal();
      loadAdminBrands();
    } else {
      showNotification(data.message || "Failed to add brand", "error");
    }
  } catch (error) {
    showNotification("Error adding brand", "error");
    console.error("Brand submit error:", error);
  }
}

async function handlePerfumeSubmit(e) {
  e.preventDefault();

  // Check if all required elements exist
  const requiredElements = [
    "perfumeBrand",
    "perfumeName",
    "perfumePrice",
    "perfumeVolume",
    "perfumeConcentration",
    "perfumeTarget",
    "perfumeUri",
    "perfumeImageUrl",
    "perfumeDescription",
    "perfumeIngredients",
  ];

  const elements = {};
  for (const id of requiredElements) {
    const element = document.getElementById(id);
    if (!element) {
      console.error(`Perfume form element not found: ${id}`);
      showNotification("Perfume form not found", "error");
      return;
    }
    elements[id] = element;
  }

  const selectedBrandId = elements.perfumeBrand.value;
  const selectedBrand = allBrands.find(
    (brand) => brand._id === selectedBrandId
  );

  // Check if selected brand is soft-deleted
  if (selectedBrand && selectedBrand.isDeleted) {
    if (
      !confirm(
        `Warning: You are creating a perfume for a deleted brand "${selectedBrand.brandName}". Do you want to continue?`
      )
    ) {
      return;
    }
  }

  const perfumeData = {
    perfumeName: elements.perfumeName.value,
    brand: selectedBrandId,
    price: parseFloat(elements.perfumePrice.value),
    volume: parseInt(elements.perfumeVolume.value),
    concentration: elements.perfumeConcentration.value,
    targetAudience: elements.perfumeTarget.value,
    uri: elements.perfumeUri.value,
    imageUrl: elements.perfumeImageUrl.value,
    description: elements.perfumeDescription.value,
    ingredients: elements.perfumeIngredients.value,
  };

  const isEditMode = e.target.dataset.mode === "edit";
  const perfumeId = e.target.dataset.perfumeId;

  try {
    const url = isEditMode
      ? `${API_URL}/perfumes/${perfumeId}`
      : `${API_URL}/perfumes`;
    const method = isEditMode ? "PUT" : "POST";

    const response = await fetch(url, {
      method: method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${safeGetFromStorage("token")}`,
      },
      body: JSON.stringify(perfumeData),
    });

    const data = await response.json();

    if (response.ok) {
      const message = isEditMode
        ? "Perfume updated successfully!"
        : "Perfume added successfully!";
      showNotification(message, "success");
      document.getElementById("perfumeForm").reset();
      closeModal();
      loadAdminPerfumes();

      // Reset form mode
      e.target.dataset.mode = "";
      e.target.dataset.perfumeId = "";

      // Reset modal title
      const modalTitle = document.querySelector("#perfumeFormModal h3");
      if (modalTitle) {
        modalTitle.textContent = "Add New Perfume";
      }
    } else {
      const message = isEditMode
        ? "Failed to update perfume"
        : "Failed to add perfume";
      showNotification(data.message || message, "error");
    }
  } catch (error) {
    const message = isEditMode
      ? "Error updating perfume"
      : "Error adding perfume";
    showNotification(message, "error");
    console.error("Perfume submit error:", error);
  }
}

// Store brands globally for filtering
let allAdminBrands = [];

async function loadAdminBrands() {
  try {
    const response = await fetch(`${API_URL}/brands`, {
      headers: {
        Authorization: `Bearer ${safeGetFromStorage("token")}`,
      },
    });

    const brands = await response.json();
    allAdminBrands = brands; // Store for filtering

    if (response.ok) {
      console.log(
        "Loaded brands for admin table:",
        brands.map((b) => ({
          _id: b._id,
          name: b.brandName,
          isDeleted: b.isDeleted,
          deletedAt: b.deletedAt,
          hasDeletedAt: !!b.deletedAt,
        }))
      );

      // Check specific brand that's causing issues
      const problemBrand = brands.find(
        (b) => b._id === "68f4e8c88779ae0d01ed5dc0"
      );
      if (problemBrand) {
        console.log("Problem brand details:", problemBrand);
      } else {
        console.log("Problem brand not found in loaded brands");
      }

      const activeBrands = brands.filter(
        (brand) => !brand.isDeleted && !brand.deletedAt
      );
      const deletedBrands = brands.filter(
        (brand) => brand.isDeleted || brand.deletedAt
      );

      // Render the table with all brands
      renderBrandsTable(brands);
    }
  } catch (error) {
    console.error("Error loading brands:", error);
  }
}

async function loadAdminPerfumes() {
  try {
    const response = await fetch(`${API_URL}/perfumes`, {
      headers: {
        Authorization: `Bearer ${safeGetFromStorage("token")}`,
      },
    });

    const perfumes = await response.json();

    if (response.ok) {
      console.log(
        "Loaded perfumes for admin table:",
        perfumes.map((p) => ({
          name: p.perfumeName,
          imageUrl: p.imageUrl,
          uri: p.uri,
          hasImage: !!(p.imageUrl || p.uri),
        }))
      );
      const table = document.getElementById("perfumesTable");
      if (!table) {
        console.log("perfumesTable element not found - not on admin page");
        return;
      }
      table.innerHTML = `
                <div class="overflow-x-auto">
                    <table class="table table-zebra w-full">
                        <thead>
                            <tr>
                                <th>Image</th>
                                <th>Name</th>
                                <th>Brand</th>
                                <th>Price</th>
                                <th>Target</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${perfumes
                              .map(
                                (perfume) => `
                                <tr>
                                    <td>
                                        <div class="avatar">
                                            <div class="w-12 h-12 rounded">
                                                ${(() => {
                                                  // Prioritize actual product images over sample images
                                                  let imageSrc = "";
                                                  if (
                                                    perfume.imageUrl &&
                                                    !perfume.imageUrl.includes(
                                                      "unsplash.com"
                                                    )
                                                  ) {
                                                    imageSrc = perfume.imageUrl;
                                                  } else if (perfume.uri) {
                                                    imageSrc = perfume.uri;
                                                  } else if (perfume.imageUrl) {
                                                    imageSrc = perfume.imageUrl;
                                                  }

                                                  if (
                                                    imageSrc &&
                                                    imageSrc.trim() !== ""
                                                  ) {
                                                    return `<img src="${imageSrc}" 
                                                     alt="${perfume.perfumeName}" 
                                                                 class="w-full h-full object-cover rounded"
                                                                 onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                                                                <div class="w-12 h-12 bg-gray-100 flex items-center justify-center text-gray-500 text-xs rounded" style="display: none;">
                                                                    <span>No img</span>
                                                                </div>`;
                                                  } else {
                                                    return `<div class="w-12 h-12 bg-gray-100 flex items-center justify-center text-gray-500 text-xs rounded">
                                                                    <span>No img</span>
                                                                </div>`;
                                                  }
                                                })()}
                                            </div>
                                        </div>
                                    </td>
                                    <td class="font-semibold">${
                                      perfume.perfumeName
                                    }</td>
                                    <td class="${
                                      perfume.brand?.isDeleted
                                        ? "opacity-60 text-red-600"
                                        : ""
                                    }">
                                        ${
                                          perfume.brand
                                            ? perfume.brand.brandName
                                            : "Unknown"
                                        }${
                                  perfume.brand?.isDeleted ? " (Deleted)" : ""
                                }
                                    </td>
                                    <td>
                                        <span class="badge badge-soft">$${
                                          perfume.price
                                        }</span>
                                    </td>
                                    <td>
                                        <div class="badge ${
                                          perfume.targetAudience === "male"
                                            ? "badge-primary"
                                            : perfume.targetAudience ===
                                              "female"
                                            ? "badge-secondary"
                                            : "badge-accent"
                                        }">
                                            ${perfume.targetAudience}
                                        </div>
                                    </td>
                                    <td>
                                        <div class="flex gap-2">
                                            <button class="btn btn-outline btn-secondary btn-sm" onclick="editPerfume('${
                                              perfume._id
                                            }')">
                                                <i class="fas fa-edit mr-1"></i>
                                                Edit
                                            </button>
                                            <button class="btn btn-outline btn-error btn-sm" onclick="deletePerfume('${
                                              perfume._id
                                            }')">
                                                <i class="fas fa-trash mr-1"></i>
                                                Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            `
                              )
                              .join("")}
                        </tbody>
                    </table>
                </div>
            `;
    }
  } catch (error) {
    console.error("Error loading perfumes:", error);
  }
}

function filterBrands(filter) {
  if (!allAdminBrands || allAdminBrands.length === 0) {
    console.log("No brands loaded for filtering");
    return;
  }

  let filteredBrands = allAdminBrands;

  switch (filter) {
    case "active":
      filteredBrands = allAdminBrands.filter(
        (brand) => !brand.isDeleted && !brand.deletedAt
      );
      break;
    case "deleted":
      filteredBrands = allAdminBrands.filter(
        (brand) => brand.isDeleted || brand.deletedAt
      );
      break;
    case "all":
    default:
      filteredBrands = allAdminBrands;
      break;
  }

  // Re-render table with filtered brands
  renderBrandsTable(filteredBrands);
}

function renderBrandsTable(brands) {
  const activeBrands = brands.filter(
    (brand) => !brand.isDeleted && !brand.deletedAt
  );
  const deletedBrands = brands.filter(
    (brand) => brand.isDeleted || brand.deletedAt
  );

  const table = document.getElementById("brandsTable");
  if (!table) {
    console.error("brandsTable element not found");
    return;
  }

  table.innerHTML = `
        <div class="mb-4 p-4 bg-gray-50 rounded-lg">
            <div class="flex justify-between items-center">
                <h3 class="text-lg font-semibold">Brand Statistics</h3>
                <div class="flex gap-4">
                    <span class="badge badge-success">Active: ${
                      activeBrands.length
                    }</span>
                    <span class="badge badge-error">Deleted: ${
                      deletedBrands.length
                    }</span>
                    <span class="badge badge-info">Total: ${
                      brands.length
                    }</span>
                </div>
            </div>
            <div class="mt-3 flex gap-2">
                <button class="btn btn-sm btn-outline" onclick="filterBrands('all')">All Brands</button>
                <button class="btn btn-sm btn-outline btn-success" onclick="filterBrands('active')">Active Only</button>
                <button class="btn btn-sm btn-outline btn-error" onclick="filterBrands('deleted')">Deleted Only</button>
            </div>
        </div>
        <div class="overflow-x-auto">
            <table class="table table-zebra w-full">
                <thead>
                    <tr>
                        <th>Brand Name</th>
                        <th>Status</th>
                        <th>Created</th>
                        <th>Deleted</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${brands
                      .map((brand) => {
                        // Check if brand is deleted (either isDeleted flag or has deletedAt date)
                        const isDeleted = brand.isDeleted || brand.deletedAt;
                        const statusBadge = isDeleted
                          ? '<span class="badge badge-error">Deleted</span>'
                          : '<span class="badge badge-success">Active</span>';
                        const deletedDate = brand.deletedAt
                          ? new Date(brand.deletedAt).toLocaleDateString()
                          : "-";
                        const valueButton = isDeleted
                          ? `<button class="btn btn-success btn-sm" onclick="restoreBrand('${brand._id}')">
                                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                                </svg>
                                Value
                               </button>`
                          : `<button class="btn btn-error btn-sm" onclick="deleteBrand('${brand._id}')">
                                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                                </svg>
                                Unvalue
                               </button>`;

                        return `
                            <tr class="${
                              isDeleted ? "opacity-60 bg-red-50" : ""
                            }">
                                <td class="font-semibold ${
                                  isDeleted ? "text-red-600" : ""
                                }">${brand.brandName}</td>
                                <td>${statusBadge}</td>
                                <td>${new Date(
                                  brand.createdAt
                                ).toLocaleDateString()}</td>
                                <td>${deletedDate}</td>
                                        <td>
                                            <div class="flex gap-2">
                                                ${valueButton}
                                                ${
                                                  !isDeleted
                                                    ? `<button class="btn btn-info btn-sm" onclick="editBrandName('${brand._id}', '${brand.brandName}')">
                                                    <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                                                    </svg>
                                                    Edit
                                                </button>`
                                                    : ""
                                                }
                                            </div>
                                        </td>
                            </tr>
                        `;
                      })
                      .join("")}
                </tbody>
            </table>
        </div>
    `;
}

async function deleteBrand(id) {
  if (!confirm("Are you sure you want to unvalue this brand?")) return;

  try {
    const response = await fetch(`${API_URL}/brands/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${safeGetFromStorage("token")}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      if (data.softDeleted) {
        showNotification(
          `Brand unvalued (has ${data.productCount} products)`,
          "warning"
        );
      } else {
        showNotification("Brand permanently unvalued (no products)", "success");
      }
      loadAdminBrands();
      loadBrands(); // Refresh brand filters
    } else {
      const errorData = await response.json();
      showNotification(errorData.message || "Failed to unvalue brand", "error");
    }
  } catch (error) {
    console.error("Error unvaluing brand:", error);
    showNotification("Error unvaluing brand", "error");
  }
}

async function restoreBrand(id) {
  if (!confirm("Are you sure you want to value this brand?")) return;

  try {
    console.log("Restoring brand with ID:", id);

    // First, let's check the brand data
    const checkResponse = await fetch(`${API_URL}/brands/${id}`, {
      headers: {
        Authorization: `Bearer ${safeGetFromStorage("token")}`,
      },
    });

    if (checkResponse.ok) {
      const brandData = await checkResponse.json();
      console.log("Brand data before restore:", brandData);
    } else {
      console.log("Failed to fetch brand data:", checkResponse.status);
    }

    const response = await fetch(`${API_URL}/brands/${id}/restore`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${safeGetFromStorage("token")}`,
      },
    });

    console.log("Restore response status:", response.status);

    if (response.ok) {
      const data = await response.json();
      console.log("Restore success:", data);
      showNotification("Brand valued successfully!", "success");
      loadAdminBrands();
      loadBrands(); // Refresh brand filters
    } else {
      const errorData = await response.json();
      console.log("Restore error:", errorData);
      showNotification(errorData.message || "Failed to value brand", "error");
    }
  } catch (error) {
    console.error("Error valuing brand:", error);
    showNotification("Error valuing brand", "error");
  }
}

// Global variable to store current brand being edited
let currentEditingBrandId = null;

async function editBrandName(id, currentName) {
  currentEditingBrandId = id;

  // Set the current name in the input field
  document.getElementById("editBrandName").value = currentName;

  // Show the modal
  const modal = document.getElementById("editBrandModal");
  if (modal) {
    modal.showModal();
  }
}

function closeEditBrandModal() {
  const modal = document.getElementById("editBrandModal");
  if (modal) {
    modal.close();
  }
  currentEditingBrandId = null;
}

async function updateBrandFromModal(event) {
  event.preventDefault();

  if (!currentEditingBrandId) {
    showNotification("No brand selected for editing", "error");
    return;
  }

  const formData = new FormData(event.target);
  const newName = formData.get("brandName").trim();

  if (newName === "") {
    showNotification("Brand name cannot be empty", "error");
    return;
  }

  try {
    const response = await fetch(`${API_URL}/brands/${currentEditingBrandId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${safeGetFromStorage("token")}`,
      },
      body: JSON.stringify({ brandName: newName }),
    });

    if (response.ok) {
      showNotification("Brand updated successfully!", "success");
      closeEditBrandModal();
      loadAdminBrands();
      loadBrands(); // Refresh brand filters
    } else {
      const errorData = await response.json();
      showNotification(errorData.message || "Failed to update brand", "error");
    }
  } catch (error) {
    console.error("Error updating brand:", error);
    showNotification("Error updating brand", "error");
  }
}

async function deletePerfume(id) {
  if (!confirm("Are you sure you want to delete this perfume?")) return;

  try {
    const response = await fetch(`${API_URL}/perfumes/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${safeGetFromStorage("token")}`,
      },
    });

    if (response.ok) {
      showNotification("Perfume deleted successfully", "success");
      loadAdminPerfumes();
    } else {
      showNotification("Failed to delete perfume", "error");
    }
  } catch (error) {
    console.error("Error deleting perfume:", error);
  }
}

function showBrandForm() {
  const modal = document.getElementById("brandModal");
  if (modal) {
    modal.showModal();
  }
}

async function showPerfumeForm() {
  console.log("Opening perfume form...");

  // Ensure brands are loaded first
  if (!allBrands || allBrands.length === 0) {
    console.log("Brands not loaded, loading now...");
    await loadBrands();
  } else {
    console.log("Brands already loaded:", allBrands.length);
    // Force update the dropdown even if brands are already loaded
    updateBrandFilters();
  }

  // Clear form for new perfume
  document.getElementById("perfumeForm").reset();
  document.getElementById("perfumeForm").dataset.mode = "add";
  document.getElementById("perfumeForm").dataset.perfumeId = "";

  // Update modal title
  const modalTitle = document.querySelector("#perfumeFormModal h3");
  if (modalTitle) {
    modalTitle.textContent = "Add New Perfume";
  }

  // Reset preview
  updatePreview();

  const modal = document.getElementById("perfumeFormModal");
  if (modal) {
    modal.showModal();
  }
}

async function editPerfume(perfumeId) {
  try {
    // Ensure brands are loaded first
    if (!allBrands || allBrands.length === 0) {
      await loadBrands();
    }

    // Fetch the perfume data
    const response = await fetch(`${API_URL}/perfumes/${perfumeId}`, {
      headers: {
        Authorization: `Bearer ${safeGetFromStorage("token")}`,
      },
    });

    if (response.ok) {
      const perfume = await response.json();

      // Populate the form with existing data
      const setValue = (id, value) => {
        const element = document.getElementById(id);
        if (element) element.value = value || "";
      };

      setValue("perfumeName", perfume.perfumeName);
      setValue("perfumePrice", perfume.price);
      setValue("perfumeVolume", perfume.volume);
      setValue("perfumeConcentration", perfume.concentration);
      setValue("perfumeTarget", perfume.targetAudience);
      setValue("perfumeDescription", perfume.description);
      setValue("perfumeIngredients", perfume.ingredients);
      setValue("perfumeUri", perfume.uri);
      setValue("perfumeImageUrl", perfume.imageUrl);

      // Set brand value after ensuring dropdown is populated
      setTimeout(() => {
        setValue("perfumeBrand", perfume.brand?._id);
      }, 100);

      // Update live preview if present
      setTimeout(() => {
        updatePreview();
      }, 150);

      // Set the form to edit mode
      document.getElementById("perfumeForm").dataset.mode = "edit";
      document.getElementById("perfumeForm").dataset.perfumeId = perfumeId;

      // Update the modal title
      const modalTitle = document.querySelector("#perfumeFormModal h3");
      if (modalTitle) {
        modalTitle.textContent = "Edit Perfume";
      }

      // Show the modal
      const modal = document.getElementById("perfumeFormModal");
      if (modal) {
        modal.showModal();
      }
    } else {
      showNotification("Failed to load perfume data", "error");
    }
  } catch (error) {
    console.error("Error loading perfume for edit:", error);
    showNotification("Error loading perfume data", "error");
  }
}

// Profile functions
async function loadProfileData() {
  try {
    if (!currentUser) {
      console.error("No current user found");
      return;
    }

    // Load user profile data
    const response = await fetch(`${API_URL}/members/me`, {
      headers: {
        Authorization: `Bearer ${safeGetFromStorage("token")}`,
      },
    });

    if (response.ok) {
      const responseData = await response.json();

      // Extract user data from response (API returns {member: {...}})
      const userData = responseData.member || responseData;

      // Populate profile form
      const nameInput = document.getElementById("profileName");
      const yobInput = document.getElementById("profileYOB");
      const genderSelect = document.getElementById("profileGender");
      const memberSinceSpan = document.getElementById("memberSince");
      const reviewCountSpan = document.getElementById("reviewCount");
      const avgRatingSpan = document.getElementById("avgRating");

      // Debug log to see user data
      console.log("User data from API in loadProfileData:", userData);
      console.log("YOB field:", userData.YOB, "yob field:", userData.yob);

      if (nameInput) nameInput.value = userData.name || "";
      if (yobInput) yobInput.value = userData.YOB || userData.yob || "";
      if (genderSelect) genderSelect.value = userData.gender ? "true" : "false";

      // Update statistics
      if (userData.createdAt) {
        const memberSince = new Date(userData.createdAt).getFullYear();
        if (memberSinceSpan) memberSinceSpan.textContent = memberSince;
      }

      // For now, set default values for reviews (can be enhanced later)
      if (reviewCountSpan) reviewCountSpan.textContent = "0";
      if (avgRatingSpan) avgRatingSpan.textContent = "-";
    } else {
      console.error(
        "Failed to load profile data:",
        response.status,
        response.statusText
      );
    }
  } catch (error) {
    console.error("Error loading profile data:", error);
  }
}

// Admin Profile functions
async function loadAdminProfile() {
  try {
    if (!currentUser) {
      console.error("No current user found");
      return;
    }

    // Load user profile data
    const response = await fetch(`${API_URL}/members/me`, {
      headers: {
        Authorization: `Bearer ${safeGetFromStorage("token")}`,
      },
    });

    if (response.ok) {
      const responseData = await response.json();

      // Extract user data from response (API returns {member: {...}})
      const userData = responseData.member || responseData;

      // Debug log to see user data structure
      console.log("User data from API:", userData);
      console.log("YOB field:", userData.YOB, "yob field:", userData.yob);

      // Populate profile form
      document.getElementById("profileName").value = userData.name || "";
      document.getElementById("profileYOB").value =
        userData.YOB || userData.yob || "";
      document.getElementById("profileGender").value =
        userData.gender || "true";

      // Update statistics
      const memberSince = new Date(userData.createdAt).getFullYear();
      document.getElementById("memberSince").textContent = memberSince;

      // For now, set default values for reviews (can be enhanced later)
      document.getElementById("reviewCount").textContent = "0";
      document.getElementById("avgRating").textContent = "-";
    }
  } catch (error) {
    console.error("Error loading admin profile:", error);
  }
}

function closeModal() {
  const modals = document.querySelectorAll(".modal");
  modals.forEach((modal) => {
    if (modal.showModal) {
      modal.close();
    } else {
      modal.style.display = "none";
    }
  });
}
