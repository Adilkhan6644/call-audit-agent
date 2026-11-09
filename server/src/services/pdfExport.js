const PDFDocument = require('pdfkit');

/** Builds a tabular PDF of audit jobs, resolving to a Buffer. */
function buildAuditJobsPdf(jobs) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(16).text('Audit Jobs', { underline: true });
    doc.moveDown();

    jobs.forEach((job) => {
      doc
        .fontSize(10)
        .text(`Job: ${job._id}`)
        .text(`Status: ${job.status}`)
        .text(`Score: ${job.result ? job.result.score : '-'}`)
        .text(`Summary: ${job.result ? job.result.summary : '-'}`)
        .text(`Created: ${job.createdAt ? job.createdAt.toISOString() : '-'}`)
        .moveDown();
    });

    doc.end();
  });
}

module.exports = { buildAuditJobsPdf };
