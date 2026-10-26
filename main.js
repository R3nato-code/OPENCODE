import * as THREE from 'three';
import { createEngine } from './chess-engine.js';
import { createScene } from './scene.js';

const PIECE_UNICODE = {
  'wk': '♔', 'wq': '♕', 'wr': '♖', 'wb': '♗', 'wn': '♘', 'wp': '♙',
  'bk': '♚', 'bq': '♛', 'br': '♜', 'bb': '♝', 'bn': '♞', 'bp': '♟'
};

const FILES = 'abcdefgh';
const RANKS = '87654321';

class PixelChessGame {
  constructor() {
    this.canvas = document.getElementById('chess-canvas');
    this.engine = createEngine();
    this.scene = createScene(this.canvas);

    this.selectedSquare = null;
    this.isDragging = false;
    this.dragPiece = null;
    this.pendingPromotion = null;
    this.suppressBot = false;
    this.orientation = 'white';
    this.preMoves = [];
    this.viewMode = '3d';
    this.timeControl = { base: 0, inc: 0 };
    this.clocks = { w: 0, b: 0 };
    this.clockActive = false;
    this.lastTick = 0;
    this.lastHistoryLen = 0;
    this.timeUp = false;

    try {
      if (localStorage.getItem('pixel-chess-view') === '2d') {
        this.viewMode = '2d';
        this.scene.setViewMode('2d');
      }
    } catch { /* sem storage */ }
    this.syncViewButton();

    this.engine.onMove = (state) => this.onEngineMove(state);
    this.engine.onGameOver = (result, state) => this.onGameOver(result, state);

    this.bindEvents();
    this.initClock();
    setInterval(() => this.tickClock(), 100);

    requestAnimationFrame(() => {
      this.resize();
      window.addEventListener('resize', () => this.resize());
      this.engine.newGame();
    });
  }

  bindEvents() {
    document.getElementById('new-game').addEventListener('click', () => this.newGame());
    document.getElementById('flip-board').addEventListener('click', () => this.flipBoard());
    document.getElementById('toggle-view').addEventListener('click', () => this.toggleView());
    document.getElementById('undo-move').addEventListener('click', () => this.undoMove());
    document.getElementById('hint-move').addEventListener('click', () => this.showHint());
    document.getElementById('difficulty').addEventListener('change', (e) => {
      this.engine.setDifficulty(parseInt(e.target.value));
    });
    document.getElementById('time-control').addEventListener('change', (e) => {
      this.applyTimeControl(e.target.value);
    });
    document.getElementById('bot-enabled').addEventListener('change', (e) => {
      this.engine.setBotEnabled(e.target.checked);
      if (e.target.checked && this.engine.isBotTurn()) {
        this.engine.makeBotMove();
      }
    });
    document.getElementById('bot-color').addEventListener('change', (e) => {
      this.engine.setBotColor(e.target.checked ? 'b' : 'w');
      this.orientation = e.target.checked ? 'white' : 'black';
      this.scene.setOrientation(this.orientation);
      this.preMoves = [];
      this.scene.clearArrows();
      if (this.engine.isBotTurn()) {
        this.engine.makeBotMove();
      }
    });
    document.getElementById('play-again').addEventListener('click', () => this.newGame());

    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const square = this.scene.raycast(e.clientX, e.clientY);
      if (square) this.scene.toggleMarker(square);
    });
    this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
    this.canvas.addEventListener('mouseleave', () => this.onMouseUp(null));
    this.canvas.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
    this.canvas.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
    this.canvas.addEventListener('touchend', (e) => this.onTouchEnd(e));

    document.getElementById('promotion-choices').addEventListener('click', (e) => {
      const choice = e.target.closest('.promotion-choice');
      if (choice && this.pendingPromotion) {
        this.completePromotion(choice.dataset.piece);
      }
    });
    document.getElementById('promotion-modal').addEventListener('click', (e) => {
      if (e.target.id === 'promotion-modal') this.cancelPromotion();
    });
  }

  resize() {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (width > 0 && height > 0) {
      this.scene.resize(width, height);
    }
  }

  // reconstrói a cena a partir do estado real do jogo; durante uma busca
  // o tabuleiro está em posição transitória, então nesse caso é ignorado
  syncBoard() {
    if (this.engine.isThinking) return;
    this.scene.setPosition(this.engine.game.board());
  }

  onEngineMove(state) {
    this.updateUI(state);

    const history = this.engine.game.history({ verbose: true });

    // relógio: incremento para quem acabou de jogar
    if (history.length === this.lastHistoryLen + 1 && this.timeControl.inc > 0) {
      this.clocks[history[history.length - 1].color] += this.timeControl.inc * 1000;
    }
    this.lastHistoryLen = history.length;

    this.syncBoard();
    this.scene.clearHighlights();
    this.scene.clearArrows();

    if (history.length > 0) {
      const last = history[history.length - 1];
      this.scene.highlightLastMove(this.algToSquare(last.from), this.algToSquare(last.to));
    }
    if (state.inCheck) {
      const kingSquare = this.findKingSquare(state.turn);
      if (kingSquare) this.scene.highlightCheck(kingSquare);
    }

    this.showThinking(!!state.isThinking);
    this.applyPreMovesVisual();

    if (state.isGameOver || this.suppressBot || this.timeUp) return;

    if (this.engine.isBotTurn()) {
      this.engine.makeBotMove();
    } else {
      this.processPreMoves();
    }
  }

  onGameOver(result, state) {
    const modal = document.getElementById('game-over-modal');
    const title = document.getElementById('game-over-title');
    const message = document.getElementById('game-over-message');

    switch (result) {
      case 'white':
        title.textContent = 'Xeque-mate!';
        message.textContent = 'As Brancas vencem!';
        break;
      case 'black':
        title.textContent = 'Xeque-mate!';
        message.textContent = 'As Pretas vencem!';
        break;
      case 'stalemate':
        title.textContent = 'Empate!';
        message.textContent = 'Afogamento (Stalemate)';
        break;
      default:
        title.textContent = 'Empate!';
        message.textContent = 'Empate por regra das 50 jogadas, repetição ou material insuficiente';
        break;
    }

    modal.hidden = false;
    this.clockActive = false;
    this.updateClockDisplay();
  }

  updateUI(state) {
    const turnIndicator = document.getElementById('turn-indicator');
    const checkIndicator = document.getElementById('check-indicator');
    const undoBtn = document.getElementById('undo-move');

    turnIndicator.textContent = state.turn === 'w' ? 'Vez das Brancas' : 'Vez das Pretas';
    turnIndicator.className = 'turn-indicator ' + (state.turn === 'w' ? 'white-turn' : 'black-turn');

    checkIndicator.hidden = !state.inCheck;

    undoBtn.disabled = this.engine.history.length === 0;

    this.updateCapturedPieces();
    this.updateMoveHistory();
  }

  findKingSquare(color) {
    const board = this.engine.game.board();
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const piece = board[rank][file];
        if (piece && piece.type === 'k' && piece.color === color) {
          return { file, rank };
        }
      }
    }
    return null;
  }

  updateCapturedPieces() {
    const capturedWhite = document.getElementById('captured-white');
    const capturedBlack = document.getElementById('captured-black');

    capturedWhite.innerHTML = '';
    capturedBlack.innerHTML = '';

    const history = this.engine.game.history({ verbose: true });
    const captured = { w: [], b: [] };

    for (const move of history) {
      if (move.captured) {
        const color = move.color === 'w' ? 'b' : 'w';
        captured[color].push(PIECE_UNICODE[color + move.captured]);
      }
    }

    captured.w.forEach(piece => {
      const el = document.createElement('span');
      el.className = 'captured-piece';
      el.textContent = piece;
      capturedWhite.appendChild(el);
    });

    captured.b.forEach(piece => {
      const el = document.createElement('span');
      el.className = 'captured-piece';
      el.textContent = piece;
      capturedBlack.appendChild(el);
    });
  }

  updateMoveHistory() {
    const historyEl = document.getElementById('move-history');
    const history = this.engine.game.history({ verbose: true });

    historyEl.innerHTML = '';

    for (let i = 0; i < history.length; i += 2) {
      const moveNumber = Math.floor(i / 2) + 1;
      const whiteMove = history[i];
      const blackMove = history[i + 1];

      const entry = document.createElement('div');
      entry.className = 'move-entry';

      const numSpan = document.createElement('span');
      numSpan.className = 'move-number';
      numSpan.textContent = moveNumber + '.';
      entry.appendChild(numSpan);

      const whiteSpan = document.createElement('span');
      whiteSpan.className = 'move-white';
      whiteSpan.textContent = whiteMove.san;
      entry.appendChild(whiteSpan);

      if (blackMove) {
        const blackSpan = document.createElement('span');
        blackSpan.className = 'move-black';
        blackSpan.textContent = blackMove.san;
        entry.appendChild(blackSpan);
      }

      historyEl.appendChild(entry);
    }

    historyEl.scrollTop = historyEl.scrollHeight;
  }

  showThinking(show) {
    const turnIndicator = document.getElementById('turn-indicator');
    if (show) {
      turnIndicator.textContent = 'Bot está pensando...';
      turnIndicator.style.opacity = '0.7';
    } else {
      turnIndicator.style.opacity = '1';
    }
  }

  newGame() {
    document.getElementById('game-over-modal').hidden = true;
    this.preMoves = [];
    this.scene.clearArrows();
    this.scene.clearMarkers();
    this.clearSelection();
    this.initClock();
    this.engine.newGame();
  }

  flipBoard() {
    this.orientation = this.orientation === 'white' ? 'black' : 'white';
    this.scene.setOrientation(this.orientation);
  }

  toggleView() {
    this.viewMode = this.viewMode === '3d' ? '2d' : '3d';
    this.scene.setViewMode(this.viewMode);
    try { localStorage.setItem('pixel-chess-view', this.viewMode); } catch { /* sem storage */ }
    this.syncViewButton();
  }

  syncViewButton() {
    document.getElementById('toggle-view').textContent =
      this.viewMode === '3d' ? '3D' : '2D';
  }

  applyTimeControl(value) {
    const [base, inc] = value.split(':').map(Number);
    this.timeControl = { base, inc };
    this.initClock();
  }

  initClock() {
    this.clocks.w = this.timeControl.base * 1000;
    this.clocks.b = this.timeControl.base * 1000;
    this.clockActive = this.timeControl.base > 0;
    this.timeUp = false;
    this.engine.stopped = false;
    this.lastHistoryLen = this.engine.history.length;
    this.lastTick = performance.now();
    this.updateClockDisplay();
  }

  tickClock() {
    if (!this.clockActive || this.timeUp) return;
    const engine = this.engine;
    // durante a busca o tabuleiro está em posição transitória:
    // usa o turno capturado no início da busca e não testa fim de jogo
    if (!engine.isThinking && engine.game.isGameOver()) return;
    const now = performance.now();
    const dt = now - this.lastTick;
    this.lastTick = now;
    const turn = engine.isThinking && engine.thinkingTurn
      ? engine.thinkingTurn
      : engine.game.turn();
    this.clocks[turn] = Math.max(0, this.clocks[turn] - dt);
    if (this.clocks[turn] <= 0) {
      this.onTimeExpired(turn);
      return;
    }
    this.updateClockDisplay();
  }

  onTimeExpired(loser) {
    this.clockActive = false;
    this.timeUp = true;
    this.engine.stopped = true;
    this.updateClockDisplay();
    this.showThinking(false);

    const modal = document.getElementById('game-over-modal');
    document.getElementById('game-over-title').textContent = 'Tempo Esgotado!';
    document.getElementById('game-over-message').textContent =
      loser === 'w' ? 'As Pretas vencem! (tempo)' : 'As Brancas vencem! (tempo)';
    modal.hidden = false;
  }

  updateClockDisplay() {
    const panel = document.getElementById('clock-panel');
    const elW = document.getElementById('clock-white');
    const elB = document.getElementById('clock-black');
    if (this.timeControl.base === 0) {
      panel.hidden = true;
      return;
    }
    panel.hidden = false;
    elW.textContent = this.formatTime(this.clocks.w);
    elB.textContent = this.formatTime(this.clocks.b);
    const turn = this.engine.game.turn();
    elW.classList.toggle('active', this.clockActive && turn === 'w');
    elB.classList.toggle('active', this.clockActive && turn === 'b');
    elW.classList.toggle('low', this.clocks.w <= 20000);
    elB.classList.toggle('low', this.clocks.b <= 20000);
  }

  formatTime(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return m + ':' + String(s).padStart(2, '0');
  }

  undoMove() {
    if (this.engine.history.length === 0 || this.engine.isThinking || this.timeUp) return;

    this.preMoves = [];
    this.scene.clearArrows();
    this.suppressBot = true;
    try {
      this.engine.undoMove();
      if (this.engine.botEnabled && this.engine.history.length > 0) {
        this.engine.undoMove();
      }
    } finally {
      this.suppressBot = false;
    }
    this.clearSelection();
  }

  async showHint() {
    if (this.engine.isThinking || this.engine.isBotTurn()) return;
    let hint = null;
    try {
      hint = await this.engine.getHint();
    } catch {
      return;
    }
    if (!hint) return;

    this.scene.clearArrows();
    this.scene.showArrow(this.algToSquare(hint.from), this.algToSquare(hint.to));

    const turnIndicator = document.getElementById('turn-indicator');
    turnIndicator.textContent = 'Dica: ' + hint.san;
    clearTimeout(this.hintTimer);
    this.hintTimer = setTimeout(() => {
      this.showThinking(false);
      this.updateUI(this.engine.getState());
    }, 2500);
  }

  queuePreMove(fromSquare, toSquare) {
    if (this.preMoves.length >= 6) this.preMoves.shift();
    this.preMoves.push({ from: { ...fromSquare }, to: { ...toSquare } });
    this.clearSelection();
    this.scene.applyPreMoveVisual(fromSquare, toSquare);
  }

  applyPreMovesVisual() {
    this.preMoves.forEach(pm => this.scene.applyPreMoveVisual(pm.from, pm.to));
  }

  processPreMoves() {
    while (
      this.preMoves.length > 0 &&
      !this.engine.isBotTurn() &&
      !this.engine.game.isGameOver() &&
      !this.timeUp
    ) {
      const pm = this.preMoves.shift();
      const ok = this.engine.makeMove(
        this.squareToAlg(pm.from),
        this.squareToAlg(pm.to),
        'q'
      );
      if (ok) break;
    }
  }

  clearSelection() {
    this.selectedSquare = null;
    this.scene.setSelectedSquare(null);
    this.scene.clearHighlights();
  }

  selectSquare(square, showMoves = true) {
    this.selectedSquare = square;
    this.scene.setSelectedSquare(square);
    this.scene.clearHighlights();
    this.scene.highlightSquare(square.file, square.rank, 'selected');

    if (!showMoves) {
      this.scene.setLegalMoves([]);
      return;
    }

    const moves = this.engine.getLegalMoves(this.squareToAlg(square));
    this.scene.setLegalMoves(moves);
    moves.forEach(move => {
      const target = this.algToSquare(move.to);
      this.scene.highlightSquare(target.file, target.rank, move.captured ? 'capture' : 'legal');
    });
  }

  onMouseDown(e) {
    if (e.button === 2 || this.timeUp || this.engine.game.isGameOver()) return;

    const square = this.scene.raycast(e.clientX, e.clientY);
    if (!square) {
      this.clearSelection();
      return;
    }

    const preMode = this.engine.isBotTurn();
    const humanColor = this.engine.botEnabled
      ? (this.engine.botColor === 'w' ? 'b' : 'w')
      : this.engine.game.turn();

    if (this.selectedSquare) {
      const fromAlg = this.squareToAlg(this.selectedSquare);
      const toAlg = this.squareToAlg(square);

      if (preMode) {
        if (fromAlg !== toAlg) {
          this.queuePreMove(this.selectedSquare, square);
        } else {
          this.clearSelection();
        }
        return;
      }

      const move = this.engine.getLegalMoves(fromAlg).find(m => m.to === toAlg);
      if (move) {
        if (move.promotion) {
          this.pendingPromotion = { from: fromAlg, to: toAlg };
          this.showPromotionModal(move.color);
          return;
        }
        this.makeMove(fromAlg, toAlg);
        return;
      }
    }

    const visual = this.scene.getPieceAt(square.file, square.rank);
    const piece = visual && visual.userData.preMoved
      ? visual.userData.piece
      : this.engine.game.get(this.squareToAlg(square));
    if (!piece || piece.color !== humanColor || (!preMode && piece.color !== this.engine.game.turn())) {
      this.clearSelection();
      return;
    }

    this.selectSquare(square, !preMode);

    this.isDragging = true;
    this.dragPiece = this.scene.getPieceAt(square.file, square.rank);
  }

  onMouseMove(e) {
    if (!this.isDragging || !this.dragPiece) return;

    const rect = this.canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), this.scene.camera);

    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const intersect = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(plane, intersect)) return;

    this.dragPiece.position.x = intersect.x;
    this.dragPiece.position.z = intersect.z;
    this.dragPiece.position.y = 1.2;
    this.scene.invalidateShadow();
  }

  onMouseUp(e) {
    if (!this.isDragging || !this.dragPiece || !this.selectedSquare) {
      this.isDragging = false;
      this.dragPiece = null;
      return;
    }

    let targetSquare = null;
    if (e) {
      targetSquare = this.scene.raycast(e.clientX, e.clientY);
    }

    this.isDragging = false;
    const fromSquare = this.selectedSquare;

    if (this.engine.isBotTurn()) {
      this.dragPiece = null;
      this.syncBoard();
      this.applyPreMovesVisual();
      if (targetSquare && (targetSquare.file !== fromSquare.file || targetSquare.rank !== fromSquare.rank)) {
        this.queuePreMove(fromSquare, targetSquare);
      }
      return;
    }

    if (targetSquare) {
      const fromAlg = this.squareToAlg(fromSquare);
      const toAlg = this.squareToAlg(targetSquare);

      const moves = this.engine.getLegalMoves(fromAlg);
      const move = moves.find(m => m.to === toAlg);

      if (move) {
        if (move.promotion) {
          this.pendingPromotion = { from: fromAlg, to: toAlg };
          this.dragPiece = null;
          this.showPromotionModal(move.color);
          return;
        }

        this.dragPiece = null;
        this.makeMove(fromAlg, toAlg);
        return;
      }
    }

    this.snapBack();
    this.dragPiece = null;
  }

  snapBack() {
    if (this.dragPiece && this.selectedSquare) {
      const pos = this.scene.squareToCoords(this.selectedSquare.file, this.selectedSquare.rank);
      this.dragPiece.position.copy(pos);
      this.scene.invalidateShadow();
    }
    if (this.selectedSquare) {
      this.selectSquare(this.selectedSquare);
    } else {
      this.scene.clearHighlights();
    }
  }

  makeMove(from, to, promotion) {
    this.scene.clearHighlights();
    this.selectedSquare = null;
    const success = this.engine.makeMove(from, to, promotion);
    if (!success) {
      this.syncBoard();
    }
  }

  completePromotion(piece) {
    if (!this.pendingPromotion) return;
    const { from, to } = this.pendingPromotion;
    this.pendingPromotion = null;
    document.getElementById('promotion-modal').hidden = true;
    this.makeMove(from, to, piece);
  }

  cancelPromotion() {
    this.pendingPromotion = null;
    document.getElementById('promotion-modal').hidden = true;
    this.syncBoard();
    this.clearSelection();
  }

  showPromotionModal(color) {
    const modal = document.getElementById('promotion-modal');
    const choices = document.getElementById('promotion-choices');
    choices.innerHTML = '';

    const pieces = ['q', 'r', 'b', 'n'];
    const pieceNames = { q: 'Rainha', r: 'Torre', b: 'Bispo', n: 'Cavalo' };

    pieces.forEach(p => {
      const btn = document.createElement('div');
      btn.className = 'promotion-choice' + (color === 'w' ? ' white-piece' : ' black-piece');
      btn.dataset.piece = p;
      btn.textContent = PIECE_UNICODE[color + p];
      btn.title = pieceNames[p];
      choices.appendChild(btn);
    });

    modal.hidden = false;
  }

  onTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    this.onMouseDown({ clientX: touch.clientX, clientY: touch.clientY });
  }

  onTouchMove(e) {
    e.preventDefault();
    const touch = e.touches[0];
    this.onMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
  }

  onTouchEnd(e) {
    const touch = e.changedTouches[0];
    this.onMouseUp({ clientX: touch.clientX, clientY: touch.clientY });
  }

  squareToAlg(square) {
    return FILES[square.file] + RANKS[square.rank];
  }

  algToSquare(alg) {
    return {
      file: FILES.indexOf(alg[0]),
      rank: RANKS.indexOf(alg[1])
    };
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new PixelChessGame());
} else {
  new PixelChessGame();
}

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
