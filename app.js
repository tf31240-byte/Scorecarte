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
    inputs.innerHTML+=`<input type="number" placeholder="Score ${p}" id="input${i}" oninput="updateScore(${i})">`;
  });

  if(game==="Belote" && teams.length){
    scores.innerHTML+=`<h3>Scores équipes</h3>`;
    teams.forEach((team,idx)=>{
      const teamScore=totals[team[0]]+totals[team[1]];
      scores.innerHTML+=`<div class="card score-line" style="background:${getLeadingTeamColor(idx,teamScore)}"><span>${idx===0?"Nous":"Eux"} (${players[team[0]]}+${players[team[1]]})</span><strong>${teamScore}</strong></div>`;
    });
  }

  renderGraph();
  save();
}

/* Couleur équipe qui mène */
function getLeadingTeamColor(idx,score){
  const teamScores = [totals[0]+totals[1], totals[2]+totals[3]];
  const maxScore = Math.max(...teamScores);
  return score===maxScore?"var(--lead)":"var(--card)";
}

/* Mise à jour score temps réel */
function updateScore(i){
  const val=parseInt(document.getElementById("input"+i).value)||0;
  totals[i]=val;
  document.getElementById("sco
