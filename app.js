let game = "";
let players = [];
let totals = [];
let history = [];
let teams = []; // Pour Belote : Nous / Eux

function selectGame(name){ game=name; }

/* Mettre à jour champs noms selon nombre de joueurs */
document.getElementById("playerCount").addEventListener("input", ()=>{
  const count = parseInt(document.getElementById("playerCount").value);
  const container = document.getElementById("playerNames");
  container.innerHTML="";
  for(let i=0;i<count;i++){
    container.innerHTML += `<input type="text" placeholder="Nom Joueur ${i+1}" id="name${i}">`;
  }
});

/* Démarrer jeu */
function startGame(){
  const count = parseInt(document.getElementById("playerCount").value);
  players=[];
  totals=Array(count).fill(0);
  history=[];

  for(let i=0;i<count;i++){
    const nameInput=document.getElementById(`name${i}`);
    players.push(nameInput.value||"Joueur "+(i+1));
  }

  // Belote : deux équipes Nous / Eux
  if(game==="Belote" && count===4){ teams=[[0,1],[2,3]]; }
  else{ teams=[]; }

  document.getElementById("setup").classList.add("hidden");
  document.getElementById("game").classList.remove("hidden");
  document.getElementById("gameTitle").textContent=game;

  render();
}

/* Affichage scores + inputs + historique */
function render(){
  const scores=document.getElementById("scores");
  const inputs=document.getElementById("inputs");
  const historyList=document.getElementById("history");

  scores.innerHTML="";
  inputs.innerHTML="";
  historyList.innerHTML="";

  // Scores individuels
  players.forEach((p,i)=>{
    scores.innerHTML+=`<div class="card score-line"><span>${p}</span><strong id="score${i}">${totals[i]}</strong></div>`;
    inputs.innerHTML+=`<input type="number" placeholder="Score ${p}" id="input${i}" oninput="updateScore(${i})">`;
  });

  // Scores par équipe Belote
  if(game==="Belote" && teams.length){
    scores.innerHTML+=`<h3>Scores équipes</h3>`;
    teams.forEach((team,idx)=>{
      const teamScore = totals[team[0]]+totals[team[1]];
      scores.innerHTML+=`<div class="card score-line"><span>${idx===0?"Nous":"Eux"} (${players[team[0]]} + ${players[team[1]]})</span><strong>${teamScore}</strong></div>`;
    });
  }

  // Historique
  history.forEach((round,r)=>{
    historyList.innerHTML+=`<li>Manche ${r+1} : ${round.join(" / ")}</li>`;
  });

  save();
}

/* Temps réel : mise à jour score dès saisie */
function updateScore(i){
  const val = parseInt(document.getElementById("input"+i).value) || 0;
  totals[i] = val;
  document.getElementById("score"+i).textContent=totals[i];

  // Mettre à jour équipes si Belote
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
  last.forEach((val,i)=>totals[i]=val); // restore scores
  render();
}

/* Reset */
function resetGame(){ if(confirm("Réinitialiser la partie ?")) location.reload(); }

/* Sauvegarde */
function save(){ localStorage.setItem("scoreApp",JSON.stringify({game,players,totals,history,teams})); }

/* Chargement */
function load(){
  const data=JSON.parse(localStorage.getItem("scoreApp"));
  if(!data) return;
  ({game,players,totals,history,teams}=data);
  document.getElementById("setup").classList.add("hidden");
  document.getElementById("game").classList.remove("hidden");
  document.getElementById("gameTitle").textContent=game;
  render();
}
load();

/* Dark mode */
function toggleTheme(){ document.body.classList.toggle("dark"); }

/* Export CSV */
function exportScores(){
  let csv="Joueur,"+players.join(",")+"\n";
  csv+="Total,"+totals.join(",")+"\n";
  history.forEach((round,idx)=> csv+=`Manche ${idx+1},${round.join(",")}\n`);
  const blob = new Blob([csv],{type:"text/csv"});
  const url = URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url; a.download="scores.csv"; a.click(); URL.revokeObjectURL(url);
}
