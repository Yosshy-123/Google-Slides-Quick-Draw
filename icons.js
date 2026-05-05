const ICON_NS = 'http://www.w3.org/2000/svg';

function svgMarkup(content) {
  return `<svg xmlns="${ICON_NS}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${content}</svg>`;
}

const ICONS = {
  pen: svgMarkup(`
    <path d="M4 20l1.2-4.8L15.4 5c.8-.8 2.1-.8 2.9 0l.7.7c.8.8.8 2.1 0 2.9L8.8 18.8 4 20Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M13.8 6.6l3.6 3.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
  `),
  eraser: svgMarkup(`
    <path d="M15.7 4.3 21 9.6a2 2 0 0 1 0 2.8l-6.2 6.2H8.6L3 13l7.2-7.2a2.1 2.1 0 0 1 3 0Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M7 19h11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
  `),
  trash: svgMarkup(`
    <path d="M5 7h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M9 7V5.8A1.8 1.8 0 0 1 10.8 4h2.4A1.8 1.8 0 0 1 15 5.8V7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M8 7.5v10.1A1.4 1.4 0 0 0 9.4 19h5.2a1.4 1.4 0 0 0 1.4-1.4V7.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M10 10.5v5M14 10.5v5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
  `),
  copy: svgMarkup(`
    <path d="M8 8.2V6.9A1.9 1.9 0 0 1 9.9 5h7.2A1.9 1.9 0 0 1 19 6.9v7.2A1.9 1.9 0 0 1 17.1 16h-1.3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M5 11.1A2.1 2.1 0 0 1 7.1 9h7.8A2.1 2.1 0 0 1 17 11.1v7.8A2.1 2.1 0 0 1 14.9 21H7.1A2.1 2.1 0 0 1 5 18.9v-7.8Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
  `),
};

function createIcon(name) {
  const markup = ICONS[name];
  if (!markup) throw new Error(`Unknown icon: ${name}`);
  const span = document.createElement('span');
  span.className = 'icon';
  span.innerHTML = markup;
  return span;
}

export { createIcon };
