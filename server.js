const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// MongoDB Verbinding
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Encrypto Database Succesvol Gekoppeld!'))
  .catch(err => console.error('Database Verbindingsfout:', err));

// Database Modellen
const User = mongoose.model('User', new mongoose.Schema({ username: String, isOnline: Boolean }));
const Group = mongoose.model('Group', new mongoose.Schema({ name: String, pin: String }));
const Message = mongoose.model('Message', new mongoose.Schema({ room: String, sender: String, text: String, timestamp: { type: Date, default: Date.now } }));

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="nl">
    <head>
      <meta charset="UTF-8">
      <title>Encrypto Chat</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #0c1317; color: #e9edef; height: 100vh; display: flex; justify-content: center; align-items: center; }
        
        /* INLOGSCHERM */
        #login-screen { background: #111b21; padding: 40px; border-radius: 12px; width: 100%; max-width: 420px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.5); border: 1px solid #222e35; }
        #login-screen h2 { margin-bottom: 10px; color: #00a884; font-size: 28px; font-weight: 600; }
        #login-screen p { color: #8696a0; font-size: 14px; margin-bottom: 25px; }
        input { width: 100%; padding: 14px; margin: 10px 0; background: #2a3942; border: 1px solid #3b4a54; border-radius: 8px; color: #fff; font-size: 16px; transition: 0.2s; }
        input:focus { outline: none; border-color: #00a884; background: #32444f; }
        button { width: 100%; padding: 14px; background: #00a884; color: #111b21; border: none; border-radius: 8px; font-size: 16px; font-weight: bold; cursor: pointer; transition: 0.2s; }
        button:hover { background: #00c298; transform: translateY(-1px); }

        /* HOOFD INTERFACE */
        #chat-screen { display: none; width: 100vw; height: 100vh; }
        .app-container { display: flex; width: 100%; height: 100%; background: #111b21; }

        /* SIDEBAR (LINKS) */
        .sidebar { width: 30%; max-width: 400px; min-width: 300px; background: #111b21; border-right: 1px solid #222e35; display: flex; flex-direction: column; }
        .sidebar-header { background: #202c33; padding: 16px; display: flex; justify-content: space-between; align-items: center; }
        .sidebar-header h3 { font-size: 20px; font-weight: 600; color: #e9edef; }
        .plus-btn { background: #00a884; color: #111b21; width: 36px; height: 36px; border-radius: 50%; font-size: 22px; display: flex; align-items: center; justify-content: center; cursor: pointer; border: none; font-weight: bold; transition: 0.2s; }
        .plus-btn:hover { background: #00c298; rotate: 90deg; }
        .online-status-bar { padding: 12px 16px; background: #182229; font-size: 14px; color: #8696a0; border-bottom: 1px solid #222e35; display: flex; align-items: center; gap: 8px; }
        .status-dot { width: 8px; height: 8px; background: #00e676; border-radius: 50%; display: inline-block; }
        .group-list { flex: 1; overflow-y: auto; background: #111b21; }
        .group-item { padding: 20px 16px; border-bottom: 1px solid #222e35; cursor: pointer; transition: 0.2s; display: flex; flex-direction: column; gap: 4px; }
        .group-item:hover { background: #202c33; }
        .group-item.active { background: #2a3942; border-left: 4px solid #00a884; }
        .group-item b { font-size: 16px; color: #e9edef; }
        .group-item span { font-size: 12px; color: #00a884; font-weight: 500; }

        /* CHAT VENSTER (RECHTS) */
        .chat-area { flex: 1; background: #0b141a; display: flex; flex-direction: column; }
        .chat-header { background: #202c33; padding: 16px; display: flex; align-items: center; border-bottom: 1px solid #222e35; height: 69px; }
        .chat-header h3 { font-size: 17px; font-weight: 600; color: #e9edef; }
        
        /* BERICHTENLIJST */
        .messages-container { flex: 1; padding: 24px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; }
        .no-chat-placeholder { text-align: center; color: #8696a0; margin: auto; font-size: 16px; max-width: 320px; line-height: 1.5; }
        
        /* PROFESSIONELE BERICHT BLUBBERS */
        .message { max-width: 60%; padding: 10px 14px; border-radius: 8px; font-size: 15px; line-height: 1.4; word-break: break-word; position: relative; box-shadow: 0 1px 2px rgba(0,0,0,0.2); }
        .message.sent { background: #005c4b; align-self: flex-end; color: #e9edef; border-top-right-radius: 0; }
        .message.received { background: #202c33; align-self: flex-start; color: #e9edef; border-top-left-radius: 0; }
        .message .sender { font-size: 12px; color: #00a884; font-weight: 600; margin-bottom: 4px; display: block; }
        
        /* AFGESCHERMDE INPUT BALK */
        .chat-input-bar { background: #202c33; padding: 12px 20px; display: none; align-items: center; gap: 12px; }
        .chat-input-bar input { margin: 0; background: #2a3942; border: none; flex: 1; padding: 12px 16px; }

        /* POPUP DIALOG */
        #group-modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); justify-content: center; align-items: center; z-index: 1000; }
        .modal-content { background: #222e35; padding: 30px; border-radius: 14px; width: 90%; max-width: 420px; position: relative; border: 1px solid #3b4a54; }
        .close-modal { position: absolute; top: 14px; right: 20px; font-size: 28px; cursor: pointer; color: #8696a0; transition: 0.2s; }
        .close-modal:hover { color: #fff; }
        .modal-tabs { display: flex; gap: 10px; margin-bottom: 20px; }
        .tab-btn { flex: 1; padding: 12px; background: #2a3942; border: none; color: #8696a0; cursor: pointer; border-radius: 6px; font-weight: 600; font-size: 15px; transition: 0.2s; }
        .tab-btn.active { background: #00a884; color: #111b21; }
      </style>
    </head>
    <body>

      <!-- INLOGSCHERM -->
      <div id="login-screen">
        <h2>Encrypto Chat</h2>
        <p>Veilig, afgeschermd en realtime chatten</p>
        <input id="username" type="text" placeholder="Voer uw gebruikersnaam in..." onkeypress="if(event.key==='Enter') login()">
        <button onclick="login()">Verbinding Maken</button>
      </div>

      <!-- MAIN INTERFACE -->
      <div id="chat-screen">
        <div class="app-container">
          
          <!-- SIDEBAR LINKS -->
          <div class="sidebar">
            <div class="sidebar-header">
              <h3>Encrypto Chat</h3>
              <button class="plus-btn" onclick="openModal()">+</button>
            </div>
            <div class="online-status-bar">
              <span class="status-dot"></span>
              <span id="user-count">Netwerkstatus laden...</span>
            </div>
            <div class="group-list" id="rooms-list">
              <!-- Gekoppelde kamers verschijnen hier -->
            </div>
          </div>

          <!-- CHAT VENSTER RECHTS -->
          <div class="chat-area">
            <div class="chat-header">
              <h3 id="current-group-title">Geen actieve beveiligde sessie</h3>
            </div>
            
            <div class="messages-container" id="messages">
              <div class="no-chat-placeholder" id="main-placeholder">
                Klik op de <b>+ knop</b> linksboven om een chatgroep aan te maken of te joinen met een wachtwoordbeveiliging.
              </div>
            </div>
            
            <!-- VERSTUUR BALK (Standaard onzichtbaar tot kamer-auth) -->
            <div class="chat-input-bar" id="chat-input-wrapper">
              <input id="msg-text" type="text" placeholder="Typ een beveiligd bericht..." onkeypress="checkEnter(event)">
              <button onclick="sendMessage()" style="width:auto; padding: 12px 30px;">Stuur</button>
            </div>
          </div>

        </div>
      </div>

      <!-- POPUP MODAL -->
      <div id="group-modal">
        <div class="modal-content">
          <span class="close-modal" onclick="closeModal()">&times;</span>
          <div class="modal-tabs">
            <button class="tab-btn active" id="tab-join" onclick="switchTab('join')">Sessie Joinen</button>
            <button class="tab-btn" id="tab-create" onclick="switchTab('create')">Nieuwe Sessie</button>
          </div>
          <input id="modal-group-name" type="text" placeholder="Naam van de chatgroep">
          <input id="modal-group-pin" type="password" placeholder="Groepswachtwoord / PIN">
          <button id="modal-submit-btn" onclick="handleGroupSubmit()">Deelnemen aan groep</button>
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
          if(!myUsername) return alert('Voer een geldige naam in.');
          socket.emit('user-online', myUsername);
          document.getElementById('login-screen').style.display = 'none';
          document.getElementById('chat-screen').style.display = 'block';
        }

        function openModal() { document.getElementById('group-modal').style.display = 'flex'; }
        function closeModal() { document.getElementById('group-modal').style.display = 'none'; }
        
        function switchTab(type) {
          currentTab = type;
          document.getElementById('tab-join').classList.toggle('active', type === 'join');
          document.getElementById('tab-create').classList.toggle('active', type === 'create');
          document.getElementById('modal-submit-btn').innerText = type === 'join' ? 'Deelnemen aan groep' : 'Groep Genereren';
        }

        function handleGroupSubmit() {
          const name = document.getElementById('modal-group-name').value.trim();
          const pin = document.getElementById('modal-group-pin').value.trim();
          if(!name || !pin) return alert('Vul alle beveiligingsvelden in.');

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
          
          // Toon invoervelden pas NADAT een kamer actief is gekozen/geautoriseerd
          document.getElementById('chat-input-wrapper').style.display = 'flex';
          document.getElementById('current-group-title').innerText = "Beveiligde Lijn: " + roomName;
          
          document.querySelectorAll('.group-item').forEach(item => {
            item.classList.toggle('active', item.dataset.name === roomName);
          });

          // Haal database-geschiedenis op voor deze specifieke kamer
          socket.emit('get-messages', roomName);
        }

        function sendMessage() {
          const text = document.getElementById('msg-text').value.trim();
          if(!text || !currentRoom) return;
          
          // Verstuur live naar server
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
              <span>Verbinding actief</span>
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
            </div>\`;
          container.scrollTop = container.scrollHeight;
        });

        socket.on('chat-history', (messages) => {
          const container = document.getElementById('messages');
          container.innerHTML = ''; 
          
          if(messages.length === 0) {
            container.innerHTML = '<div class="no-chat-placeholder">Einde van encryptie-lijn. Geen eerdere berichten. Start het gesprek hieronder...</div>';
          } else {
            messages.forEach(msg => {
              const isSentByMe = msg.sender === myUsername;
              container.innerHTML += \`
                <div class="message \${isSentByMe ? 'sent' : 'received'}">
                  \${!isSentByMe ? \`<span class="sender">\${msg.sender}</span>\` : ''}
                  \${msg.text}
                </div>\`;
            });
          }
          container.scrollTop = container.scrollHeight;
        });

        socket.on('update-users', (users) => {
          let onlineCount = users.filter(u => u.isOnline).length;
          document.getElementById('user-count').innerText = \`Gebruikers online in netwerk: \${onlineCount}\`;
        });

        socket.on('err', (msg) => alert(msg));
      </script>
    </body>
    </html>
  `);
});

// Socket Realtime Communicatie
io.on('connection', (socket) => {
  
  socket.on('user-online', async (username) => {
    socket.username = username;
    await User.findOneAndUpdate({ username }, { isOnline: true }, { upsert: true });
    const users = await User.find({});
    io.emit('update-users', users);
  });

  socket.on('create-group', async ({ name, pin }) => {
    const exists = await Group.findOne({ name });
    if (exists) return socket.emit('err', 'Sessie-naam is al bezet door een andere encryptielijn.');
    
    const newGroup = new Group({ name, pin });
    await newGroup.save();
    
    socket.join(name);
    socket.emit('group-joined', name);
  });

  socket.on('join-group', async ({ name, pin }) => {
    const group = await Group.findOne({ name, pin });
    if (!group) return socket.emit('err', 'Toegang geweigerd: Onjuiste groepsnaam of pincode.');
    
    socket.join(name);
    socket.emit('group-joined', name);
  });

  socket.on('get-messages', async (room) => {
    const history = await Message.find({ room }).sort({ timestamp: 1 });
    socket.emit('chat-history', history);
  });

  socket.on('send-message', async ({ room, sender, text }) => {
    const msg = new Message({ room, sender, text });
    await msg.save(); // Sla permanent op in MongoDB Atlas
    
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
server.listen(PORT, () => console.log('Encrypto Server Actief.'));
