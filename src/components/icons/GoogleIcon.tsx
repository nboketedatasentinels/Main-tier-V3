import React from 'react'

interface GoogleIconProps {
  className?: string
}

export const GoogleIcon: React.FC<GoogleIconProps> = ({ className }) => (
  <svg
    className={className}
    width="20"
    height="20"
    viewBox="0 0 533.5 544.3"
    aria-hidden="true"
    focusable="false"
  >
    <path
      fill="#4285F4"
      d="M533.5 278.4c0-18.5-1.5-37-4.7-55.1H272v104.4h147.2c-6.3 34-25 62.7-53.2 81.9v68h86.1c50.4-46.4 79.4-114.7 79.4-199.2z"
    />
    <path
      fill="#34A853"
      d="M272 544.3c72.6 0 133.5-24.1 178-65.7l-86.1-68c-23.9 16.3-54.4 25.9-91.9 25.9-70.6 0-130.5-47.6-152-111.2H31.5v69.9C75.7 486.5 167.6 544.3 272 544.3z"
    />
    <path
      fill="#FBBC05"
      d="M120 325.2c-10.2-30-10.2-62.6 0-92.6v-69.9H31.5c-36.3 72.6-36.3 159.8 0 232.4l88.5-69.9z"
    />
    <path
      fill="#EA4335"
      d="M272 107.7c39.5-.6 77.4 14.7 106.3 42.7l79.3-79.3C409.3 24.3 344.2-1.5 272 0 167.6 0 75.7 57.8 31.5 162.7l88.5 69.9C141.5 155.3 201.4 107.7 272 107.7z"
    />
  </svg>
)
