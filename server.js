const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());

const dataFilePath = path.join(__dirname, "players.json");
let players = {};
let chatMessages = [];
let rooms = { "main": [] };

// Load player data from file
if (fs.existsSync(dataFilePath)) {
  const rawData = fs.readFileSync(dataFilePath);
  players = JSON.parse(rawData);
}

const savePlayersToFile = () => {
  fs.writeFileSync(dataFilePath, JSON.stringify(players, null, 2));
};

io.on("connection", (socket) => {
  console.log("New player connected: ", socket.id);

  players[socket.id] = { x: 100, y: 100, color: "#ffffff", outfit: "/outfit1.svg", room: "main" };
  rooms["main"].push(socket.id);
  savePlayersToFile();

  io.emit("updatePlayers", players);
  io.to("main").emit("updateRoom", rooms["main"]);

  socket.on("move", (position) => {
    if (players[socket.id]) {
      players[socket.id].x = position.x;
      players[socket.id].y = position.y;
      savePlayersToFile();
      io.emit("updatePlayers", players);
    }
  });

  socket.on("changeColor", ({ playerId, color }) => {
    if (players[playerId]) {
      players[playerId].color = color;
      savePlayersToFile();
      io.emit("updatePlayers", players);
    }
  });

  socket.on("changeOutfit", ({ playerId, outfit }) => {
    if (players[playerId]) {
      players[playerId].outfit = outfit;
      savePlayersToFile();
      io.emit("updatePlayers", players);
    }
  });

  socket.on("sendMessage", (message) => {
    const chatEntry = { playerId: socket.id, message };
    chatMessages.push(chatEntry);
    io.emit("chatUpdate", chatMessages);
  });

  socket.on("changeRoom", (newRoom) => {
    if (!rooms[newRoom]) rooms[newRoom] = [];
    const oldRoom = players[socket.id].room;
    rooms[oldRoom] = rooms[oldRoom].filter(id => id !== socket.id);
    rooms[newRoom].push(socket.id);
    players[socket.id].room = newRoom;
    io.emit("updatePlayers", players);
    io.to(newRoom).emit("updateRoom", rooms[newRoom]);
  });

  socket.on("disconnect", () => {
    const room = players[socket.id]?.room;
    if (room) {
      rooms[room] = rooms[room].filter(id => id !== socket.id);
    }
    delete players[socket.id];
    savePlayersToFile();
    io.emit("updatePlayers", players);
  });
});

server.listen(3001, () => {
  console.log("Server is running on port 3001");
});
