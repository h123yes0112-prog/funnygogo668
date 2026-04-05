const socket = io();

const loginLayer = document.getElementById('login-layer');
const waitingLayer = document.getElementById('waiting-layer');
const resultLayer = document.getElementById('result-layer');

const joinBtn = document.getElementById('join-btn');
const nameInput = document.getElementById('name-input');
const restartBtn = document.getElementById('restart-btn');

const timeDisplay = document.getElementById('time-display');
const rankDisplay = document.getElementById('rank-display');

// Camera Elements
const cameraFeed = document.getElementById('camera-feed');
const photoPreview = document.getElementById('photo-preview');
const photoCanvas = document.getElementById('photo-canvas');
const captureBtn = document.getElementById('capture-btn');
const retakeBtn = document.getElementById('retake-btn');
const resultPhoto = document.getElementById('result-photo');

let currentVideoStream = null;
let capturedPhotoData = null; // 存放 Base64 圖片資料

function showLayer(layerElement) {
    document.querySelectorAll('.layer').forEach(el => el.classList.remove('active'));
    layerElement.classList.add('active');
}

// ==== 相機初始化邏輯 ====
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "user" }, // 優先使用前置(自拍)鏡頭
            audio: false 
        });
        currentVideoStream = stream;
        cameraFeed.srcObject = stream;
        cameraFeed.style.display = 'block';
        photoPreview.style.display = 'none';
        
        captureBtn.style.display = 'inline-block';
        retakeBtn.style.display = 'none';
        joinBtn.disabled = true;
        capturedPhotoData = null;
    } catch (err) {
        console.error("相機存取失敗: ", err);
        alert("無法存取相機！請確認您已經允許瀏覽器使用相機權限，且必須在安全連線 (HTTPS) 狀態下。");
    }
}

function stopCamera() {
    if (currentVideoStream) {
        currentVideoStream.getTracks().forEach(track => track.stop());
    }
}

// 拍照按鈕
captureBtn.addEventListener('click', () => {
    // 將影片畫格畫到 Canvas 上
    photoCanvas.width = cameraFeed.videoWidth;
    photoCanvas.height = cameraFeed.videoHeight;
    const ctx = photoCanvas.getContext('2d');
    
    // 如果是前置鏡頭，圖片可能是左右相反的，可以依需求處理鏡像
    ctx.translate(photoCanvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(cameraFeed, 0, 0, photoCanvas.width, photoCanvas.height);
    
    // 取得 Base64 (可選擇降低品質與大小以防 Payload 太大)
    capturedPhotoData = photoCanvas.toDataURL('image/jpeg', 0.6);
    
    // 預覽
    photoPreview.src = capturedPhotoData;
    photoPreview.style.display = 'block';
    cameraFeed.style.display = 'none';
    
    captureBtn.style.display = 'none';
    retakeBtn.style.display = 'inline-block';
    
    // 解鎖連線按鈕 (需填名字才能按)
    checkFormStatus();
});

// 重拍按鈕
retakeBtn.addEventListener('click', () => {
    startCamera();
});

nameInput.addEventListener('input', checkFormStatus);

function checkFormStatus() {
    if (capturedPhotoData && nameInput.value.trim() !== '') {
        joinBtn.disabled = false;
    } else {
        joinBtn.disabled = true;
    }
}

// 初始化開啟相機
startCamera();


// ==== 遊戲流程邏輯 ====

joinBtn.addEventListener('click', () => {
    const name = nameInput.value.trim();
    if (!name || !capturedPhotoData) return;
    
    joinBtn.textContent = '小神童報到中...';
    joinBtn.style.opacity = '0.5';
    
    // 將身分與大頭照傳送給後端隊列
    socket.emit('join_queue', { name: name, photo: capturedPhotoData });
    
    // 關閉相機節省資源
    stopCamera();
    
    setTimeout(() => {
        joinBtn.textContent = '準備舉起大槌！';
        joinBtn.style.opacity = '1';
        showLayer(waitingLayer);
    }, 400);
});

restartBtn.addEventListener('click', () => {
    nameInput.value = '';
    joinBtn.disabled = true;
    showLayer(loginLayer);
    startCamera(); // 重新開啟相機
});


// ==== WebSocket 事件監聽 ====

socket.on('game_result', (data) => {
    console.log('🎉 收到機台成績:', data);
    
    timeDisplay.textContent = '-.--';
    rankDisplay.textContent = '搬運分析中...';
    rankDisplay.className = 'rank-tag cute';
    // 放入專屬照片
    resultPhoto.src = data.photo || 'https://via.placeholder.com/150';

    showLayer(resultLayer);

    // 數字跳動特效
    let ticks = 0;
    const interval = setInterval(() => {
        timeDisplay.textContent = (Math.random() * 10).toFixed(2);
        ticks++;
        if(ticks > 15) {
            clearInterval(interval);
            timeDisplay.textContent = data.time_left;
            rankDisplay.textContent = `[${data.rank}]`;
            
            // 依據 rank 上色
            if(data.rank === '慢慢搬') rankDisplay.classList.add('rank-slow');
            else if(data.rank === '大力士') rankDisplay.classList.add('rank-fast');
            else rankDisplay.classList.add('rank-god'); // 移山神童
        }
    }, 40);
});
