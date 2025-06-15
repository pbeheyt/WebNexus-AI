// src/components/layout/ContentTypeIcon.jsx
import React from 'react';
import PropTypes from 'prop-types';

import { CONTENT_TYPES } from '../../shared/constants';
import { GeneralContentIcon } from '../icons/GeneralContentIcon';
import { PdfIcon } from '../icons/PdfIcon';
import { RedditIcon } from '../icons/RedditIcon';
import { SelectedTextIcon } from '../icons/SelectedTextIcon';
import { YouTubeIcon } from '../icons/YouTubeIcon';

// Map content types to their corresponding icon components
const ICON_MAP = {
  [CONTENT_TYPES.GENERAL]: GeneralContentIcon,
  [CONTENT_TYPES.PDF]: PdfIcon,
  [CONTENT_TYPES.REDDIT]: RedditIcon,
  [CONTENT_TYPES.SELECTED_TEXT]: SelectedTextIcon,
  [CONTENT_TYPES.YOUTUBE]: YouTubeIcon,
};

/**
 * Reusable component for displaying content type icons.
 * This component is now secure and uses dedicated React components for each icon,
 * avoiding the use of dangerouslySetInnerHTML.
 *
 * @param {object} props - Component props
 * @param {string} props.contentType - The type of content to display an icon for.
 * @param {string} [props.className=''] - Additional CSS classes for the icon component.
 */
export function ContentTypeIcon({ contentType, className = '', ...props }) {
  const IconComponent = ICON_MAP[contentType] || GeneralContentIcon;

  return <IconComponent className={className} {...props} />;
}

ContentTypeIcon.propTypes = {
  contentType: PropTypes.string.isRequired,
  className: PropTypes.string,
};

export default ContentTypeIcon;