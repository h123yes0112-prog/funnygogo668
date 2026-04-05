const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// 允許跨域請求 (解決 hardware_mock 不在同網域的問題)
app.use(cors());

// 解析 JSON 請求與伺服靜態網址 (開放 10mb 上限供相機 Base64 使用)
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// 玩家排隊佇列
let activePlayers = []; // { id: socket.id, name: string } 陣列
let leaderboard = []; // { name, time_left, rank } 陣列

io.on('connection', (socket) => {
    console.log('📱 [連線] 新增網頁連線:', socket.id);

    // 玩家報到加入等候
    socket.on('join_queue', (data) => {
        const { name, photo } = data; // 接收包含 base64 相片的資料
        // 如果這個 socket id 已經在列表，先移除舊的避免重複
        activePlayers = activePlayers.filter(p => p.id !== socket.id);
        
        activePlayers.push({ id: socket.id, name, photo });
        console.log(`✅ [排隊] 玩家【${name}】已加入等候。 (當前排隊人數: ${activePlayers.length})`);
        
        // 告知該客戶端進入等待狀態
        socket.emit('queue_status', { 
            status: 'waiting', 
            message: '請拍下機台大按鈕🚀' 
        });
        
        // 推播給 TV 更新排隊人數
        io.emit('queue_status_update', { waitingCount: activePlayers.length });
    });

    // 玩家斷線
    socket.on('disconnect', () => {
        activePlayers = activePlayers.filter(p => p.id !== socket.id);
        console.log(`❌ [斷線] ${socket.id} 已離開。 (剩餘排隊人數: ${activePlayers.length})`);
        io.emit('queue_status_update', { waitingCount: activePlayers.length });
    });

    // 給大螢幕用的：要求目前最新資料
    socket.on('tv_request_data', () => {
        socket.emit('tv_broadcast', { leaderboard });
        socket.emit('queue_status_update', { waitingCount: activePlayers.length });
    });
});

// 實體大按鈕送出數據的 API 端點
app.post('/api/record', (req, res) => {
    const { time_left } = req.body;
    
    if (time_left === undefined) {
        return res.status(400).json({ error: '缺少 time_left 欄位' });
    }

    const t = parseFloat(time_left);
    let rank = '';
    
    // 秒數判定邏輯
    if (t > 10.00 || t < 0) {
        rank = '無效數值 (超過範圍)';
    } else if (t >= 2.01) {
        rank = '慢慢搬';
    } else if (t >= 1.01) {
        rank = '大力士';
    } else {
        rank = '移山神童';
    }

    const resultData = {
        time_left: t.toFixed(2),
        rank: rank,
        timestamp: new Date().toISOString()
    };

    console.log(`\n🔴 [硬體觸發] 機台傳來秒數: ${resultData.time_left} 秒`);

    // 尋找最前端的等候玩家並派發成績
    if (activePlayers.length > 0) {
        const player = activePlayers.shift(); // 先進先出 (FIFO)
        console.log(`🎉 [結果派發] 分數分析為: [${rank}]，已傳送給: 玩家【${player.name}】\n`);
        
        // 更新排行榜 (越小越強)
        leaderboard.push({ name: player.name, time_left: resultData.time_left, rank: rank, photo: player.photo });
        leaderboard.sort((a, b) => parseFloat(a.time_left) - parseFloat(b.time_left));
        leaderboard = leaderboard.slice(0, 5); // 記錄前 5 名
        
        // 將大頭照一併加到推播中給手機與 TV
        const finalResult = { ...resultData, photo: player.photo };
        
        io.to(player.id).emit('game_result', finalResult);
        // 推播給大螢幕
        io.emit('tv_broadcast', { 
            latestPlayer: player.name, 
            latestResult: finalResult, 
            leaderboard 
        });
        io.emit('queue_status_update', { waitingCount: activePlayers.length });

        res.json({ success: true, assigned_to: player.name, result: resultData });
    } else {
        console.log(`⚠️ [警告] 收到機台分數，但是目前手機端沒有人在排隊喔！\n`);
        res.status(200).json({ success: false, message: '目前無等待中玩家', result: resultData });
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n======================================================`);
    console.log(`🌟 互動裝置後端啟動成功！`);
    console.log(`🌐 網頁端請用手機瀏覽器開啟: http://(你的電腦區域IP):${PORT}`);
    console.log(`🖥️ 本機測試請開啟: http://localhost:${PORT}`);
    console.log(`⚙️ 硬體發送 API : POST http://localhost:${PORT}/api/record`);
    console.log(`======================================================\n`);
});
