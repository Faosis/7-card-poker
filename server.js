const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const PokerSolver = require('pokersolver').Hand;

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const SUITS = ['s', 'h', 'd', 'c'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];

function createDeck() {
  const deck = [];
  for (const s of SUITS) {
    for (const r of RANKS) {
      deck.push(r + s);
    }
  }
  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

const rooms = {};

function createRoomState(roomId) {
  return {
    id: roomId,
    players: [], // [socketId1, socketId2]
    decks: [createDeck(), createDeck()],
    boards: [
      Array.from({ length: 7 }, () => []),
      Array.from({ length: 7 }, () => [])
    ],
    currentCards: [null, null],
    turn: 0, // 0 or 1
    currentRound: 0, // 0 to 4 (players must fill row by row, or free placement)
    gameOver: false,
    results: null
  };
}

function evaluateGame(room) {
  const colWinners = [];
  const p0Desc = [];
  const p1Desc = [];
  let p0Wins = 0;
  let p1Wins = 0;

  for (let col = 0; col < 7; col++) {
    const h0 = PokerSolver.solve(room.boards[0][col]);
    const h1 = PokerSolver.solve(room.boards[1][col]);
    p0Desc.push(h0.descr);
    p1Desc.push(h1.descr);

    const winners = PokerSolver.winners([h0, h1]);
    if (winners.length === 2) {
      colWinners.push(-1); // Tie
    } else if (winners[0] === h0) {
      colWinners.push(0);
      p0Wins++;
    } else {
      colWinners.push(1);
      p1Wins++;
    }
  }

  return { colWinners, p0Desc, p1Desc, p0Wins, p1Wins };
}

function broadcastState(room) {
  room.players.forEach((socketId, playerIdx) => {
    const oppIdx = 1 - playerIdx;
    
    // Mask opponent's cards: show 1st card (index 0) and reveal full column if game over
    const maskedOppBoard = room.boards[oppIdx].map((col, colIdx) => {
      const bothFull = col.length === 5 && room.boards[playerIdx][colIdx].length === 5;
      return col.map((card, cardIdx) => {
        if (room.gameOver || bothFull || cardIdx === 0) {
          return card;
        }
        return 'XX'; // Hidden card
      });
    });

    io.to(socketId).emit('gameState', {
      playerIdx,
      myBoard: room.boards[playerIdx],
      oppBoard: maskedOppBoard,
      myCurrentCard: room.currentCards[playerIdx],
      isMyTurn: !room.gameOver && room.turn === playerIdx && room.players.length === 2,
      waitingForOpponent: room.players.length < 2,
      gameOver: room.gameOver,
      results: room.results
    });
  });
}

io.on('connection', (socket) => {
  socket.on('joinRoom', (roomId) => {
    roomId = (roomId || 'default').trim().toUpperCase();
    if (!rooms[roomId] || rooms[roomId].players.length === 0) {
      rooms[roomId] = createRoomState(roomId);
    }

    const room = rooms[roomId];
    if (room.players.length >= 2 && !room.players.includes(socket.id)) {
      socket.emit('errorMsg', 'Room is full!');
      return;
    }

    if (!room.players.includes(socket.id)) {
      const pIdx = room.players.length;
      room.players.push(socket.id);
      room.currentCards[pIdx] = room.decks[pIdx].pop();
      socket.join(roomId);
      socket.roomId = roomId;
    }

    broadcastState(room);
  });

  socket.on('placeCard', (colIdx) => {
    const room = rooms[socket.roomId];
    if (!room || room.gameOver || room.players.length < 2) return;

    const pIdx = room.players.indexOf(socket.id);
    if (pIdx !== room.turn) return;
    if (colIdx < 0 || colIdx > 6) return;

    const targetCol = room.boards[pIdx][colIdx];
    if (targetCol.length >= 5) return;

    // Optional MSN Rule: Force even row building (cannot place 2nd card until all 7 cols have 1 card)
    const minLen = Math.min(...room.boards[pIdx].map(c => c.length));
    if (targetCol.length > minLen) {
      socket.emit('errorMsg', 'You must place one card in each column before starting the next row!');
      return;
    }

    // Place card
    targetCol.push(room.currentCards[pIdx]);

    // Check if player still needs cards (35 total)
    const totalPlaced = room.boards[pIdx].reduce((sum, c) => sum + c.length, 0);
    room.currentCards[pIdx] = totalPlaced < 35 ? room.decks[pIdx].pop() : null;

    // Check if both players placed all 35 cards
    const p0Total = room.boards[0].reduce((sum, c) => sum + c.length, 0);
    const p1Total = room.boards[1].reduce((sum, c) => sum + c.length, 0);

    if (p0Total === 35 && p1Total === 35) {
      room.gameOver = true;
      room.results = evaluateGame(room);
    } else {
      room.turn = 1 - room.turn;
    }

    broadcastState(room);
  });

  socket.on('rematch', () => {
    const room = rooms[socket.roomId];
    if (!room) return;
    const oldPlayers = [...room.players];
    rooms[socket.roomId] = createRoomState(socket.roomId);
    const newRoom = rooms[socket.roomId];
    newRoom.players = oldPlayers;
    newRoom.currentCards[0] = newRoom.decks[0].pop();
    if (oldPlayers.length > 1) {
      newRoom.currentCards[1] = newRoom.decks[1].pop();
    }
    broadcastState(newRoom);
  });

  socket.on('disconnect', () => {
    const room = rooms[socket.roomId];
    if (room) {
      room.players = room.players.filter(id => id !== socket.id);
      io.to(socket.roomId).emit('errorMsg', 'Opponent disconnected. Refresh to start a new game.');
      delete rooms[socket.roomId];
    }
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`7 Hand Poker running on http://0.0.0.0:${PORT}`);
});
