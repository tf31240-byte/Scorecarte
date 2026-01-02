
let game = "";
let players = [];
let totals = [];
let history = [];
let teams = []; // Pour Belote: [[0,1],[2,3]]

/* 1. Choix du jeu */
function selectGame(name) {
  game = name;
}

/* 2. Démarrage */
function startGame() {
  const count = parseInt(document.getElementById("playerCount").value);
  players = [];
  totals = Array(count).fill(0);
  history = [];

  for (let i = 0; i < count; i++) {
    players.push("Joueur " + (i + 1));
  }

  if (game === "Belote" && count === 4) {
    teams = [[0,1],[2,3]];
  } else {
    teams = [];
  }

  document.getElementById("setup").classList.add("hidden");
  document.getElementById("game").classList.remove("hidden");
  document.getElementById("gameTitle").textContent = game;

  render();
}

/* 3. Affichage */
function render() {
  const scores = document.getElementById("scores");
  const inputs = document.getElementById("inputs");
  const historyList = document.getElementById("history");

  scores.innerHTML = "";
  inputs.innerHTML = "";
  historyList.innerHTML = "";

  // Scores individuels
  players.forEach((p, i) => {
    scores.innerHTML += `
      <div class="card score-line">
        <span>${p}</span>
        <strong>${totals[i]}</strong>
      </div>
    `;
    inputs.innerHTML += `<input type="number" placeholder="${p}" id="input${i}">`;
  });

  // Scores par équipe (Belote)
  if (game === "Belote" && teams.length) {
    scores.innerHTML += `<h3>Scores équipes</h3>`;
    teams.forEach((team, idx) => {
      const teamScore = totals[team[0]] + totals[team[1]];
      scores.innerHTML += `<div class="card score-line">
        <span>Équipe ${idx + 1} (${players[team[0]]} + ${players[team[1]]})</span>
        <strong>${teamScore}</strong>
      </div>`;
    });
  }

  // Historique
  history.forEach((round, r) => {
    historyList.innerHTML += `<li>Manche ${r + 1} : ${round.join(" / ")}</li>`;
  });

  save();
}

/* 4. Ajouter une manche */
function addRound() {
  let round = [];
  players.forEach((_, i) => {
    const val = parseInt(document.getElementById("input" + i).value) || 0;
    totals[i] += val;
    round.push(val);
  });
  history.push(round);
  render();
}

/* 5. Annuler dernière manche */
function undoRound() {
  if (!history.length) return;
  const last = history.pop();
  last.forEach((val, i) => totals[i] -= val);
  render();
}

/* 6. Reset */
function resetGame() {
  if (!confirm("Réinitialiser la partie ?")) return;
  location.reload();
}

/* 7. Sauvegarde */
function save() {
  localStorage.setItem("scoreApp", JSON.stringify({
    game, players, totals, history, teams
  }));
}

/* 8. Chargement */
function load() {
  const data = JSON.parse(localStorage.getItem("scoreApp"));
  if (!data) return;
  ({ game, players, totals, history, teams } = data);
  document.getElementById("setup").classList.add("hidden");
  document.getElementById("game").classList.remove("hidden");
  document.getElementById("gameTitle").textContent = game;
  render();
}

load();

/* 9. Dark mode toggle */
function toggleTheme() {
  document.body.classList.toggle("dark");
}

/* 10. Export CSV */
function exportScores() {
  let csv = "Joueur," + players.join(",") + "\n";
  csv += "Total," + totals.join(",") + "\n";
  history.forEach((round, idx) => {
    csv += "Manche " + (idx+1) + "," + round.join(",") + "\n";
  });

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "scores.csv";
  a.click();
  URL.revokeObjectURL(url);
}
