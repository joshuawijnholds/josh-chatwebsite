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
const Message = mongoose.model('Message', new mongoose.Schema({ room: String, sender: String, text: String, timestamp: { type: Date, default: Date.now } }));

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Josh-chatwebsite</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #111b21; color: #e9edef; height: 100vh; display: flex; justify-content: center; align-items: center; }
        
        /* INLOGSCHERM */
        #login-screen { background: #222e35; padding: 30px; border-radius: 10px; width: 100%; max-width: 400px; text-align: center; box-shadow: 0 4px 10px rgba(0,0,0,0.3); }
        #login-screen h2 { margin-bottom: 20px; color: #00a884; }
        input { width: 100%; padding: 12px; margin: 10px 0; background: #2a3942; border: 1px solid #3b4a54; border-radius: 6px; color: #fff; font-size: 16px; }
        input:focus { outline: none; border-color: #00a884; }
        button { width: 100%; padding: 12px; background: #00a884; color: #fff; border: none; border-radius: 6px; font-size: 16px; font-weight: bold; cursor: pointer; transition: 0.2s; }
        button:hover { background: #008f72; }

        /* WHATSAPP INTERFACE */
        #chat-screen { display: none; width: 100vw; height: 100vh; }
        .app-container { display: flex; width: 100%; height: 100%; }

        /* LINKERKOLOM (SIDEBAR) */
        .sidebar { width: 30%; max-width: 350px; min-width: 260px; background: #111b21; border-right: 1px solid #222e35; display: flex; flex-direction: column; }
        .sidebar-header { background: #202c33; padding: 15px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #222e35; }
        .sidebar-header h3 { font-size: 18px; color: #e9edef; }
        .plus-btn { background: #202c33; color: #00a884; width: 40px; height: 40px; border-radius: 50%; font-size: 24px; display: flex; align-items: center; justify-content: center; cursor: pointer; border: 1px solid #2a3942; }
        .plus-btn:hover { background: #2a3942; }
        .group-list { flex: 1; overflow-y: auto; }
        .group-item { padding: 15px; border-bottom: 1px solid #222e35; cursor: pointer; transition: 0.2s; display: flex; justify-content: space-between; align-items: center; }
        .group-item:hover { background: #202c33; }
        .group-item.active { background: #2a3942; }

        /* RECHTERKOLOM (CHAT AREA) */
        .chat-area { flex: 1; background: #0b141a; display: flex; flex-direction: column; position: relative; }
        .chat-header { background: #202c33; padding: 15px; display: none; align-items: center; border-bottom: 1px solid #222e35; }
        .chat-header h3 { margin-left: 10px; }
        .messages-container { flex: 1; padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; }
        
        /* BERICHTEN STYLING */
        .message { max-width: 65%; padding: 8px 12px; border-radius: 8px; font-size: 15px; line-height: 1.4; word-break: break-word; }
        .message.sent { background: #005c4b; align-self: flex-end; color: #e9edef; }
        .message.received { background: #202c33; align-self: flex-start; color: #e9edef; }
        .message .sender { font-size: 12px; color: #8696a0; font-weight: bold; margin-bottom: 3px; display: block; }
        
        .chat-input-bar { background: #202c33; padding: 10px; display: none; align-items: center; gap: 10px; }
        .chat-input-bar input { margin: 0; background: #2a3942; border: none; }

        /* POPUP MODAL VOOR PLUS-KNOP */
        #group-modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); justify-content: center; align-items: center; z-index: 100; }
        .modal-content { background: #222e35; padding: 25px; border-radius: 10px; width: 90%; max-width: 400px; position: relative; }
        .close-modal { position: absolute; top: 10px; right: 15px; font-size: 20px; cursor: pointer; color: #8696a0; }
        .modal-tabs { display: flex; gap: 10px; margin-bottom: 15px; }
        .tab-btn { flex: 1; padding: 8px; background: #2a3942; border: none; color: #fff; cursor: pointer; border-radius: 4px; }
        .tab-btn.active { background: #00a884; }
        
        /* ONLINE STATUS SPELERS */
        .online-status-bar { padding: 10px 15px; background: #182229; font-size: 13px; color: #8696a0; border-bottom: 1px solid #222e35; }
      </style>
    </head>
    <body>

      <!-- INLOGSCHERM -->
      <div id="login-screen">
        <h2>Josh-chatwebsite</h2>
        <input id="username" type="text" placeholder="Kies een gebruikersnaam...">
        <button onclick="login()">Open WhatsApp-Chat</button>
      </div>

      <!-- MAIN APP INTERFACE -->
      <div id="chat-screen">
        <div class="app-container">
          
          <!-- SIDEBAR -->
          <div class="sidebar">
            <div class="sidebar-header">
              <h3 id="my-name">Mijn Chat</h3>
              <div class="plus-btn" onclick="openModal()">+</div>
            </div>
            <div class="online-status-bar" id="user-list">Online spelers: 0</div>
            <div class="group-list" id="rooms-list"></div>
          </div>

          <!-- CHAT WINDOW -->
          <div class="chat-area" id="chat-area">
            <div class="chat-header" id="chat-header">
              <h3 id="current-group-title">Selecteer een groep</h3>
            </div>
            <div class="messages-container" id="messages">
              <div style="text-align:center; color:#8696a0; margin-top:200px;">Klik op het plusje om een groep te maken of te joinen!</div>
            </div>
            <div class="chat-input-bar" id="input-bar">
              <input id="msg-text" type="text" placeholder="Typ een bericht..." onkeypress="checkEnter(event)">
              <button onclick="sendMessage()" style="width:auto; padding: 12px 25px;">Stuur</button>
            </div>
          </div>

        </div>
      </div>

      <!-- POPUP DIALOG VOOR GROEPEN -->
      <div id="group-modal">
        <div class="modal-content">
          <span class="close-modal" onclick="closeModal()">&times;</span>
          <div class="modal-tabs">
            <button class="tab-btn active" id="tab-join" onclick="switchTab('join')">Groep Joinen</button>
            <button class="tab-btn" id="tab-create" onclick="switchTab('create')">Nieuwe Groep</button>
          </div>
          <input id="modal-group-name" type="text" placeholder="Groepsnaam">
          <input id="modal-group-pin" type="password" placeholder="Wachtwoord / PIN">
          <button id="modal-submit-btn" onclick="handleGroupSubmit()">Join Groep</button>
        </div>
      </div>

      <script src="/socket.io/socket.io.js"></script>
      <script>
        const socket = io();
        let myUsername = "";
        let currentRoom = "";
        let currentTab = "join";
        let joinedRooms = [];

        function login() {
          myUsername = document.getElementById('username').value.trim();
          if(!myUsername) return alert('Vul een naam in');
          socket.emit('user-online', myUsername);
          document.getElementById('login-screen').style.display = 'none';
          document.getElementById('chat-screen').style.display = 'block';
          document.getElementById('my-name').innerText = myUsername;
        }

        function openModal() { document.getElementById('group-modal').style.display = 'flex'; }
        function closeModal() { document.getElementById('group-modal').style.display = 'none'; }
        
        function switchTab(type) {
          currentTab = type;
          document.getElementById('tab-join').classList.toggle('active', type === 'join');
          document.getElementById('tab-create').classList.toggle('active', type === 'create');
          document.getElementById('modal-submit-btn').innerText = type === 'join' ? 'Join Groep' : 'Maak Groep';
        }

        function handleGroupSubmit() {
          const name = document.getElementById('modal-group-name').value.trim();
          const pin = document.getElementById('modal-group-pin').value.trim();
          if(!name || !pin) return alert('Vul alle velden in');

          if(currentTab === 'create') {
            socket.emit('create-group', { name, pin });
          } else {
            socket.emit('join-group', { name, pin });
          }
          closeModal();
          document.getElementById('modal-group-name').value = '';
          document.getElementById('modal-group-pin').value = '';
        }

        function selectRoom(roomName) {
          currentRoom = roomName;
          document.getElementById('chat-header').style.display = 'flex';
          document.getElementById('input-bar').style.display = 'flex';
          document.getElementById('current-group-title').innerText = roomName;
          
          document.querySelectorAll('.group-item').forEach(item => {
            item.classList.toggle('active', item.dataset.name === roomName);
          });

          socket.emit('get-messages', roomName);
        }

        function sendMessage() {
          const text = document.getElementById('msg-text').value.trim();
          if(!text || !currentRoom) return;
          socket.emit('send-message', { room: currentRoom, sender: myUsername, text });
          document.getElementById('msg-text').value = '';
        }

        function checkEnter(e) { if(e.key === 'Enter') sendMessage(); }

        socket.on('group-joined', (roomName) => {
          if(!joinedRooms.includes(roomName)) {
            joinedRooms.push(roomName);
            updateRoomsSidebar();
          }
          selectRoom(roomName);
        });

        function updateRoomsSidebar() {
          let html = '';
          joinedRooms.forEach(room => {
            html += \`<div class="group-item" data-name="\${room}" onclick="selectRoom('\${room}')">
              <b># \${room}</b>
              <span style="font-size:11px; color:#00a884;">actief</span>
            </div>\`;
          });
          document.getElementById('rooms-list').innerHTML = html;
        }

        socket.on('receive-message', (data) => {
          if(data.room !== currentRoom) return;
          const container = document.getElementById('messages');
          const isSentByMe = data.sender === myUsername;
          
          container.innerHTML += \`
            <div class="message \${isSentByMe ? 'sent' : 'received'}">
              \${!isSentByMe ? \`<span class="sender">\${data.sender}</span>\` : ''}
              \${data.text}
            </div>
          \`;
          container.scrollTop = container.scrollHeight;
        });

        socket.on('chat-history', (messages) => {
          const container = document.getElementById('messages');
          container.innerHTML = '';
          messages.forEach(msg => {
            const isSentByMe = msg.sender === myUsername;
            container.innerHTML += \`
              <div class="message \${isSentByMe ? 'sent' : 'received'}">
                \${!isSentByMe ? \`<span class="sender">\${msg.sender}</span>\` : ''}
                \${msg.text}
              </div>
            \`;
          });
          container.scrollTop = container.scrollHeight;
        });

        socket.on('update-users', (users) => {
          let onlineCount = users.filter(u => u.isOnline).length;
          document.getElementById('user-list').innerText = \`Online spelers: \${onlineCount}\`;
        });

        socket.on('err', (msg) => alert(msg));
      </script>
    </body>
    </html>
  `);
});

io.on('connection', (socket) => {
  socket.on('user-online', async (username) => {
    socket.username = username;
    await User.findOneAndUpdate({ username }, { isOnline: true }, { upsert: true });
    const users = await User.find({});
    io.emit('update-users', users);
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

  socket.on('get-messages', async (room) => {
    const history = await Message.find({ room }).sort({ timestamp: 1 });
    socket.emit('chat-history', history);
  });

  socket.on('send-message', async ({ room, sender, text }) => {
    const msg = new Message({ room, sender, text });
    await msg.save();
    io.to(room).emit('receive-message', { room, sender, text });
  });

  socket.on('disconnect', async () => {
    if (socket.username) {
      await User.findOneAndUpdate({ username: socket.username }, { isOnline: false });
      const users = await User.find({});
      io.emit('update-users', users);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Server draait!'));
