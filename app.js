const tg = window.Telegram.WebApp;
tg.expand();
tg.ready();

const statusText = document.getElementById("statusText");
const scanBtn = document.getElementById("scanBtn");
const imageInput = document.getElementById("imageInput");
const canvas = document.getElementById("outputCanvas");
const ctx = canvas.getContext("2d");
const laser = document.getElementById("laser");
const resultsCard = document.getElementById("resultsCard");

let modelReady = false;
let loadedImage = null;
let lastScore = "0.0";

// Подключаем легкую библиотеку распознавания лиц
const script = document.createElement("script");
script.src = "https://jsdelivr.net";
script.onload = async () => {
  try {
    const MODEL_URL = "https://jsdelivr.net";
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    await faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL);
    modelReady = true;
    statusText.innerText = loadedImage ? "Фото готово! Нажми кнопку ниже 👇" : "Нейросеть готова. Выбери фото 👆";
    if (loadedImage) scanBtn.disabled = false;
  } catch (err) {
    statusText.innerText = "Ошибка сети: " + err.message;
  }
};
script.onerror = () => {
  statusText.innerText = "Не удалось загрузить модуль ИИ (проверьте интернет/VPN)";
};
document.head.appendChild(script);

// Загрузка фото с телефона (без квадратных скобок)
imageInput.addEventListener("change", function(e) {
  const file = e.target.files.item(0);
  if (!file) return;

  statusText.innerText = "Обрабатываем фото...";
  const reader = new FileReader();
  reader.onload = function(ev) {
    const img = new Image();
    img.onload = function() {
      loadedImage = img;
      document.getElementById("placeholder").style.display = "none";
      document.getElementById("canvasWrap").style.display = "flex";
      resultsCard.style.display = "none";

      const scale = img.width > 500 ? 500 / img.width : 1;
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      if (modelReady) {
        scanBtn.disabled = false;
        statusText.innerText = "Фото загружено! Нажми «Сканировать внешность»";
      } else {
        statusText.innerText = "Фото загружено, завершаем настройку ИИ...";
      }
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
});

const dist = (p1, p2) => Math.hypot(p1.x - p2.x, p1.y - p2.y);

// Запуск сканирования
scanBtn.addEventListener("click", async () => {
  if (!modelReady || !loadedImage) return;

  scanBtn.disabled = true;
  resultsCard.style.display = "none";
  laser.style.display = "block";
  statusText.innerText = "Сканируем черты лица...";
  ctx.drawImage(loadedImage, 0, 0, canvas.width, canvas.height);

  try {
    const detection = await faceapi
      .detectSingleFace(canvas, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks(true);

    laser.style.display = "none";

    if (!detection) {
      statusText.innerText = "❌ Лицо не найдено. Выбери четкое селфи анфас.";
      scanBtn.disabled = false;
      return;
    }

    const pts = detection.landmarks.positions;
    drawMesh(pts);
    calcMetrics(pts);

    statusText.innerText = "✅ Анализ успешно завершен!";
    scanBtn.disabled = false;
    if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred("success");
  } catch (err) {
    laser.style.display = "none";
    statusText.innerText = "Ошибка анализа. Попробуй другое фото.";
    scanBtn.disabled = false;
  }
});

// Отрисовка 68 биометрических точек лица
function drawMesh(pts) {
  ctx.fillStyle = "#00f2fe";
  pts.forEach(pt => {
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 2, 0, 2 * Math.PI);
    ctx.fill();
  });

  // Соединяем контур овала лица
  ctx.strokeStyle = "rgba(255, 0, 127, 0.85)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i <= 16; i++) {
    const p = pts.at(i);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
}

// Расчет пропорций и баллов
function calcMetrics(pts) {
  // Точки: 0 и 16 (скулы), 8 (подбородок), 27 (переносица), 30 (кончик носа), 36-39 (левый глаз), 42-45 (правый глаз)
  const faceW = dist(pts.at(0), pts.at(16));
  const lowerH = dist(pts.at(27), pts.at(8));

  const leftSide = dist(pts.at(0), pts.at(30));
  const rightSide = dist(pts.at(16), pts.at(30));
  const sym = Math.min(99, Math.max(77, Math.round((1 - Math.abs(leftSide - rightSide) / Math.max(leftSide, rightSide)) * 102)));

  const ratio = (lowerH * 1.65) / faceW;
  const gold = Math.min(98, Math.max(76, Math.round((1 - Math.abs(ratio - 1.45) * 0.4) * 100)));

  const lEye = dist(pts.at(36), pts.at(39));
  const rEye = dist(pts.at(42), pts.at(45));
  const eyes = Math.min(99, Math.max(79, Math.round((1 - Math.abs(lEye - rEye) / Math.max(lEye, rEye)) * 103)));

  const jawW = dist(pts.at(4), pts.at(12));
  const jaw = Math.min(97, Math.max(78, Math.round((1 - Math.abs((jawW / faceW) - 0.76)) * 100)));

  const avg = (sym + gold + eyes + jaw) / 4;
  lastScore = (7.3 + ((avg - 76) / 23) * 2.5).toFixed(1);

  document.getElementById("totalScore").innerText = `${lastScore} / 10`;
  document.getElementById("archetypeTitle").innerText = lastScore >= 9.0 ? "🔥 Модельная геометрия (Топ 5%)" : "✨ Гармоничный фотогеничный типаж";
  document.getElementById("adviceText").innerHTML = `<strong>💡 Совет стилиста:</strong> Отличный баланс черт! Мягкий дневной свет спереди и легкий наклон камеры сверху максимально подчеркнут линию скул и взгляд.`;

  resultsCard.style.display = "block";
  setTimeout(() => {
    document.getElementById("symVal").innerText = sym + "%";
    document.getElementById("symBar").style.width = sym + "%";
    document.getElementById("goldVal").innerText = gold + "%";
    document.getElementById("goldBar").style.width = gold + "%";
    document.getElementById("eyesVal").innerText = eyes + "%";
    document.getElementById("eyesBar").style.width = eyes + "%";
    document.getElementById("jawVal").innerText = jaw + "%";
    document.getElementById("jawBar").style.width = jaw + "%";
  }, 100);
}

window.shareResult = () => {
  const txt = `⚡ Нейросеть оценила мою внешность на ${lastScore} из 10! Проверь себя тоже:`;
  tg.openTelegramLink(`https://t.me{encodeURIComponent(window.location.href)}&text=${encodeURIComponent(txt)}`);
};
