import path from "path";

export function getContentType(filePath: string): string {
	const ext = path.extname(filePath).toLowerCase();
	switch (ext) {
		case ".pdf":
			return "application/pdf";
		case ".doc":
		case ".docx":
			return "application/msword";
		case ".jpg":
		case ".jpeg":
			return "image/jpeg";
		case ".png":
			return "image/png";
		default:
			return "application/octet-stream";
	}
}