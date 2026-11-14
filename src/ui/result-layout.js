// 結果の操作ボタンを残し、説明だけをスクロールするための高さ。
// 低い操作欄でも、見出し・ボタン・上下の余白と本文2行分を確保する。
export function resultToastHeight({ controlsHeight, bottom, headerHeight, actionsHeight, verticalInsets, gap, bodyHeight }) {
  const minimum = headerHeight + actionsHeight + verticalInsets + gap * 2 + bodyHeight;
  return Math.min(Math.max(0, bottom - 8), Math.max(controlsHeight + 40, minimum));
}

export function placeResultToast(panel, topAnchor, bottomAnchor) {
  if (panel.hidden) return;
  const top = topAnchor.getBoundingClientRect(), bottom = bottomAnchor.getBoundingClientRect();
  panel.style.left = `${top.left}px`;
  panel.style.width = `${top.width}px`;
  panel.style.bottom = `${Math.max(0, innerHeight - bottom.bottom)}px`;
  const css = getComputedStyle(panel);
  const number = value => Number.parseFloat(value) || 0;
  const body = panel.querySelector('.result-body');
  const max = resultToastHeight({
    controlsHeight: bottom.bottom - top.top, bottom: bottom.bottom,
    headerHeight: panel.querySelector('.result-head').getBoundingClientRect().height,
    actionsHeight: panel.querySelector('.result-actions').getBoundingClientRect().height,
    verticalInsets: number(css.paddingTop) + number(css.paddingBottom) + number(css.borderTopWidth) + number(css.borderBottomWidth),
    gap: number(css.rowGap), bodyHeight: Math.max(48, number(getComputedStyle(body).lineHeight) * 2)
  });
  panel.style.maxHeight = `${max}px`;
}

