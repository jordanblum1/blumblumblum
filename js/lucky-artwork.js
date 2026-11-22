// Clone only the trusted, local link art. Each copy owns its SVG definitions.
export function createArtwork(choices) {
  let serial = 0;
  return index => {
    const choice = choices[index];
    const cell = document.createElement('div');
    cell.className = 'lucky-symbol';
    cell.dataset.luckySymbol = choice.label;
    const art = choice.art.cloneNode(true);
    art.classList.remove('is-playing');
    art.classList.add('is-controlled');
    art.setAttribute('aria-hidden', 'true');
    art.removeAttribute('tabindex');
    if (art instanceof SVGElement) {
      art.setAttribute('focusable', 'false');
      art.setAttribute('fill', 'none');
      art.setAttribute('stroke', 'currentColor');
      art.setAttribute('stroke-width', '1.55');
      art.setAttribute('stroke-linecap', 'round');
      art.setAttribute('stroke-linejoin', 'round');
    }
    const prefix = 'lucky-' + (++serial) + '-';
    const ids = new Map([art, ...art.querySelectorAll('[id]')].filter(element => element.id).map(element => [element.id, prefix + element.id]));
    // ID tokens are matched once, so a rewritten ID cannot be rewritten again.
    const rewrite = value => value.replace(/#([\w-]+)/g, (token, id) => ids.has(id) ? '#' + ids.get(id) : token);
    for (const element of [art, ...art.querySelectorAll('*')]) {
      for (const attribute of [...element.attributes]) {
        if (attribute.name === 'id') element.id = ids.get(attribute.value);
        else if (attribute.value.includes('#')) element.setAttribute(attribute.name, rewrite(attribute.value));
      }
      if (element.localName === 'style') element.textContent = rewrite(element.textContent);
    }
    cell.append(art);
    return cell;
  };
}
