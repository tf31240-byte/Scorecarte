/* Icônes en couleur des jeux (SVG originaux, à plat). Valeur de preset : "img:<nom>". */
const GAME_ICONS = (() => {
    const T = 'font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" font-weight="800" text-anchor="middle"';
    const wrap = (inner) => `<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">${inner}</svg>`;
    return {
        skyjo: wrap(`
            <rect width="64" height="64" rx="14" fill="#1e3a8a"/>
            <g transform="rotate(-16 22 40)"><rect x="9" y="14" width="26" height="36" rx="5" fill="#38bdf8"/><text x="22" y="40" font-size="17" fill="#fff" ${T}>-2</text></g>
            <g transform="rotate(16 42 40)"><rect x="29" y="14" width="26" height="36" rx="5" fill="#ef4444"/><text x="42" y="40" font-size="17" fill="#fff" ${T}>12</text></g>
            <g transform="rotate(0 32 32)"><rect x="19" y="10" width="26" height="36" rx="5" fill="#22c55e"/><text x="32" y="35" font-size="19" fill="#fff" ${T}>5</text></g>
            <rect x="12" y="54" width="40" height="4" rx="2" fill="#facc15"/>`),
        uno: wrap(`
            <rect width="64" height="64" rx="14" fill="#1f2937"/>
            <g transform="rotate(-30 32 54)"><rect x="20" y="8" width="24" height="38" rx="5" fill="#3b82f6" stroke="#fff" stroke-width="2"/></g>
            <g transform="rotate(-10 32 54)"><rect x="20" y="8" width="24" height="38" rx="5" fill="#22c55e" stroke="#fff" stroke-width="2"/></g>
            <g transform="rotate(10 32 54)"><rect x="20" y="8" width="24" height="38" rx="5" fill="#facc15" stroke="#fff" stroke-width="2"/></g>
            <g transform="rotate(30 32 54)"><rect x="20" y="8" width="24" height="38" rx="5" fill="#ef4444" stroke="#fff" stroke-width="2"/><text x="32" y="36" font-size="22" fill="#fff" ${T}>7</text></g>`),
        scrabble: wrap(`
            <rect width="64" height="64" rx="14" fill="#7c4a21"/>
            <rect x="5" y="5" width="54" height="54" rx="10" fill="#9a6232"/>
            <g transform="rotate(-8 20 34)"><rect x="6" y="18" width="24" height="26" rx="4" fill="#f6dfa8" stroke="#d6b36a" stroke-width="1.5"/><text x="17" y="39" font-size="19" fill="#3b2410" ${T}>S</text><text x="26" y="42" font-size="7" fill="#3b2410" ${T}>1</text></g>
            <g transform="rotate(6 44 34)"><rect x="32" y="18" width="24" height="26" rx="4" fill="#f6dfa8" stroke="#d6b36a" stroke-width="1.5"/><text x="43" y="39" font-size="19" fill="#3b2410" ${T}>K</text><text x="52" y="42" font-size="7" fill="#3b2410" ${T}>10</text></g>
            <rect x="14" y="48" width="36" height="5" rx="2.5" fill="#ef4444" opacity=".9"/>`),
        belote: wrap(`
            <rect width="64" height="64" rx="14" fill="#166534"/>
            <g transform="rotate(-12 24 40)"><rect x="9" y="12" width="28" height="40" rx="5" fill="#fff"/><text x="17" y="26" font-size="12" fill="#dc2626" ${T}>V</text><text x="23" y="45" font-size="24" fill="#dc2626" ${T}>♥</text></g>
            <g transform="rotate(12 40 40)"><rect x="27" y="12" width="28" height="40" rx="5" fill="#fff" stroke="#e5e7eb" stroke-width="1"/><text x="35" y="26" font-size="12" fill="#111827" ${T}>A</text><text x="41" y="45" font-size="24" fill="#111827" ${T}>♠</text></g>`),
        flip7: wrap(`
            <rect width="64" height="64" rx="14" fill="#6d28d9"/>
            <rect x="17" y="9" width="30" height="42" rx="6" fill="#fff"/>
            <text x="32" y="42" font-size="34" fill="#f97316" ${T}>7</text>
            <path d="M12 50a22 22 0 0 0 40 4" fill="none" stroke="#facc15" stroke-width="4" stroke-linecap="round"/>
            <path d="M54 46l-1 9-8-3z" fill="#facc15"/>`)
    };
})();

/** Rend une icône de jeu : SVG couleur si "img:<nom>" connu, sinon l'emoji (échappé). */
function gameIcon(value) {
    const v = String(value || '');
    if (v.startsWith('img:') && GAME_ICONS[v.slice(4)]) return `<span class="game-ico">${GAME_ICONS[v.slice(4)]}</span>`;
    return escapeHtml(v);
}
/** Version texte (pour <option>, etc.) : emoji de repli. */
const GAME_ICON_FALLBACK = { skyjo: '🔢', uno: '🌈', scrabble: '🅰️', belote: '🃏', flip7: '🔄' };
function gameIconText(value) {
    const v = String(value || '');
    return v.startsWith('img:') ? (GAME_ICON_FALLBACK[v.slice(4)] || '🎮') : v;
}
