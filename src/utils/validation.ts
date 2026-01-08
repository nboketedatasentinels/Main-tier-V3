
interface ValidationResult {
  isValid: boolean;
  message?: string;
}

/**
 * Validates a URL string.
 *
 * @param url The URL to validate.
 * @returns A ValidationResult object with a boolean and an optional error message.
 */
export const isValidUrl = (url: string): ValidationResult => {
  if (!url) {
    return { isValid: false, message: 'URL cannot be empty.' };
  }

  // Regex to match common URL patterns, including http, https.
  // It also supports Google Drive, Dropbox, and OneDrive share links.
  const urlPattern = new RegExp(
    '^(https?://)' + // protocol
    '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // domain name
    '((\\d{1,3}\\.){3}\\d{1,3}))' + // OR ip (v4) address
    '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // port and path
    '(\\?[;&a-z\\d%_.~+=-]*)?' + // query string
    '(\\#[-a-z\\d_]*)?$', // fragment locator
    'i'
  );

  const googleDrivePattern = /^https:\/\/drive\.google\.com\/(file\/d\/|open\?id=|document\/d\/|spreadsheets\/d\/|presentation\/d\/)[\w-]+/i;
  const dropboxPattern = /^(https?:\/\/(www\.)?dropbox\.com\/scl\/fi\/)[\w-]+\/[\w-]+\?rlkey=[\w-]+&dl=[0-1]/i;
  const onedrivePattern = /^https:\/\/(1drv\.ms|onedrive\.live\.com)\/(redir|embed|view)\?.+/i;


  if (urlPattern.test(url) || googleDrivePattern.test(url) || dropboxPattern.test(url) || onedrivePattern.test(url)) {
    return { isValid: true };
  }


  // Check for common mistakes to provide better error messages
  if (!/^(https?:\/\/)/i.test(url)) {
      return { isValid: false, message: 'Invalid URL. Make sure it starts with http:// or https://' };
  }

  if (url.includes(' ')) {
      return { isValid: false, message: 'URL cannot contain spaces.' };
  }


  return { isValid: false, message: 'Invalid URL format. Please provide a valid and complete link.' };
};
