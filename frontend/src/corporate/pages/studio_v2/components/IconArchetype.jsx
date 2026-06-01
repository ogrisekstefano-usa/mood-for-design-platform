/**
 * IconArchetype — renders a Lucide icon based on icon_key string.
 * Falls back to a neutral square if the icon name is unknown.
 */
import React from 'react';
import {
  Sofa, Building2, Store, ShoppingBag, Hammer, Tag, MoreHorizontal,
  Box,
} from 'lucide-react';

const REGISTRY = {
  Sofa, Building2, Store, ShoppingBag, Hammer, Tag, MoreHorizontal,
};

const IconArchetype = ({ name, size = 28, color = 'currentColor' }) => {
  const Cmp = REGISTRY[name] || Box;
  return <Cmp size={size} color={color} strokeWidth={1.4} />;
};

export default IconArchetype;
