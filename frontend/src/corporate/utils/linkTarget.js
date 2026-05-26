/**
 * Returns the spreadable `target` / `rel` attributes for an anchor based on
 * a CMS-stored target string ("_blank" / "_self" / undefined).
 *
 * Usage:
 *   <a href={links.cta_primary_href} {...linkTarget(links.cta_primary_target)} />
 */
export const linkTarget = (target) => {
  if (target === '_blank') {
    return { target: '_blank', rel: 'noopener noreferrer' };
  }
  return {};
};

export default linkTarget;
