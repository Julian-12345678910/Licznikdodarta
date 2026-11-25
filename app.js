import { createPhoneCam } from "./phonecam.js";

const numbers = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
const state = {
  startScore: 501,
  players: [],
  active: 0,
  visit: [],
  history: [],
  visits: [],
  finished: false,
  camera: null,
  cameraRetry: 0,
  cameraDarts: [],
  cameraConfirmOpen: false,
  toastTimer: null,
  sound: false
};

const $ = (selector) => document.querySelector(selector);
const dialog = $("#new-game-dialog");

function freshPlayer(name) {
  return { name, score: state.startScore, legs: 0, darts: 0, points: 0 };
}

function toast(message) {
  const element = $("#toast");
  element.textContent = message;
  element.classList.add("show");
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => element.classList.remove("show"), 2600);
}

function polar(radius, angle) {
  const radians = angle * Math.PI / 180;
  return [150 + Math.sin(radians) * radius, 150 - Math.cos(radians) * radius];
}

function ringPath(inner, outer, start, end) {
  const [x1, y1] = polar(outer, start);
  const [x2, y2] = polar(outer, end);
  const [x3, y3] = polar(inner, end);
  const [x4, y4] = polar(inner, start);
  return `M ${x1} ${y1} A ${outer} ${outer} 0 0 1 ${x2} ${y2} L ${x3} ${y3} A ${inner} ${inner} 0 0 0 ${x4} ${y4} Z`;
}

function buildBoard() {
  const pieces = [];
  numbers.forEach((number, index) => {
    const start = index * 18 - 9;
    const end = start + 18;
    const center = index * 18;
    const light = index % 2 === 0;
    const rings = [
      { inner: 130, outer: 146, multiplier: 2, color: light ? "#b84338" : "#38805a" },
      { inner: 84, outer: 91, multiplier: 3, color: light ? "#b84338" : "#38805a" },
      { inner: 91, outer: 130, multiplier: 1, color: light ? "#d9d4c7" : "#24362d" },
      { inner: 18, outer: 84, multiplier: 1, color: light ? "#d9d4c7" : "#24362d" }
    ];
    rings.forEach((ring) => {
      pieces.push(`<path class="board-hit" d="${ringPath(ring.inner, ring.outer, start, end)}" fill="${ring.color}" role="button" tabindex="0" aria-label="${ring.multiplier === 1 ? "" : `Potrójne ${ring.multiplier}, `}${number}, ${number * ring.multiplier} punktów" data-score="${number * ring.multiplier}" data-label="${ring.multiplier === 1 ? "" : `T${ring.multiplier} `}${number}" data-double="${ring.multiplier === 2}"></path>`);
    });
    const [labelX, labelY] = polar(138, center);
    pieces.push(`<text class="board-number" x="${labelX}" y="${labelY}">${number}</text>`);
  });
  pieces.push('<circle class="board-hit" cx="150" cy="150" r="18" fill="#287c50" role="button" tabindex="0" aria-label="Outer bull, 25 punktów" data-score="25" data-label="25"></circle>');
  pieces.push('<circle class="board-hit" cx="150" cy="150" r="9" fill="#d35342" role="button" tabindex="0" aria-label="Bullseye, 50 punktów" data-score="50" data-label="BULL" data-double="true"></circle>');
  $("#board").innerHTML = `<svg viewBox="0 0 300 300" aria-label="Tarcza do darta">${pieces.join("")}<circle cx="150" cy="150" r="146" fill="none" stroke="#111612" stroke-width="2"></circle></svg>`;
}

function currentPlayer() {
  return state.players[state.active];
}

function paint() {
  state.players.forEach((player, index) => {
    const card = $(`#player-card-${index}`);
    card.classList.toggle("active", index === state.active && !state.finished);
    $(`#player-name-${index}`).textContent = player.name;
    $(`#score-${index}`).textContent = player.score;
    $(`#legs-${index}`).textContent = `${player.legs} ${player.legs === 1 ? "LEG" : "LEGÓW"}`;
    $(`#darts-${index}`).textContent = player.darts;
    $(`#average-${index}`).textContent = player.darts ? (player.points / player.darts * 3).toFixed(1) : "—";
    $(`#track-${index}`).style.width = `${Math.max(0, Math.min(100, player.score / state.startScore * 100))}%`;
    const active = index === state.active && !state.finished;
    $(`#turn-badge-${index}`).textContent = active ? "TERAZ RZUCA" : "OCZEKUJE";
    $(`#turn-badge-${index}`).classList.toggle("muted", !active);
  });
  $("#game-label").textContent = `${state.startScore} · DOUBLE OUT`;
  $("#match-status").textContent = `${state.startScore} · 2 GRACZY${state.finished ? " · KONIEC MECZU" : ""}`;
  $("#dart-count").textContent = state.visit.length;
  $("#undo").disabled = state.visit.length === 0 || state.finished;
  $("#next-turn").disabled = state.visit.length === 0 || state.finished;
  $("#next-turn").innerHTML = `ZAKOŃCZ WIZYTĘ <span>→</span>`;

  const slots = [...state.visit];
  $("#visit-darts").innerHTML = [0, 1, 2].map((index) => {
    const dart = slots[index];
    return `<span class="dart-slot ${dart ? "filled" : ""} ${!dart && index === slots.length && slots.length < 3 ? "current" : ""}">${dart ? escapeHtml(dart.label) : "—"}</span>`;
  }).join("");

  const current = currentPlayer();
  $("#checkout").textContent = checkoutRoute(current.score) || "—";
  $("#checkout-hint").textContent = current.score > 170 ? "Poza zasięgiem checkoutu" : "Najkrótsza droga do zera";
  renderHistory();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function renderHistory() {
  const list = $("#history");
  if (!state.visits.length) {
    list.innerHTML = '<div class="empty-history">Pierwszy rzut? Tarcza czeka.</div>';
    return;
  }
  list.innerHTML = [...state.visits].reverse().slice(0, 6).map((visit) =>
    `<div class="history-item"><span>${escapeHtml(visit.name)} <small>· ${visit.darts} rzut${visit.darts === 1 ? "" : "y"}</small></span><b>${visit.score}${visit.bust ? " · BUST" : ""}</b></div>`
  ).join("");
}

function checkoutRoute(score) {
  if (score <= 0 || score > 170) return "";
  const options = [];
  for (let number = 1; number <= 20; number += 1) {
    options.push({ score: number, label: `S${number}`, double: false });
    options.push({ score: number * 2, label: `D${number}`, double: true });
    options.push({ score: number * 3, label: `T${number}`, double: false });
  }
  options.push({ score: 25, label: "25", double: false });
  options.push({ score: 50, label: "BULL", double: true });
  for (let darts = 1; darts <= 3; darts += 1) {
    const search = (sum, route) => {
      if (route.length === darts) {
        return sum === score && route[route.length - 1].double ? route : null;
      }
      for (const option of options) {
        if (sum + option.score > score) continue;
        const found = search(sum + option.score, [...route, option]);
        if (found) return found;
      }
      return null;
    };
    const route = search(0, []);
    if (route) return route.map((dart) => dart.label).join(" · ");
  }
  return "";
}

function saveGame() {
  const data = {
    startScore: state.startScore,
    players: state.players,
    active: state.active,
    history: state.history,
    visits: state.visits,
    visit: state.visit,
    finished: state.finished
  };
  try {
    localStorage.setItem("dartboard-game-v1", JSON.stringify(data));
  } catch (error) {
    console.error("Nie udało się zapisać meczu.", error);
    toast("Nie udało się zapisać meczu w tej przeglądarce.");
  }
}

function loadGame() {
  try {
    const saved = localStorage.getItem("dartboard-game-v1");
    if (!saved) return false;
    const data = JSON.parse(saved);
    if (![301, 501, 701].includes(data.startScore) || !Array.isArray(data.players) || data.players.length !== 2) return false;
    state.startScore = data.startScore;
    state.players = data.players;
    state.active = data.active === 1 ? 1 : 0;
    state.history = Array.isArray(data.history) ? data.history : [];
    state.visits = Array.isArray(data.visits) ? data.visits : [];
    state.visit = Array.isArray(data.visit) ? data.visit : [];
    state.finished = Boolean(data.finished);
    return true;
  } catch (error) {
    console.error("Nie udało się odczytać zapisanego meczu.", error);
    return false;
  }
}

function recordDart(score, label, isDouble = false) {
  if (state.finished || state.visit.length >= 3) return;
  if (!Number.isInteger(score) || score < 0 || score > 60) {
    toast("Wynik jednego rzutu musi mieścić się w zakresie 0–60.");
    return;
  }
  const player = currentPlayer();
  const before = player.score;
  const remaining = before - score;
  const bust = remaining < 0 || remaining === 1 || (remaining === 0 && !isDouble);
  const dart = { score, label, isDouble, before, bust };
  state.visit.push(dart);
  state.history.push({ player: state.active, dart });
  player.darts += 1;
  player.points += score;
  if (!bust) player.score = remaining;

  if (remaining === 0 && isDouble) {
    state.visits.push({ name: player.name, score: state.visit.reduce((sum, item) => sum + item.score, 0), darts: state.visit.length });
    player.legs += 1;
    state.finished = true;
    toast(`${player.name} wygrywa lega! 🎯`);
  } else if (bust || state.visit.length === 3) {
    completeVisit(bust);
  }
  $("#score-input").value = "";
  paint();
  saveGame();
}

function completeVisit(bust = false) {
  const player = currentPlayer();
  const score = state.visit.reduce((sum, dart) => sum + dart.score, 0);
  const darts = state.visit.reduce((sum, dart) => sum + (dart.darts || 1), 0);
  if (bust) player.points -= score;
  state.visits.push({ name: player.name, score: bust ? 0 : score, darts, bust });
  if (bust) toast("BUST — wynik wraca do początku wizyty.");
  state.active = state.active === 0 ? 1 : 0;
  state.visit = [];
}

function addManualScore(value) {
  if (state.finished) {
    toast("Mecz jest zakończony. Rozpocznij nową grę.");
    return;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 180) {
    toast("Wpisz wynik wizyty od 0 do 180.");
    return;
  }
  const player = currentPlayer();
  const visitTotal = state.visit.reduce((sum, dart) => sum + dart.score, 0);
  const before = player.score;
  const after = before - visitTotal - parsed;
  const bust = after < 0 || after === 1 || (after === 0 && !checkoutRoute(before));
  const darts = Math.max(1, Math.min(3 - state.visit.length, Math.ceil(parsed / 60) || 1));
  state.visit.push({ score: parsed, label: String(parsed), isDouble: after === 0 && Boolean(checkoutRoute(before)), before, bust, manual: true, darts });
  state.history.push({ player: state.active, dart: state.visit[state.visit.length - 1] });
  player.darts += darts;
  player.points += parsed;
  if (!bust) player.score = after;
  if (after === 0 && !bust) {
    state.visits.push({ name: player.name, score: visitTotal + parsed, darts: state.visit.reduce((sum, dart) => sum + (dart.darts || 1), 0) });
    player.legs += 1;
    state.finished = true;
    toast(`${player.name} wygrywa lega!`);
  } else {
    if (bust || state.visit.length >= 3) completeVisit(bust);
    else completeVisit(false);
  }
  $("#score-input").value = "";
  paint();
  saveGame();
}

function undoLast() {
  if (!state.visit.length || state.finished) return;
  const dart = state.visit.pop();
  const player = currentPlayer();
  player.score = dart.before;
  player.darts -= dart.darts || 1;
  player.points -= dart.score;
  state.history.pop();
  paint();
  saveGame();
}

function startNewGame(score, names) {
  stopCamera();
  state.startScore = score;
  state.players = names.map((name) => freshPlayer(name));
  state.active = 0;
  state.visit = [];
  state.history = [];
  state.visits = [];
  state.finished = false;
  paint();
  saveGame();
}

function openNewGame() {
  $("#name-input-0").value = state.players[0]?.name || "Gracz 1";
  $("#name-input-1").value = state.players[1]?.name || "Gracz 2";
  $("#starting-score").value = String(state.startScore);
  dialog.showModal();
}

const calibrationStorageKey = "dartboard-camera-calibration-v1";

function readSavedCalibration() {
  try {
    const saved = localStorage.getItem(calibrationStorageKey);
    if (!saved) return null;
    const calibration = JSON.parse(saved);
    return calibration
      && Array.isArray(calibration.points)
      && calibration.points.length === 4
      && calibration.points.every((point) =>
        Array.isArray(point) && point.length === 2 && point.every(Number.isFinite)
      )
      ? calibration
      : null;
  } catch (error) {
    console.error("Nie udało się odczytać kalibracji kamery.", error);
    return null;
  }
}

function setCameraStatus(message, calibrated = false) {
  $("#camera-status").textContent = message;
  $("#scan-label").textContent = message;
  $(".camera-overlay").classList.toggle("calibrated", calibrated);
  $(".camera-overlay").classList.toggle("error", /nie udało|problem|błąd|zezwól/i.test(message));
}

function renderCameraOutline(lines) {
  const video = $("#camera-video");
  const svg = $("#camera-outline");
  const width = 1280;
  const height = Math.round(video.videoHeight * width / video.videoWidth);
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.replaceChildren(...lines.map((line) => {
    const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    polyline.setAttribute("points", line.map(([x, y]) => `${x},${y}`).join(" "));
    return polyline;
  }));
  svg.classList.remove("hidden");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function calibrateAutomatically(camera, retry) {
  const priorCalibration = readSavedCalibration();
  while (state.camera === camera && retry === state.cameraRetry) {
    setCameraStatus(priorCalibration
      ? "Ponownie dopasowuję zapisaną tarczę…"
      : "Szukam pustej tarczy i dopasowuję obraz…");
    try {
      const twenty = priorCalibration ? await camera.orientation(priorCalibration) : null;
      const result = await camera.calibrate(twenty);
      if (result.ok) {
        try {
          localStorage.setItem(calibrationStorageKey, JSON.stringify(result.calibration));
        } catch (error) {
          console.error("Nie udało się zapisać orientacji tarczy.", error);
          toast("Kalibracja działa w tej sesji, ale nie zostanie zapamiętana.");
        }
        const lines = await camera.outline(result.calibration);
        renderCameraOutline(lines);
        setCameraStatus("Tarcza skalibrowana — punktowanie aktywne", true);
        await camera.start(result.calibration);
        return;
      }
      setCameraStatus(`Nie znaleziono tarczy: ${result.reason}`);
    } catch (error) {
      console.error("Automatyczna kalibracja tarczy nie powiodła się.", error);
      setCameraStatus(`Problem z kalibracją: ${error.message}`);
    }
    await sleep(4000);
  }
}

function cameraStatus(status, detail) {
  const labels = {
    loading: `Ładowanie silnika wizji${detail ? ` (${detail.step}/${detail.of})` : "…"}`,
    "no-camera": "Nie znaleziono kamery",
    denied: "Zezwól stronie na dostęp do kamery",
    busy: "Kamera jest używana przez inną aplikację",
    watching: "Punktowanie z kamery aktywne",
    unsettled: "Obraz niestabilny — sprawdź ostrość i oświetlenie",
    knocked: "Kamera lub telefon się poruszył — włącz kamerę ponownie",
    lost: "Połączenie z kamerą zostało przerwane",
    stopped: "Kamera wyłączona",
    error: `Błąd silnika wizji${detail?.reason ? `: ${detail.reason}` : ""}`
  };
  const label = labels[status];
  if (!label) return;
  const calibrated = status === "watching" || status === "unsettled";
  setCameraStatus(label, calibrated);
  if (status === "watching") {
    $("#camera-toggle").textContent = "WYŁĄCZ KAMERĘ";
  } else if (["knocked", "lost", "error", "denied", "no-camera", "busy"].includes(status)) {
    $("#camera-toggle").textContent = "PONÓW PUNKTOWANIE";
  }
  if (status === "knocked" || status === "lost" || status === "error") toast(label);
}

function dartScore(dart) {
  if (dart.seg === 25) return dart.mult === 2 ? 50 : 25;
  return dart.seg * dart.mult;
}

function dartLabel(dart) {
  if (dart.seg === 0 || dart.mult === 0) return "PUDŁO";
  if (dart.seg === 25) return dart.mult === 2 ? "BULL" : "25";
  return `${dart.mult === 3 ? "T" : dart.mult === 2 ? "D" : ""}${dart.seg}`;
}

function applyCameraDart(dart) {
  recordDart(dartScore(dart), dartLabel(dart), dart.mult === 2);
}

function showNextCameraConfirmation() {
  if (state.cameraConfirmOpen || !state.cameraDarts.length) return;
  const { event, odds } = state.cameraDarts[0];
  const list = $("#dart-candidates");
  list.replaceChildren(...odds.map((candidate) => {
    const button = document.createElement("button");
    button.className = "dart-candidate";
    button.type = "button";
    const label = document.createElement("b");
    label.textContent = dartLabel(candidate);
    const probability = document.createElement("span");
    probability.textContent = `${Math.round(candidate.p * 100)}%`;
    button.append(label, probability);
    button.addEventListener("click", () => confirmCameraDart(candidate));
    return button;
  }));
  $("#accept-best-guess").textContent = `UŻYJ NAJBARDZIEJ PRAWDOPODOBNEGO · ${dartLabel(event)}`;
  state.cameraConfirmOpen = true;
  $("#dart-confirm-dialog").showModal();
}

function confirmCameraDart(dart) {
  state.cameraDarts.shift();
  state.cameraConfirmOpen = false;
  $("#dart-confirm-dialog").close();
  applyCameraDart(dart);
  showNextCameraConfirmation();
}

function cameraEvent(event) {
  if (state.finished) return;
  if (event.type === "dart") {
    const odds = Array.isArray(event.odds) ? event.odds.filter((candidate) =>
      Number.isInteger(candidate.seg) && Number.isInteger(candidate.mult) && Number.isFinite(candidate.p)
    ) : [];
    if (event.confidence < 0.8 && odds.length) {
      state.cameraDarts.push({ event, odds });
      showNextCameraConfirmation();
      return;
    }
    applyCameraDart(event);
    return;
  }
  if (event.type === "takeout" && state.visit.length && !state.finished) {
    completeVisit(false);
    paint();
    saveGame();
    return;
  }
  if (event.type === "removed") toast("Kamera wykryła usunięcie lotki z tarczy.");
}

async function toggleCamera() {
  if (state.camera) {
    if (state.camera.watching()) {
      stopCamera();
      return;
    }
    stopCamera();
  }
  const camera = createPhoneCam({ onEvent: cameraEvent, onStatus: cameraStatus });
  if (!camera.supported()) {
    setCameraStatus("Kamera wymaga bezpiecznego adresu HTTPS lub localhost", false);
    toast("Uruchom stronę przez HTTPS albo localhost, aby użyć kamery.");
    return;
  }
  const retry = ++state.cameraRetry;
  state.camera = camera;
  $("#camera-view").classList.remove("hidden");
  $("#camera-toggle").textContent = "WYŁĄCZ KAMERĘ";
  $("#camera-outline").classList.add("hidden");
  $(".camera-overlay").classList.remove("error", "calibrated");
  try {
    await camera.open($("#camera-video"));
    if (state.camera !== camera || retry !== state.cameraRetry) return;
    await calibrateAutomatically(camera, retry);
  } catch (error) {
    console.error("Nie udało się uruchomić punktowania z kamery.", error);
    if (state.camera === camera) {
      setCameraStatus(`Nie udało się uruchomić kamery: ${error.message}`);
      toast(`Nie udało się uruchomić kamery: ${error.message}`);
      camera.stop();
      state.camera = null;
      $("#camera-toggle").textContent = "PONÓW PUNKTOWANIE";
    }
  }
}

function stopCamera() {
  state.cameraRetry += 1;
  if (state.camera) state.camera.stop();
  state.camera = null;
  state.cameraDarts = [];
  state.cameraConfirmOpen = false;
  const confirmation = $("#dart-confirm-dialog");
  if (confirmation.open) confirmation.close();
  $("#camera-view").classList.add("hidden");
  $("#camera-outline").classList.add("hidden");
  $("#camera-outline").replaceChildren();
  $("#camera-toggle").textContent = "WŁĄCZ KAMERĘ";
  setCameraStatus("Automatyczne wykrywanie i kalibracja tarczy");
}

$("#board").addEventListener("click", (event) => {
  const hit = event.target.closest(".board-hit");
  if (hit) recordDart(Number(hit.dataset.score), hit.dataset.label, hit.dataset.double === "true");
});
$("#board").addEventListener("keydown", (event) => {
  if ((event.key === "Enter" || event.key === " ") && event.target.matches(".board-hit")) {
    event.preventDefault();
    recordDart(Number(event.target.dataset.score), event.target.dataset.label, event.target.dataset.double === "true");
  }
});
document.querySelectorAll(".quick-scores [data-score]").forEach((button) => {
  button.addEventListener("click", () => addManualScore(button.dataset.score));
});
$("#submit-score").addEventListener("click", () => addManualScore($("#score-input").value));
$("#score-input").addEventListener("keydown", (event) => {
  if (event.key === "Enter") addManualScore(event.currentTarget.value);
});
$("#undo").addEventListener("click", undoLast);
$("#next-turn").addEventListener("click", () => {
  if (!state.visit.length || state.finished) return;
  completeVisit(false);
  paint();
  saveGame();
});
$("#camera-toggle").addEventListener("click", toggleCamera);
$("#accept-best-guess").addEventListener("click", () => {
  if (state.cameraDarts.length) confirmCameraDart(state.cameraDarts[0].event);
});
$("#dart-confirm-dialog").addEventListener("cancel", () => {
  state.cameraDarts.shift();
  state.cameraConfirmOpen = false;
  toast("Niepewny rzut pominięty.");
  setTimeout(showNextCameraConfirmation, 0);
});
$("#about-button").addEventListener("click", () => $("#about-dialog").showModal());
$("#new-game").addEventListener("click", openNewGame);
$("#new-game-top").addEventListener("click", openNewGame);
$(".close-dialog").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});
$("#new-game-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const names = [$("#name-input-0").value.trim(), $("#name-input-1").value.trim()];
  if (names.some((name) => !name)) {
    toast("Wpisz imiona obu graczy.");
    return;
  }
  startNewGame(Number($("#starting-score").value), names);
  dialog.close();
  toast("Mecz gotowy. Powodzenia!");
});
$("#sound-toggle").addEventListener("click", (event) => {
  state.sound = !state.sound;
  event.currentTarget.classList.toggle("sound-on", state.sound);
  event.currentTarget.setAttribute("aria-label", state.sound ? "Wyłącz dźwięk" : "Włącz dźwięk");
  toast(state.sound ? "Dźwięk włączony." : "Dźwięk wyłączony.");
});
window.addEventListener("beforeunload", stopCamera);

buildBoard();
if (!loadGame()) {
  state.players = [freshPlayer("Gracz 1"), freshPlayer("Gracz 2")];
  saveGame();
}
paint();
