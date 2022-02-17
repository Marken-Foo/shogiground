import { HeadlessState, State } from './state';
import * as sg from './types';
import * as board from './board';
import * as util from './util';
import { cancel as dragCancel } from './drag';
import { predrop } from './premove';

export function setDropMode(s: State, piece: sg.Piece, fromHand: boolean): void {
  s.dropmode.active = true;
  s.dropmode.piece = piece;
  s.dropmode.fromHand = fromHand;
  dragCancel(s);
  board.unselect(s);
  if (piece && board.isPredroppable(s)) {
    s.predroppable.dropDests = predrop(s.pieces, piece, s.dimensions);
  }
}

export function cancelDropMode(s: HeadlessState): void {
  s.dropmode.active = false;
  s.dropmode.piece = undefined;
}

export function drop(s: State, e: sg.MouchEvent): void {
  if (!s.dropmode.active) return;

  if (e.cancelable) e.preventDefault();

  board.unsetPremove(s);
  board.unsetPredrop(s);

  const piece = s.dropmode.piece;

  if (piece) {
    s.pieces.set('00', piece);
    const position = util.eventPosition(e);
    const dest = position && board.getKeyAtDomPos(position, board.sentePov(s), s.dimensions, s.dom.bounds());
    if (dest) {
      board.userDrop(s, dest, false, true);
      if (s.dropmode.fromHand) s.dropmode.active = false;
    }
  }
  s.dom.redraw();
}
