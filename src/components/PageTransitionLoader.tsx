import React from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

interface PageTransitionLoaderProps {
  fullScreen?: boolean;
  size?: 'small' | 'medium' | 'large';
  inline?: boolean;
}

export const PageTransitionLoader: React.FC<PageTransitionLoaderProps> = ({
  fullScreen = true,
  size = 'large',
  inline = false,
}) => {
  const sizeMap = {
    small: 96,
    medium: 200,
    large: 320,
  };

  const loaderSize = sizeMap[size];

  const animation = (
    <DotLottieReact
      src="https://lottie.host/d9b4b8ae-2d44-4bc6-b80a-4d709d78bee5/MxsdsRgn1I.lottie"
      loop
      autoplay
      style={{ width: loaderSize, height: loaderSize, maxWidth: '70vw' }}
    />
  );

  if (fullScreen) {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center bg-surface-default"
        style={{ zIndex: 9999 }}
      >
        {animation}
      </div>
    );
  }

  const containerClassName = inline
    ? 'inline-flex items-center justify-center'
    : 'flex items-center justify-center py-8';

  return <div className={containerClassName}>{animation}</div>;
};
