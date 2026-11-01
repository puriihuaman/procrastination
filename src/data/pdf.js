import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import workerSource from "pdfjs-dist/legacy/build/pdf.worker.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSource;

export const MAX_PDF_SIZE = 10 * 1024 * 1024;

export async function extractPdfText(file) {
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items.map((item) => item.str).join(" ").replace(/\s+/g, " ").trim();
    pages.push({ page: pageNumber, text });
  }
  const text = pages.map((page) => page.text).filter(Boolean).join("\n\n");
  return { pageCount: pdf.numPages, pages, text, hasText: Boolean(text) };
}
