import { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import './InfoTooltip.css';
import type { TooltipContent } from './infoTooltipData';

interface InfoTooltipProps {
  content: TooltipContent;
}

export const InfoTooltip = ({ content }: InfoTooltipProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const iconRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (isVisible && iconRef.current) {
      const iconRect = iconRef.current.getBoundingClientRect();
      const tooltipWidth = 320;
      const tooltipHeight = 200; // Estimate
      const padding = 12;

      let left = iconRect.left + iconRect.width / 2 - tooltipWidth / 2;
      let top = iconRect.bottom + padding;

      // Keep within viewport horizontally
      if (left < padding) {
        left = padding;
      } else if (left + tooltipWidth > window.innerWidth - padding) {
        left = window.innerWidth - tooltipWidth - padding;
      }

      // If tooltip would go below viewport, show above
      if (top + tooltipHeight > window.innerHeight - padding) {
        top = iconRect.top - tooltipHeight - padding;
      }

      setTooltipStyle({
        position: 'fixed',
        left: `${left}px`,
        top: `${top}px`,
        width: `${tooltipWidth}px`,
      });
    }
  }, [isVisible]);

  const hasContent = content.examples?.length || content.description;
  if (!hasContent) return null;

  return (
    <span
      className="info-tooltip-wrapper"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      <span className="info-icon" ref={iconRef}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      </span>
      {isVisible && ReactDOM.createPortal(
        <div className="info-tooltip-popup" style={tooltipStyle}>
          {content.description && (
            <div className="tooltip-description">{content.description}</div>
          )}

          {content.examples && content.examples.length > 0 && (
            <div className="tooltip-examples">
              <div className="tooltip-section-title">Examples</div>
              <ul>
                {content.examples.map((example, i) => (
                  <li key={i}>
                    {example.text}
                    {example.source && <span className="example-source"> ({example.source})</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>,
        document.body
      )}
    </span>
  );
};
