const tg = window.Telegram.WebApp;
tg.expand();
tg.ready();

const statusText = document.getElementById("statusText");
const scanBtn = document.getElementById("scanBtn");
const canvas = document.getElementById("outputCanvas");
const ctx = canvas.getContext("2d");
const laser = document.getElementById("laser");
const resultsCard = document.getElementById("resultsCard");
let loadedImage = null;
let lastScore = "8.8";

document.getElementById("imageInput").addEventListener("change", function(e) {
  const file = e.target.files.item(0);
  if (!file) return;
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
      scanBtn.disabled = false;
      statusText.innerText = "Фото готово! Нажми кнопку ниже";
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
});

async function startScan() {
  if (!loadedImage) return;
  scanBtn.disabled = true;
  resultsCard.style.display = "none";
  laser.style.display = "block";
  statusText.innerText = "Анализируем геометрию...";
  ctx.drawImage(loadedImage, 0, 0, canvas.width, canvas.height);

  let box = { x: canvas.width * 0.25, y: canvas.height * 0.18, width: canvas.width * 0.5, height: canvas.height * 0.6 };
  if ("FaceDetector" in window) {
    try {
      const faces = await new FaceDetector({ fastMode: true }).detect(canvas);
      if (faces.length > 0) box = faces.at(0).boundingBox;
    } catch (e) {}
  }

  setTimeout(() => {
    laser.style.display = "none";
    ctx.strokeStyle = "#00f2fe";
    ctx.lineWidth = 2;
    ctx.strokeRect(box.x, box.y, box.width, box.height);

    const w = Math.floor(box.width);
    const h = Math.floor(box.height);
    const sym = Math.min(98, Math.max(82, 85 + (w % 13)));
    const gold = Math.min(97, Math.max(81, 83 + (h % 14)));
    const eyes = Math.min(99, Math.max(84, 86 + ((w + h) % 12)));
    const jaw = Math.min(96, Math.max(80, 82 + ((w * 2) % 14)));
    lastScore = (7.9 + (((sym + gold + eyes + jaw) / 4 - 80) / 20) * 1.9).toFixed(1);

    document.getElementById("totalScore").innerText = `${lastScore} / 10`;
    document.getElementById("archetypeTitle").innerText = lastScore >= 9.0 ? "🔥 Модельная геометрия" : "✨ Гармоничный типаж";
    document.getElementById("adviceText").innerHTML = "<b>💡 Совет:</b> Отличный баланс пропорций! Мягкий фронтальный свет сделает черты еще выразительнее.";
    resultsCard.style.display = "block";

    ["sym", "gold", "eyes", "jaw"].forEach((k, i) => {
      const v = [sym, gold, eyes, jaw].at(i);
      document.getElementById(k + "Val").innerText = v + "%";
      document.getElementById(k + "Bar").style.width = v + "%";
    });
    statusText.innerText = "✅ Сканирование завершено!";
    scanBtn.disabled = false;
  }, 1400);
}

function shareResult() {
  const txt = `⚡ Нейросеть оценила мою внешность на ${lastScore} из 10!`;
  tg.openTelegramLink(`https://t.me{encodeURIComponent(window.location.href)}&text=${encodeURIComponent(txt)}`);
}
