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

// 最大10個までの通知・画像データを保持する配列
let recentImages = [];

// WebSocketの接続管理
wss.on('connection', (ws) => {
  // 接続時に現在の最新リストをすぐ送る
  ws.send(JSON.stringify({ type: 'init', list: recentImages }));
});

// 1. ユーザースクリプトからのデータ受信 (POST)
app.post('/api/notification', (req, res) => {
  const data = req.body;
  
  // データが空でないか確認（urlまたはmessage等のプロパティ）
  if (!data || (!data.url && !data.message)) {
    return res.status(400).send('Data is required');
  }

  const newEntry = {
    ...data,
    timestamp: new Date().toISOString()
  };

  // 配列の先頭に追加し、最大10個までに制限
  recentImages.unshift(newEntry);
  if (recentImages.length > 10) {
    recentImages.pop();
  }

  console.log('データを正常に受信・バッファ更新:', newEntry);

  // 接続中のすべてのWebSocketクライアントへリアルタイムプッシュ配信
  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.send(JSON.stringify({ type: 'update', list: recentImages }));
    }
  });

  res.status(200).json({ success: true, list: recentImages });
});

// GET用（ブラウザでアクセスした際のダッシュボード表示）
app.get('/', (req, res) => {
  let listItems = recentImages.map(item => {
    if (item.url) {
      return `<li>
        <a href="${item.url}" target="_blank">${item.url}</a><br>
        <img src="${item.url}" width="150" style="margin-top:5px; border-radius:4px;"><br>
        <small style="color:#aaa;">${item.timestamp || ''}</small>
      </li>`;
    } else {
      return `<li>
        ${item.message || JSON.stringify(item)}<br>
        <small style="color:#aaa;">${item.timestamp || ''}</small>
      </li>`;
    }
  }).join('');

  res.send(`
      <html>
          <head>
              <title>Discord & Florr.io Notification</title>
              <style>
                  body { background: #121212; color: #fff; font-family: sans-serif; padding: 20px; }
                  .card { background: #1e1e1e; padding: 20px; border-radius: 8px; max-width: 600px; margin: auto; box-shadow: 0 4px 15px rgba(0,0,0,0.5); }
                  ul { padding-left: 20px; }
                  li { margin-bottom: 20px; word-break: break-all; border-bottom: 1px solid #333; padding-bottom: 10px; }
                  img { display: block; }
              </style>
          </head>
          <body>
              <div class="card">
                  <h2>Recent Captured Media (Max 10)</h2>
                  <ul>${listItems || '<li>まだデータはありません</li>'}</ul>
              </div>
          </body>
      </html>
  `);
});

// リスト確認用のAPIエンドポイント
app.get('/api/notification', (req, res) => {
  res.status(200).json(recentImages);
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`WebSocket Server is running on port ${PORT}`);
});
