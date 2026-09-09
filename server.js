const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { WebSocketServer } = require('ws');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// WebSocket接続管理（スマホとビューアーのシグナリング中継）
wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      // WebRTCのシグナリングメッセージを他のクライアントへ転送
      if (data.type === 'offer' || data.type === 'answer' || data.type === 'candidate') {
        wss.clients.forEach((client) => {
          if (client !== ws && client.readyState === ws.OPEN) {
            client.send(JSON.stringify(data));
          }
        });
      }
    } catch (e) {
      console.error('WebSocket error:', e);
    }
  });
});

// トップページ（florrio.html）を返す
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../florrio.html'));
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
