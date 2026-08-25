import { jsPDF, GState } from 'jspdf';
import { MapsReview } from '../types';

let cachedLogoBase64: string | null = null;

/**
 * Preload and convert logo URL to Base64 image data URL
 */
export async function getLogoBase64(): Promise<string | null> {
  if (cachedLogoBase64) return cachedLogoBase64;

  try {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Circle gradient background
      const grad = ctx.createLinearGradient(0, 0, 200, 200);
      grad.addColorStop(0, '#2563eb');
      grad.addColorStop(1, '#4f46e5');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(100, 100, 95, 0, Math.PI * 2);
      ctx.fill();

      // Inner border
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Text GM
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 75px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('GM', 100, 100);

      cachedLogoBase64 = canvas.toDataURL('image/png');
      return cachedLogoBase64;
    }
  } catch (err) {
    console.warn('Canvas logo export error:', err);
  }
  return null;
}

/**
 * Format slot/admin code to human readable name
 */
export const getSlotIndicatorName = (slot?: string): string => {
  if (!slot) return 'Admin GM Agency';
  const clean = slot.trim().toLowerCase();
  if (clean === 'adminshp1' || clean === 'adminera') return 'ERA';
  if (clean === 'admin4') return 'ADMIN 4';
  if (clean === 'admin5') return 'ADMIN 5';
  if (clean === 'admin6') return 'ADMIN 6';
  if (clean === 'admin7') return 'ADMIN 7';
  if (clean === 'admin8') return 'ADMIN 8';
  if (clean === 'admin9') return 'ADMIN 9';
  if (clean === 'admin10') return 'ADMIN 10';
  if (clean.startsWith('admin')) return clean.toUpperCase();
  return slot.toUpperCase();
};

/**
 * Generate highly polished, modern 1-page PDF for Google Maps / Reviewers Report
 */
export async function generateMapsReportPDF(item: MapsReview, adminName?: string) {
  try {
    const logoBase64 = await getLogoBase64();

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const dateStr = new Date(item.created_at || Date.now()).toLocaleDateString('id-ID', {
      year: 'numeric', month: 'long', day: 'numeric'
    });

    // Determine admin who worked on it
    const rawAdmin = adminName || item.created_by;
    const adminDisplayName = getSlotIndicatorName(rawAdmin);

    // ==========================================
    // 1. WATERMARK BACKGROUND (Logo + Text, Opacity 0.12)
    // ==========================================
    doc.saveGraphicsState();
    // Set watermark opacity between 10-20% (0.12)
    doc.setGState(new GState({ opacity: 0.12 }));
    if (logoBase64) {
      // Large centered logo watermark (110mm x 110mm)
      doc.addImage(logoBase64, 'PNG', 50, 93.5, 110, 110, undefined, 'FAST');
    }
    // Watermark background text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(28);
    doc.setTextColor(30, 58, 138); // Deep Navy
    doc.text("GM AGENCY OFFICIAL PROOF", 105, 215, { align: 'center' });
    doc.restoreGraphicsState();

    // ==========================================
    // 2. HEADER SECTION (With Logo next to GM AGENCY)
    // ==========================================
    // Top background header bar (Optional subtle accent bar at top)
    doc.setFillColor(37, 99, 235); // Blue 600
    doc.rect(0, 0, 210, 4, 'F');

    // Header Logo (x=15, y=10, size=15x15mm)
    if (logoBase64) {
      doc.addImage(logoBase64, 'PNG', 15, 10, 15, 15, undefined, 'FAST');
    }

    // Header Title Next to Logo (x=33, y=17)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(30, 58, 138); // Blue/Navy
    doc.text("GM AGENCY", 33, 18);

    // Header Subtitle
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(59, 130, 246); // Blue 500
    doc.text("LAMPIRAN BUKTI ULASAN REVIEWER REAL", 33, 23.5);

    // Right Header Info
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139); // Slate 500
    doc.text(`Tanggal Laporan: ${dateStr}`, 195, 20, { align: 'right' });

    // Divider Line
    doc.setDrawColor(226, 232, 240); // Slate 200
    doc.setLineWidth(0.6);
    doc.line(15, 28, 195, 28);

    // ==========================================
    // 3. METADATA CARD BLOCK (Information)
    // ==========================================
    const cardY = 32;
    const cardHeight = 28;

    // Card background & border
    doc.setFillColor(248, 250, 252); // Slate 50
    doc.roundedRect(15, cardY, 180, cardHeight, 3, 3, 'F');
    doc.setDrawColor(226, 232, 240); // Slate 200
    doc.setLineWidth(0.4);
    doc.roundedRect(15, cardY, 180, cardHeight, 3, 3, 'S');

    // Accent bar on left edge of card
    doc.setFillColor(37, 99, 235); // Blue 600
    doc.roundedRect(15, cardY, 3, cardHeight, 1.5, 1.5, 'F');

    // Row 1: Nama Client & Progres Ulasan
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.text("NAMA CLIENT:", 22, cardY + 6.5);
    doc.text("PROGRES ULASAN:", 112, cardY + 6.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42); // Slate 900
    doc.text(item.client_name ? item.client_name.toUpperCase() : '-', 22, cardY + 12);

    const count = item.reviewer_accounts?.length || 0;
    const target = item.target_count || count || 1;
    const pct = Math.min(100, Math.round((count / target) * 100));

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`${count} dari ${target} Target Selesai (${pct}%)`, 112, cardY + 12);

    // Row 2: Link Google Maps Target
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text("LINK TARGET GOOGLE MAPS:", 22, cardY + 18.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(37, 99, 235); // Blue 600
    let mapsLink = item.maps_link || '-';
    if (mapsLink.length > 95) {
      mapsLink = mapsLink.substring(0, 92) + '...';
    }
    doc.text(mapsLink, 22, cardY + 23.5);

    // ==========================================
    // 4. ACCOUNTS GRID TITLE
    // ==========================================
    const titleY = cardY + cardHeight + 8;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59); // Slate 800
    doc.text("DAFTAR AKUN REVIEWER REAL SELESAI:", 15, titleY);

    // Counter badge on top right of table
    doc.setFillColor(219, 234, 254); // Blue 100
    doc.roundedRect(155, titleY - 4.5, 40, 6, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(29, 78, 216); // Blue 700
    doc.text(`TOTAL: ${count} AKUN`, 175, titleY - 0.5, { align: 'center' });

    // ==========================================
    // 5. DRAW ACCOUNTS IN MODERN GRID/TABLE
    // ==========================================
    const accounts = item.reviewer_accounts || [];
    const totalAccounts = accounts.length;

    if (totalAccounts === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184);
      doc.text("Belum ada ulasan akun yang selesai diinput.", 20, titleY + 12);
    } else {
      // Dynamic column calculation to fit cleanly in 1 A4 page
      let numCols = 3;
      let rowHeight = 7.2;
      let fontSize = 8;
      let verticalSpacing = 2;

      if (totalAccounts <= 24) {
        numCols = 2;
        rowHeight = 8.5;
        fontSize = 9;
        verticalSpacing = 2.5;
      } else if (totalAccounts <= 60) {
        numCols = 3;
        rowHeight = 7.2;
        fontSize = 8;
        verticalSpacing = 2;
      } else {
        numCols = 4;
        rowHeight = 6.2;
        fontSize = 7;
        verticalSpacing = 1.2;
      }

      const colWidth = (180 - (numCols - 1) * 3) / numCols;
      const colGap = 3;
      const startX = 15;
      const startY = titleY + 5;

      accounts.forEach((acc, index) => {
        const colIndex = index % numCols;
        const rowIndex = Math.floor(index / numCols);
        const x = startX + colIndex * (colWidth + colGap);
        const y = startY + rowIndex * (rowHeight + verticalSpacing);

        // Card container
        doc.setFillColor(255, 255, 255); // White card
        doc.roundedRect(x, y, colWidth, rowHeight, 1.2, 1.2, 'F');
        doc.setDrawColor(226, 232, 240); // Slate 200
        doc.setLineWidth(0.3);
        doc.roundedRect(x, y, colWidth, rowHeight, 1.2, 1.2, 'S');

        // Number pill badge background
        const badgeWidth = rowHeight - 2;
        doc.setFillColor(239, 246, 255); // Blue 50
        doc.roundedRect(x + 1, y + 1, badgeWidth, rowHeight - 2, 0.8, 0.8, 'F');

        // Number pill text
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(fontSize - 1.5);
        doc.setTextColor(29, 78, 216); // Blue 700
        doc.text(
          (index + 1).toString(),
          x + 1 + badgeWidth / 2,
          y + 1 + (rowHeight - 2) / 2 + (fontSize - 1.5) / 4 + 0.2,
          { align: 'center' }
        );

        // Account name text
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(fontSize);
        doc.setTextColor(51, 65, 85); // Slate 700

        const maxTextWidth = colWidth - (badgeWidth + 3);
        let truncatedAcc = acc;
        if (doc.getTextWidth(acc) > maxTextWidth) {
          while (doc.getTextWidth(truncatedAcc + '...') > maxTextWidth && truncatedAcc.length > 0) {
            truncatedAcc = truncatedAcc.slice(0, -1);
          }
          truncatedAcc += '...';
        }
        doc.text(truncatedAcc, x + badgeWidth + 2.5, y + rowHeight / 2 + fontSize / 4 - 0.2);
      });
    }

    // ==========================================
    // 6. FOOTER SECTION
    // ==========================================
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(15, 280, 195, 280);

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.text("* Laporan ini sah dan diterbitkan secara otomatis oleh sistem GM AGENCY.", 15, 285);
    doc.text("Halaman 1 dari 1 (Lampiran Bukti Resmi)", 195, 285, { align: 'right' });

    // Save PDF
    const cleanClientName = (item.client_name || 'Client').replace(/[^\w\s-]/gi, '').replace(/\s+/g, '_');
    doc.save(`Laporan_GM_Agency_${cleanClientName}.pdf`);
  } catch (err) {
    console.error("Gagal mengekspor PDF:", err);
    throw err;
  }
}
