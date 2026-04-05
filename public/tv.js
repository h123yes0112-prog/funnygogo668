const socket = io();

const tvPlayerName = document.getElementById('tv-player-name');
const tvStatusMsg = document.getElementById('tv-status-msg');
const tvScoreBox = document.getElementById('tv-score-box');
const tvTime = document.getElementById('tv-time');
const tvRank = document.getElementById('tv-rank');
const tvPlayerPhoto = document.getElementById('tv-player-photo');
const tvPhotoBox = document.getElementById('tv-photo-box');
const leaderboardList = document.getElementById('leaderboard-list');

// 監聽並拿取當前的最新排行榜與最新動態
socket.on('tv_broadcast', (data) => {
    // === 更新左側即時動態 ===
    if (data.latestPlayer) {
        tvPlayerName.textContent = '剛剛完成挑戰：' + data.latestPlayer;
        tvStatusMsg.style.display = 'none';
        
        // 顯示大頭照
        if (data.latestResult.photo) {
            tvPlayerPhoto.src = data.latestResult.photo;
            tvPhotoBox.style.display = 'block';
        }
        
        tvScoreBox.style.display = 'block';

        // 假跑馬燈數字
        let ticks = 0;
        tvRank.className = 'rank-tag cute';
        tvRank.textContent = '分析中...';
        
        const interval = setInterval(() => {
            tvTime.textContent = (Math.random() * 10).toFixed(2);
            ticks++;
            if(ticks > 15) {
                clearInterval(interval);
                tvTime.textContent = data.latestResult.time_left;
                tvRank.textContent = `[${data.latestResult.rank}]`;
                
                if(data.latestResult.rank === '慢慢搬') tvRank.classList.add('rank-slow');
                else if(data.latestResult.rank === '大力士') tvRank.classList.add('rank-fast');
                else tvRank.classList.add('rank-god'); // 移山神童
            }
        }, 40);
    }

    // === 更新右側排行榜 ===
    if (data.leaderboard && data.leaderboard.length > 0) {
        leaderboardList.innerHTML = '';
        data.leaderboard.forEach((record, index) => {
            const item = document.createElement('div');
            
            let rankNumClass = '';
            if (index === 0) rankNumClass = 'gold';
            else if (index === 1) rankNumClass = 'silver';
            else if (index === 2) rankNumClass = 'bronze';

            item.className = `leaderboard-item ${rankNumClass}`;
            
            // 加入照片（如果當初沒傳照片就給個預設圖片）
            const photoSrc = record.photo || 'https://via.placeholder.com/60';

            item.innerHTML = `
                <div class="lb-rank">#${index + 1}</div>
                <img class="lb-photo" src="${photoSrc}" alt="avatar">
                <div class="lb-name">${record.name}</div>
                <div class="lb-time">${record.time_left}s</div>
            `;
            leaderboardList.appendChild(item);
        });
    }
});

socket.on('queue_status_update', (data) => {
    if (data.waitingCount > 0 && tvStatusMsg.style.display !== 'none') {
        tvStatusMsg.textContent = `現場排隊人數：${data.waitingCount} 人，火熱準備中...`;
    } else if (data.waitingCount === 0 && tvStatusMsg.style.display !== 'none') {
        tvStatusMsg.textContent = `還沒有人排隊，快掃描 QR Code 加入！`;
    }
});

socket.emit('tv_request_data');
