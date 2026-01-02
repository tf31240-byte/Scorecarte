let game="", players=[], history=[], totals=[], teams=[], playerColors=[];

/* Couleurs fixes */
function assignPlayerColors(){
  const colors=["#ff4d4d","#4da6ff","#4dff88","#ffa64d","#b84dff","#ffd24d","#4dffd1","#ff4dd2"];
  playerColors = players.map((_,i)=>colors[i%colors.length]);
}

/* Sélection du jeu */
function selectGame(name){
  game = name;
  const playerSetup = document.getElementById("playerSetup");

  if(game==="Belote"){
    players=["Nous 1","Nous 2","Eux 1","Eux 2"];
    totals=[0,0,0,0]; history=[]; teams=[[0,1],[2,3]];
    playerSetup.classList.add("hidden");
    startGame();
  } else {
    playerSetup.classList.remove("hidden");
    renderPlayerInputs();
  }
}

/* Créer les inputs pour noms joueurs */
function renderPlayerInputs(){
  const container = document.getElementById("playerNames");
  container.innerHTML = "";
  const count = parseInt(document.getElementById("playerCount").value);
  for(let i=0;i<count;i++){
    const input = document.createElement("input");
    input.type="text"; input.placeholder="Nom joueur "+(i+1); input.id="name"+i;
    container.appendChild(input);
  }
}

/* Démarrer le jeu */
function startGame(){
  if(game!=="Belote"){
    const count = parseInt(document.getElementById("playerCount").value);
    players=[]; history=[]; teams=[]; totals=[];
    for(let i=0;i<count;i++){
      const name = document.getElementById("name"+i).value || "Joueur "+(i+1);
      players.push(name);
    }
  }
  assignPlayerColors();
  document.getElementById("setup").classList.add("hidden");
  document.getElementById("game").classList.remove("hidden");
  document.getElementById("gameTitle").textContent=game;
  calculateTotals();
  render();
}

/* Retour menu principal */
function backToMenu(){
  document.getElementById("game").classList.add("hidden");
  document.getElementById("setup").classList.remove("hidden");
  document.getElementById("playerSetup").classList.add("hidden");
  game="", players=[], totals=[], history=[], teams=[], playerColors=[];
}

/* Calcul totals à partir de l'historique */
function calculateTotals(){
  totals = players.map((_,i)=> history.reduce((sum,round)=>sum+round[i],0));
}

/* Affichage scores et inputs */
function render(){
  const scores = document.getElementById("scores");
  const inputs = document.getElementById("inputs");
  scores.innerHTML = ""; inputs.innerHTML = "";

  players.forEach((p,i)=>{
    scores.innerHTML += `<div class="card score-line" id="line${i}"><span>${p}</span><strong id="score${i}">${totals[i] || 0}</strong></div>`;
    const inputEl = document.createElement("input");
    inputEl.type="number"; inputEl.placeholder="Score "+p; inputEl.value=0;
    inputEl.addEventListener("input",()=>updateScore(i));
    inputs.appendChild(inputEl);
  });

  renderGraph();
  save();
}

/* Mise à jour temporaire d’un score */
function updateScore(i){
  const val = parseInt(document.querySelectorAll("#inputs input")[i].value)||0;
  const line = document.getElementById("line"+i);
  line.classList.add("pulse");
  setTimeout(()=>line.classList.remove("pulse"),400);
}

/* Valider manche */
function addRound(){
  const round = players.map((_,i)=> parseInt(document.querySelectorAll("#inputs input")[i].value)||0 );
  history.push(round);
  calculateTotals();
  // reset inputs à 0
  document.querySelectorAll("#inputs input").forEach(input=>input.value=0);
  render();
}

/* Annuler dernière manche */
function undoRound(){
  if(!history.length) return;
  history.pop();
  calculateTotals();
  render();
}

/* Reset jeu */
function resetGame(){ if(confirm("Réinitialiser la partie ?")) location.reload(); }

/* Dark mode */
function toggleTheme(){ document.body.classList.toggle("dark"); }

/* Export CSV */
function exportScores(){
  let csv="Joueur,"+players.join(",")+"\n";
  csv+="Total,"+totals.join(",")+"\n";
  history.forEach((round,idx)=> csv+=`Manche ${idx+1},${round.join(",")}\n`);
  const blob=new Blob([csv],{type:"text/csv"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a"); a.href=url; a.download="scores.csv"; a.click();
  URL.revokeObjectURL(url);
}

/* Historique graphique */
function renderGraph(){
  const container=document.getElementById("historyGraph");
  container.innerHTML="";
  if(!history.length) return;
  const maxScore = Math.max(...history.flat(),1);

  history.forEach((round,r)=>{
    const mancheLabel = document.createElement("div");
    mancheLabel.style.width="100%";
    mancheLabel.style.textAlign="center";
    mancheLabel.style.fontSize="12px";
    mancheLabel.textContent="Manche "+(r+1);
    container.appendChild(mancheLabel);

    round.forEach((val,i)=>{
      const bar = document.createElement("div");
      bar.className="bar";
      bar.style.height = (val/maxScore*100)+"px";
      bar.style.background = playerColors[i];
      const label = document.createElement("span");
      label.textContent = val;
      bar.appendChild(label);
      container.appendChild(bar);
    });
  });
}

/* Sauvegarde locale */
function save(){ localStorage.setItem("scoreApp",JSON.stringify({game,players,history,teams,playerColors})); }

/* Chargement */
function load(){
  const data = JSON.parse(localStorage.getItem("scoreApp"));
  if(!data) return;
  ({game,players,history,teams,playerColors}=data);
  if(game){ document.getElementById("setup").classList.add("hidden");
    document.getElementById("game").classList.remove("hidden");
    document.getElementById("gameTitle").textContent=game;
    calculateTotals();
    render();
  }
}
load();
