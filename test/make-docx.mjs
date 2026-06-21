import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
} from "docx";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const cell = (text, opts = {}) =>
  new TableCell({
    width: { size: 33, type: WidthType.PERCENTAGE },
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: opts.bold, color: opts.color })],
      }),
    ],
  });

const doc = new Document({
  sections: [
    {
      children: [
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: "Quarterly Study Report", color: "1F3864" }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: "Generated for fidelity testing",
              italics: true,
              color: "808080",
            }),
          ],
        }),
        new Paragraph({ text: "" }),
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: "1. Introduction" })],
        }),
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          children: [
            new TextRun("This paragraph mixes "),
            new TextRun({ text: "bold", bold: true }),
            new TextRun(", "),
            new TextRun({ text: "italic", italics: true }),
            new TextRun(", "),
            new TextRun({ text: "underlined", underline: {} }),
            new TextRun(", and "),
            new TextRun({ text: "colored red", color: "C00000" }),
            new TextRun(
              " runs to confirm inline formatting is preserved exactly as authored in Microsoft Word."
            ),
          ],
        }),
        new Paragraph({ text: "" }),
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun("2. Bullet list")],
        }),
        new Paragraph({ text: "First key finding", bullet: { level: 0 } }),
        new Paragraph({ text: "Second key finding", bullet: { level: 0 } }),
        new Paragraph({ text: "A nested detail", bullet: { level: 1 } }),
        new Paragraph({ text: "" }),
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun("3. Results table")],
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                cell("Subject", { bold: true, color: "FFFFFF" }),
                cell("Score", { bold: true, color: "FFFFFF" }),
                cell("Grade", { bold: true, color: "FFFFFF" }),
              ],
            }),
            new TableRow({
              children: [cell("Mathematics"), cell("92"), cell("A")],
            }),
            new TableRow({
              children: [cell("Physics"), cell("88"), cell("A-")],
            }),
            new TableRow({
              children: [cell("Chemistry"), cell("79"), cell("B+")],
            }),
          ],
        }),
        new Paragraph({ text: "" }),
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [
            new TextRun({
              text: "Right-aligned signature line",
              italics: true,
            }),
          ],
        }),
      ],
    },
  ],
});

const buf = await Packer.toBuffer(doc);
const out = fileURLToPath(new URL("./sample.docx", import.meta.url));
writeFileSync(out, buf);
console.log("wrote", out, buf.length, "bytes");
