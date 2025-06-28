# Socket.IO Integration Prompts for Cursor Agent

## Overview

These are step-by-step prompts for implementing Socket.IO client integration with the MetaHead Arena headball game server in a Next.js project.

---

# PART A: WEB3 AUTHENTICATION SYSTEM

## Auth Prompt 1: Set Up Web3 Authentication Infrastructure

```
Create a Web3 authentication system for a Next.js project that uses SIWE (Sign-In with Ethereum). Follow these steps:

1. Install required dependencies:
   - siwe (Sign-In with Ethereum)
   - ethers (Ethereum library)
   - js-cookie (for cookie management)
   - @types/js-cookie (TypeScript types)

2. Create an auth context at `contexts/AuthContext.tsx` with:
   - User state (user object with walletAddress or null)
   - Loading state (boolean)
   - Connect wallet function
   - Sign in function (SIWE flow)
   - Logout function

3. Create types at `types/auth.ts`:
   - User interface (walletAddress, id, gameStats)
   - SiweConfig interface
   - AuthResponse interface

4. Set up API endpoints configuration:
   - Base API URL from environment variable (defaults to http://localhost:3000/api)
   - Auth endpoints: /api/auth/nonce, /api/auth/verify, /api/auth/logout
   - User endpoints: /api/users/wallet/{address}, /api/users/profile/{id}

The context should manage JWT tokens stored in httpOnly cookies and handle Web3 wallet connections.
```

---

## Auth Prompt 1 Alternative: Set Up Wagmi Web3 Authentication Infrastructure

```
Create a Web3 authentication system using Wagmi for a Next.js project with SIWE. Follow these steps:

1. Install required dependencies:
   - wagmi (React hooks for Ethereum)
   - @wagmi/core (Core Wagmi functionality)
   - viem (TypeScript Interface for Ethereum)
   - siwe (Sign-In with Ethereum)
   - @rainbow-me/rainbowkit (Optional: for pre-built wallet UI)
   - js-cookie (for cookie management)

2. Create Wagmi configuration at `lib/wagmi.ts`:
   - Configure supported chains (avlanche, sepolia, etc.)
   - Set up wallet connectors (MetaMask, WalletConnect, Coinbase, etc.)
   - Configure public client with RPC providers
   - Export wagmiConfig for app-wide usage

3. Create types at `types/auth.ts`:
   - User interface (walletAddress, id, gameStats)
   - SiweConfig interface
   - AuthResponse interface
   - WagmiAuthState interface

4. Set up API endpoints configuration:
   - Base API URL from environment variable
   - Auth endpoints: /api/auth/nonce, /api/auth/verify, /api/auth/logout
   - User endpoints: /api/users/wallet/{address}, /api/users/profile/{id}

5. Create auth context at `contexts/AuthContext.tsx` that integrates with Wagmi:
   - Use Wagmi hooks internally (useAccount, useSignMessage, etc.)
   - Manage authentication state separately from wallet connection
   - Handle SIWE flow with Wagmi's signing capabilities
   - Sync with Wagmi's account changes automatically
```

---

## Auth Prompt 2: Implement Web3 Wallet Connection

```
Create Web3 wallet connection and SIWE authentication components:

1. Create `components/auth/WalletConnect.tsx`:
   - Connect wallet button (MetaMask, WalletConnect, etc.)
   - Display connected wallet address
   - Handle wallet connection errors
   - Show wallet connection status

2. Create `components/auth/SiweAuth.tsx`:
   - Sign-in button that triggers SIWE flow
   - Handle message signing
   - Loading states during authentication
   - Error message display
   - Success feedback

3. Create `hooks/useWallet.ts`:
   - Detect wallet presence (MetaMask, etc.)
   - Connect/disconnect wallet functionality
   - Listen for account changes
   - Handle network switching if needed

4. Create `utils/siwe.ts`:
   - SIWE message creation helpers
   - Domain and statement configuration
   - Nonce handling utilities

Use ethers.js for wallet interactions and SIWE library for message creation.
```

---

## Auth Prompt 2 Alternative: Implement Wagmi Wallet Connection

```
Create Web3 wallet connection using Wagmi hooks and components:

1. Set up providers in `_app.tsx`:
   - Wrap app with WagmiConfig provider
   - Optionally add RainbowKitProvider for pre-built UI
   - Configure theme and modal settings

2. Create `components/auth/WagmiWalletConnect.tsx`:
   - Use useConnect hook for wallet connections
   - Display available connectors (MetaMask, WalletConnect, etc.)
   - Handle connection states and errors with Wagmi hooks
   - Use useAccount hook to show connected wallet info

3. Create `components/auth/WagmiSiweAuth.tsx`:
   - Use useSignMessage hook for SIWE signing
   - Integrate with useAccount for wallet address
   - Handle signing states with Wagmi's built-in loading states
   - Error handling with Wagmi's error types

4. Create `hooks/useWagmiAuth.ts`:
   - Custom hook that combines Wagmi hooks with auth logic
   - Use useAccount, useConnect, useDisconnect from Wagmi
   - Handle account changes automatically
   - Integrate with your auth context

5. Optional: Use RainbowKit components:
   - `<ConnectButton />` for instant wallet connection UI
   - Custom wallet modal with `useConnectModal`
   - Account modal with `useAccountModal`

This approach leverages Wagmi's optimized hooks and built-in error handling.
```

---

## Auth Prompt 3: Implement SIWE Authentication Flow

```
Create the complete SIWE authentication service and API integration:

1. Create `services/authService.ts` with functions:
   - generateNonce(walletAddress) - POST to /api/auth/nonce
   - verifySignature(message, signature) - POST to /api/auth/verify
   - logout() - POST to /api/auth/logout
   - getCurrentUser(userId) - GET /api/users/profile/{userId}

2. Implement the SIWE authentication flow:
   - Step 1: Connect wallet and get address
   - Step 2: Generate nonce from server
   - Step 3: Create SIWE message with nonce
   - Step 4: Sign message with wallet
   - Step 5: Send message + signature to verify endpoint
   - Step 6: Receive JWT token in httpOnly cookie

3. Each API function should:
   - Use fetch with proper headers
   - Handle HTTP errors (400, 401, 500, etc.)
   - Return consistent format: { success, data?, error? }
   - Include credentials: 'include' for cookie handling

4. Add error handling for:
   - Wallet not connected
   - User rejected signing
   - Invalid signature
   - Network errors
   - Nonce expiration

Include proper TypeScript types for all SIWE-related data structures.
```

---

## Auth Prompt 3 Alternative: Implement Wagmi SIWE Authentication Flow

```
Create SIWE authentication using Wagmi hooks and optimized patterns:

1. Create `services/wagmiAuthService.ts` with functions:
   - generateNonce(walletAddress) - POST to /api/auth/nonce
   - verifySignature(message, signature) - POST to /api/auth/verify
   - logout() - POST to /api/auth/logout
   - getCurrentUser(userId) - GET /api/users/profile/{userId}

2. Create `hooks/useSiweAuth.ts` custom hook:
   - Use useAccount to get connected wallet address
   - Use useSignMessage for message signing
   - Implement complete SIWE flow:
     * Auto-detect wallet connection from Wagmi
     * Generate nonce using wallet address
     * Create SIWE message with proper format
     * Sign using Wagmi's useSignMessage hook
     * Handle Wagmi's signing states (loading, error, success)
     * Send signed message to verification endpoint

3. Handle Wagmi-specific features:
   - Use Wagmi's built-in error types and handling
   - Leverage Wagmi's automatic state management
   - Handle account switching with useAccount's built-in listeners
   - Use Wagmi's connection status for conditional rendering

4. Error handling with Wagmi patterns:
   - Use Wagmi's error objects for detailed error info
   - Handle connector-specific errors
   - Automatic retry mechanisms with Wagmi hooks
   - Chain switching errors and recovery

5. Integration patterns:
   - Subscribe to account changes with Wagmi's watchers
   - Sync authentication state with wallet connection state
   - Handle multi-wallet scenarios with Wagmi's connector system

This approach leverages Wagmi's optimizations and built-in Web3 best practices.
```

---

## Auth Prompt 4: Implement Protected Routes and Session Management

```
Set up route protection and authentication persistence for Web3 auth:

1. Create `components/auth/ProtectedRoute.tsx`:
   - Check if wallet is connected AND user is authenticated
   - Redirect to wallet connection if not connected
   - Show loading spinner while checking auth state
   - Handle both wallet and authentication status

2. Create `middleware.ts` (Next.js 13+) or auth middleware:
   - Protect game routes (/game, /profile, etc.)
   - Check for valid JWT token in cookies
   - Redirect to connect wallet page if not authenticated

3. In the AuthContext, implement:
   - Auto-connect wallet on app startup (if previously connected)
   - Validate existing JWT token with server
   - Auto-logout on token expiration
   - Handle wallet account changes (re-authenticate if different)
   - Store last connected wallet in localStorage

4. Create auth pages:
   - `pages/auth/connect.tsx` - wallet connection page
   - Handle redirects after successful authentication
   - Remember intended destination before auth

5. Add session management:
   - Detect wallet disconnection
   - Clear auth state when wallet changes
   - Handle wallet account switching
   - Persistent wallet preference across sessions
```

---

## Auth Prompt 4 Alternative: Implement Wagmi Protected Routes and Session Management

```
Set up route protection and session management optimized for Wagmi:

1. Create `components/auth/WagmiProtectedRoute.tsx`:
   - Use useAccount to check wallet connection status
   - Integrate with your auth context for authentication check
   - Handle Wagmi's loading states automatically
   - Leverage Wagmi's built-in connection persistence

2. Create `middleware.ts` with Wagmi integration:
   - Check both Wagmi connection state and JWT token
   - Handle Wagmi's automatic reconnection on page load
   - Redirect based on Wagmi's connection status

3. Enhanced AuthContext with Wagmi watchers:
   - Use Wagmi's watchAccount for automatic account change detection
   - Leverage Wagmi's automatic wallet reconnection
   - Handle multi-wallet scenarios with Wagmi's connector system
   - Use Wagmi's built-in local storage persistence

4. Create auth pages optimized for Wagmi:
   - `pages/auth/connect.tsx` with RainbowKit ConnectButton (if using)
   - Handle Wagmi's connection states (connecting, connected, disconnected)
   - Use Wagmi's built-in error handling and retry mechanisms

5. Advanced session management with Wagmi:
   - Leverage Wagmi's automatic persistence across browser sessions
   - Handle chain switching with useNetwork hook
   - Use Wagmi's disconnect functionality for clean logouts
   - Integrate with Wagmi's connector-specific persistence

6. Add Wagmi-specific features:
   - ENS name resolution with useEnsName
   - Avatar display with useEnsAvatar
   - Network switching with useSwitchNetwork
   - Connection status indicators with Wagmi's built-in states

This approach leverages Wagmi's built-in persistence and state management capabilities.
```

---

## Auth Prompt 5: Integrate Web3 Auth with Application State

```
Connect Web3 authentication with the main application and prepare for Socket.IO:

1. Wrap your app with AuthProvider in `_app.tsx`:
   - Initialize both wallet and auth state on app load
   - Handle global authentication loading states
   - Set up wallet event listeners globally

2. Create user profile management:
   - `components/user/UserProfile.tsx` - display wallet address and game stats
   - `components/user/WalletMenu.tsx` - dropdown with disconnect/logout options
   - Show game statistics (wins, losses, draws, total matches)
   - Display wallet address in shortened format (0x1234...5678)

3. Add authentication status to main navigation:
   - Show "Connect Wallet" button when not connected
   - Show wallet address and game stats when connected
   - Display authentication status indicators
   - Show wallet connection loading states

4. Create auth utilities in `utils/auth.ts`:
   - isWalletConnected() helper function
   - isAuthenticated() helper function
   - formatWalletAddress(address) for display
   - validateAuthToken() function
   - getWalletProvider() helper

5. Prepare for Socket.IO integration:
   - Ensure JWT token is stored in httpOnly cookie after SIWE auth
   - Test that cookies are sent with Socket.IO connections
   - Verify token validation works with the socket server
   - Handle wallet disconnection during socket sessions

Add comprehensive error handling and user feedback for Web3 interactions.
```

---

## Auth Prompt 5 Alternative: Integrate Wagmi with Application State

```
Connect Wagmi-based Web3 authentication with the main application:

1. Set up providers in `_app.tsx`:
   - Wrap with WagmiConfig provider
   - Add RainbowKitProvider (optional)
   - Initialize AuthProvider after Wagmi providers
   - Configure Wagmi themes and settings

2. Create Wagmi-enhanced user profile management:
   - `components/user/WagmiUserProfile.tsx`:
     * Use useAccount for wallet info
     * Use useEnsName for ENS resolution
     * Use useEnsAvatar for profile pictures
     * Display game statistics with wallet context
   - `components/user/WagmiWalletMenu.tsx`:
     * Use useDisconnect for wallet disconnection
     * Show multiple connected wallets if applicable
     * Network switching options with useSwitchNetwork

3. Enhanced navigation with Wagmi hooks:
   - Use useAccount for connection status
   - Show RainbowKit ConnectButton or custom button
   - Display ENS names when available
   - Show network indicators with useNetwork

4. Create Wagmi utilities in `utils/wagmiAuth.ts`:
   - isWalletConnected() using Wagmi's useAccount
   - formatWalletAddress() with ENS fallback
   - getConnectorInfo() for wallet-specific features
   - validateConnection() helper

5. Socket.IO integration with Wagmi:
   - Use Wagmi's account data for socket authentication
   - Handle account switching in active socket connections
   - Leverage Wagmi's watchers for real-time socket updates
   - Integrate Wagmi's connection state with socket state

6. Advanced Wagmi features:
   - Multi-wallet support for power users
   - Network-specific configurations
   - Connector-specific error handling
   - Performance optimizations with Wagmi's caching

This approach maximizes Wagmi's capabilities and built-in optimizations.
```

---

# WAGMI-SPECIFIC ENHANCEMENTS

## Wagmi Enhancement Prompt 1: Advanced Wagmi Configuration

```
Set up advanced Wagmi configuration for production-ready Web3 integration:

1. Create comprehensive `lib/wagmi.ts` configuration:
   - Configure multiple chains (Ethereum, Polygon, Arbitrum, etc.)
   - Set up fallback RPC providers for reliability
   - Configure wallet connectors with custom options
   - Add custom chains if needed for your game
   - Set up proper error handling and retry logic

2. Environment-based configuration:
   - Different RPC endpoints for development/production
   - Chain-specific configurations
   - API key management for RPC providers
   - Custom connector settings per environment

3. Advanced provider setup:
   - Public client configuration with multiple providers
   - WebSocket provider for real-time updates
   - Batch request optimization
   - Caching strategies for improved performance

4. Custom hooks for game-specific needs:
   - `useGameChain()` - ensure users are on correct chain
   - `useWalletValidation()` - validate wallet for game compatibility
   - `useNetworkGuard()` - handle network switching for optimal gameplay

This setup ensures optimal performance and reliability for gaming applications.
```

---

## Wagmi Enhancement Prompt 2: RainbowKit Integration

```
Integrate RainbowKit for enhanced wallet connection UI (optional but recommended):

1. Install and configure RainbowKit:
   - Install @rainbow-me/rainbowkit
   - Set up RainbowKitProvider in _app.tsx
   - Configure themes (light/dark/custom)
   - Customize wallet list and ordering

2. Create custom RainbowKit components:
   - `components/auth/CustomConnectButton.tsx` - styled for your game
   - Custom wallet modal with game branding
   - Network switching modal integration
   - Error handling modals

3. Advanced RainbowKit features:
   - Custom wallet icons and branding
   - Localization for international users
   - Mobile-optimized wallet connections
   - WalletConnect QR code customization

4. Integration with your auth system:
   - Trigger SIWE flow after RainbowKit connection
   - Handle RainbowKit events for auth state updates
   - Custom disconnect behavior
   - Integration with game-specific requirements

5. Styling and theming:
   - Match your game's design system
   - Custom CSS for wallet selection
   - Responsive design for all devices
   - Animation and transition customization

This provides a professional, user-friendly wallet connection experience.
```

---

## Wagmi Enhancement Prompt 3: Performance Optimization

```
Optimize Wagmi implementation for gaming performance:

1. Implement efficient state management:
   - Use Wagmi's built-in caching effectively
   - Minimize unnecessary re-renders with useMemo/useCallback
   - Batch Wagmi hook calls where possible
   - Implement proper dependency arrays

2. Connection optimization:
   - Eager connection for returning users
   - Connection persistence across page reloads
   - Minimal connection overhead
   - Efficient connector switching

3. Network request optimization:
   - Batch RPC calls where possible
   - Implement request caching strategies
   - Use multicall for batch operations
   - Optimize polling intervals for real-time data

4. Bundle size optimization:
   - Tree-shake unused Wagmi features
   - Lazy load wallet connectors
   - Optimize RainbowKit bundle if using
   - Use dynamic imports for optional features

5. Error handling optimization:
   - Efficient error boundary implementation
   - Graceful degradation for unsupported features
   - User-friendly error messages
   - Automatic retry mechanisms

This ensures smooth gaming experience even with Web3 interactions.
```

---

# PART B: SOCKET.IO INTEGRATION

## Prompt 1: Install Dependencies and Create Basic Socket Manager

````
Create a Socket.IO client setup for a Next.js project that connects to a headball game server. Follow these steps:

1. Install socket.io-client dependency
2. Create a file at `lib/socket.ts` with a SocketManager class
3. The class should handle connection, disconnection, and socket instance management
4. Use these connection settings:
   - withCredentials: true (for cookie authentication)
   - transports: ['websocket', 'polling']
   - timeout: 10000
   - Server URL should come from environment variable NEXT_PUBLIC_SOCKET_URL or default to localhost:3000

The SocketManager should be a singleton pattern with methods: connect(), disconnect(), and getSocket().

IMPORTANT: Ensure your backend Socket.IO server has proper CORS configuration with specific origins (not "*") when using credentials:true. The server should have:
```javascript
const io = socketIo(server, {
  cors: {
    origin: ["http://localhost:3001", "http://localhost:3000"], // Specific origins
    credentials: true,
  }
});
````

```

---

## Prompt 2: Create Web3-Aware Socket Hook

```

Create a React hook called `useSocket` in `hooks/useSocket.ts` that integrates with Web3 auth:

1. Manages socket connection state (connected/disconnected)
2. Handles connection errors
3. Returns: { socket, isConnected, error, disconnect }
4. Uses the SocketManager from the previous step
5. Uses the Web3 authentication context - only connect when wallet is connected AND user is authenticated
6. Sets up event listeners for:
   - 'connect' event (set isConnected to true)
   - 'disconnect' event (set isConnected to false)
   - 'error' event (capture error messages)
   - 'welcome' event (verify authentication status with wallet address)
7. Properly cleans up event listeners on unmount
8. Automatically disconnects when user logs out or wallet disconnects

Include TypeScript types and integrate with the Web3 auth system. Handle wallet address validation in socket events.

```

---

## Prompt 2 Alternative: Create Wagmi-Integrated Socket Hook

```

Create a Socket hook that integrates seamlessly with Wagmi:

1. Create `hooks/useWagmiSocket.ts` that:

   - Uses useAccount from Wagmi to monitor wallet connection
   - Integrates with your auth context for authentication state
   - Automatically connects/disconnects based on Wagmi's account state
   - Handles Wagmi's account switching automatically

2. Enhanced socket management:

   - Monitor Wagmi's isConnected state for wallet connection
   - Use Wagmi's address for socket authentication
   - Handle Wagmi's isReconnecting state gracefully
   - Integrate with Wagmi's error handling patterns

3. Wagmi-specific features:

   - Listen to Wagmi's account change events
   - Handle connector switching in active socket sessions
   - Use Wagmi's connection status for socket state decisions
   - Leverage Wagmi's built-in persistence for socket reconnection

4. Advanced integration:
   - Use Wagmi's watchers for real-time socket updates
   - Handle network switching during socket sessions
   - Integrate with Wagmi's disconnect events
   - Performance optimization using Wagmi's caching

This provides optimal integration between Wagmi's wallet management and socket connections.

```

---

## Prompt 3: Implement Game Connection with Web3 Identity

```

Create a game component that uses Web3 authentication and socket connection:

1. Create a component called `GameLobby` that:

   - Uses both useAuth and useSocket hooks
   - Only renders when wallet is connected and user is authenticated
   - Shows wallet address and authentication status

2. When socket connects, automatically emit 'join-game' event with empty data {}
3. Listen for these server events:
   - 'welcome' - verify authentication status and wallet address match
   - 'player-created' - store player data (includes walletAddress, userId, position)
   - 'error' - handle auth errors (redirect to connect wallet if AUTH_REQUIRED)
4. Display:

   - Socket connection status
   - Current user's wallet address (formatted: 0x1234...5678)
   - Player information when successfully joined (position, ready status)

5. Add proper error handling:
   - Authentication failures (redirect to wallet connection)
   - Connection failures (show retry option)
   - Wallet disconnection during gameplay
   - Server errors (show user-friendly messages)

Include disconnect wallet button that properly disconnects socket and clears all auth state.

```

---

## Prompt 3 Alternative: Implement Wagmi Game Connection

```

Create a game component optimized for Wagmi integration:

1. Create `components/game/WagmiGameLobby.tsx` that:

   - Uses useAccount from Wagmi for wallet state
   - Uses useWagmiSocket (from previous prompt) for socket connection
   - Leverages Wagmi's built-in loading and error states
   - Shows ENS names when available using useEnsName

2. Enhanced wallet integration:

   - Display ENS avatar with useEnsAvatar
   - Show network information with useNetwork
   - Handle network switching with useSwitchNetwork if needed
   - Use Wagmi's connector info for wallet-specific features

3. Wagmi-optimized event handling:

   - Use Wagmi's address directly for socket events
   - Handle Wagmi's account changes in real-time
   - Leverage Wagmi's connection persistence
   - Integrate with Wagmi's error objects

4. Advanced features:

   - Multi-wallet support if user has multiple connected
   - Network-specific game configurations
   - Connector-specific optimizations
   - Enhanced error recovery with Wagmi's retry mechanisms

5. UI enhancements:
   - Use RainbowKit components if available
   - Wagmi-specific loading states
   - Network indicators and switching prompts
   - Wallet-specific icons and branding

This provides a more polished and Web3-native gaming experience.

```

---

## Prompt 4: Add Matchmaking with Web3 Identity

```

Extend the GameLobby component to handle matchmaking with wallet-based identity:

1. Add buttons for:

   - Find Match (emit 'find-match')
   - Create Room (emit 'create-room')
   - Join Room by Code (input field + emit 'join-room-by-code' with { roomCode })

2. Listen for these room events and update UI accordingly:

   - 'room-joined' - show room info with player wallet addresses
   - 'room-created' - show created room details and shareable room code
   - 'player-joined-room' - update player list with wallet addresses
   - 'room-full' - show "opponent found" message with wallet addresses

3. Add state management for:

   - currentRoom (room data with player wallet addresses)
   - isInRoom (boolean)
   - players array (each player has walletAddress, userId, position)

4. In the room interface, display:

   - Room code prominently for sharing
   - Player list showing wallet addresses (formatted)
   - Current user's position (player1 or player2)
   - Waiting status with player count

5. Add proper loading states for all matchmaking operations
6. Handle authentication errors during room operations
7. Show player roles clearly (player1 vs player2 with wallet addresses)

```

---

## Prompt 5: Implement Ready System with Player Identity

```

Add ready-up functionality with Web3 player identity:

1. When in a room, show:

   - Room code prominently for sharing
   - List of players with wallet addresses and ready status
   - Your position indicator (Player 1 or Player 2)
   - "Ready/Unready" toggle button (emit 'player-ready')
   - "Leave Room" button (emit 'leave-room')

2. Listen for these events:

   - 'player-ready' - update player ready states showing wallet addresses
   - 'game-started' - transition to game view with match data and player positions
   - 'left-room' - return to lobby view
   - 'player-left' - update player list and show notification with wallet address

3. Add state for:

   - playerReadyStates (object mapping wallet addresses to ready status)
   - isGameActive (boolean)
   - gameData (match information with player wallet addresses)
   - myPosition ('player1' or 'player2')

4. Visual feedback features:

   - Highlight your own wallet address in player list
   - Show clear position assignment (Player 1 vs Player 2)
   - Visual ready indicators for each player
   - "Waiting for opponent to ready up" message
   - Game starting countdown when both players ready

5. Ensure only authenticated wallet users can perform ready actions

```

---

## Prompt 6: Create Real-Time Gameplay Input System

```

Create a gameplay input system with Web3 player identity:

1. Create a `useGameInput` hook that:

   - Takes socket, isGameActive, and authentication status as parameters
   - Only works when wallet is connected, user is authenticated, and game is active
   - Sets up keyboard event listeners for:
     - Arrow Keys/WASD for movement (emit 'move-left', 'move-right')
     - Space/W for jump (emit 'jump')
     - S for kick (emit 'kick')
     - Key release for stop movement (emit 'stop-move')
   - Properly cleans up event listeners

2. In the game component, listen for:

   - 'player-input' - handle opponent movements (includes wallet address)
   - 'ball-state' - sync ball physics from server authority (only from player1)
   - 'player-position' - sync opponent position (includes wallet address)

3. Add functions to handle these events:

   - handleOpponentInput(data) - validate opponent wallet address
   - updateBallState(ballData) - only accept from player1 authority
   - updateOpponentPosition(positionData) - validate player identity

4. Player authority system:

   - Player 1 (first to join) has ball authority
   - Validate input sources by wallet address
   - Show which player you are (Player 1/2) prominently

5. Add authentication checks for all gameplay actions
6. Handle wallet disconnection during gameplay gracefully

```

---

## Prompt 7: Implement Game State Management with Web3 Identity

```

Add comprehensive game state management with player wallet tracking:

1. Create state for:

   - score: { player1: number, player2: number }
   - gameTimer: number (remaining time in seconds)
   - gameStatus: 'waiting' | 'active' | 'paused' | 'ended'
   - playerWallets: { player1: string, player2: string }
   - myPosition: 'player1' | 'player2'

2. Listen for game events:

   - 'goal-scored' - update score display with scorer's wallet address
   - 'game-state-update' - sync any game state changes
   - 'match-ended' - show final results with winner's wallet address

3. Create UI components for:

   - Score display showing wallet addresses for each player
   - Game timer countdown
   - Player position indicators (You vs Opponent)
   - Current game status
   - Goal celebrations with scorer identification

4. Add functions to emit game events:

   - handleGoalScored(goalData) - include wallet address of scorer
   - endGame(finalScore, duration) - emit 'game-end' with match results

5. Handle match completion:

   - Show winner with their wallet address
   - Display final score with player wallet addresses
   - Show match statistics (goals, saves, etc.)
   - Update user's game stats automatically via API call

6. Add post-game features:
   - Call /api/users/profile/{userId} to get updated stats
   - Show win/loss record changes
   - Display match history integration

```

---

## Prompt 8: Add Rematch System and Advanced Features

```

Implement the rematch system with Web3 player tracking:

1. After match ends, show options for:

   - Request Rematch (emit 'request-rematch')
   - Decline Rematch (emit 'decline-rematch')
   - Leave Room and return to lobby

2. Listen for rematch events:

   - 'rematch-requested' - show notification with opponent's wallet address
   - 'rematch-confirmed' - start new game automatically with same players
   - 'rematch-declined' - show declined message, return to room lobby

3. Add comprehensive error handling:

   - JWT token expiration during gameplay (auto-logout)
   - Wallet disconnection during match
   - Network disconnections with reconnection attempts
   - Opponent wallet disconnection
   - Server errors with user-friendly messages

4. Add final polish:

   - Loading states for all operations with wallet confirmation
   - Clear error messages with wallet-specific context
   - Connection quality indicator
   - Proper cleanup when wallet disconnects

5. Integrate with user profile system:

   - Show updated match history after each game
   - Display win/loss statistics from /api/users/profile/{userId}
   - Track gameplay metrics per wallet address
   - Show player rank/level progression if available

6. Add wallet-specific features:
   - Remember preferred wallet connection
   - Handle multiple wallet switching
   - Show transaction history if blockchain integration exists

```

---

## Prompt 9: Production Readiness and Security

```

Finalize the implementation with robust Web3 security and production features:

1. Create comprehensive security measures:

   - Validate wallet signatures on every critical action
   - Prevent wallet address spoofing
   - Handle malicious wallet connections gracefully
   - Implement client-side rate limiting
   - Secure JWT token storage and transmission

2. Add Web3-specific error handling:

   - Wallet installation detection (MetaMask, etc.)
   - Network switching errors (wrong chain)
   - Transaction rejection handling
   - Wallet lock/unlock detection
   - Account switching during gameplay

3. Add user experience improvements:

   - Toast notifications for wallet events
   - Loading states for all wallet operations
   - Offline/online status indicators
   - Smooth transitions between wallet states
   - Mobile wallet support (WalletConnect)

4. Production deployment setup:

   - Environment variables for Web3 providers
   - Error logging and monitoring for wallet interactions
   - Performance optimization for Web3 calls
   - SEO considerations for Web3 auth pages
   - Analytics for wallet connection rates

5. Testing and validation:

   - Test with multiple wallet providers
   - Verify signature validation end-to-end
   - Test wallet switching scenarios
   - Validate security measures
   - Performance testing with Web3 interactions

6. Documentation and maintenance:
   - Document wallet connection requirements
   - Create troubleshooting guide for common Web3 issues
   - Add browser compatibility notes
   - Include mobile wallet setup instructions

Create comprehensive documentation for the Web3 authentication and socket integration.

```

---

## Final Integration Checklist

After completing all prompts, verify:

**Web3 Authentication:**

- [ ] Wallet connection works with MetaMask/WalletConnect
- [ ] SIWE authentication flow completes successfully
- [ ] JWT tokens are stored securely in httpOnly cookies
- [ ] Wallet address validation works throughout app
- [ ] Protected routes work with Web3 auth
- [ ] Auto-logout on wallet disconnection

**Wagmi-Specific (if using Wagmi):**

- [ ] Wagmi configuration is optimized for gaming
- [ ] Multiple wallet connectors work correctly
- [ ] RainbowKit integration (if used) is properly themed
- [ ] ENS names and avatars display correctly
- [ ] Network switching works smoothly
- [ ] Performance is optimized with Wagmi's caching

**Socket Integration:**

- [ ] Socket connects only when wallet is connected and authenticated
- [ ] Socket disconnects on wallet disconnection/logout
- [ ] Player identity is preserved via wallet address
- [ ] Real-time features work with Web3 identity

**Game Features:**

- [ ] Matchmaking respects wallet-based identity
- [ ] Player positions are clearly identified by wallet address
- [ ] Match history is associated with wallet address
- [ ] Game stats update correctly per wallet
- [ ] Error handling covers all Web3 scenarios

**Production Ready:**

- [ ] Security best practices for Web3 implemented
- [ ] Performance optimized for wallet interactions
- [ ] Error logging includes wallet-specific context
- [ ] User experience is smooth across wallet providers
- [ ] Mobile wallet support is functional
```
