import type { FC } from 'react'
import { Image, type ImageProps } from '@chakra-ui/react'

type BrandLogoProps = Omit<ImageProps, 'src' | 'alt'> & {
  /** Light sidebars use the official mark. Dark bars use the plum-safe version. */
  variant?: 'light' | 'dark'
}

export const BrandLogo: FC<BrandLogoProps> = ({ variant = 'light', h = '44px', ...rest }) => (
  <Image
    src={variant === 'dark' ? '/t4l-logo-on-dark.png' : '/t4l-logo-2024.png'}
    alt="Transformation Leader. Positive impact. Sustainable change."
    h={h}
    w="auto"
    maxW="100%"
    objectFit="contain"
    objectPosition="left center"
    {...rest}
  />
)
