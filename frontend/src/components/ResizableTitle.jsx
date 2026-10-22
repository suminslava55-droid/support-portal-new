import React, { useRef } from 'react';
import './ResizableTitle.css';

const MIN_WIDTH = 50;

/**
 * Ячейка заголовка Ant Design Table с перетаскиваемой правой границей.
 * Подключение: components={{ header: { cell: ResizableTitle } }} и
 * onHeaderCell: () => ({ width, onResize: (w) => ... }) у колонки.
 */
export default function ResizableTitle({ onResize, width, onClick, className, children, ...rest }) {
  // Флаг «только что тянули» — чтобы отпускание мыши не переключало сортировку
  const draggedRef = useRef(false);

  if (!width || !onResize) {
    return <th className={className} onClick={onClick} {...rest}>{children}</th>;
  }

  const handleMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = width;
    draggedRef.current = false;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev) => {
      draggedRef.current = true;
      onResize(Math.max(MIN_WIDTH, Math.round(startWidth + ev.clientX - startX)));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setTimeout(() => { draggedRef.current = false; }, 0);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const handleClick = (e) => {
    if (draggedRef.current) return;
    onClick?.(e);
  };

  return (
    <th {...rest} className={`${className || ''} resizable-th`} onClick={handleClick}>
      {children}
      <span
        className="resizable-th-handle"
        onMouseDown={handleMouseDown}
        onClick={(e) => e.stopPropagation()}
      />
    </th>
  );
}
