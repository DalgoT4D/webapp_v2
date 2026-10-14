import React from 'react';

/** Linkify URLs in a notification message. Shared by the in-app NotificationRow
 * and the admin broadcast history, which both render admin/user-authored text
 * and must escape it the same way (features/admin-portal/plan.md §5). */
export function renderMessageWithLinks(message: string): React.ReactNode {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = message.split(urlRegex);

  return parts.map((part, index) => {
    if (/^https?:\/\/[^\s]+$/.test(part)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-teal-600 hover:text-teal-700 hover:underline break-all"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    return part;
  });
}
