import { useEffect, useRef, useState } from 'react';

/**
 * Intersection Observer-based reveal hook.
 * Triggers CSS .visible class for scroll animations.
 */
export const useReveal = ({ threshold = 0.1, once = true } = {}) => {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          if (once) observer.unobserve(el);
        }
      },
      { threshold }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, once]);

  return [ref, visible];
};
