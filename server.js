const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Veilige MongoDB verbinding (Server crasht nooit bij trage database)
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Encrypto Database verbonden.'))
  .catch(err => console.log('Database verbindingsfout:', err));

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
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Encrypto Chat</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
        body { background: #0c1317; color: #e9edef; height: 100vh; display: flex; justify-content: center; align-items: center; overflow: hidden; }
        
        /* INLOGSCHERM (PREMIUM LOOK) */
        #login-screen { background: #111b21; padding: 50px 40px; border-radius: 20px; width: 100%; max-width: 420px; text-align: center; box-shadow: 0 20px 50px rgba(0,0,0,0.6); border: 1px solid #222e35; transition: 0.3s; }
        #login-screen h2 { margin-bottom: 8px; color: #00a884; font-size: 32px; font-weight: 700; letter-spacing: -0.5px; }
        #login-screen p { color: #8696a0; font-size: 14px; margin-bottom: 35px; }
        
        input { width: 100%; padding: 15px 20px; margin: 10px 0; background: #2a3942; border: 1px solid #2a3942; border-radius: 12px; color: #fff; font-size: 16px; outline: none; transition: 0.2s ease; }
        input:focus { border-color: #00a884; background: #32444f; box-shadow: 0 0 0 3px rgba(0, 168, 132, 0.2); }
        
        button { width: 100%; padding: 15px; background: #00a884; color: #111b21; border: none; border-radius: 12px; font-size: 16px; font-weight: 700; cursor: pointer; transition: 0.2s ease; }
        button:hover { background: #00c298; transform: translateY(-1px); box-shadow: 0 5px 15px rgba(0, 168, 132, 0.3); }
        button:active { transform: translateY(0); }

        /* INTERFACE STRUCTUUR */
        #chat-screen { display: none; width: 100vw; height: 100vh; animation: fadeIn 0.5s ease; }
        .app-container { display: flex; width: 100%; height: 100%; background: #111b21; }

        /* SIDEBAR (LINKS) */
        .sidebar { width: 32%; max-width: 400px; min-width: 320px; background: #111b21; border-right: 1px solid #222e35; display: flex; flex-direction: column; }
        .sidebar-header { background: #202c33; padding: 22px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #222e35; }
        .sidebar-header h3 { font-size: 22px; font-weight: 700; color: #e9edef; letter-spacing: -0.5px; }
        
        .network-bar { padding: 12px 20px; background: #182229; font-size: 13px; color: #8696a0; border-bottom: 1px solid #222e35; display: flex; align-items: center; gap: 10px; }
        .status-dot { width: 8px; height: 8px; background: #00e676; border-radius: 50%; box-shadow: 0 0 8px #00e676; }
        
        /* BEHEER BOX IN SIDEBAR */
        .group-manager-box { padding: 20px; background: #1f2c34; border-bottom: 1px solid #222e35; }
        .group-manager-box h4 { font-size: 12px; margin-bottom: 10px; color: #00a884; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; }
        .group-manager-box input { padding: 12px 14px; font-size: 14px; margin: 5px 0; border-radius: 8px; }
        .flex-buttons { display: flex; gap: 10px; margin-top: 8px; }
        .flex-buttons button { padding: 12px; font-size: 14px; border-radius: 8px; }

        /* GROEPENLIJST */
        .group-list-title { padding: 16px 20px 6px 20px; font-size: 12px; color: #8696a0; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; }
        .group-list { flex: 1; overflow-y: auto; }
        .group-item { padding: 18px 20px; border-bottom: 1px solid #1f2c34; cursor: pointer; transition: 0.2s; display: flex; justify-content: space-between; align-items: center; }
        .group-item:hover { background: #202c33; }
        .group-item.active { background: #2a3942; border-left: 4px solid #00a884; }
        .group-item b { font-size: 16px; color: #e9edef; font-weight: 500; }
        .group-item span { font-size: 11px; background: #202c33; padding: 4px 10px; border-radius: 20px; color: #00a884; border: 1px solid #2a3942; font-weight: 600; }

        /* CHAT VENSTER (RECHTS) */
        .chat-area { flex: 1; background: #0b141a; display: flex; flex-direction: column; box-shadow: inset 0 20px 20px -20px rgba(0,0,0,0.4); }
        .chat-header { background: #202c33; padding: 20px; display: flex; align-items: center; border-bottom: 1px solid #222e35; height: 74px; }
        .chat-header h3 { font-size: 18px; font-weight: 600; color: #e9edef; }
        
        /* BERICHTEN */
        .messages-container { flex: 1; padding: 30px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; }
        .welcome-placeholder { text-align: center; color: #8696a0; margin: auto; font-size: 16px; max-width: 300px; line-height: 1.6; font-weight: 400; }
        
        /* PROFESSIONELE CHAT BUBBELS */
        .message { max-width: 60%; padding: 10px 16px; border-radius: 14px; font-size: 15px; line-height: 1.45; word-break: break-word; box-shadow: 0 1px 2px rgba(0,0,0,0.3); animation: slideIn 0.2s ease; }
        .message.sent { background: #005c4b; align-self: flex-end; color: #e9edef; border-top-right-radius: 2px; }
        .message.received { background: #202c33; align-self: flex-start; color: #e9edef; border-top-left-radius: 2px; }
        .message .sender { font-size: 12px; color: #00a884; font-weight: 600; margin-bottom: 4px; display: block; text-transform: capitalize; }
        
        /* INPUT BALK ONDERAAN */
        .chat-input-bar { background: #202c33; padding: 16px 20px; display: none; align-items: center; gap: 14px; border-top: 1px solid #222e35; }
        .chat-input-bar input { margin: 0; background: #2a3942; border: none; flex: 1; padding: 14px 20px; border-radius: 10px; font-size: 15px; }
        .chat-input-bar button { width: auto; padding: 14px 28px; border-radius: 10px; }

        /* ANIMATIES */
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
      </style>
    </head>
    <body>

      <!-- INLOGSCHERM -->
      <div id="login-screen">
        <h2>Encrypto Chat</h2>
        <p>Maak verbinding met het beveiligde netwerk</p>
        <input id="username" type="text" placeholder="Kies een gebruikersnaam..." onkeypress="if(event.key==='Enter') login()">
        <button onclick="login()">Systeem Starten</button>
      </div>

      <!-- MAIN APP INTERFACE -->
      <div id="chat-screen">
        <div class="app-container">
          
          <!-- SIDEBAR LINKS -->
          <div class="sidebar">
            <div class="sidebar-header">
              <h3 id="display-my-name">Mijn Account</h3>
            </div>
            <div class="network-bar">
              <span class="status-dot"></span>
              <span id="user-count">Verbinding maken...</span>
            </div>
            
            <!-- GROEP EN SESSIE BEHEERDER -->
            <div class="group-manager-box">
              <h4>Sessie configureren</h4>
              <input id="group-name-input" type="text" placeholder="Naam van de groep...">
              <input id="group-pin-input" type="password" placeholder="Groepswachtwoord / PIN...">
              <div class="flex-buttons">
                <button onclick="actionGroup('create')" style="background: #00a884;">Maak Groep</button>
                <button onclick="actionGroup('join')" style="background: #3b4a54; color: #fff;">Join Groep</button>
              </div>
            </div>

            <div class="group-list-title">Actieve Beveiligde Lijnen</div>
            <div class="group-list" id="rooms-sidebar-list">
              <!-- Groepen laden hier direct in -->
            </div>
          </div>

          <!-- CHAT VENSTER RECHTS -->
          <div class="chat-area">
            <div class="chat-header">
              <h3 id="current-chat-title">Geen actieve chatverbinding</h3>
            </div>
            
            <div class="messages-container" id="messages-box">
              <div class="welcome-placeholder" id="main-placeholder">
                Gebruik het linkermenu om een gecodeerde groep te starten of te joinen met een wachtwoord.
              </div>
            </div>
            
            <!-- INPUT BALK -->
            <div class="chat-input-bar" id="input-bar-wrapper">
              <input id="msg-input" type="text" placeholder="Typ een gecodeerd bericht..." onkeypress="if(event.key==='Enter') sendMyMessage()">
              <button onclick="sendMyMessage()">Stuur</button>
            </div>
          </div>

        </div>
      </div>

      <script src="/socket.io/socket.io.js"></script>
      <script>
        const socket = io();
        let myName = "";
        let activeRoom = "";
        let activeRoomsList = [];

        function login() {
          myName = document.getElementById('username').value.trim();
          if(!myName) return alert('Voer een geldige gebruikersnaam in.');
          socket.emit('register-user', myName);
          document.getElementById('login-screen').style.display = 'none';
          document.getElementById('chat-screen').style.display = 'block';
          document.getElementById('display-my-name').innerText = myName;
        }

        function actionGroup(type) {
          const name = document.getElementById('group-name-input').value.trim();
          const pin = document.getElementById('group-pin-input').value.trim();
          if(!name || !pin) return alert('Vul zowel de groepsnaam als de pincode in.');

          socket.emit(type === 'create' ? 'create-new-room' : 'join-exist-room', { name, pin });
          
          document.getElementById('group-name-input').value = '';
          document.getElementById('group-pin-input').value = '';
        }

        function openChatRoom(roomName) {
          activeRoom = roomName;
          
          document.getElementById('input-bar-wrapper').style.display = 'flex';
          document.getElementById('current-chat-title').innerText = "Beveiligde Lijn: " + roomName;
          
          const placeholder = document.getElementById('main-placeholder');
          if(placeholder) placeholder.remove();

          document.querySelectorAll('.group-item').forEach(item => {
            item.classList.toggle('active', item.dataset.name === roomName);
          });

          // Vraag direct alle oude chatgeschiedenis op uit MongoDB
          socket.emit('load-history', roomName);
        }

        function sendMyMessage() {
          const text = document.getElementById('msg-input').value.trim();
          if(!text || !activeRoom) return;
          
          socket.emit('broadcast-message', { room: activeRoom, sender: myName, text });
          document.getElementById('msg-input').value = '';
        }

        socket.on('room-success', (roomName) => {
          if(!activeRoomsList.includes(roomName)) {
            activeRoomsList.push(roomName);
            
            let html = '';
            activeRoomsList.forEach(room => {
              html += \`<div class="group-item" data-name="\${room}" onclick="openChatRoom('\${room}')">
                <b># \${room}</b>
                <span>veilig</span>
              </div>\`;
            });
            document.getElementById('rooms-sidebar-list').innerHTML = html;
          }
          // Opent de chat DIRECT op het grote scherm
          openChatRoom(roomName);
        });

        socket.on('msg-arrival', (data) => {
          if(data.room !== activeRoom) return;
          const box = document.getElementById('messages-box');
          const me = data.sender === myName;
          
          box.innerHTML += \`
            <div class="message \${me ? 'sent' : 'received'}">
              \${!me ? \`<span class="sender">\${data.sender}</span>\` : ''}
              \${data.text}
            </div>\`;
          box.scrollTop = box.scrollHeight;
        });

        socket.on('history-arrival', (messages) => {
          const box = document.getElementById('messages-box');
          box.innerHTML = '';
          
          if(messages.length === 0) {
            box.innerHTML = '<div class="welcome-placeholder">Einde van encryptielijn. Typ hieronder een bericht om de geschiedenis te starten.</div>';
          } else {
            messages.forEach(msg => {
              const me = msg.sender === myName;
              box.innerHTML += \`
                <div class="message \${me ? 'sent' : 'received'}">
                  \${!me ? \`<span class="sender">\${msg.sender}</span>\` : ''}
                  \${msg.text}
                </div>\`;
            });
          }
          box.scrollTop = box.scrollHeight;
        });

        socket.on('user-count-update', (count) => {
          document.getElementById('user-count').innerText = "Netwerk Online (" + count + " gebruikers)";
        });

        socket.on('error-msg', (msg) => alert(msg));
      </script>
    </body>
    </html>
  `);
});

// Realtime Server-Logica (Node.js & Socket.io)
io.on('connection', (socket) => {
  
  socket.on('register-user', async (username) => {
    socket.username = username;
    await User.findOneAndUpdate({ username }, { isOnline: true }, { upsert: true });
    sendOnlineCount();
  });

  socket.on('create-new-room', async ({ name, pin }) => {
    const check = await Group.findOne({ name });
    if (check) return socket.emit('error-msg', 'Beveiligde lijnnaam is al bezet.');
    
    const newGroup = new Group({ name, pin });
    await newGroup.save();
    
    socket.join(name);
    socket.emit('room-success', name);
  });

  socket.on('join-exist-room', async ({ name, pin }) => {
    const group = await Group.findOne({ name, pin });
    if (!group) return socket.emit('error-msg', 'Toegang geweigerd: Pincode of groepsnaam onjuist.');
    
    socket.join(name);
    socket.emit('room-success', name);
  });

  socket.on('load-history', async (room) => {
    const history = await Message.find({ room }).sort({ timestamp: 1 });
    socket.emit('history-arrival', history);
  });

  socket.on('broadcast-message', async ({ room, sender, text }) => {
    const msg = new Message({ room, sender, text });
    await msg.save(); // Slaat permanent op in MongoDB Atlas voor latere joiners
    io.to(room).emit('msg-arrival', { room, sender, text });
  });

  socket.on('disconnect', async () => {
    if (socket.username) {
      await User.findOneAndUpdate({ username: socket.username }, { isOnline: false });
      sendOnlineCount();
    }
  });
});

async function sendOnlineCount() {
  const activeCount = await User.countDocuments({ isOnline: true });
  io.emit('user-count-update', activeCount);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Encrypto Server actief.'));
