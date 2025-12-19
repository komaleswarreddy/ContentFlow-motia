/**
 * Export utilities for content data
 */

export interface ExportableContent {
  id: string;
  contentId: string;
  title: string;
  author: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Export content to JSON
 */
export function exportToJSON(data: ExportableContent[], filename: string = 'content-export') {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export content to CSV
 */
export function exportToCSV(data: ExportableContent[], filename: string = 'content-export') {
  if (data.length === 0) return;

  // CSV headers
  const headers = ['ID', 'Content ID', 'Title', 'Author', 'Status', 'Created At', 'Updated At'];
  
  // Convert data to CSV rows
  const rows = data.map(item => [
    item.id || '',
    item.contentId || '',
    `"${(item.title || '').replace(/"/g, '""')}"`, // Escape quotes in CSV
    `"${(item.author || '').replace(/"/g, '""')}"`,
    item.status || '',
    item.createdAt || '',
    item.updatedAt || ''
  ]);

  // Combine headers and rows
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export content to PDF using jsPDF
 * Note: This requires jsPDF to be installed
 */
export async function exportToPDF(data: ExportableContent[], filename: string = 'content-export') {
  try {
    // Dynamic import to avoid SSR issues
    const { default: jsPDF } = await import('jspdf');
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const startY = 20;
    let yPos = startY;
    const lineHeight = 7;
    const maxWidth = pageWidth - 2 * margin;

    // Title
    doc.setFontSize(16);
    doc.text('Content Export', margin, yPos);
    yPos += lineHeight * 2;

    // Date
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, yPos);
    yPos += lineHeight * 2;

    // Table headers
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    const headers = ['Title', 'Author', 'Status', 'Created'];
    const colWidths = [maxWidth * 0.4, maxWidth * 0.25, maxWidth * 0.2, maxWidth * 0.15];
    let xPos = margin;

    headers.forEach((header, index) => {
      doc.text(header, xPos, yPos);
      xPos += colWidths[index];
    });
    yPos += lineHeight;

    // Draw line under headers
    doc.setLineWidth(0.5);
    doc.line(margin, yPos - 2, pageWidth - margin, yPos - 2);
    yPos += lineHeight * 0.5;

    // Table rows
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);

    data.forEach((item, index) => {
      // Check if we need a new page
      if (yPos > pageHeight - margin - lineHeight * 3) {
        doc.addPage();
        yPos = startY;
      }

      xPos = margin;
      const rowData = [
        item.title || 'N/A',
        item.author || 'N/A',
        item.status || 'N/A',
        new Date(item.createdAt).toLocaleDateString() || 'N/A'
      ];

      rowData.forEach((cell, cellIndex) => {
        // Truncate text if too long
        const cellText = doc.splitTextToSize(cell, colWidths[cellIndex] - 2);
        doc.text(cellText, xPos, yPos);
        xPos += colWidths[cellIndex];
      });

      yPos += lineHeight * 1.5;

      // Add subtle line between rows
      if (index < data.length - 1) {
        doc.setLineWidth(0.1);
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, yPos - lineHeight * 0.5, pageWidth - margin, yPos - lineHeight * 0.5);
      }
    });

    // Footer with total count
    yPos += lineHeight;
    doc.setFontSize(8);
    doc.setFont(undefined, 'italic');
    doc.text(`Total items: ${data.length}`, margin, yPos);

    // Save PDF
    doc.save(`${filename}-${new Date().toISOString().split('T')[0]}.pdf`);
  } catch (error) {
    console.error('Error generating PDF:', error);
    // Fallback: if jsPDF is not available, show error
    alert('PDF export requires jsPDF library. Please install it: npm install jspdf');
  }
}

