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

let latestNotification = { message: "まだ通知はありません", timestamp: null };

// WebSocketの接続管理
wss.on('connection', (ws) => {
  // 接続時に現在の最新通知をすぐ送る
  ws.send(JSON.stringify(latestNotification));
});

// 1. Kiwi Browser / スクリプトからの通知受信 (POST)
app.post('/api/notification', (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).send('Message is required');
  }

  latestNotification = {
    message: message,
    timestamp: new Date().toISOString()
  };

  console.log('通知を受信、全クライアントへ即時送信:', latestNotification);

  // 接続中のすべてのクライアントへ瞬時にプッシュ配信
  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.send(JSON.stringify(latestNotification));
    }
  });

  res.status(200).json({ success: true, notification: latestNotification });
});

// GET用（バックアップ・初期確認用）
app.get('/api/notification', (req, res) => {
  res.status(200).json(latestNotification);
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`WebSocket Server is running on port ${PORT}`);
});
