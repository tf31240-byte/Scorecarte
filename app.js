let game="", players=[], totals=[], history=[], teams=[], playerColors=[];

/* Couleurs fixes par joueur */
function assignPlayerColors(){
  const colors=["#ff4d4d","#4da6ff","#4dff88","#ffa64d","#b84dff","#ffd24d","#4dffd1","#ff4dd2"];
  playerColors=players.map((_,i)=>colors[i%colors.length]);
}

/* Sélection du jeu */
function selectGame(name){
  game=name;
  const options=document.getElementById("options");
  if(game==="Belote"){
    players=["Nous Joueur 1","Nous Joueur 2","Eux Joueur 1","Eux Joueur 2"];
    totals=[0,0,0,0]; history=[]; teams=[[0,1],[2,3]];
    options.classList.add("hidden");
  }else{
    options.classList.remove("hidden");
    const count=parseInt(document.getElementById("playerCount").value);
    const container=document.getElementById("playerNames");
    container.innerHTML="";
    for(let i=0;i<count;i++) container.innerHTML+=`<input type="text" placeholder="Nom Joueur ${i+1}" id="name${i}">`;
  }
}

/* Mise à jour noms si nombre de joueurs change */
document.getElementById("playerCount").addEventListener("input",()=>{
  const count=parseInt(document.getElementById("playerCount").value);
  const container=document.getElementById("playerNames"); container.innerHTML="";
  for(let i=0;i<count;i++) container.innerHTML+=`<input type="text" placeholder="Nom Joueur ${i+1}" id="name${i}">`;
});

/* Démarrer le jeu */
function startGame(){
  if(game!=="Belote"){
    const count=parseInt(document.getElementById("playerCount").value);
    players=[]; totals=Array(count).fill(0); history=[]; teams=[];
    for(let i=0;i<count;i++){
      const nameInput=document.getElementById(`name${i}`);
      players.push(nameInput.value||"Joueur "+(i+1));
    }
  }
  assignPlayerColors();
  document.getElementById("setup").classList.add("hidden");
  document.getElementById("game").classList.remove("hidden");
  document.getElementById("gameTitle").textContent=game;
  render();
}

/* Retour au menu principal */
function backToMenu(){
  document.getElementById("game").classList.add("hidden");
  document.getElementById("setup").classList.remove("hidden");
  document.getElementById("options").classList.add("hidden");
  game=""; players=[]; totals=[]; history=[]; teams=[]; playerColors=[];
}

/* Rendu principal */
function render(){
  const scores=document.getElementById("scores");
  const inputs=document.getElementById("inputs");
  scores.innerHTML=""; inputs.innerHTML="";

  players.forEach((p,i)=>{
    scores.innerHTML+=`<div class="card score-line" id="line${i}"><span>${p}</span><strong id="score${i}">${totals[i]}</strong></div>`;
    const inputEl = document.createElement("input");
    inputEl.type="number";
    inputEl.placeholder="Score "+p;
    inputEl.value=totals[i];
    inputEl.oninput=()=>updateScore(i);
    inputs.appendChild(inputEl);
  });

  renderGraph();
  save();
}

/* Temps réel avec feedback pulse */
function updateScore(i){
  const val=parseInt(document.querySelectorAll("#inputs input")[i].value)||0;
  totals[i]=val;
  document.getElementById("score"+i).textContent=totals[i];

  const line=document.getElementById("line"+i);
  line.classList.add("pulse");
  setTimeout(()=>line.classList.remove("pulse"),500);

  renderGraph();
  save();
}

/* Ajouter manche */
function addRound(){
  const round=[]; players.forEach((_,i)=>round.push(totals[i]));
  history.push([...round]);
  render();
}

/* Reset */
function resetGame(){ if(confirm("Réinitialiser la partie ?")) location.reload(); }

/* Sauvegarde locale */
function save(){ localStorage.setItem("scoreApp",JSON.stringify({game,players,totals,history,teams,playerColors})); }

/* Chargement */
function load(){
  const data=JSON.parse(localStorage.getItem("scoreApp"));
  if(!data) return;
  ({game,players,totals,history,teams,playerColors}=data);
  if(game){
    document.getElementById("setup").classList.add("hidden");
    document.getElementById("game").classList.remove("hidden");
    document.getElementById("gameTitle").textContent=game;
    render();
  }
}
load();

/* Dark mode */
function toggleTheme(){ document.body.classList.toggle("dark"); }

/* Export CSV */
function exportScores(){
  let csv="Joueur,"+players.join(",")+"\n";
  csv+="Total,"+totals.join(",")+"\n";
  history.forEach((round,idx)=> csv+=`Manche ${idx+1},${round.join(",")}\n`);
  const blob=new Blob([csv],{type:"text/csv"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url; a.download="scores.csv"; a.click();
  URL.revokeObjectURL(url);
}

/* Rendu graphique historique avec labels manche */
function renderGraph(){
  const container=document.getElementById("historyGraph");
  container.innerHTML="";
  if(!history.length) return;

  let maxScore=Math.max(...totals.concat(...history.flat()));

  history.forEach((round,r)=>{
    const mancheLabel=document.createElement("div");
    mancheLabel.style.width="100%";
    mancheLabel.style.textAlign="center";
    mancheLabel.style.fontSize="12px";
    mancheLabel.textContent="Manche "+(r+1);
    container.appendChild(mancheLabel);

    round.forEach((val,i)=>{
      const bar=document.createElement("div");
      bar.className="bar";
      bar.style.height=(val/maxScore*100)+"px";
      bar.style.background=playerColors[i];
      const label=document.createElement("span");
      label.textContent=val;
      bar.appendChild(label);
      container.appendChild(bar);
    });
  });
}
