export function validateSyllabusFile(file: File): string | null {
  if (file.type !== 'application/pdf') {
    return 'Only PDF files are allowed.';
  }

  if (file.size > 10 * 1024 * 1024) {
    return 'File must be under 10MB.';
  }

  return null;
}