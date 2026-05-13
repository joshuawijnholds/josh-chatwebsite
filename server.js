const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Veilige MongoDB verbinding (server start altijd, ook bij trage database)
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Database operationeel'))
  .catch(err => console.log('Database wachtwoord of URI klopt niet:', err));

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
        
        /* INLOGSCHERM */
        #login-screen { background: #111b21; padding: 40px 30px; border-radius: 16px; width: 100%; max-width: 400px; text-align: center; box-shadow: 0 12px 40px rgba(0,0,0,0.5); border: 1px solid #222e35; }
        #login-screen h2 { margin-bottom: 8px; color: #00a884; font-size: 28px; font-weight: 600; }
        #login-screen p { color: #8696a0; font-size: 14px; margin-bottom: 30px; }
        
        input { width: 100%; padding: 14px 18px; margin: 10px 0; background: #2a3942; border: 1px solid #3b4a54; border-radius: 10px; color: #fff; font-size: 16px; outline: none; transition: 0.2s; }
        input:focus { border-color: #00a884; background: #32444f; }
        
        button { width: 100%; padding: 14px; background: #00a884; color: #111b21; border: none; border-radius: 10px; font-size: 16px; font-weight: 700; cursor: pointer; transition: 0.2s; }
        button:hover { background: #00c298; transform: translateY(-1px); }

        /* HOOFDMENU EN CHAT STRUCTUUR */
        #chat-screen { display: none; width: 100vw; height: 100vh; }
        .app-container { display: flex; width: 100%; height: 100%; background: #111b21; }

        /* SIDEBAR (LINKS) */
        .sidebar { width: 35%; max-width: 420px; min-width: 320px; background: #111b21; border-right: 1px solid #222e35; display: flex; flex-direction: column; }
        .sidebar-header { background: #202c33; padding: 20px 16px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #222e35; }
        .sidebar-header h3 { font-size: 20px; font-weight: 600; }
        
        .network-bar { padding: 12px 16px; background: #182229; font-size: 13px; color: #8696a0; border-bottom: 1px solid #222e35; display: flex; align-items: center; gap: 8px; }
        .status-dot { width: 8px; height: 8px; background: #00e676; border-radius: 50%; }
        
        /* GROEP FORMULIER IN SIDEBAR (MAKKELIJKER!) */
        .group-manager-box { padding: 16px; background: #1f2c34; border-bottom: 1px solid #222e35; }
        .group-manager-box h4 { font-size: 14px; margin-bottom: 8px; color: #00a884; text-transform: uppercase; letter-spacing: 0.5px; }
        .group-manager-box input { padding: 10px 12px; font-size: 14px; margin: 4px 0; border-radius: 6px; }
        .flex-buttons { display: flex; gap: 8px; margin-top: 6px; }
        .flex-buttons button { padding: 10px; font-size: 14px; border-radius: 6px; }

        .group-list { flex: 1; overflow-y: auto; padding-top: 5px; }
        .group-list-title { padding: 12px 16px 4px 16px; font-size: 12px; color: #8696a0; text-transform: uppercase; }
        .group-item { padding: 16px; border-bottom: 1px solid #222e35; cursor: pointer; transition: 0.2s; display: flex; justify-content: space-between; align-items: center; }
        .group-item:hover { background: #202c33; }
        .group-item.active { background: #2a3942; border-left: 4px solid #00a884; }
        .group-item b { font-size: 16px; color: #e9edef; }
        .group-item span { font-size: 11px; background: #202c33; padding: 4px 8px; border-radius: 12px; color: #00a884; border: 1px solid #2a3942; }

        /* CHAT VENSTER (RECHTS) */
        .chat-area { flex: 1; background: #0b141a; display: flex; flex-direction: column; }
        .chat-header { background: #202c33; padding: 16px; display: flex; align-items: center; border-bottom: 1px solid #222e35; height: 69px; }
        .chat-header h3 { font-size: 18px; font-weight: 600; color: #e9edef; }
        
        /* BERICHTENSTRUCKTEER */
        .messages-container { flex: 1; padding: 24px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; background-color: #0b141a; }
        .welcome-placeholder { text-align: center; color: #8696a0; margin: auto; font-size: 15px; max-width: 280px; line-height: 1.5; }
        
        /* CHAT BUBBELS */
        .message { max-width: 65%; padding: 10px 14px; border-radius: 12px; font-size: 15px; line-height: 1.4; word-break: break-word; box-shadow: 0 1px 1px rgba(0,0,0,0.2); }
        .message.sent { background: #005c4b; align-self: flex-end; color: #e9edef; border-top-right-radius: 2px; }
        .message.received { background: #202c33; align-self: flex-start; color: #e9edef; border-top-left-radius: 2px; }
        .message .sender { font-size: 12px; color: #00a884; font-weight: 600; margin-bottom: 3px; display: block; }
        
        /* VERSTUUR BALK */
        .chat-input-bar { background: #202c33; padding: 12px 16px; display: none; align-items: center; gap: 12px; border-top: 1px solid #222e35; }
        .chat-input-bar input { margin: 0; background: #2a3942; border: none; flex: 1; padding: 12px 16px; border-radius: 8px; }
        .chat-input-bar button { width: auto; padding: 12px 24px; border-radius: 8px; }
      </style>
    </head>
    <body>

      <!-- INLOGSCHERM -->
      <div id="login-screen">
        <h2>Encrypto Chat</h2>
        <p>Voer een naam in om het systeem te starten</p>
        <input id="username" type="text" placeholder="Gebruikersnaam..." onkeypress="if(event.key==='Enter') login()">
        <button onclick="login()">Verbinding Maken</button>
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
              <span id="user-count">Netwerk actief</span>
            </div>
            
            <!-- GROEP REGISTRATIE / JOIN DRAAD -->
            <div class="group-manager-box">
              <h4>Sessie beheren</h4>
              <input id="group-name-input" type="text" placeholder="Groepsnaam...">
              <input id="group-pin-input" type="password" placeholder="Wachtwoord / PIN...">
              <div class="flex-buttons">
                <button onclick="actionGroup('create')" style="background: #00a884;">Maak Groep</button>
                <button onclick="actionGroup('join')" style="background: #3b4a54; color: #fff;">Join Groep</button>
              </div>
            </div>

            <div class="group-list-title">Mijn actieve groepen</div>
            <div class="group-list" id="rooms-sidebar-list">
              <!-- Groepen verschijnen hier direct -->
            </div>
          </div>

          <!-- CHAT VENSTER RECHTS -->
          <div class="chat-area">
            <div class="chat-header">
              <h3 id="current-chat-title">Geen chat geselecteerd</h3>
            </div>
            
            <div class="messages-container" id="messages-box">
              <div class="welcome-placeholder" id="main-placeholder">
                Gebruik het formulier links om een groep aan te maken of te joinen en start direct met typen.
              </div>
            </div>
            
            <!-- VERSTUUR BALK -->
            <div class="chat-input-bar" id="input-bar-wrapper">
              <input id="msg-input" type="text" placeholder="Typ een beveiligd bericht..." onkeypress="if(event.key==='Enter') sendMyMessage()">
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
          if(!myName) return alert('Vul een naam in.');
          socket.emit('register-user', myName);
          document.getElementById('login-screen').style.display = 'none';
          document.getElementById('chat-screen').style.display = 'block';
          document.getElementById('display-my-name').innerText = myName;
        }

        function actionGroup(type) {
          const name = document.getElementById('group-name-input').value.trim();
          const pin = document.getElementById('group-pin-input').value.trim();
          if(!name || !pin) return alert('Vul een groepsnaam en wachtwoord in.');

          socket.emit(type === 'create' ? 'create-new-room' : 'join-exist-room', { name, pin });
          
          // Maak invoervelden leeg
          document.getElementById('group-name-input').value = '';
          document.getElementById('group-pin-input').value = '';
        }

        function openChatRoom(roomName) {
          activeRoom = roomName;
          
          // Toon invoerbalk en verander titel
          document.getElementById('input-bar-wrapper').style.display = 'flex';
          document.getElementById('current-chat-title').innerText = "Groep: " + roomName;
          
          // Verwijder placeholder indien aanwezig
          const placeholder = document.getElementById('main-placeholder');
          if(placeholder) placeholder.remove();

          // Markeer actieve groep aan de linkerkant
          document.querySelectorAll('.group-item').forEach(item => {
            item.classList.toggle('active', item.dataset.name === roomName);
          });

          // Vraag chatgeschiedenis op aan MongoDB
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
            
            // Bouw de linkerkant opnieuw op
            let html = '';
            activeRoomsList.forEach(room => {
              html += \`<div class="group-item" data-name="\${room}" onclick="openChatRoom('\${room}')">
                <b># \${room}</b>
                <span>verbonden</span>
              </div>\`;
            });
            document.getElementById('rooms-sidebar-list').innerHTML = html;
          }
          // Open direct de chat!
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
            box.innerHTML = '<div style="text-align:center; color:#8696a0; margin-top:20px;">Dit is het begin van deze beveiligde chatlijn.</div>';
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
          document.getElementById('user-count').innerText = "Netwerk actief (" + count + " online)";
        });

        socket.on('error-msg', (msg) => alert(msg));
      </script>
    </body>
    </html>
  `);
});

// Realtime Server-Logica
io.on('connection', (socket) => {
  
  socket.on('register-user', async (username) => {
    socket.username = username;
    await User.findOneAndUpdate({ username }, { isOnline: true }, { upsert: true });
    sendOnlineCount();
  });

  socket.on('create-new-room', async ({ name, pin }) => {
    const check = await Group.findOne({ name });
    if (check) return socket.emit('error-msg', 'Deze groepsnaam bestaat al!');
    
    const newGroup = new Group({ name, pin });
    await newGroup.save();
    
    socket.join(name);
    socket.emit('room-success', name);
  });

  socket.on('join-exist-room', async ({ name, pin }) => {
    const group = await Group.findOne({ name, pin });
    if (!group) return socket.emit('error-msg', 'Onjuiste groepsnaam of pincode!');
    
    socket.join(name);
    socket.emit('room-success', name);
  });

  socket.on('load-history', async (room) => {
    const history = await Message.find({ room }).sort({ timestamp: 1 });
    socket.emit('history-arrival', history);
  });

  socket.on('broadcast-message', async ({ room, sender, text }) => {
    const msg = new Message({ room, sender, text });
    await msg.save();
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
server.listen(PORT, () => console.log('Systeem online.'));
