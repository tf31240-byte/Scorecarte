let game = "";
let players = [];
let totals = [];
let history = [];
let teams = [];

/* Sélection du jeu */
function selectGame(name){
  game = name;
  const options = document.getElementById("options");
  if(game==="Belote"){
    // Belote fixe : Nous/Eux
    players = ["Nous Joueur 1","Nous Joueur 2","Eux Joueur 1","Eux Joueur 2"];
    totals = [0,0,0,0];
    history = [];
    teams = [[0,1],[2,3]];
    options.classList.add("hidden");
  } else {
    // Autres jeux : choix du nombre de joueurs
    options.classList.remove("hidden");
    document.getElementById("playerNames").innerHTML = "";
    const count = parseInt(document.getElementById("playerCount").value);
    for(let i=0;i<count;i++){
      document.getElementById("playerNames").innerHTML += `<input type="text" placeholder="Nom Joueur ${i+1}" id="name${i}">`;
    }
  }
}

/* Mettre à jour champs noms si on change le nombre de joueurs (Skyjo/Flip7) */
document.getElementById("playerCount").addEventListener("input",()=>{
  const count = parseInt(document.getElementById("playerCount").value);
  const container = document.getElementById("playerNames");
  container.innerHTML="";
  for(let i=0;i<count;i++){
    container.innerHTML += `<input type="text" placeholder="Nom Joueur ${i+1}" id="name${i}">`;
  }
});

/* Démarrage du jeu */
function startGame(){
  if(game!=="Belote"){
    const count = parseInt(document.getElementById("playerCount").value);
    players=[];
    totals=Array(count).fill(0);
    history=[];
    for(let i=0;i<count;i++){
      const nameInput = document.getElementById(`name${i}`);
      players.push(nameInput.value || "Joueur "+(i+1));
    }
    teams=[];
  }

  document.getElementById("setup").classList.add("hidden");
  document.getElementById("game").classList.remove("hidden");
  document.getElementById("gameTitle").textContent = game;
  render();
}

/* Retour au menu principal */
function backToMenu(){
  document.getElementById("game").classList.add("hidden");
  document.getElementById("setup").classList.remove("hidden");
  document.getElementById("options").classList.add("hidden");
  game="";
  players=[];
  totals=[];
  history=[];
  teams=[];
}

/* Affichage scores, inputs, historique */
function render(){
  const scores = document.getElementById("scores");
  const inputs = document.getElementById("inputs");
  const historyList = document.getElementById("history");

  scores.innerHTML="";
  inputs.innerHTML="";
  historyList.innerHTML="";

  players.forEach((p,i)=>{
    scores.innerHTML += `<div class="card score-line"><span>${p}</span><strong id="score${i}">${totals[i]}</strong></div>`;
    inputs.innerHTML += `<input type="number" placeholder="Score ${p}" id="input${i}" oninput="updateScore(${i})">`;
  });

  if(game==="Belote" && teams.length){
    scores.innerHTML += `<h3>Scores équipes</h3>`;
    teams.forEach((team,idx)=>{
      const teamScore = totals[team[0]]+totals[team[1]];
      scores.innerHTML += `<div class="card score-line"><span>${idx===0?"Nous":"Eux"} (${players[team[0]]} + ${players[team[1]]})</span><strong>${teamScore}</strong></div>`;
    });
  }

  history.forEach((round,r)=>{
    historyList.innerHTML += `<li>Manche ${r+1} : ${round.join(" / ")}</li>`;
  });

  save();
}

/* Scores en temps réel */
function updateScore(i){
  const val = parseInt(document.getElementById("input"+i).value) || 0;
  totals[i] = val;
  document.getElementById("score"+i).textContent = totals[i];
  if(game==="Belote" && teams.length) render();
  save();
}

/* Ajouter manche historique */
function addRound(){
  const round = [];
  players.forEach((_,i)=> round.push(totals[i]));
  history.push([...round]);
  render();
}

/* Annuler dernière manche */
function undoRound(){
  if(!history.length) return;
  const last = history.pop();
  last.forEach((val,i)=>totals[i]=val);
  render();
}

/* Reset */
function resetGame(){
  if(confirm("Réinitialiser la partie ?")) location.reload();
}

/* Sauvegarde */
function save(){
  localStorage.setItem("scoreApp",JSON.stringify({game,players,totals,history,teams}));
}

/* Chargement */
function load(){
  const data = JSON.parse(localStorage.getItem("scoreApp"));
  if(!data) return;
  ({game,players,totals,history,teams}=data);
  if(game){
    document.getElementById("setup").classList.add("hidden");
    document.getElementById("game").classList.remove("hidden");
    document.getElementById("gameTitle").textContent = game;
    render();
  }
}
load();

/* Dark mode */
function toggleTheme(){ document.body.classList.toggle("dark"); }

/* Export CSV */
function exportScores(){
  let csv = "Joueur," + players.join(",") + "\n";
  csv += "Total," + totals.join(",") + "\n";
  history.forEach((round,idx)=> csv+=`Manche ${idx+1},${round.join(",")}\n`);
  const blob = new Blob([csv],{type:"text/csv"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href=url; a.download="scores.csv"; a.click();
  URL.revokeObjectURL(url);
}
