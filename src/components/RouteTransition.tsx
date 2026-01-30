import React, { Suspense } from 'react';
import { motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { PageTransitionLoader } from './PageTransitionLoader';

interface RouteTransitionProps {
  children: React.ReactNode;
}

export const RouteTransition: React.FC<RouteTransitionProps> = ({ children }) => {
  const location = useLocation();

  return (
    <motion.div
      key={location.pathname}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.3,
        ease: 'easeInOut',
      }}
      style={{ width: '100%', height: '100%' }}
    >
      <Suspense fallback={<PageTransitionLoader />}>
        {children}
      </Suspense>
    </motion.div>
  );
};
