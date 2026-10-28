import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '../translation/index.jsx';
import LineItem from './LineItem.jsx';

// While dragging near the top or bottom of the window, the page scrolls so rows off screen can be reached.
const SCROLL_EDGE = 60;
const SCROLL_STEP = 12;

// The scene's lines, reordered by dragging a row's grip (pointer events, so it works with a mouse, a pen or a finger)
// or by focusing the grip and pressing the arrow keys.
// lineProps: passed to every LineItem. onReorder(ids): the scene's line IDs in the new order.
// children: rows shown after the lines (the predict button).
export default function LineList({ lines, lineProps, onReorder, children }) {
  const { t } = useTranslation();
  // { from, to } while a row is dragged: from is its index, to the insertion index (0..lines.length).
  const [drag, setDrag] = useState(null);
  const listRef = useRef(null);
  const refocusId = useRef(null);

  // Moving a row can take focus off its grip; give it back so the arrow keys keep working.
  useEffect(() => {
    if (!refocusId.current) return;
    listRef.current.querySelector(`.drag-handle[data-line-id="${refocusId.current}"]`)?.focus();
    refocusId.current = null;
  }, [lines]);

  function indexOf(e) {
    return lines.findIndex((l) => l.id === e.currentTarget.dataset.lineId);
  }

  // Before the first row whose middle is below the pointer; after the last row when there is none.
  function insertionIndex(clientY) {
    const rows = [...listRef.current.querySelectorAll('li[data-line-id]')];
    const index = rows.findIndex((row) => {
      const rect = row.getBoundingClientRect();
      return clientY < rect.top + rect.height / 2;
    });
    if (index === -1) return rows.length;
    return index;
  }

  // Dropping a row right before or right after itself leaves the order as it is.
  function isMove(from, to) {
    return to !== from && to !== from + 1;
  }

  function move(from, to) {
    if (!isMove(from, to)) return;
    const ids = lines.map((l) => l.id);
    const [id] = ids.splice(from, 1);
    ids.splice(to > from ? to - 1 : to, 0, id);
    onReorder(ids);
  }

  function startDrag(e) {
    if (e.button !== 0) return;
    // No text selection and no focus change while dragging; capture keeps the moves coming outside the grip.
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const from = indexOf(e);
    setDrag({ from, to: from });
  }

  function moveDrag(e) {
    if (!drag) return;
    if (e.clientY < SCROLL_EDGE) window.scrollBy(0, -SCROLL_STEP);
    else if (e.clientY > window.innerHeight - SCROLL_EDGE) window.scrollBy(0, SCROLL_STEP);
    const to = insertionIndex(e.clientY);
    if (to !== drag.to) setDrag({ ...drag, to });
  }

  function endDrag() {
    if (!drag) return;
    setDrag(null);
    move(drag.from, drag.to);
  }

  function cancelDrag() {
    setDrag(null);
  }

  function moveByKey(e) {
    const from = indexOf(e);
    let to;
    if (e.key === 'ArrowUp') to = from - 1;
    else if (e.key === 'ArrowDown') to = from + 2;
    else return;
    e.preventDefault();
    if (to < 0 || to > lines.length) return;
    refocusId.current = lines[from].id;
    move(from, to);
  }

  const dragHandleProps = {
    onPointerDown: startDrag,
    onPointerMove: moveDrag,
    onPointerUp: endDrag,
    onPointerCancel: cancelDrag,
    onKeyDown: moveByKey,
  };

  function dragClass(index) {
    if (!drag) return '';
    if (index === drag.from) return 'dragging';
    if (!isMove(drag.from, drag.to)) return '';
    if (index === drag.to) return 'drop-before';
    if (index === lines.length - 1 && drag.to === lines.length) return 'drop-after';
    return '';
  }

  function listClass() {
    if (drag) return 'lines reordering';
    return 'lines';
  }

  function renderEmpty() {
    if (lines.length) return null;
    return <li className="empty">{t('scene.emptyLines')}</li>;
  }

  return (
    <ol ref={listRef} className={listClass()}>
      {renderEmpty()}
      {lines.map((line, index) => (
        <LineItem key={line.id} line={line} {...lineProps} dragHandleProps={dragHandleProps} dragClass={dragClass(index)} />
      ))}
      {children}
    </ol>
  );
}
