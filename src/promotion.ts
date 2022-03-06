import * as board from './board.js';
import * as sg from './types.js';
import { State } from './state.js';
import { createEl, key2pos, pieceNameOf, posToTranslateAbs, setDisplay, translateAbs } from './util';

export function setPromotion(s: State, key: sg.Key, pieces: sg.Piece[]): void {
  s.promotion.active = true;
  s.promotion.key = key;
  s.promotion.pieces = pieces;
}

export function cancelPromotion(s: State): void {
  s.promotion.active = false;
  s.promotion.key = undefined;
  s.promotion.pieces = undefined;
}

export function renderPromotions(s: State): void {
  const promotionEl = s.dom.elements.promotion;
  setDisplay(promotionEl, s.promotion.active);

  if (!s.promotion.active || !s.promotion.key || !s.promotion.pieces || s.viewOnly) return;

  const asSente = board.sentePov(s),
    initPos = key2pos(s.promotion.key);
  const promotionNode = createEl('promotion');
  translateAbs(promotionNode, posToTranslateAbs(s.dimensions, s.dom.bounds())(initPos, asSente), 1);

  s.promotion.pieces.forEach(p => {
    const pieceNode = createEl('piece', pieceNameOf(p));
    pieceNode.dataset.color = p.color;
    pieceNode.dataset.role = p.role;
    promotionNode.appendChild(pieceNode);
  });

  promotionEl.innerHTML = '';
  promotionEl.appendChild(promotionNode);
}

export function promote(s: State, e: sg.MouchEvent): void {
  e.preventDefault();

  const key = s.promotion.key,
    piece = getPiece(e.target as HTMLElement);

  if (s.promotion.active && key && piece) {
    s.pieces.set(key, piece);
    board.callUserFunction(s.promotion.after, piece);
  } else board.callUserFunction(s.promotion.cancel);

  cancelPromotion(s);
  setDisplay(s.dom.elements.promotion, false);

  s.dom.redraw();
}

function getPiece(pieceEl: HTMLElement): sg.Piece | undefined {
  const role = pieceEl.dataset.role;
  const color = pieceEl.dataset.color;
  if (sg.isRole(role) && sg.isColor(color)) return { role: role, color: color };
  return;
}
