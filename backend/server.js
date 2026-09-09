const express = require('express');
const cors = require('cors');
const path = require('path'); // 追加

const app = express();
app.use(cors());
app.use(express.json());

// ★リポジトリのルートにあるファイル（florrio.htmlなど）を配信できるようにする
app.use(express.static(path.join(__dirname, '../')));

// 1. 通知を受け取るエンドポイント (POST)
let latestNotification = { message: "まだ通知はありません", timestamp: null };

app.post('/api/notification', (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).send('Message is required');
  }

  latestNotification = {
    message: message,
    timestamp: new Date().toISOString()
  };

  console.log('通知を受信しました:', latestNotification);
  res.status(200).json({ success: true, notification: latestNotification });
});

// 2. 最新の通知を確認するエンドポイント (GET)
app.get('/api/notification', (req, res) => {
  res.status(200).json(latestNotification);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
