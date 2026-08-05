// Pure rendering — turns a selection (from resume-select.mjs) into a docx
// Document. No scoring, no I/O, no page counting. Bullets are rendered as a
// literal "•  " prefix run rather than the docx package's numbering API — a
// deliberate simplification (identical visual result in a single-level list,
// avoids wiring a numbering config) — see spec-resume-variants.md.

import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";

export const RESEARCH_STATUS_LABEL = {
  under_submission: "Under submission",
  in_preparation: "In preparation",
  published: "Published",
};

// certification/course kinds: terse "Name" or "Name (In progress, expected Mon YYYY)".
export function certStatusText(cert) {
  if (cert.status === "held") return cert.name;
  if (cert.expected) {
    const [y, m] = cert.expected.split("-");
    const monthName = new Date(Number(y), Number(m) - 1, 1).toLocaleString("en-US", { month: "short" });
    return `${cert.name} (In progress, expected ${monthName} ${y})`;
  }
  // Should be unreachable — resume-lint.mjs's lintCertifications gates this.
  throw new Error(`certification "${cert.name}" has status="${cert.status}" and no expected date`);
}

function runsToTextRuns(text_runs, extraOpts = {}) {
  return text_runs.map((r) => new TextRun({ text: r.text, bold: r.bold, ...extraOpts }));
}

function heading(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 80 },
    border: { bottom: { color: "888888", space: 2, style: "single", size: 4 } },
    children: [new TextRun({ text, bold: true, size: 22 })],
  });
}

function bulletParagraph(text_runs) {
  return new Paragraph({
    spacing: { after: 60 },
    indent: { left: 240, hanging: 240 },
    children: [new TextRun({ text: "•  " }), ...runsToTextRuns(text_runs)],
  });
}

function plainParagraph(text_runs, opts = {}) {
  return new Paragraph({ spacing: { after: 60 }, children: runsToTextRuns(text_runs), ...opts });
}

export function buildDocument(selection) {
  const {
    header, // [name, tagline, contact] entries
    summary,
    experience, // flat list of header/bullet entries, in source order
    research, // included research entries (already page-fit)
    projects, // included project entries, in render order
    collapsedLine, // string | null — the fully-built "More on GitHub: ..." line
    skills,
    education,
    certifications, // { certification: [], course: [], self_paced: [] }
  } = selection;

  const children = [];

  const [name, tagline, contact] = header;
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [new TextRun({ text: name.text_runs[0].text, bold: true, size: 32 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [new TextRun({ text: tagline.text_runs[0].text, size: 20 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 160 },
      children: [new TextRun({ text: contact.text_runs[0].text, size: 18 })],
    }),
  );

  if (summary) {
    children.push(heading("PROFESSIONAL SUMMARY"), plainParagraph(summary.text_runs));
  }

  children.push(heading("PROFESSIONAL EXPERIENCE"));
  for (const e of experience) {
    if (e.kind === "header") {
      children.push(
        new Paragraph({ spacing: { before: 100, after: 20 }, children: [new TextRun({ text: e.company, bold: true, italics: true, size: 19 })] }),
        plainParagraph(e.text_runs, { spacing: { after: 40 } }),
      );
    } else {
      children.push(bulletParagraph(e.text_runs));
    }
  }

  if (research.length > 0) {
    children.push(heading("Research (ongoing)"));
    for (const e of research) {
      const label = RESEARCH_STATUS_LABEL[e.research_status];
      if (!label) throw new Error(`research entry "${e.id}" has an unrecognized research_status`);
      children.push(
        bulletParagraph(e.text_runs),
        new Paragraph({ spacing: { after: 80 }, indent: { left: 240 }, children: [new TextRun({ text: `Status: ${label}`, italics: true, size: 18 })] }),
      );
    }
  }

  if (projects.length > 0 || collapsedLine) {
    children.push(heading("Applied AI Projects"));
    for (const e of projects) {
      children.push(bulletParagraph(e.text_runs));
    }
    if (collapsedLine) {
      children.push(plainParagraph([{ text: collapsedLine, bold: false }]));
    }
  }

  children.push(heading("KEY TECHNICAL SKILLS"));
  for (const e of skills) children.push(bulletParagraph(e.text_runs));

  children.push(heading("EDUCATION"));
  for (const e of education) children.push(plainParagraph(e.text_runs));

  if (certifications.length > 0) {
    children.push(heading("Certifications & Continuing Education"));
    const formal = certifications.filter((c) => c.kind !== "self_paced");
    const selfPaced = certifications.filter((c) => c.kind === "self_paced");
    if (formal.length > 0) {
      children.push(plainParagraph([{ text: formal.map(certStatusText).join(" · "), bold: false }]));
    }
    for (const c of selfPaced) {
      // Never certificate language — name + a short description of what was
      // built, no "held"/"in progress" framing at all (amendment 2, item 4).
      children.push(
        bulletParagraph([
          { text: `${c.name}: `, bold: true },
          { text: c.description || "", bold: false },
        ]),
      );
    }
  }

  return new Document({
    sections: [{ properties: { page: { margin: { top: 560, bottom: 560, left: 700, right: 700 } } }, children }],
  });
}

// Flat rendered text, used by the keyword-coverage report and by lint checks
// that need to see what a human reader would actually see.
export function extractRenderedText(selection) {
  const parts = [];
  const collect = (entries) => entries.forEach((e) => parts.push(e.text_runs.map((r) => r.text).join(" ")));
  collect(selection.header);
  if (selection.summary) collect([selection.summary]);
  collect(selection.experience);
  collect(selection.research);
  collect(selection.projects);
  if (selection.collapsedLine) parts.push(selection.collapsedLine);
  collect(selection.skills);
  collect(selection.education);
  const formal = selection.certifications.filter((c) => c.kind !== "self_paced");
  const selfPaced = selection.certifications.filter((c) => c.kind === "self_paced");
  parts.push(formal.map(certStatusText).join(" "));
  parts.push(selfPaced.map((c) => `${c.name}: ${c.description || ""}`).join(" "));
  return parts.join("\n");
}
