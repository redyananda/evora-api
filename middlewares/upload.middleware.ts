import multer from "multer";

export const upload = (maxSize: number = 2) => {
  const storage = multer.memoryStorage();

  const limits = {
    fileSize: maxSize * 1024 * 1024, // 2mb default
  };

  return multer({ storage, limits });
};