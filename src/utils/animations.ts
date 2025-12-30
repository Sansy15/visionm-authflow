import { Variants } from "framer-motion";

/**
 * Shared animation variants for consistent styling across pages
 * All animations use fast, professional timing (0.2-0.25s)
 */

// Standard animation variant: fade in + slight upward motion (12px)
export const fadeInUpVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.25,
      ease: [0.4, 0, 0.2, 1],
    },
  },
};

// Fast animation variant: fade in + slight upward motion (10px, 0.2s)
export const fastFadeInUpVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.2,
      ease: [0.4, 0, 0.2, 1],
    },
  },
};

// Stagger container for multiple children (0.1s delay between children)
export const staggerContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05,
    },
  },
};

