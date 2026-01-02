let game="", players=[], history=[];

/* Étape 1 : Sélection du jeu */
function selectGame(name){
  game = name;
  document.getElementById("step1").classList.add("hidden");
  document.getElementById("step2").classList.remove("hidden");
  renderPlayerInputs();
}

/* Étape 2 : Ajouter joueurs */
function renderPlayerInputs(){
  const container = document.getElementById("playerInputs");
  container.innerHTML="";
  for(let i=0;i<4;i++){ // valeur par défaut max 4 joueurs, modifiable
    const input = document.createElement("input");
    input.type="text";
    input.placeholder="Nom joueur "+(i+1);
    input.id="player"+i;
    container.appendChild(input);
  }
}

/* Démarrer la partie */
function startGame(){
  players=[];
  for(let i=0;i<4;i++){
    const name = document.getElementById("player"+i).value || "Joueur "+(i+1);
    players.push(name);
  }
  history=[];
  document.getElementById("step2").classList.add("hidden");
  document.getElementById("step3").classList.remove("hidden");
  document.getElementById("gameTitle").textContent = game;
  renderScoreTable();
}

/* Rendu tableau scores */
function renderScoreTable(){
  const container = document.getElementById("scoreTable");
  container.innerHTML="";

  let table = "<table><tr><th>Joueur</th><th>Total</th><th>Dernière Manche</th><th>Points à ajouter</th></tr>";

  players.forEach((p,i)=>{
    const lastRound = history.length ? history[history.length-1][i] : 0;
    const total = history.reduce((sum,round)=>sum+round[i],0);
    table += `<tr>
      <td>${p}</td>
      <td id="total${i}">${total}</td>
      <td id="last${i}">${lastRound}</td>
      <td><input type="number" id="input${i}" value="0"></td>
    </tr>`;
  });

  table += "</table>";
  container.innerHTML = table;
}

/* Étape 3 : Ajouter une manche */
function addRound(){
  const round = players.map((_,i)=>{
    const val = parseInt(document.getElementById("input"+i).value) || 0;
    return val;
  });
  history.push(round);
  renderScoreTable();
}

/* Annuler dernière manche */
function undoRound(){
  if(history.length>0) history.pop();
  renderScoreTable();
}

/* Reset jeu */
function resetGame(){
  if(confirm("Réinitialiser la partie ?")) location.reload();
}

/* Menu principal */
function backToMenu(){
  location.reload();
}

/* Dark mode */
function toggleTheme(){ document.body.classList.toggle("dark"); }
