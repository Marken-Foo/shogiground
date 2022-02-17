import * as util from './util';
import * as sg from './types';

type Mobility = (x1: number, y1: number, x2: number, y2: number) => boolean;

function diff(a: number, b: number): number {
  return Math.abs(a - b);
}

function pawn(color: sg.Color): Mobility {
  return (x1, y1, x2, y2) => (color === 'sente' ? x1 === x2 && y1 - 1 === y2 : x1 === x2 && y1 + 1 === y2);
}

function knight(color: sg.Color): Mobility {
  return (x1, y1, x2, y2) => diff(x1, x2) === 1 && diff(y1, y2) === 2 && (color === 'sente' ? y2 < y1 : y2 > y1);
}

const bishop: Mobility = (x1, y1, x2, y2) => {
  return diff(x1, x2) === diff(y1, y2);
};

const rook: Mobility = (x1, y1, x2, y2) => {
  return x1 === x2 || y1 === y2;
};

const king: Mobility = (x1, y1, x2, y2) => {
  return diff(x1, x2) < 2 && diff(y1, y2) < 2;
};

function lance(color: sg.Color): Mobility {
  return (x1, y1, x2, y2) => (color === 'sente' ? x1 === x2 && y2 < y1 : x1 === x2 && y1 < y2);
}

function silver(color: sg.Color): Mobility {
  return (x1, y1, x2, y2) =>
    diff(x1, x2) < 2 &&
    diff(y1, y2) < 2 &&
    y1 !== y2 &&
    (color === 'sente' ? x1 !== x2 || y2 < y1 : x1 !== x2 || y2 > y1);
}

function gold(color: sg.Color): Mobility {
  return (x1, y1, x2, y2) =>
    diff(x1, x2) < 2 && diff(y1, y2) < 2 && (color === 'sente' ? y2 <= y1 || x1 === x2 : y2 >= y1 || x1 === x2);
}

const horse: Mobility = (x1, y1, x2, y2) => {
  return king(x1, y1, x2, y2) || bishop(x1, y1, x2, y2);
};

const dragon: Mobility = (x1, y1, x2, y2) => {
  return king(x1, y1, x2, y2) || rook(x1, y1, x2, y2);
};

const allPos = util.allKeys.map(util.key2pos);

export function premove(pieces: sg.Pieces, key: sg.Key, dims: sg.Dimensions): sg.Key[] {
  const piece = pieces.get(key);
  if (!piece) return [];
  const pos = util.key2pos(key),
    r = piece.role,
    mobility: Mobility =
      r === 'pawn'
        ? pawn(piece.color)
        : r === 'knight'
        ? knight(piece.color)
        : r === 'bishop'
        ? bishop
        : r === 'rook'
        ? rook
        : r === 'king'
        ? king
        : r === 'silver'
        ? silver(piece.color)
        : r === 'lance'
        ? lance(piece.color)
        : r === 'horse'
        ? horse
        : r === 'dragon'
        ? dragon
        : gold(piece.color);
  return allPos
    .filter(
      pos2 =>
        (pos[0] !== pos2[0] || pos[1] !== pos2[1]) &&
        mobility(pos[0], pos[1], pos2[0], pos2[1]) &&
        pos2[0] < dims.files &&
        pos2[1] < dims.ranks
    )
    .map(util.pos2key);
}

function lastRow(dims: sg.Dimensions, pos: sg.Pos, color: sg.Color): boolean {
  return color === 'sente' ? pos[1] === 0 : pos[1] === dims.ranks - 1;
}

function lastTwoRows(dims: sg.Dimensions, pos: sg.Pos, color: sg.Color): boolean {
  return lastRow(dims, pos, color) || (color === 'sente' ? pos[1] === 1 : pos[1] === dims.ranks - 2);
}

export function predrop(pieces: sg.Pieces, dropPiece: sg.Piece, dims: sg.Dimensions): sg.Key[] {
  const color = dropPiece.color;
  const role = dropPiece.role;
  return util.allKeys.filter(key => {
    const p = pieces.get(key);
    const pos = util.key2pos(key);
    return (
      (!p || p.color !== color) &&
      pos[0] < dims.files &&
      pos[1] < dims.ranks &&
      (role === 'pawn' || role === 'lance'
        ? !lastRow(dims, pos, color)
        : role === 'knight'
        ? !lastTwoRows(dims, pos, color)
        : true)
    );
  });
}
