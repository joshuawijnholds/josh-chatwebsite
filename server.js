const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

mongoose.connect(process.env.MONGO_URI).then(() => console.log('Database verbonden!'));

const User = mongoose.model('User', new mongoose.Schema({ username: String, isOnline: Boolean }));
const Group = mongoose.model('Group', new mongoose.Schema({ name: String, pin: String }));

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Josh-chatwebsite</title>
      <style>
        body { font-family: sans-serif; background: #222; color: #fff; padding: 20px; }
        .box { background: #333; padding: 15px; margin-bottom: 15px; border-radius: 5px; }
        input, button { padding: 10px; margin: 5px 0; width: 100%; box-sizing: border-box; }
        button { background: #5c8a6b; color: white; border: none; cursor: pointer; }
        #chat-screen { display: none; }
        .online { color: #55ff55; } .offline { color: #ff5555; }
      </style>
    </head>
    <body>
      <div id="login-screen" class="box">
        <h2>Josh-chatwebsite - Inloggen</h2>
        <input id="username" type="text" placeholder="Gebruikersnaam">
        <button onclick="login()">Start Chat</button>
      </div>
      <div id="chat-screen">
        <div class="box">
          <h2>Welkom bij Josh-chatwebsite, <span id="my-name"></span></h2>
          <div id="user-list"></div>
        </div>
        <div class="box">
          <h3>Groep Beheer</h3>
          <input id="group-name" type="text" placeholder="Groepsnaam">
          <input id="group-pin" type="password" placeholder="Wachtwoord / PIN">
          <button onclick="createGroup()">Maak Groep</button>
          <button onclick="joinGroup()" style="background:#4a6fa5;">Join Groep</button>
        </div>
        <div class="box" id="chat-box" style="display:none;">
          <h3>Groep: <span id="current-group"></span></h3>
          <div id="messages" style="height:200px; overflow-y:auto; background:#111; padding:10px;"></div>
          <input id="msg-text" type="text" placeholder="Typ een bericht...">
          <button onclick="sendMessage()">Verstuur</button>
        </div>
      </div>
      <script src="/socket.io/socket.io.js"></script>
      <script>
        const socket = io();
        let myUsername = "";
        let currentRoom = "";
        function login() {
          myUsername = document.getElementById('username').value;
          if(!myUsername) return alert('Vul een naam in');
          socket.emit('user-online', myUsername);
          document.getElementById('login-screen').style.display = 'none';
          document.getElementById('chat-screen').style.display = 'block';
          document.getElementById('my-name').innerText = myUsername;
        }
        function createGroup() {
          const name = document.getElementById('group-name').value;
          const pin = document.getElementById('group-pin').value;
          socket.emit('create-group', { name, pin });
        }
        function joinGroup() {
          const name = document.getElementById('group-name').value;
          const pin = document.getElementById('group-pin').value;
          socket.emit('join-group', { name, pin });
        }
        function sendMessage() {
          const text = document.getElementById('msg-text').value;
          socket.emit('send-message', { room: currentRoom, sender: myUsername, text });
          document.getElementById('msg-text').value = '';
        }
        socket.on('group-joined', (roomName) => {
          currentRoom = roomName;
          document.getElementById('chat-box').style.display = 'block';
          document.getElementById('current-group').innerText = roomName;
          document.getElementById('messages').innerHTML = '';
        });
        socket.on('receive-message', (data) => {
          document.getElementById('messages').innerHTML += '<p><b>' + data.sender + ':</b> ' + data.text + '</p>';
        });
        socket.on('update-users', (users) => {
          let html = '<h3>Online Spelers:</h3>';
          users.forEach(u => {
            html += '<p><span class="' + (u.isOnline ? 'online' : 'offline') + '">●</span> ' + u.username + '</p>';
          });
          document.getElementById('user-list').innerHTML = html;
        });
        socket.on('err', (msg) => alert(msg));
      </script>
    </body>
    </html>
  `);
});

let activeSockets = {};
io.on('connection', (socket) => {
  socket.on('user-online', async (username) => {
    socket.username = username;
    activeSockets[username] = socket.id;
    await User.findOneAndUpdate({ username }, { isOnline: true }, { upsert: true });
    sendUserList();
  });
  socket.on('create-group', async ({ name, pin }) => {
    const exists = await Group.findOne({ name });
    if (exists) return socket.emit('err', 'Groep bestaat al!');
    const newGroup = new Group({ name, pin });
    await newGroup.save();
    socket.join(name);
    socket.emit('group-joined', name);
  });
  socket.on('join-group', async ({ name, pin }) => {
    const group = await Group.findOne({ name, pin });
    if (!group) return socket.emit('err', 'Onjuiste groepsnaam of wachtwoord!');
    socket.join(name);
    socket.emit('group-joined', name);
  });
  socket.on('send-message', ({ room, sender, text }) => {
    io.to(room).emit('receive-message', { sender, text });
  });
  socket.on('disconnect', async () => {
    if (socket.username) {
      await User.findOneAndUpdate({ username: socket.username }, { isOnline: false });
      sendUserList();
    }
  });
});
async function sendUserList() {
  const users = await User.find({});
  io.emit('update-users', users);
}
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Server draait!'));
