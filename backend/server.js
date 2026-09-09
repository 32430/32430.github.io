const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { WebSocketServer } = require('ws');

const app = express();
app.use(cors());
app.use(express.json());

// 静的ファイルの配信
app.use(express.static(path.join(__dirname, '../')));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

let recentImages = [];

// WebSocket接続管理（スマホとPCのシグナリング中継）
wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
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

// トップページアクセス時に `florrio.html` を返す
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../florrio.html'));
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
