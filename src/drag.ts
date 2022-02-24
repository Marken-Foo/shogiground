import { State } from './state.js';
import * as board from './board.js';
import * as util from './util.js';
import { clear as drawClear } from './draw.js';
import * as sg from './types.js';
import { anim } from './anim.js';
import { predrop } from './predrop.js';

export interface DragCurrent {
  orig: sg.Key; // orig key of dragging piece
  piece: sg.Piece;
  origPos: sg.NumberPair; // first event position
  pos: sg.NumberPair; // latest event position
  started: boolean; // whether the drag has started; as per the distance setting
  element: sg.PieceNode | (() => sg.PieceNode | undefined);
  newPiece?: boolean; // is it a new piece from outside the board
  fromHand?: boolean; // is it a piece from shogiground hand
  force?: boolean; // can the new piece replace an existing one (editor)
  previouslySelected?: sg.Key;
  originTarget: EventTarget | null;
  keyHasChanged: boolean; // whether the drag has left the orig key
}

export function start(s: State, e: sg.MouchEvent): void {
  if (!e.isTrusted || (e.button !== undefined && e.button !== 0)) return; // only touch or left click
  if (e.touches && e.touches.length > 1) return; // support one finger touch only
  const bounds = s.dom.bounds(),
    position = util.eventPosition(e)!,
    orig = board.getKeyAtDomPos(position, board.sentePov(s), s.dimensions, bounds);
  if (!orig) return;
  const piece = s.pieces.get(orig);
  const previouslySelected = s.selected;
  if (!previouslySelected && s.drawable.enabled && (s.drawable.eraseOnClick || !piece || piece.color !== s.turnColor))
    drawClear(s);
  // Prevent touch scroll and create no corresponding mouse event, if there
  // is an intent to interact with the board.
  if (
    e.cancelable !== false &&
    (!e.touches || s.blockTouchScroll || piece || previouslySelected || pieceCloseTo(s, position))
  )
    e.preventDefault();
  const hadPremove = !!s.premovable.current;
  const hadPredrop = !!s.predroppable.current || !!s.predroppable.dests;
  s.stats.ctrlKey = e.ctrlKey;
  if (s.selected && board.canMove(s, s.selected, orig)) {
    anim(state => board.selectSquare(state, orig), s);
  } else {
    board.selectSquare(s, orig);
  }
  const stillSelected = s.selected === orig;
  const element = pieceElementByKey(s, orig);
  if (piece && element && stillSelected && board.isDraggable(s, orig)) {
    s.draggable.current = {
      orig,
      piece,
      origPos: position,
      pos: position,
      started: s.draggable.autoDistance && s.stats.dragged,
      element,
      previouslySelected,
      originTarget: e.target,
      keyHasChanged: false,
    };
    element.sgDragging = true;
    element.classList.add('dragging');
    // place ghost
    const ghost = s.dom.elements.ghost;
    if (ghost) {
      ghost.className = `ghost ${piece.color} ${piece.role}`;
      util.translateAbs(ghost, util.posToTranslateAbs(s.dimensions, bounds)(util.key2pos(orig), board.sentePov(s)));
      util.setVisible(ghost, true);
    }
    processDrag(s);
  } else {
    if (hadPremove) board.unsetPremove(s);
    if (hadPredrop) board.unsetPredrop(s);
  }
  s.dom.redraw();
}

function pieceCloseTo(s: State, pos: sg.NumberPair): boolean {
  const asSente = board.sentePov(s),
    bounds = s.dom.bounds(),
    radiusSq = Math.pow(bounds.width / s.dimensions.files, 2);
  for (const key of s.pieces.keys()) {
    const center = util.computeSquareCenter(key, asSente, s.dimensions, bounds);
    if (util.distanceSq(center, pos) <= radiusSq) return true;
  }
  return false;
}

export function dragNewPiece(s: State, piece: sg.Piece, e: sg.MouchEvent, hand: boolean, force: boolean): void {
  const key = '00';
  s.pieces.set(key, piece);
  board.unselect(s);
  s.dom.redraw();

  const position = util.eventPosition(e)!;

  s.draggable.current = {
    orig: key,
    piece,
    origPos: position,
    pos: position,
    started: true,
    element: () => pieceElementByKey(s, key),
    originTarget: e.target,
    newPiece: true,
    fromHand: hand,
    force: force,
    keyHasChanged: s.dropmode.active && s.dropmode.piece?.role === piece.role && s.dropmode.piece.color === piece.color,
  };
  if (board.isPredroppable(s, piece)) s.predroppable.dests = predrop(s.pieces, piece, s.dimensions);
  if (hand) {
    s.dropmode.active = true;
    s.dropmode.piece = piece;
  }
  processDrag(s);
}

function processDrag(s: State): void {
  requestAnimationFrame(() => {
    const cur = s.draggable.current;
    if (!cur) return;
    // cancel animations while dragging
    if (s.animation.current?.plan.anims.has(cur.orig)) s.animation.current = undefined;
    // if moving piece is gone, cancel
    const origPiece = s.pieces.get(cur.orig);
    if (!origPiece || !util.samePiece(origPiece, cur.piece)) cancel(s);
    else {
      if (!cur.started && util.distanceSq(cur.pos, cur.origPos) >= Math.pow(s.draggable.distance, 2))
        cur.started = true;
      if (cur.started) {
        // support lazy elements
        if (typeof cur.element === 'function') {
          const found = cur.element();
          if (!found) return;
          found.sgDragging = true;
          found.classList.add('dragging');
          cur.element = found;
        }

        const bounds = s.dom.bounds();
        util.translateAbs(cur.element, [
          cur.pos[0] - bounds.left - bounds.width / (s.dimensions.files * 2),
          cur.pos[1] - bounds.top - bounds.height / (s.dimensions.ranks * 2),
        ]);
        cur.keyHasChanged =
          cur.keyHasChanged ||
          (!cur.newPiece && cur.orig !== board.getKeyAtDomPos(cur.pos, board.sentePov(s), s.dimensions, bounds)) ||
          (!!cur.fromHand && util.distanceSq(cur.pos, cur.origPos) >= Math.pow(s.draggable.distance, 4));
      }
    }
    processDrag(s);
  });
}

export function move(s: State, e: sg.MouchEvent): void {
  // support one finger touch only
  if (s.draggable.current && (!e.touches || e.touches.length < 2)) {
    s.draggable.current.pos = util.eventPosition(e)!;
  }
}

export function end(s: State, e: sg.MouchEvent): void {
  const cur = s.draggable.current;
  if (!cur) return;
  // create no corresponding mouse event
  if (e.type === 'touchend' && e.cancelable !== false) e.preventDefault();
  // comparing with the origin target is an easy way to test that the end event
  // has the same touch origin
  if (e.type === 'touchend' && cur.originTarget !== e.target && !cur.newPiece) {
    s.draggable.current = undefined;
    return;
  }
  board.unsetPremove(s);
  board.unsetPredrop(s);
  // touchend has no position; so use the last touchmove position instead
  const eventPos = util.eventPosition(e) || cur.pos;
  const dest = board.getKeyAtDomPos(eventPos, board.sentePov(s), s.dimensions, s.dom.bounds());
  if (dest && cur.started && cur.orig !== dest) {
    if (cur.newPiece) {
      board.userDrop(s, cur.piece, dest, cur.force, cur.fromHand);
      s.pieces.delete('00');
    } else {
      s.stats.ctrlKey = e.ctrlKey;
      if (board.userMove(s, cur.orig, dest)) s.stats.dragged = true;
    }
  } else if (cur.newPiece) {
    s.pieces.delete(cur.orig);
    if (cur.fromHand && cur.keyHasChanged) {
      board.cancelDropMode(s);
    }
  } else if (s.draggable.deleteOnDropOff && !dest) {
    s.draggable.lastDropOff = cur;
    s.pieces.delete(cur.orig);
    board.callUserFunction(s.events.change);
  }
  if ((cur.orig === cur.previouslySelected || cur.keyHasChanged) && (cur.orig === dest || !dest)) board.unselect(s);
  else if (!s.selectable.enabled) board.unselect(s);

  removeDragElements(s);

  s.draggable.current = undefined;
  s.dom.redraw();
}

export function cancel(s: State): void {
  const cur = s.draggable.current;
  if (cur) {
    if (cur.newPiece) s.pieces.delete(cur.orig);
    s.draggable.current = undefined;
    board.unselect(s);
    removeDragElements(s);
    s.dom.redraw();
  }
}

function removeDragElements(s: State): void {
  const e = s.dom.elements;
  if (e.ghost) util.setVisible(e.ghost, false);
}

function pieceElementByKey(s: State, key: sg.Key): sg.PieceNode | undefined {
  let el = s.dom.elements.pieces.firstElementChild as HTMLElement | undefined;
  while (el) {
    if (sg.isPieceNode(el) && el.sgKey === key) return el as sg.PieceNode;
    el = el.nextElementSibling as HTMLElement | undefined;
  }
  return;
}
