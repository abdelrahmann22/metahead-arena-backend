# 🏈 Head Ball Arena - Demo Instructions

## 🚀 Quick Start

1. **Start the server:**

   ```bash
   npm run dev
   ```

2. **Open your browser and navigate to:**
   - Main demo: `http://localhost:3000`
   - Auth demo: `http://localhost:3000/auth-demo.html`

## 🔐 Authentication Demo

### Prerequisites

- MetaMask browser extension installed
- Some ETH in your wallet (for transaction signing, not required for this demo)

### Testing Steps

#### 1. **Connect Wallet**

- Click "Connect MetaMask"
- Approve the connection in MetaMask popup
- Verify wallet address appears in the UI

#### 2. **Test SIWE Authentication**

- Option A: Click "Complete Auth Flow" for automatic testing
- Option B: Manual testing:
  1. Click "Get Nonce" - receives nonce from backend
  2. Click "Sign & Verify" - signs message and verifies with backend

#### 3. **Test Protected APIs**

- After successful authentication, test protected endpoints:
  - Get User Profile
  - Get Match History
  - Get User Chests
- View responses in the API Response section

### Expected Flow

```
1. Connect Wallet → Wallet address displayed
2. Get Nonce → Nonce appears in response box
3. Sign Message → MetaMask popup for signature
4. Verify → JWT token returned, user authenticated
5. Test API → Protected endpoints accessible with JWT
```

### Activity Log

- Monitor all authentication steps in real-time
- Color-coded messages (success=green, error=red, info=blue)
- Timestamps for debugging

## 🎮 Game Demo

### Features

- Real-time multiplayer gameplay
- Room creation and joining
- WebSocket communication testing
- Complete game event monitoring

### Testing

1. Open multiple browser tabs
2. Connect different wallet addresses
3. Create/join rooms
4. Test real-time game mechanics

## 🔧 Troubleshooting

### Common Issues

**MetaMask Not Detected:**

- Install MetaMask browser extension
- Refresh the page after installation

**Network Issues:**

- Ensure you're on a supported network (Ethereum mainnet/testnets)
- Check MetaMask network settings

**SIWE Library Issues:**

- If you see "SIWE library not loaded" error, click "🔄 Reload SIWE Library" button
- The demo includes a fallback SIWE implementation if CDN fails
- Try refreshing the page if library loading issues persist
- Use browser console command: `authDemo.checkLibraryStatus()` to debug

**Authentication Fails:**

- Clear browser localStorage
- Disconnect and reconnect wallet
- Check JWT_SECRET environment variable is set

**API Calls Fail:**

- Verify authentication completed successfully
- Check backend server is running
- Inspect network tab for error details

### Environment Variables

Make sure these are set in your `.env` file:

```
JWT_SECRET=your-secret-key-here
MONGODB_URI=your-mongodb-connection-string
PORT=3000
```

## 📊 API Endpoints Being Tested

### Authentication Endpoints

- `POST /api/auth/nonce` - Generate SIWE nonce
- `POST /api/auth/verify` - Verify signature and get JWT

### Protected Endpoints

- `GET /api/users/profile/{userId}` - Get user profile (requires JWT)
- `GET /api/matches/user/{userId}/history` - Get match history (requires JWT)
- `GET /api/chests/{walletAddress}` - Get user chests (requires JWT)

## 🎯 Success Criteria

✅ **Authentication Working:**

- Wallet connects successfully
- Nonce generation works
- Message signing completes
- JWT token received
- User data returned

✅ **Protected APIs Working:**

- JWT token accepted
- User-specific data returned
- Proper error handling for invalid tokens

✅ **Security Features:**

- Rate limiting active (max 10 requests per 15 minutes)
- Nonce expiration (5 minutes)
- JWT expiration (24 hours)
- Address validation
- Domain validation

This demo validates that your SIWE + JWT authentication system is production-ready! 🎉
