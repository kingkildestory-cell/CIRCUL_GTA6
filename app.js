import { FaceLandmarker, FilesetResolver } from "https://jsdelivr.net";

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

let faceLandmarker = null;
let loadedImage = null;
let lastScore = "0.0";

async function initAI() {
  try {
    const vision = await FilesetResolver.forVisionTasks("https://jsdelivr.net/wasm");
    faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: "https://googleapis.com",
        delegate: "GPU"
      },
      runningMode: "IMAGE",
      numFaces: 1
    });
    statusText.innerText = "Нейросеть готова. Выбери фото 👆";
  } catch (e) {
    statusText.innerText = "Ошибка загрузки ИИ. Обнови страницу.";
  }
}
initAI();

imageInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = () => {
      loadedImage = img;
      document.getElementById("placeholder").style.display = "none";
      document.getElementById("canvasWrap").style.display = "flex";
      resultsCard.style.display = "none";
      const scale = img.width > 600 ? 600 / img.width : 1;
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      if (faceLandmarker) {
        scanBtn.disabled = false;
        statusText.innerText = "Фото готово! Нажми кнопку ниже";
      }
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
});

const dist = (p1, p2) => Math.hypot(p1.x - p2.x, p1.y - p2.y);

scanBtn.addEventListener("click", () => {
  if (!faceLandmarker || !loadedImage) return;
  scanBtn.disabled = true;
  resultsCard.style.display = "none";
  laser.style.display = "block";
  statusText.innerText = "Строим 3D-сетку лица...";
  ctx.drawImage(loadedImage, 0, 0, canvas.width, canvas.height);

  setTimeout(() => {
    const res = faceLandmarker.detect(canvas);
    laser.style.display = "none";
    if (!res.faceLandmarks || !res.faceLandmarks.length) {
      statusText.innerText = "❌ Лицо не найдено. Попробуй другое фото.";
      scanBtn.disabled = false;
      return;
    }
    const lm = res.faceLandmarks[0];
    drawMesh(lm);
    calcMetrics(lm);
    statusText.innerText = "✅ Анализ завершен!";
    scanBtn.disabled = false;
    if (tg.HapticFeedback) tg.HapticFeedback.notificationOccurred("success");
  }, 1200);
});

function drawMesh(lm) {
  ctx.fillStyle = "#00f2fe";
  for (let i = 0; i < lm.length; i += 2) {
    ctx.beginPath();
    ctx.arc(lm[i].x * canvas.width, lm[i].y * canvas.height, 1.3, 0, 2 * Math.PI);
    ctx.fill();
  }
  ctx.strokeStyle = "rgba(255, 0, 127, 0.8)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(lm[10].x * canvas.width, lm[10].y * canvas.height);
  ctx.lineTo(lm[152].x * canvas.width, lm[152].y * canvas.height);
  ctx.moveTo(lm[234].x * canvas.width, lm[234].y * canvas.height);
  ctx.lineTo(lm[454].x * canvas.width, lm[454].y * canvas.height);
  ctx.stroke();
}

function calcMetrics(lm) {
  const fH = dist(lm[10], lm[152]);
  const fW = dist(lm[234], lm[454]);
  const lD = dist(lm[1], lm[234]);
  const rD = dist(lm[1], lm[454]);
  const sym = Math.min(99, Math.max(76, Math.round((1 - Math.abs(lD - rD) / Math.max(lD, rD)) * 102)));
  const gold = Math.min(98, Math.max(75, Math.round((1 - Math.abs((fH / fW) - 1.48) * 0.45) * 100)));
  const lEye = dist(lm[33], lm[133]);
  const rEye = dist(lm[362], lm[263]);
  const eyes = Math.min(99, Math.max(78, Math.round((1 - Math.abs(lEye - rEye) / Math.max(lEye, rEye)) * 103)));
  const jaw = Math.min(97, Math.max(77, Math.round((1 - Math.abs((dist(lm[172], lm[397]) / fW) - 0.78)) * 100)));

  const avg = (sym + gold + eyes + jaw) / 4;
  lastScore = (7.2 + ((avg - 75) / 25) * 2.6).toFixed(1);

  document.getElementById("totalScore").innerText = `${lastScore} / 10`;
  document.getElementById("archetypeTitle").innerText = lastScore >= 9.0 ? "🔥 Модельная геометрия (Топ 5%)" : "✨ Гармоничный фотогеничный типаж";
  document.getElementById("adviceText").innerHTML = `<strong>💡 Совет стилиста:</strong> Отличный баланс пропорций! Мягкий фронтальный свет и ракурс чуть выше уровня глаз максимально подчеркнут выразительность черт.`;

  resultsCard.style.display = "block";
  setTimeout(() => {
    ["sym", "gold", "eyes", "jaw"].forEach((k, idx) => {
      const val = [sym, gold, eyes, jaw][idx];
      document.getElementById(k + "Val").innerText = val + "%";
      document.getElementById(k + "Bar").style.width = val + "%";
    });
  }, 100);
}

window.shareResult = () => {
  const txt = `⚡ Нейросеть оценила мою внешность на ${lastScore} из 10! Проверь себя тоже:`;
  tg.openTelegramLink(`https://t.me{encodeURIComponent(window.location.href)}&text=${encodeURIComponent(txt)}`);
};
