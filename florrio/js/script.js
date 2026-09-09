// Render等で公開している自分のAPIサーバーのURLを指定してください
const API_ENDPOINT = 'https://your-render-app-url.onrender.com/api/get-latest-messages'; 

const feedContainer = document.getElementById('notification-feed');
const statusElement = document.getElementById('connection-status');

// 画面に新しい通知カードを追加する関数
function appendNotification(content, timestamp) {
    // 初回のプレースホルダーがあれば消す
    const placeholder = feedContainer.querySelector('.placeholder');
    if (placeholder) {
        placeholder.remove();
    }

    const card = document.createElement('div');
    card.className = 'notification-card';

    const timeString = new Date(timestamp).toLocaleTimeString();

    card.innerHTML = `
        <div class="notification-time">${timeString}</div>
        <div class="notification-content">${escapeHTML(content)}</div>
    `;

    // 新しいものを上に追加
    feedContainer.prepend(card);
}

// XSS対策の簡単なエスケープ処理
function escapeHTML(str) {
    return str.replace(/[&'`<>"]/g, (match) => ({
        '&': '&amp;',
        "'": '&#x27;',
        '`': '&#x60;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
    }[match]));
}

// 定期的にサーバーから新しい通知を取得する（ポーリングの例）
async function fetchNotifications() {
    try {
        const response = await fetch(API_ENDPOINT);
        if (!response.ok) throw new Error('Network response was not ok');
        
        const data = await response.json();
        
        // 接続成功ステータスに変更
        statusElement.textContent = '接続中 (Live)';
        statusElement.className = 'status-connected';

        // サーバー側から返ってきたメッセージ配列を画面に反映
        // ※サーバーの仕様に合わせて書き換えてください
        if (Array.isArray(data)) {
            // ここでは簡易的に全件または新しいものを描画
        }
    } catch (error) {
        console.error('データ取得エラー:', error);
        statusElement.textContent = '接続エラー / スリープ中';
        statusElement.className = 'status-disconnected';
    }
}

// 初期化（数秒おきにサーバーへデータを迎えに行く場合）
// ※Renderの無料プラン対策やWebSocketを使う場合は適宜書き換えてください
// setInterval(fetchNotifications, 5000);
