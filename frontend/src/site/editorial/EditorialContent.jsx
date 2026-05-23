/**
 * ITER143A+ · Dynamic Editorial Runtime™ — EditorialContent component
 *
 * Renders a single editorial block from the dynamic bundle. Defaults to
 * a non-semantic <span>; callers pass `as="h1"` etc. for headings.
 *
 *   <EditorialContent blockKey="site.begin_journey.step1.title" as="h1" />
 *   <EditorialContent blockKey="site.begin_journey.step1.cta.next"
 *                     fallback="" as="span" />
 *
 * STRICT POLICY: if the key is missing, the component renders the
 * fallback (default: empty string), NEVER a foreign-language source.
 */
import React from 'react';
import { useEditorialBlock, useEditorialBundle } from './EditorialBundleProvider';

export const EditorialContent = ({
  blockKey,
  fallback = '',
  as: Tag = 'span',
  skeletonWidth = '8ch',
  ...rest
}) => {
  const value = useEditorialBlock(blockKey, '');
  const { ready, loading } = useEditorialBundle();
  if (!ready && loading && !value) {
    return (
      <Tag {...rest} aria-busy="true" data-editorial-skeleton="true"
           style={{ ...(rest.style || {}),
                    display: 'inline-block',
                    minWidth: skeletonWidth,
                    opacity: 0.35,
                    background: 'currentColor',
                    color: 'transparent',
                    borderRadius: '0.2em' }}>
        {'\u00A0'}
      </Tag>
    );
  }
  return <Tag {...rest}>{value || fallback}</Tag>;
};

export default EditorialContent;
