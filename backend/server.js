const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { WebSocketServer } = require('ws');

const app = express();
app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, '../')));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

let recentImages = [];

// WebSocket接続管理（スマホとPCのシグナリング中継）
wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      // シグナリング用メッセージを他のクライアントへブロードキャスト
      if (data.type === 'offer' || data.type === 'answer' || data.type === 'candidate') {
        wss.clients.forEach((client) => {
          if (client !== ws && client.readyState === ws.OPEN) {
            client.send(JSON.stringify(data));
          }
        });
      }
    } catch (e) {
      console.error('WebSocket message error:', e);
    }
  });

  // 接続時に現在の画像リストも送信
  ws.send(JSON.stringify({ type: 'init', list: recentImages }));
});

// 画像通知の受信API
app.post('/api/notification', (req, res) => {
  const data = req.body;
  if (!data || (!data.url && !data.message)) {
    return res.status(400).send('Data is required');
  }

  const newEntry = { ...data, timestamp: new Date().toISOString() };
  recentImages.unshift(newEntry);
  if (recentImages.length > 10) recentImages.pop();

  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.send(JSON.stringify({ type: 'update', list: recentImages }));
    }
  });

  res.status(200).json({ success: true, list: recentImages });
});

// ダッシュボード画面（WebRTC受信プレビュー ＋ 画像リスト）
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Discord & Remote Monitor</title>
        <style>
          body { background: #121212; color: #fff; font-family: sans-serif; padding: 20px; }
          .container { max-width: 800px; margin: auto; }
          .card { background: #1e1e1e; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.5); }
          video { width: 100%; max-height: 400px; background: #000; border-radius: 6px; }
          ul { padding-left: 20px; }
          li { margin-bottom: 15px; word-break: break-all; border-bottom: 1px solid #333; padding-bottom: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="card">
            <h2>Live Remote Stream</h2>
            <video id="remoteVideo" autoplay playsinline controls></video>
          </div>
          <div class="card">
            <h2>Captured Media (Max 10)</h2>
            <ul id="list"><li>読み込み中...</li></ul>
          </div>
        </div>
        <script>
          const protocol = location.protocol === 'https:' ? 'wss://' : 'ws://';
          const ws = new WebSocket(protocol + location.host);
          let pc;
          const rtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

          ws.onmessage = async (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'init' || data.type === 'update') {
              renderList(data.list || data);
            } else if (data.type === 'offer') {
              pc = new RTCPeerConnection(rtcConfig);
              pc.ontrack = (e) => { document.getElementById('remoteVideo').srcObject = e.streams[0]; };
              pc.onicecandidate = (e) => { if (e.candidate) ws.send(JSON.stringify({ type: 'candidate', candidate: e.candidate })); };
              await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              ws.send(JSON.stringify({ type: 'answer', answer: answer }));
            } else if (data.type === 'candidate' && pc) {
              await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            }
          };

          function renderList(list) {
            const listElem = document.getElementById('list');
            if (!list || list.length === 0) { listElem.innerHTML = '<li>まだデータはありません</li>'; return; }
            listElem.innerHTML = list.map(item => \`
              <li>
                \${item.url ? \`<a href="\${item.url}" target="_blank" style="color:#4CAF50;">\${item.url}</a><br><img src="\${item.url}" width="150" style="margin-top:5px;border-radius:4px;">\` : item.message}
                <br><small style="color:#aaa;">\${item.timestamp || ''}</small>
              </li>
            \`).join('');
          }
        </script>
      </body>
    </html>
  `);
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
