// constants/upload.ts
export const UPLOAD_LIMITS = {
  free: {
    maxFileSize: 15 * 1024 * 1024,      // 15MB
    maxFilesPerMessage: 5,
    allowedTypes: [
      // Documents
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "text/plain", "text/csv",
      // Images (vẫn nên cho phép)
      "image/jpeg", "image/png", "image/gif", "image/webp",
      // Archive
      "application/zip",
    ],
  },
} as const;

export const FILE_SIZE_ERROR = (max: number) =>
  `File vượt quá ${max / 1024 / 1024}MB.`;