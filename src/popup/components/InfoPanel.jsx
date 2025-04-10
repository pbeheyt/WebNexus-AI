//src/popup/components/InfoPanel.jsx
import React from 'react';
import { getContentTypeIconSvg } from '../../shared/utils/icon-utils';

export function InfoPanel({ contentTypeLabel, contentType }) {
  const displayLabel = contentTypeLabel || 'content';
  const iconSvg = getContentTypeIconSvg(contentType);
  
  const modifiedIconSvg = iconSvg.replace('w-5 h-5', 'w-3.5 h-3.5');

  return (
    <div className="p-1 rounded-lg bg-theme-hover/20 dark:bg-theme-hover/10 text-xs text-theme-secondary leading-relaxed">
      <p className="mb-1.5">
        Extract this <span className="font-medium text-theme-primary">{displayLabel}</span>
        {modifiedIconSvg && (
          <span
            className="inline-block align-middle mx-1"
            dangerouslySetInnerHTML={{ __html: modifiedIconSvg }}
          />
        )}
        and send it with your prompt to the selected platform.
      </p>
      <p>
        Open <span className="font-medium text-theme-primary">Side Panel</span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-3.5 h-3.5 inline-block align-text-bottom mx-1 text-theme-primary"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor"/>
          <line x1="15" y1="3" x2="15" y2="21" stroke="currentColor"/>
        </svg>
        to have your AI conversation directly on this page.
      </p>
    </div>
  );
}