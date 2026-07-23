export function iconLink(url: string | null | undefined, icon: string, title: string): Node {
  if (!url) return document.createTextNode('—');
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  anchor.title = title;
  anchor.className = 'grid-action';
  anchor.innerHTML = `<i class="pi ${icon}" aria-hidden="true"></i>`;
  return anchor;
}

export function textLink(url: string | null | undefined, text: string, className = ''): Node {
  if (!url) return document.createTextNode(text);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  anchor.textContent = text;
  anchor.className = className;
  return anchor;
}
