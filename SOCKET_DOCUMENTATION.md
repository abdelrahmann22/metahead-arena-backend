# Step-by-Step Socket.IO Integration Guide for Next.js

## 🎯 What You'll Build

By following this guide, you'll create a fully functional real-time headball game client that can:

- Connect to the MetaHead Arena server
- Authenticate users via JWT cookies
- Handle matchmaking and room management
- Process real-time gameplay events
- Manage player input and game state synchronization

## 📋 Prerequisites

- Next.js project set up and running
- Basic knowledge of React hooks
- User authentication system in place (for JWT cookies)

## 🚀 Quick Start Checklist

- [ ] Install Socket.IO client
- [ ] Create basic connection
- [ ] Test authentication
- [ ] Implement game events
- [ ] Add error handling
- [ ] Test real-time gameplay

---

## Step 1: Installation & Basic Setup

### 1.1 Install Required Dependencies

First, install the Socket.IO client in your Next.js project:

## Installation & Setup

### Install Socket.IO Client

```bash
npm install socket.io-client
```

### Basic Connection Setup

```typescript
// lib/socket.ts
import { io, Socket } from "socket.io-client";

const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3000";

class SocketManager {
  private socket: Socket | null = null;

  connect(): Socket {
    if (!this.socket) {
      this.socket = io(SOCKET_URL, {
        withCredentials: true, // Important for cookie-based authentication
        transports: ["websocket", "polling"],
        timeout: 10000,
        forceNew: true,
      });
    }
    return this.socket;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  getSocket(): Socket | null {
    return this.socket;
  }
}

export const socketManager = new SocketManager();
```

## Authentication

### Authentication Requirements

The server uses JWT token authentication via cookies. The token must be present in the `authToken` cookie before connecting to protected game events.

### Authentication Flow

1. User logs in via HTTP API and receives JWT token in cookie
2. Connect to Socket.IO server (token is automatically sent via cookie)
3. Server verifies token and associates user data with socket
4. Client can now access protected game events

### Authentication Events

```typescript
// Server sends welcome message on connection
socket.on("welcome", (data) => {
  console.log("Welcome data:", data);
  // data.authenticated: boolean - whether user is authenticated
  // data.walletAddress: string - user's wallet (if authenticated)
  // data.playerId: string - socket ID
});

// Authentication errors
socket.on("error", (error) => {
  if (error.type === "AUTH_REQUIRED") {
    // Redirect to login or show auth modal
    console.log("Authentication required:", error.message);
  }
});
```

## Connection Management

### React Hook for Socket Connection

```typescript
// hooks/useSocket.ts
import { useEffect, useRef, useState } from "react";
import { Socket } from "socket.io-client";
import { socketManager } from "../lib/socket";

export const useSocket = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = socketManager.connect();
    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      setError(null);
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    socket.on("error", (err) => {
      setError(err.message || "Socket error occurred");
    });

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("error");
    };
  }, []);

  const disconnect = () => {
    socketManager.disconnect();
    setIsConnected(false);
  };

  return {
    socket: socketRef.current,
    isConnected,
    error,
    disconnect,
  };
};
```

## Available Events

### Client-to-Server Events (Emit)

#### Game Management

```typescript
// Join the game (requires authentication)
socket.emit("join-game", {});

// Find a match through matchmaking
socket.emit("find-match");

// Create a new room
socket.emit("create-room");

// Join room by code
socket.emit("join-room-by-code", {
  roomCode: string,
});

// Toggle ready status
socket.emit("player-ready");

// Leave current room
socket.emit("leave-room");

// End current game
socket.emit("game-end", {
  finalScore: { player1: number, player2: number },
  duration: number, // in milliseconds
});
```

#### Rematch System

```typescript
// Request a rematch
socket.emit("request-rematch");

// Decline a rematch
socket.emit("decline-rematch");
```

#### Gameplay Events

```typescript
// Player input events
socket.emit("move-left", { pressed: boolean });
socket.emit("move-right", { pressed: boolean });
socket.emit("jump", { pressed: boolean });
socket.emit("kick", { pressed: boolean });
socket.emit("stop-move");

// Generic player input
socket.emit("player-input", {
  action: string,
  pressed: boolean,
  // additional input data
});

// Ball state (only for ball authority - player1)
socket.emit("ball-state", {
  ball: {
    x: number,
    y: number,
    velocityX: number,
    velocityY: number,
  },
  timestamp: number,
});

// Player position sync
socket.emit("player-position", {
  position: "player1" | "player2",
  player: {
    x: number,
    y: number,
    velocityX: number,
    velocityY: number,
  },
  timestamp: number,
});

// Goal scored
socket.emit("goal-scored", {
  scoringPlayer: string,
  goalType: string,
  // additional goal data
});

// Game state update
socket.emit("game-state-update", {
  // game state data
});
```

### Server-to-Client Events (Listen)

#### Connection Events

```typescript
socket.on("welcome", (data) => {
  // data: { message, playerId, authenticated, walletAddress?, serverTime }
});

socket.on("error", (error) => {
  // error: { message, type, ...additionalData }
});
```

#### Player & Room Events

```typescript
socket.on("player-created", (data) => {
  // data: { player, user }
});

socket.on("game-status", (stats) => {
  // Current game statistics
});

socket.on("room-joined", (data) => {
  // data: { roomId, roomCode, players, waitingForPlayers, gameMode, roomType }
});

socket.on("room-created", (data) => {
  // data: { roomId, roomCode, players, waitingForPlayers, gameMode, roomType }
});

socket.on("player-joined-room", (data) => {
  // data: { player, waitingForPlayers }
});

socket.on("room-full", (data) => {
  // data: { message, roomId, timestamp }
});

socket.on("left-room", (data) => {
  // data: { roomId }
});

socket.on("player-left", (data) => {
  // data: { playerId, username, remainingPlayers, message, reason? }
});
```

#### Game Flow Events

```typescript
socket.on("player-ready", (data) => {
  // data: { playerId, username, isReady, allPlayersReady, room, timestamp }
});

socket.on("game-started", (data) => {
  // data: { message, room, matchDuration }
});

socket.on("match-ended", (data) => {
  // data: { message, finalScore, duration, matchId, winner }
});
```

#### Rematch Events

```typescript
socket.on("rematch-requested", (data) => {
  // data: { player, rematchState }
});

socket.on("rematch-confirmed", (roomData) => {
  // New game confirmed, roomData contains updated room info
});

socket.on("rematch-declined", (data) => {
  // data: { player }
});
```

#### Gameplay Events

```typescript
socket.on("player-input", (data) => {
  // data: { playerId, username, position, action, input, timestamp }
});

socket.on("ball-state", (data) => {
  // data: { ball: { x, y, velocityX, velocityY }, timestamp }
});

socket.on("player-position", (data) => {
  // data: { position, player: { x, y, velocityX, velocityY }, timestamp }
});
```

## Event Data Structures

### Player Object

```typescript
interface Player {
  id: string; // socket ID
  userId: string; // database user ID
  walletAddress: string;
  username: string;
  position: "player1" | "player2" | null;
  isReady: boolean;
  currentRoom: string | null;
  score: number;
}
```

### Room Object

```typescript
interface Room {
  id: string;
  code: string;
  maxPlayers: number;
  players: Player[];
  status: "waiting" | "ready" | "active" | "finished";
  gameMode: string;
  settings: {
    matchDuration: number;
  };
  gameState: {
    isActive: boolean;
    startTime: number;
    score: { player1: number; player2: number };
  };
  matchId?: string;
}
```

### Error Object

```typescript
interface SocketError {
  message: string;
  type:
    | "AUTH_REQUIRED"
    | "VALIDATION_ERROR"
    | "ROOM_ERROR"
    | "GAME_ERROR"
    | "SERVER_ERROR";
  [key: string]: any; // Additional error-specific data
}
```

## Example Implementation

### Game Component with Socket Integration

```typescript
// components/Game.tsx
import React, { useEffect, useState } from "react";
import { useSocket } from "../hooks/useSocket";

interface GameState {
  room: any;
  players: any[];
  isInRoom: boolean;
  isGameActive: boolean;
  score: { player1: number; player2: number };
}

export const Game: React.FC = () => {
  const { socket, isConnected } = useSocket();
  const [gameState, setGameState] = useState<GameState>({
    room: null,
    players: [],
    isInRoom: false,
    isGameActive: false,
    score: { player1: 0, player2: 0 },
  });

  useEffect(() => {
    if (!socket) return;

    // Join game when connected
    socket.emit("join-game", {});

    // Room events
    socket.on("room-joined", (data) => {
      setGameState((prev) => ({
        ...prev,
        room: data,
        players: data.players,
        isInRoom: true,
      }));
    });

    socket.on("game-started", (data) => {
      setGameState((prev) => ({
        ...prev,
        isGameActive: true,
        room: data.room,
      }));
    });

    socket.on("match-ended", (data) => {
      setGameState((prev) => ({
        ...prev,
        isGameActive: false,
        score: data.finalScore,
      }));
    });

    // Gameplay events
    socket.on("player-input", (data) => {
      // Handle opponent input for physics simulation
      handleOpponentInput(data);
    });

    socket.on("ball-state", (data) => {
      // Sync ball state from authority
      updateBallState(data.ball);
    });

    return () => {
      socket.off("room-joined");
      socket.off("game-started");
      socket.off("match-ended");
      socket.off("player-input");
      socket.off("ball-state");
    };
  }, [socket]);

  const findMatch = () => {
    socket?.emit("find-match");
  };

  const createRoom = () => {
    socket?.emit("create-room");
  };

  const joinRoomByCode = (code: string) => {
    socket?.emit("join-room-by-code", { roomCode: code });
  };

  const toggleReady = () => {
    socket?.emit("player-ready");
  };

  const handlePlayerInput = (action: string, pressed: boolean) => {
    socket?.emit(action, { pressed });
  };

  const handleOpponentInput = (data: any) => {
    // Implement opponent movement in your game physics
    console.log("Opponent input:", data);
  };

  const updateBallState = (ballData: any) => {
    // Update ball position from authority
    console.log("Ball state:", ballData);
  };

  return (
    <div className="game-container">
      <div className="connection-status">
        Status: {isConnected ? "Connected" : "Disconnected"}
      </div>

      {!gameState.isInRoom && (
        <div className="lobby">
          <button onClick={findMatch}>Find Match</button>
          <button onClick={createRoom}>Create Room</button>
          <input
            type="text"
            placeholder="Room code"
            onKeyPress={(e) => {
              if (e.key === "Enter") {
                joinRoomByCode(e.currentTarget.value);
              }
            }}
          />
        </div>
      )}

      {gameState.isInRoom && !gameState.isGameActive && (
        <div className="waiting-room">
          <h3>Room: {gameState.room?.code}</h3>
          <div>Players: {gameState.players.length}/2</div>
          <button onClick={toggleReady}>Toggle Ready</button>
        </div>
      )}

      {gameState.isGameActive && (
        <div className="game-area">
          <div className="score">
            {gameState.score.player1} - {gameState.score.player2}
          </div>
          {/* Your game canvas/rendering here */}
        </div>
      )}
    </div>
  );
};
```

### Input Handler Hook

```typescript
// hooks/useGameInput.ts
import { useEffect } from "react";
import { Socket } from "socket.io-client";

export const useGameInput = (socket: Socket | null, isGameActive: boolean) => {
  useEffect(() => {
    if (!socket || !isGameActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case "ArrowLeft":
        case "KeyA":
          socket.emit("move-left", { pressed: true });
          break;
        case "ArrowRight":
        case "KeyD":
          socket.emit("move-right", { pressed: true });
          break;
        case "Space":
        case "KeyW":
          socket.emit("jump", { pressed: true });
          break;
        case "KeyS":
          socket.emit("kick", { pressed: true });
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case "ArrowLeft":
        case "KeyA":
        case "ArrowRight":
        case "KeyD":
          socket.emit("stop-move");
          break;
        case "Space":
        case "KeyW":
          socket.emit("jump", { pressed: false });
          break;
        case "KeyS":
          socket.emit("kick", { pressed: false });
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [socket, isGameActive]);
};
```

## Error Handling

### Common Error Types and Handling

```typescript
// utils/errorHandler.ts
export const handleSocketError = (error: any) => {
  switch (error.type) {
    case "AUTH_REQUIRED":
      // Redirect to login
      window.location.href = "/login";
      break;

    case "VALIDATION_ERROR":
      // Show validation message
      console.error("Validation error:", error.message);
      break;

    case "ROOM_ERROR":
      // Handle room-related errors
      if (error.roomCode) {
        alert(`Failed to join room ${error.roomCode}: ${error.message}`);
      }
      break;

    case "GAME_ERROR":
      // Handle game-related errors
      console.error("Game error:", error.message);
      break;

    default:
      // Generic error handling
      console.error("Socket error:", error.message);
  }
};
```

## Best Practices

### 1. Connection Management

- Always clean up event listeners in useEffect cleanup
- Handle connection state properly
- Implement reconnection logic for production

### 2. Authentication

- Ensure JWT token is valid before connecting
- Handle auth errors gracefully
- Refresh tokens when needed

### 3. Event Handling

- Use TypeScript interfaces for type safety
- Validate incoming data
- Handle edge cases (player disconnection, network issues)

### 4. Performance

- Throttle high-frequency events (player input, ball state)
- Use requestAnimationFrame for smooth gameplay
- Minimize data sent in real-time events

### 5. Security

- Validate all user input on the server
- Never trust client-side game state
- Use server authority for critical game events

### 6. Error Recovery

- Implement retry mechanisms
- Handle partial state updates
- Provide user feedback for connection issues

## Environment Configuration

```bash
# .env.local
NEXT_PUBLIC_SOCKET_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

This documentation provides a complete guide for integrating the Socket.IO server with a Next.js frontend. Remember to handle all edge cases and implement proper error recovery for a production-ready application.
