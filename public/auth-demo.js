// Global state
let provider = null;
let signer = null;
let userAddress = null;
let isAuthenticated = false;
let userId = null;
let currentNonce = null;

// Initialize when page loads
document.addEventListener("DOMContentLoaded", function () {
  // Delay initialization to ensure libraries are loaded
  setTimeout(() => {
    checkMetaMaskAvailability();
    loadStoredAuth();
  }, 500);
});

// Also check when window loads (fallback)
window.addEventListener("load", function () {
  setTimeout(() => {
    if (typeof SiweMessage !== "undefined") {
      console.log("✅ SIWE library confirmed loaded");
      document.getElementById("siweWarning").style.display = "none";
      document.getElementById("generateNonce").disabled = false;
      document.getElementById("fullAuth").disabled = false;

      // Re-run availability check to update UI
      checkMetaMaskAvailability();
    }
  }, 1000);
});

// Check if MetaMask is available
function checkMetaMaskAvailability() {
  if (typeof window.ethereum !== "undefined") {
    logActivity("✅ MetaMask detected", "success");
    document.getElementById("metamaskWarning").style.display = "none";

    // Listen for account changes
    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);
  } else {
    logActivity("❌ MetaMask not found", "error");
    document.getElementById("connectWallet").disabled = true;
  }

  // Check if SIWE library is loaded
  if (typeof SiweMessage === "undefined") {
    logActivity("❌ SIWE library not loaded", "error");
    document.getElementById("siweWarning").style.display = "block";
    document.getElementById("generateNonce").disabled = true;
    document.getElementById("fullAuth").disabled = true;
  } else {
    logActivity("✅ SIWE library loaded", "success");
    document.getElementById("siweWarning").style.display = "none";
  }
}

// Check for existing authentication (httpOnly cookies)
function loadStoredAuth() {
  // Since tokens are in httpOnly cookies, we'll verify by making a test API call
  checkAuthenticationStatus();
}

// Connect to MetaMask wallet
async function connectWallet() {
  try {
    logActivity("🔗 Connecting to MetaMask...", "info");

    if (!window.ethereum) {
      throw new Error("MetaMask not found");
    }

    // Request account access
    provider = new ethers.providers.Web3Provider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    signer = provider.getSigner();
    userAddress = await signer.getAddress();

    // Get network info
    const network = await provider.getNetwork();

    // Update UI
    updateConnectionStatus(true);
    document.getElementById(
      "walletAddress"
    ).textContent = `Address: ${userAddress}`;
    document.getElementById(
      "walletChain"
    ).textContent = `Chain: ${network.name} (${network.chainId})`;
    document.getElementById("walletInfo").classList.remove("hidden");

    // Enable auth buttons
    enableAuthButtons();

    logActivity(`✅ Connected to ${userAddress} on ${network.name}`, "success");
  } catch (error) {
    logActivity(`❌ Connection failed: ${error.message}`, "error");
    console.error("Connection error:", error);
  }
}

// Generate nonce from backend
async function generateNonce() {
  try {
    if (!userAddress) {
      throw new Error("Wallet not connected");
    }

    logActivity("🎲 Requesting nonce from backend...", "info");

    // Prepare SIWE message data
    const network = await provider.getNetwork();
    const siweMessageData = {
      domain: window.location.host,
      address: userAddress,
      statement: "Sign in to Head Ball Arena",
      uri: window.location.origin,
      version: "1",
      chainId: network.chainId,
      issuedAt: new Date().toISOString(),
    };

    logActivity(
      `📝 SIWE data: ${JSON.stringify(siweMessageData, null, 2)}`,
      "info"
    );

    // Request nonce from backend
    const response = await fetch("/api/auth/nonce", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include", // REQUIRED for cross-origin cookies (Next.js -> Backend)
      body: JSON.stringify(siweMessageData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `HTTP ${response.status}`);
    }

    currentNonce = await response.text();

    // Display nonce
    document.getElementById("nonceData").textContent = currentNonce;
    document.getElementById("nonceResponse").classList.remove("hidden");

    // Enable sign button
    document.getElementById("signMessage").disabled = false;

    logActivity(`✅ Nonce received: ${currentNonce}`, "success");

    return currentNonce;
  } catch (error) {
    logActivity(`❌ Nonce generation failed: ${error.message}`, "error");
    console.error("Nonce error:", error);
    throw error;
  }
}

// Sign message and verify with backend
async function signAndVerify() {
  try {
    if (!currentNonce) {
      throw new Error("No nonce available. Generate nonce first.");
    }

    if (typeof SiweMessage === "undefined") {
      throw new Error("SIWE library not loaded. Please refresh the page.");
    }

    logActivity("✍️ Creating SIWE message for signing...", "info");

    // Create complete SIWE message
    const network = await provider.getNetwork();
    const siweMessage = new SiweMessage({
      domain: window.location.host,
      address: userAddress,
      statement: "Sign in to Head Ball Arena",
      uri: window.location.origin,
      version: "1",
      chainId: network.chainId,
      nonce: currentNonce,
      issuedAt: new Date().toISOString(),
    });

    const messageToSign = siweMessage.prepareMessage();
    logActivity(`📄 Message to sign:\n${messageToSign}`, "info");

    // Sign message
    logActivity("✍️ Requesting signature from wallet...", "info");
    const signature = await signer.signMessage(messageToSign);

    logActivity(
      `✅ Message signed: ${signature.substring(0, 20)}...`,
      "success"
    );

    // Verify with backend
    logActivity("🔍 Verifying signature with backend...", "info");

    const verifyResponse = await fetch("/api/auth/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include", // REQUIRED for cross-origin cookies (Next.js -> Backend)
      body: JSON.stringify({
        message: messageToSign,
        signature: signature,
      }),
    });

    const authResult = await verifyResponse.json();

    if (!authResult.success) {
      throw new Error(authResult.message || "Verification failed");
    }

    // Store authentication data (token is in httpOnly cookie)
    isAuthenticated = true;
    userId = authResult.data.user.id;
    userAddress = authResult.data.address;

    // Display auth response
    document.getElementById("authData").textContent = JSON.stringify(
      authResult,
      null,
      2
    );
    document.getElementById("authResponse").classList.remove("hidden");

    // Update UI
    updateAuthStatus(true);
    enableProtectedAPIButtons();

    logActivity(`🎉 Authentication successful!`, "success");
    logActivity(`👤 User ID: ${userId}`, "success");
    logActivity(`🔒 Token stored in secure httpOnly cookie`, "info");
    logActivity(`🆕 New user: ${authResult.data.user.isNewUser}`, "info");

    return authResult;
  } catch (error) {
    logActivity(`❌ Authentication failed: ${error.message}`, "error");
    console.error("Auth error:", error);
    throw error;
  }
}

// Complete authentication flow (nonce + sign + verify)
async function fullAuthFlow() {
  try {
    logActivity("🚀 Starting complete authentication flow...", "info");

    // Step 1: Generate nonce
    await generateNonce();

    // Small delay for better UX
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Step 2: Sign and verify
    await signAndVerify();

    logActivity("🎊 Complete authentication flow finished!", "success");
  } catch (error) {
    logActivity(`💥 Authentication flow failed: ${error.message}`, "error");
  }
}

// Test protected API endpoints
async function testProtectedAPI() {
  try {
    if (!isAuthenticated) {
      throw new Error("Not authenticated. Complete authentication first.");
    }

    const selectedEndpoint = document.getElementById("testEndpoint").value;
    logActivity(`🛡️ Testing protected endpoint: ${selectedEndpoint}`, "info");

    // Replace placeholders in endpoint
    let endpoint = selectedEndpoint;

    if (endpoint.includes("{userId}")) {
      if (!userId) {
        logActivity(
          "⚠️ No userId available, using placeholder for demo",
          "info"
        );
        endpoint = endpoint.replace("{userId}", "current");
      } else {
        endpoint = endpoint.replace("{userId}", userId);
      }
    }

    if (endpoint.includes("{walletAddress}")) {
      if (!userAddress) {
        logActivity("⚠️ No wallet address available", "error");
        throw new Error("Wallet address not available");
      }
      endpoint = endpoint.replace("{walletAddress}", userAddress);
    }

    logActivity(`📡 Making request to: ${endpoint}`, "info");

    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include", // Include cookies for authentication
    });

    const responseData = await response.json();

    // Display API response
    document.getElementById("apiData").textContent = JSON.stringify(
      responseData,
      null,
      2
    );
    document.getElementById("apiResponse").classList.remove("hidden");

    if (response.ok) {
      logActivity(`✅ API call successful (${response.status})`, "success");
    } else {
      logActivity(
        `⚠️ API call returned ${response.status}: ${responseData.message}`,
        "error"
      );

      // If unauthorized, update auth status
      if (response.status === 401 || response.status === 403) {
        updateAuthStatus(false);
        isAuthenticated = false;
      }
    }

    return responseData;
  } catch (error) {
    logActivity(`❌ API test failed: ${error.message}`, "error");
    console.error("API test error:", error);
  }
}

// Event handlers for wallet changes
function handleAccountsChanged(accounts) {
  if (accounts.length === 0) {
    logActivity("🔌 Wallet disconnected", "info");
    resetConnection();
  } else if (accounts[0] !== userAddress) {
    logActivity(`🔄 Account changed to ${accounts[0]}`, "info");
    resetConnection();
    // Auto-reconnect with new account
    setTimeout(connectWallet, 1000);
  }
}

function handleChainChanged(chainId) {
  logActivity(`⛓️ Chain changed to ${chainId}`, "info");
  // Reload to ensure clean state
  window.location.reload();
}

// UI update functions
function updateConnectionStatus(connected) {
  const statusElement = document.getElementById("connectionStatus");
  const connectButton = document.getElementById("connectWallet");

  if (connected) {
    statusElement.textContent = "Connected";
    statusElement.className = "status connected";
    connectButton.textContent = "Disconnect";
    connectButton.onclick = disconnect;
  } else {
    statusElement.textContent = "Disconnected";
    statusElement.className = "status disconnected";
    connectButton.textContent = "Connect MetaMask";
    connectButton.onclick = connectWallet;
  }
}

function updateAuthStatus(authenticated) {
  const statusElement = document.getElementById("authStatus");
  const testButton = document.getElementById("testProtectedAPI");
  const logoutButton = document.getElementById("logout");

  if (authenticated) {
    statusElement.textContent = "Authenticated";
    statusElement.className = "status authenticated";
    testButton.disabled = false;
    logoutButton.disabled = false;
  } else {
    statusElement.textContent = "Not Authenticated";
    statusElement.className = "status disconnected";
    testButton.disabled = true;
    logoutButton.disabled = true;
  }
}

function enableAuthButtons() {
  document.getElementById("generateNonce").disabled = false;
  document.getElementById("fullAuth").disabled = false;
}

function enableProtectedAPIButtons() {
  document.getElementById("testProtectedAPI").disabled = false;
}

function resetConnection() {
  provider = null;
  signer = null;
  userAddress = null;
  currentNonce = null;
  isAuthenticated = false;
  userId = null;

  updateConnectionStatus(false);
  updateAuthStatus(false);

  document.getElementById("walletInfo").classList.add("hidden");
  document.getElementById("generateNonce").disabled = true;
  document.getElementById("signMessage").disabled = true;
  document.getElementById("fullAuth").disabled = true;
  document.getElementById("testProtectedAPI").disabled = true;
  document.getElementById("logout").disabled = true;
}

function disconnect() {
  logActivity("👋 Disconnecting wallet...", "info");

  // Call logout endpoint to clear httpOnly cookie
  logout();

  resetConnection();

  logActivity("✅ Disconnected successfully", "success");
}

// Utility functions
function logActivity(message, type = "info") {
  const log = document.getElementById("activityLog");
  const entry = document.createElement("div");
  entry.className = `log-entry ${type}`;
  entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;

  log.appendChild(entry);
  log.scrollTop = log.scrollHeight;

  console.log(`[${type.toUpperCase()}] ${message}`);
}

function clearLog() {
  const log = document.getElementById("activityLog");
  log.innerHTML = '<div class="log-entry info">Log cleared...</div>';
}

// Check authentication status by making a test API call
async function checkAuthenticationStatus() {
  try {
    logActivity("🔍 Checking authentication status...", "info");

    // Try to access a protected endpoint to verify authentication
    // We'll use a dummy userId first to check if we get a proper auth error vs 404
    const response = await fetch("/api/users/profile/test", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include", // Include cookies
    });

    if (response.status === 404) {
      // 404 means we're authenticated but user not found, which is fine for status check
      isAuthenticated = true;
      updateAuthStatus(true);
      enableProtectedAPIButtons();
      logActivity("🔄 Active session found (authenticated)", "success");
    } else if (response.status === 401 || response.status === 403) {
      // Unauthorized means no valid session
      logActivity("ℹ️ No active session found", "info");
    } else if (response.ok) {
      // This shouldn't happen with test ID, but handle it
      isAuthenticated = true;
      updateAuthStatus(true);
      enableProtectedAPIButtons();
      logActivity("🔄 Active session found", "success");
    } else {
      logActivity("ℹ️ No active session found", "info");
    }
  } catch (error) {
    logActivity("ℹ️ No active session found", "info");
  }
}

// Logout function to clear authentication
async function logout() {
  try {
    logActivity("👋 Logging out...", "info");

    const response = await fetch("/api/auth/logout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include", // Include cookies
    });

    if (response.ok) {
      logActivity("✅ Logged out successfully", "success");
    } else {
      logActivity("⚠️ Logout request failed, but continuing...", "info");
    }

    // Reset authentication state regardless of response
    isAuthenticated = false;
    userId = null;
    updateAuthStatus(false);
  } catch (error) {
    logActivity("⚠️ Logout request failed, but clearing local state", "info");
    isAuthenticated = false;
    userId = null;
    updateAuthStatus(false);
  }
}

// Force reload SIWE library
function reloadSiweLibrary() {
  logActivity("🔄 Attempting to reload SIWE library...", "info");

  const script = document.createElement("script");
  script.src = "https://cdn.jsdelivr.net/npm/siwe@2.3.2/dist/siwe.min.js";
  script.onload = function () {
    logActivity("✅ SIWE library reloaded successfully", "success");
    document.getElementById("siweWarning").style.display = "none";
    document.getElementById("generateNonce").disabled = false;
    document.getElementById("fullAuth").disabled = false;
    checkMetaMaskAvailability();
  };
  script.onerror = function () {
    logActivity("❌ CDN failed, trying fallback implementation...", "error");
    if (typeof createFallbackSiweMessage === "function") {
      createFallbackSiweMessage();
      logActivity("✅ Using fallback SIWE implementation", "success");
      document.getElementById("siweWarning").style.display = "none";

      // Show fallback info instead
      const fallbackInfo = document.getElementById("fallbackInfo");
      if (fallbackInfo) {
        fallbackInfo.style.display = "block";
      }

      document.getElementById("generateNonce").disabled = false;
      document.getElementById("fullAuth").disabled = false;
      checkMetaMaskAvailability();
    } else {
      logActivity("❌ Fallback implementation not available", "error");
    }
  };
  document.head.appendChild(script);
}

// Check library status
function checkLibraryStatus() {
  const status = {
    ethers: typeof ethers !== "undefined",
    SiweMessage: typeof SiweMessage !== "undefined",
    ethereum: typeof window.ethereum !== "undefined",
    fallback: typeof createFallbackSiweMessage !== "undefined",
  };

  logActivity(`📊 Library Status: ${JSON.stringify(status, null, 2)}`, "info");

  // Test SIWE message creation if available
  if (typeof SiweMessage !== "undefined") {
    try {
      const testMessage = new SiweMessage({
        domain: "test.com",
        address: "0x1234567890123456789012345678901234567890",
        statement: "Test statement",
        uri: "https://test.com",
        version: "1",
        chainId: 1,
        nonce: "testnonce123",
        issuedAt: new Date().toISOString(),
      });

      const formatted = testMessage.prepareMessage();
      logActivity(`✅ SIWE message test successful`, "success");
      console.log("Test SIWE message:", formatted.substring(0, 100) + "...");
    } catch (error) {
      logActivity(`❌ SIWE message test failed: ${error.message}`, "error");
    }
  }

  return status;
}

// Export functions for testing in console
window.authDemo = {
  connectWallet,
  generateNonce,
  signAndVerify,
  fullAuthFlow,
  testProtectedAPI,
  disconnect,
  clearLog,
  reloadSiweLibrary,
  checkLibraryStatus,

  // Getters for current state
  get provider() {
    return provider;
  },
  get signer() {
    return signer;
  },
  get userAddress() {
    return userAddress;
  },
  get authToken() {
    return authToken;
  },
  get userId() {
    return userId;
  },
  get currentNonce() {
    return currentNonce;
  },
};
