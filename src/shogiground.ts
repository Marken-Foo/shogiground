import { Api, start } from './api.js';
import { Config, configure } from './config.js';
import { HeadlessState, State, defaults } from './state.js';
import { renderWrap } from './wrap.js';
import * as events from './events.js';
import { render, updateBounds } from './render.js';
import * as svg from './svg.js';
import * as util from './util.js';

export function Shogiground(element: HTMLElement, config?: Config): Api {
  const maybeState: State | HeadlessState = defaults();

  configure(maybeState, config || {});

  function redrawAll(): State {
    const prevUnbind = 'dom' in maybeState ? maybeState.dom.unbind : undefined;
    // compute bounds from existing board element if possible
    // this allows non-square boards from CSS to be handled (for ratio)
    const relative = maybeState.viewOnly && !maybeState.drawable.visible,
      elements = renderWrap(element, maybeState, relative),
      bounds = util.memo(() => elements.board.getBoundingClientRect()),
      redrawNow = (skipSvg?: boolean): void => {
        render(state);
        if (!skipSvg && elements.svg && elements.customSvg) svg.renderSvg(state, elements.svg, elements.customSvg);
      },
      boundsUpdated = (): void => {
        bounds.clear();
        updateBounds(state);
        if (elements.svg && elements.customSvg) svg.renderSvg(state, elements.svg, elements.customSvg);
      };
    const state = maybeState as State;
    state.dom = {
      elements,
      bounds,
      redraw: debounceRedraw(redrawNow),
      redrawNow,
      unbind: prevUnbind,
      relative,
    };
    state.drawable.prevSvgHash = '';
    redrawNow(false);
    events.bindBoard(state, boundsUpdated);
    events.bindHands(state);
    if (!prevUnbind) state.dom.unbind = events.bindDocument(state, boundsUpdated);
    state.events.insert && state.events.insert(elements);
    return state;
  }

  return start(redrawAll(), redrawAll);
}

function debounceRedraw(redrawNow: (skipSvg?: boolean) => void): () => void {
  let redrawing = false;
  return () => {
    if (redrawing) return;
    redrawing = true;
    requestAnimationFrame(() => {
      redrawNow();
      redrawing = false;
    });
  };
}
