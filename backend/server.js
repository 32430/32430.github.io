const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json()); // JSONデータを受け取れるようにする

// 最新の通知データを一時保存する変数
let latestNotification = { message: "まだ通知はありません", timestamp: null };

// 1. Kiwi Browser / スクリプトから通知を受け取るエンドポイント (POST)
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

// 2. 静的サイト側から最新の通知を確認するエンドポイント (GET)
app.get('/api/notification', (req, res) => {
  res.status(200).json(latestNotification);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
