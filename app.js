document.addEventListener("DOMContentLoaded", function(){

let players=[], history=[], playerColors=[], chart;

const setupBtn = document.getElementById("setupPlayersBtn");
const startBtn = document.getElementById("startGameBtn");
const scoreContainer = document.getElementById("scoreContainer");
const historyContainer = document.getElementById("historyContainer");
const ctx = document.getElementById("scoreChart").getContext('2d');

// --- LOCAL STORAGE ---
function saveGame(){
  localStorage.setItem("gameData", JSON.stringify({players, history}));
}

function loadGame(){
  const data = localStorage.getItem("gameData");
  if(data){
    const parsed = JSON.parse(data);
    players = parsed.players || [];
    history = parsed.history || [];
    if(players.length){
      assignPlayerColors();
      document.getElementById("step1").classList.add("hidden");
      document.getElementById("step2").classList.remove("hidden");
      renderScores();
      renderHistory();
      renderChart();
      return true;
    }
  }
  return false;
}

// --- COULEURS ---
function assignPlayerColors(){
  const colors=["#ff4d4d","#4da6ff","#4dff88","#ffa64d","#b84dff","#ffd24d","#4dffd1","#ff4dd2"];
  playerColors = players.map((_,i)=>colors[i%colors.length]);
}

// --- CONFIGURATION JOUEURS ---
setupBtn.addEventListener("click", ()=>{
  const num = parseInt(document.getElementById("numPlayers").value)||2;
  const container = document.getElementById("playerInputs");
  container.innerHTML="";
  for(let i=0;i<num;i++){
    const input = document.createElement("input");
    input.type="text"; input.placeholder="Nom joueur "+(i+1);
    input.id="player"+i;
    container.appendChild(input);
  }
  startBtn.classList.remove("hidden");
});

startBtn.addEventListener("click", ()=>{
  const num = parseInt(document.getElementById("numPlayers").value)||2;
  players=[];
  for(let i=0;i<num;i++){
    const name = document.getElementById("player"+i).value || "Joueur "+(i+1);
    players.push(name);
  }
  history=[]; assignPlayerColors();
  document.getElementById("step1").classList.add("hidden");
  document.getElementById("step2").classList.remove("hidden");
  renderScores();
  renderHistory();
  renderChart();
  saveGame();
});

// --- METTRE EN EVIDENCE LE LEADER ---
function highlightLeader(){
  if(scoreContainer.children.length === 0) return;
  const totals = players.map((_,i)=>history.reduce((sum,r)=>sum+r[i],0));
  const maxTotal = Math.max(...totals);
  players.forEach((_,i)=>{
    const row = scoreContainer.children[i];
    if(totals[i] === maxTotal && maxTotal>0){
      row.style.border = "2px solid gold";
    } else {
      row.style.border = "none";
    }
  });
}

// --- RENDER TABLEAU + BARRES ANIMÉES ---
function renderScores(){
  scoreContainer.innerHTML="";
  const maxTotal = Math.max(...players.map((_,i)=>history.reduce((sum,r)=>sum+r[i],0)),1);
  players.forEach((p,i)=>{
    const total = history.reduce((sum,r)=>sum+r[i],0);
    const row = document.createElement("div"); row.className="playerRow";

    const nameDiv = document.createElement("div"); nameDiv.className="playerName"; nameDiv.textContent=p;
    const totalDiv = document.createElement("div"); totalDiv.className="playerTotal"; totalDiv.textContent=total;
    const inputDiv = document.createElement("div"); inputDiv.className="playerInput";
    const input = document.createElement("input"); input.type="number"; input.value=0; input.id="input"+i;
    inputDiv.appendChild(input);

    const barDiv = document.createElement("div"); barDiv.className="playerBar";
    const fill = document.createElement("div"); fill.className="barFill"; 
    fill.style.backgroundColor = playerColors[i];
    setTimeout(()=>{ fill.style.width = (total/maxTotal*100)+"%"; }, 10);
    barDiv.appendChild(fill);

    row.append(nameDiv,totalDiv,inputDiv,barDiv);
    scoreContainer.appendChild(row);
  });
  highlightLeader();
}

// --- HISTORIQUE ---
function renderHistory(){
  historyContainer.innerHTML="";
  history.forEach((round,r)=>{
    const row = document.createElement("div"); row.className="historyRow";
    round.forEach((val,i)=>{
      const cell = document.createElement("div"); cell.className="historyCell";
      cell.style.backgroundColor = playerColors[i];
      cell.textContent = val;
      row.appendChild(cell);
    });
    historyContainer.appendChild(row);
  });
}

// --- CHART ---
function renderChart(){
  const datasets = players.map((p,i)=>{
    let cumul = 0;
    const data = history.map(r=>{
      cumul += r[i]; return cumul;
    });
    return {
      label:p,
      data:data,
      borderColor:playerColors[i],
      backgroundColor:playerColors[i]+"33",
      fill:false,
      tension:0.2
    };
  });
  if(chart) chart.destroy();
  chart = new Chart(ctx,{
    type:'line',
    data:{labels:history.map((_,i)=>"Manche "+(i+1)), datasets:datasets},
    options:{responsive:true, plugins:{legend:{position:'bottom'}}}
  });
}

// --- AJOUTER MANCHE ---
function addRound(){
  const round = players.map((_,i)=>{
    const val = parseInt(document.getElementById("input"+i).value)||0;
    return val;
  });
  history.push(round);

  if(navigator.vibrate) navigator.vibrate(50);

  players.forEach((_,i)=>{
    const row = scoreContainer.children[i];
    row.classList.add("pulse");
    setTimeout(()=>row.classList.remove("pulse"),400);
  });

  players.forEach((_,i)=>document.getElementById("input"+i).value=0);
  renderScores(); renderHistory(); renderChart();
  saveGame();
}

// --- ANNULER DERNIERE MANCHE ---
function undoRound(){
  if(history.length>0){
    history.pop();

    if(navigator.vibrate) navigator.vibrate(50);

    renderScores(); renderHistory(); renderChart();
    saveGame();
  }
}

// --- NOUVELLE PARTIE ---
document.getElementById("resetBtn").addEventListener("click", ()=>{
  if(confirm("Réinitialiser la partie ?")){
    history=[]; renderScores(); renderHistory(); renderChart();
    localStorage.removeItem("gameData");
  }
});

// --- MODE SOMBRE ---
document.getElementById("toggleTheme").addEventListener("click", ()=>document.body.classList.toggle("dark"));

// --- LOAD GAME ---
loadGame();

// --- BOUTONS ---
document.getElementById("addRoundBtn").addEventListener("click", addRound);
document.getElementById("undoRoundBtn").addEventListener("click", undoRound);
