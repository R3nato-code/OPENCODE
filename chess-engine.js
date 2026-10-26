import { Chess } from 'chess.js';

// pausa a busca quando passa deste orçamento, para o navegador renderizar
const YIELD_MS = 8;
const YIELD_CHECK = 4;

const inBrowser = typeof window !== 'undefined';
let yieldChannel = null;
let yieldCount = 0;

function yieldToBrowser() {
  // a cada 8 pausas usa setTimeout: garante progresso de timers/render
  const useChannel = inBrowser && typeof MessageChannel !== 'undefined' && ++yieldCount % 8 !== 0;
  if (useChannel) {
    // macrotask sem o clamp de 4ms do setTimeout aninhado
    if (!yieldChannel) yieldChannel = new MessageChannel();
    return new Promise(resolve => {
      yieldChannel.port1.onmessage = () => resolve();
      yieldChannel.port2.postMessage(null);
    });
  }
  return new Promise(resolve => setTimeout(resolve, 0));
}

const PIECE_VALUES = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000
};

const PAWN_TABLE = [
  [0, 0, 0, 0, 0, 0, 0, 0],
  [50, 50, 50, 50, 50, 50, 50, 50],
  [10, 10, 20, 30, 30, 20, 10, 10],
  [5, 5, 10, 25, 25, 10, 5, 5],
  [0, 0, 0, 20, 20, 0, 0, 0],
  [5, -5, -10, 0, 0, -10, -5, 5],
  [5, 10, 10, -20, -20, 10, 10, 5],
  [0, 0, 0, 0, 0, 0, 0, 0]
];

const KNIGHT_TABLE = [
  [-50, -40, -30, -30, -30, -30, -40, -50],
  [-40, -20, 0, 0, 0, 0, -20, -40],
  [-30, 0, 10, 15, 15, 10, 0, -30],
  [-30, 5, 15, 20, 20, 15, 5, -30],
  [-30, 0, 15, 20, 20, 15, 0, -30],
  [-30, 5, 10, 15, 15, 10, 5, -30],
  [-40, -20, 0, 5, 5, 0, -20, -40],
  [-50, -40, -30, -30, -30, -30, -40, -50]
];

const BISHOP_TABLE = [
  [-20, -10, -10, -10, -10, -10, -10, -20],
  [-10, 0, 0, 0, 0, 0, 0, -10],
  [-10, 0, 5, 10, 10, 5, 0, -10],
  [-10, 5, 5, 10, 10, 5, 5, -10],
  [-10, 0, 10, 10, 10, 10, 0, -10],
  [-10, 10, 10, 10, 10, 10, 10, -10],
  [-10, 5, 0, 0, 0, 0, 5, -10],
  [-20, -10, -10, -10, -10, -10, -10, -20]
];

const ROOK_TABLE = [
  [0, 0, 0, 0, 0, 0, 0, 0],
  [5, 10, 10, 10, 10, 10, 10, 5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [-5, 0, 0, 0, 0, 0, 0, -5],
  [0, 0, 0, 5, 5, 0, 0, 0]
];

const QUEEN_TABLE = [
  [-20, -10, -10, -5, -5, -10, -10, -20],
  [-10, 0, 0, 0, 0, 0, 0, -10],
  [-10, 0, 5, 5, 5, 5, 0, -10],
  [-5, 0, 5, 5, 5, 5, 0, -5],
  [0, 0, 5, 5, 5, 5, 0, -5],
  [-10, 5, 5, 5, 5, 5, 0, -10],
  [-10, 0, 5, 0, 0, 0, 0, -10],
  [-20, -10, -10, -5, -5, -10, -10, -20]
];

const KING_TABLE_MIDDLE = [
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-30, -40, -40, -50, -50, -40, -40, -30],
  [-20, -30, -30, -40, -40, -30, -30, -20],
  [-10, -20, -20, -20, -20, -20, -20, -10],
  [20, 20, 0, 0, 0, 0, 20, 20],
  [20, 30, 10, 0, 0, 10, 30, 20]
];

const KING_TABLE_END = [
  [-50, -40, -30, -20, -20, -30, -40, -50],
  [-30, -20, -10, 0, 0, -10, -20, -30],
  [-30, -10, 20, 30, 30, 20, -10, -30],
  [-30, -10, 30, 40, 40, 30, -10, -30],
  [-30, -10, 30, 40, 40, 30, -10, -30],
  [-30, -10, 20, 30, 30, 20, -10, -30],
  [-30, -30, 0, 0, 0, 0, -30, -30],
  [-50, -30, -30, -30, -30, -30, -30, -50]
];

const PIECE_TABLES = {
  p: PAWN_TABLE,
  n: KNIGHT_TABLE,
  b: BISHOP_TABLE,
  r: ROOK_TABLE,
  q: QUEEN_TABLE,
  k: KING_TABLE_MIDDLE
};

function flipTable(table) {
  return table.slice().reverse();
}

function getPieceTable(piece, isEndgame) {
  const table = PIECE_TABLES[piece.type];
  if (!table) return null;
  if (piece.type === 'k' && isEndgame) {
    return flipTable(KING_TABLE_END);
  }
  return piece.color === 'w' ? flipTable(table) : table;
}

function isEndgame(board) {
  let queenCount = 0;
  let minorCount = 0;
  for (const square of board) {
    if (square) {
      if (square.type === 'q') queenCount++;
      if (square.type === 'b' || square.type === 'n') minorCount++;
    }
  }
  return queenCount === 0 || (queenCount === 1 && minorCount <= 1);
}

export class ChessEngine {
  constructor() {
    this.game = new Chess();
    this.difficulty = 3;
    this.botColor = 'b';
    this.botEnabled = true;
    this.history = [];
    this.onMove = null;
    this.onGameOver = null;
    this.isThinking = false;
    this.thinkingTurn = null;
    this.searchGen = 0;
    this.stopped = false;
  }

  setDifficulty(depth) {
    this.difficulty = Math.max(1, Math.min(5, depth));
  }

  setBotColor(color) {
    this.botColor = color;
  }

  setBotEnabled(enabled) {
    this.botEnabled = enabled;
  }

  newGame() {
    this.game = new Chess();
    this.history = [];
    this.searchGen++;
    this.isThinking = false;
    this.thinkingTurn = null;
    this.stopped = false;
    if (this.onMove) this.onMove(this.getState());
  }

  getState() {
    return {
      fen: this.game.fen(),
      turn: this.game.turn(),
      isCheck: this.game.isCheck(),
      isCheckmate: this.game.isCheckmate(),
      isStalemate: this.game.isStalemate(),
      isDraw: this.game.isDraw(),
      isGameOver: this.game.isGameOver(),
      history: this.game.history({ verbose: true }),
      inCheck: this.game.isCheck()
    };
  }

  makeMove(from, to, promotion = 'q') {
    if (this.isThinking) return false;

    try {
      const move = this.game.move({ from, to, promotion });
      if (move) {
        this.history.push(move);
        if (this.onMove) this.onMove(this.getState());
        this.checkGameOver();
        return true;
      }
    } catch {
      return false;
    }
    return false;
  }

  makeMoveSan(san) {
    if (this.isThinking) return false;

    try {
      const move = this.game.move(san);
      if (move) {
        this.history.push(move);
        if (this.onMove) this.onMove(this.getState());
        this.checkGameOver();
        return true;
      }
    } catch {
      return false;
    }
    return false;
  }

  undoMove() {
    if (this.history.length === 0 || this.isThinking) return false;

    const move = this.game.undo();
    if (move) {
      this.history.pop();
      if (this.onMove) this.onMove(this.getState());
      return true;
    }
    return false;
  }

  getLegalMoves(square) {
    return this.game.moves({ square, verbose: true });
  }

  getAllLegalMoves() {
    return this.game.moves({ verbose: true });
  }

  isBotTurn() {
    return this.botEnabled && this.game.turn() === this.botColor && !this.game.isGameOver();
  }

  async makeBotMove() {
    if (!this.isBotTurn() || this.isThinking) return;

    this.isThinking = true;
    this.thinkingTurn = this.game.turn();
    const gen = this.searchGen;
    const game = this.game;
    if (this.onMove) this.onMove({ ...this.getState(), isThinking: true });

    setTimeout(async () => {
      let move = null;
      try {
        if (!this.stopped && this.game === game) {
          move = await this.findBestMove(this.difficulty);
        }
      } catch (err) {
        console.error('Erro no lance do bot:', err);
      }

      // só aplica o lance se o jogo seguir inalterado desde o início da busca
      const alive = this.searchGen === gen && this.game === game;
      if (alive && move && !this.stopped) {
        const played = this.game.move({ from: move.from, to: move.to, promotion: move.promotion });
        if (played) this.history.push(played);
      }

      if (this.searchGen === gen) {
        this.isThinking = false;
        this.thinkingTurn = null;
      }
      if (!alive) return;

      if (this.onMove) this.onMove(this.getState());
      if (!this.stopped) this.checkGameOver();
    }, 100);
  }

  async findBestMove(depth) {
    const game = this.game;
    const moves = game.moves({ verbose: true });
    if (moves.length === 0) return null;

    const orderMoves = (list) => list.slice().sort((a, b) =>
      (b.captured ? 1 : 0) - (a.captured ? 1 : 0)
    );

    const aborted = () => this.stopped || this.game !== game;

    let nodes = 0;
    let lastYield = performance.now();
    const tick = async () => {
      if (++nodes % YIELD_CHECK !== 0 || aborted()) return;
      if (performance.now() - lastYield < YIELD_MS) return;
      await yieldToBrowser();
      lastYield = performance.now();
    };

    const alphaBeta = async (g, d, alpha, beta, maximizing) => {
      if (aborted()) return 0;
      if (d === 0 || g.isGameOver()) {
        await tick();
        return this.evaluateBoard(g);
      }

      const moves = orderMoves(g.moves({ verbose: true }));
      if (maximizing) {
        let maxEval = -Infinity;
        for (const move of moves) {
          g.move(move);
          const evaluation = await alphaBeta(g, d - 1, alpha, beta, false);
          g.undo();
          if (aborted()) return 0;
          maxEval = Math.max(maxEval, evaluation);
          alpha = Math.max(alpha, evaluation);
          if (beta <= alpha) break;
        }
        return maxEval;
      } else {
        let minEval = Infinity;
        for (const move of moves) {
          g.move(move);
          const evaluation = await alphaBeta(g, d - 1, alpha, beta, true);
          g.undo();
          if (aborted()) return 0;
          minEval = Math.min(minEval, evaluation);
          beta = Math.min(beta, evaluation);
          if (beta <= alpha) break;
        }
        return minEval;
      }
    };

    let bestMove = null;
    let bestScore = -Infinity;

    for (const move of orderMoves(moves)) {
      if (aborted()) return null;
      game.move(move);
      const opponentIsWhite = game.turn() === 'w';
      const result = await alphaBeta(game, depth - 1, -Infinity, Infinity, opponentIsWhite);
      game.undo();
      if (aborted()) return null;
      const score = opponentIsWhite ? -result : result;

      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }

    return bestMove;
  }

  evaluateBoard(game) {
    if (game.isCheckmate()) {
      return game.turn() === 'w' ? -Infinity : Infinity;
    }
    if (game.isDraw()) {
      // isDraw() já cobre o afogamento: repetir isStalemate() só gerava lances à toa
      return 0;
    }

    const board = game.board();
    const endgame = isEndgame(board.flat());
    let score = 0;

    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const piece = board[rank][file];
        if (piece) {
          const value = PIECE_VALUES[piece.type];
          const table = getPieceTable(piece, endgame);
          const positional = table ? table[rank][file] : 0;
          const pieceScore = value + positional;
          score += piece.color === 'w' ? pieceScore : -pieceScore;
        }
      }
    }

    const mobility = game.moves().length;
    score += game.turn() === 'w' ? mobility * 0.1 : -mobility * 0.1;

    return score;
  }

  async getHint() {
    if (this.game.isGameOver() || this.isThinking) return null;
    const gen = this.searchGen;
    const game = this.game;
    this.isThinking = true;
    this.thinkingTurn = this.game.turn();
    try {
      const move = await this.findBestMove(2);
      if (this.searchGen !== gen || this.game !== game || !move) return null;
      return { from: move.from, to: move.to, san: move.san, promotion: move.promotion };
    } finally {
      if (this.searchGen === gen) {
        this.isThinking = false;
        this.thinkingTurn = null;
      }
    }
  }

  checkGameOver() {
    if (this.game.isGameOver() && this.onGameOver) {
      let result = '';
      if (this.game.isCheckmate()) {
        result = this.game.turn() === 'w' ? 'black' : 'white';
      } else if (this.game.isStalemate()) {
        result = 'stalemate';
      } else if (this.game.isDraw()) {
        result = 'draw';
      }
      this.onGameOver(result, this.getState());
    }
  }
}

export function createEngine() {
  return new ChessEngine();
}