// SVG の部品を作る小さな関数（前作 PRISM の src/ui/svg.js を移した）
export function svg(tag, attrs = {}, text = '') {
  const item = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [name, value] of Object.entries(attrs)) item.setAttribute(name, value);
  if (text) item.textContent = text;
  return item;
}
