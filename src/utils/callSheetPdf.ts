import jsPDF from 'jspdf';
import type {
  CallSheet, ProductionPerson, ProductionLocation, CrewCallEntry,
} from '../types/screenplay';
import { generateMapsLink, type WeatherData } from './weather';

// PDF constants (in points, 72 points = 1 inch)
const PW = 612; // Page width (8.5")
const PH = 792; // Page height (11")
const ML = 36;  // Left margin
const MR = 36;  // Right margin
const MT = 36;  // Top margin
const MB = 36;  // Bottom margin
const CW = PW - ML - MR; // Content width

// Colors
const BLACK = '#1a1a1a';
const DARK = '#2C3E50';
const GRAY = '#555555';
const LIGHT_GRAY = '#999999';
const BG_GRAY = '#f0f0f0';
const BORDER = '#cccccc';
const LINK_BLUE = '#2563EB';

interface CallSheetPdfData {
  callSheet: CallSheet;
  people: ProductionPerson[];
  locations: ProductionLocation[];
  weather?: WeatherData | null;
  disclaimer: string;
}

function fillRect(doc: jsPDF, x: number, y: number, w: number, h: number, color: string) {
  doc.setFillColor(color);
  doc.rect(x, y, w, h, 'F');
}

function strokeRect(doc: jsPDF, x: number, y: number, w: number, h: number, color = BORDER) {
  doc.setDrawColor(color);
  doc.setLineWidth(0.5);
  doc.rect(x, y, w, h, 'S');
}

function hLine(doc: jsPDF, x: number, y: number, w: number, color = BORDER, width = 0.5) {
  doc.setDrawColor(color);
  doc.setLineWidth(width);
  doc.line(x, y, x + w, y);
}

function setFont(doc: jsPDF, size: number, style: 'normal' | 'bold' = 'normal', color = BLACK) {
  doc.setFontSize(size);
  doc.setFont('helvetica', style);
  doc.setTextColor(color);
}

function checkPage(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > PH - MB) {
    doc.addPage();
    return MT;
  }
  return y;
}

export function generateCallSheetPDF(data: CallSheetPdfData): jsPDF {
  const { callSheet: cs, people, locations, weather, disclaimer } = data;
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });

  const getPerson = (id: string) => people.find(p => p.id === id);
  const getLoc = (id: string) => locations.find(l => l.id === id);

  let y = MT;

  // ============================================================
  // ROW 1: Title | Crew Call | Date
  // ============================================================
  setFont(doc, 18, 'bold');
  const titleLines = doc.splitTextToSize(cs.title || 'Untitled', 220);
  doc.text(titleLines, ML, y + 16);

  setFont(doc, 8, 'normal', GRAY);
  doc.text('Crew Call', PW / 2, y + 8, { align: 'center' });
  setFont(doc, 28, 'bold');
  doc.text(cs.crewCall, PW / 2, y + 34, { align: 'center' });

  const dateStr = cs.date
    ? new Date(cs.date + 'T12:00:00').toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      })
    : 'Date TBD';
  setFont(doc, 11, 'bold');
  doc.text(dateStr, PW - MR, y + 14, { align: 'right' });
  setFont(doc, 18, 'bold');
  doc.text(`Day ${cs.dayNumber} of ${cs.totalDays}`, PW - MR, y + 34, { align: 'right' });

  y += 50;
  hLine(doc, ML, y, CW, BLACK, 1.5);
  y += 4;

  // ============================================================
  // ROW 2: Producer | Hospital | Locations | Times + Weather
  // ============================================================
  const row2Top = y;
  const col1W = 90;
  const col4W = 155;
  const midSpace = CW - col1W - col4W;
  const col2W = midSpace * 0.45;
  const col3W = midSpace * 0.55;
  const col2X = ML + col1W;
  const col3X = col2X + col2W;
  const col4X = col3X + col3W;

  // Col 1: Producer / Director
  setFont(doc, 8, 'bold');
  doc.text('Producer', ML + 4, row2Top + 12);
  setFont(doc, 8, 'normal');
  doc.text(cs.producer || '--', ML + 4, row2Top + 24);
  if (cs.director) {
    setFont(doc, 8, 'bold');
    doc.text('Director', ML + 4, row2Top + 40);
    setFont(doc, 8, 'normal');
    doc.text(cs.director, ML + 4, row2Top + 52);
  }

  // Col 2: Nearest Hospital
  setFont(doc, 9, 'bold');
  doc.text('Nearest Hospital', col2X + col2W / 2, row2Top + 12, { align: 'center' });
  hLine(doc, col2X + 8, row2Top + 15, col2W - 16, LIGHT_GRAY, 0.3);
  if (cs.nearestHospital) {
    setFont(doc, 8, 'normal');
    const hospLines = doc.splitTextToSize(cs.nearestHospital, col2W - 16);
    doc.text(hospLines, col2X + col2W / 2, row2Top + 28, { align: 'center' });
  } else {
    setFont(doc, 8, 'normal', LIGHT_GRAY);
    doc.text('Not set', col2X + col2W / 2, row2Top + 28, { align: 'center' });
  }

  // Col 3: Locations
  let locY = row2Top + 4;
  cs.locationIds.forEach(lid => {
    const loc = getLoc(lid);
    if (!loc) return;
    setFont(doc, 9, 'bold');
    doc.text(loc.name, col3X + col3W / 2, locY + 10, { align: 'center' });
    const addrParts = [loc.streetAddress, [loc.city, loc.state, loc.postalCode].filter(Boolean).join(', ')].filter(Boolean);
    if (addrParts.length > 0) {
      setFont(doc, 8, 'normal', LINK_BLUE);
      addrParts.forEach((part, i) => {
        doc.text(part, col3X + col3W / 2, locY + 22 + (i * 10), { align: 'center' });
      });
      const mapsUrl = generateMapsLink(loc);
      if (mapsUrl) {
        doc.link(col3X + 4, locY + 12, col3W - 8, addrParts.length * 10 + 8, { url: mapsUrl });
      }
    }
    if (loc.phone) {
      setFont(doc, 7, 'normal', GRAY);
      doc.text(loc.phone, col3X + col3W / 2, locY + 22 + (addrParts.length * 10), { align: 'center' });
    }
    locY += 22 + (addrParts.length * 10) + 12;
  });

  // Col 4: Times + Weather
  setFont(doc, 9, 'normal');
  doc.text('Crew Call: ' + cs.crewCall, col4X + 4, row2Top + 12);
  doc.text('Shooting Call: ' + cs.shootingCall, col4X + 4, row2Top + 24);
  doc.text('First Meal: ' + cs.firstMeal, col4X + 4, row2Top + 36);
  setFont(doc, 9, 'bold');
  doc.text('Est. Wrap: ' + cs.estimatedWrap, col4X + 4, row2Top + 48);

  if (weather) {
    const wxY = row2Top + 58;
    fillRect(doc, col4X + 4, wxY, col4W - 8, 50, '#f8f9fa');
    strokeRect(doc, col4X + 4, wxY, col4W - 8, 50, '#e5e7eb');
    const wxCx = col4X + col4W / 2;

    setFont(doc, 14, 'bold');
    doc.text(weather.tempLow + 'F', wxCx - 28, wxY + 14, { align: 'center' });
    doc.text(weather.tempHigh + 'F', wxCx + 28, wxY + 14, { align: 'center' });
    setFont(doc, 6, 'normal', LIGHT_GRAY);
    doc.text('low', wxCx - 28, wxY + 22, { align: 'center' });
    doc.text('high', wxCx + 28, wxY + 22, { align: 'center' });

    setFont(doc, 7, 'normal', GRAY);
    const wxDesc = weather.description + '. Wind ' + weather.windSpeed + 'mph.' +
      (weather.precipChance > 0 ? ' ' + weather.precipChance + '% precip.' : '');
    const wxLines = doc.splitTextToSize(wxDesc, col4W - 20);
    doc.text(wxLines, wxCx, wxY + 32, { align: 'center' });

    setFont(doc, 7, 'bold', BLACK);
    doc.text('Sunrise: ' + weather.sunrise, col4X + 10, wxY + 46);
    doc.text('Sunset: ' + weather.sunset, col4X + col4W - 10, wxY + 46, { align: 'right' });
  }

  const row2H = weather ? 116 : Math.max(70, locY - row2Top);
  [col2X, col3X, col4X].forEach(x => {
    doc.setDrawColor(BORDER);
    doc.setLineWidth(0.3);
    doc.line(x, row2Top, x, row2Top + row2H);
  });
  strokeRect(doc, ML, row2Top, CW, row2H, BORDER);

  y = row2Top + row2H + 1;

  // ============================================================
  // DISCLAIMER BANNER
  // ============================================================
  if (disclaimer) {
    fillRect(doc, ML, y, CW, 20, BG_GRAY);
    hLine(doc, ML, y, CW, BORDER, 0.3);
    hLine(doc, ML, y + 20, CW, BORDER, 0.3);
    setFont(doc, 7, 'bold', '#333333');
    const disclaimerLines = doc.splitTextToSize(disclaimer, CW - 20);
    doc.text(disclaimerLines, PW / 2, y + (disclaimerLines.length > 1 ? 8 : 13), { align: 'center' });
    y += 22;
  }

  // ============================================================
  // TODAY'S SCHEDULE
  // ============================================================
  if (cs.scenes.length > 0) {
    y = checkPage(doc, y, 60);
    y += 4;
    setFont(doc, 12, 'bold');
    doc.text("Today's Schedule", ML + 8, y + 12);
    y += 18;

    const sCols = [55, 0, 70, 150];
    sCols[1] = CW - sCols[0] - sCols[2] - sCols[3];

    fillRect(doc, ML, y, CW, 15, DARK);
    setFont(doc, 8, 'bold', '#ffffff');
    doc.text('SCENE', ML + sCols[0] / 2, y + 11, { align: 'center' });
    doc.text('SET / DESCRIPTION', ML + sCols[0] + 6, y + 11);
    doc.text('CAST', ML + sCols[0] + sCols[1] + 6, y + 11);
    doc.text('LOCATION', ML + sCols[0] + sCols[1] + sCols[2] + 6, y + 11);
    y += 15;

    cs.scenes.forEach(scene => {
      const loc = scene.locationId ? getLoc(scene.locationId) : undefined;
      const locAddr = loc
        ? [loc.streetAddress, [loc.city, loc.state, loc.postalCode].filter(Boolean).join(', ')].filter(Boolean)
        : [];
      const rowH = Math.max(26, 14 + locAddr.length * 10);

      y = checkPage(doc, y, rowH);

      fillRect(doc, ML, y, sCols[0], rowH, BG_GRAY);
      setFont(doc, 13, 'bold');
      doc.text(scene.sceneNumber, ML + sCols[0] / 2, y + rowH / 2 + 4, { align: 'center' });

      setFont(doc, 9, 'bold', BLACK);
      doc.text(scene.setDescription, ML + sCols[0] + 6, y + 14);
      if (scene.notes) {
        setFont(doc, 7, 'normal', GRAY);
        doc.text(scene.notes, ML + sCols[0] + 8, y + 24);
      }

      setFont(doc, 9, 'normal', BLACK);
      doc.text(scene.cast || '', ML + sCols[0] + sCols[1] + 6, y + 14);

      const locX = ML + sCols[0] + sCols[1] + sCols[2] + 6;
      if (loc) {
        setFont(doc, 8, 'bold', BLACK);
        doc.text(loc.name, locX, y + 12);
        setFont(doc, 7, 'normal', LINK_BLUE);
        locAddr.forEach((line, i) => {
          doc.text(line, locX, y + 22 + (i * 10));
        });
        const mapsUrl = generateMapsLink(loc);
        if (mapsUrl) {
          doc.link(locX - 2, y + 13, sCols[3] - 8, locAddr.length * 10 + 6, { url: mapsUrl });
        }
      }

      hLine(doc, ML, y + rowH, CW, '#e5e7eb', 0.3);
      y += rowH;
    });
  }

  y += 6;

  // ============================================================
  // TALENT
  // ============================================================
  if (cs.talentCalls.length > 0) {
    y = checkPage(doc, y, 60);
    setFont(doc, 12, 'bold');
    doc.text('Talent', ML + 8, y + 12);
    y += 18;

    const tCols = [36, 0, 110, 60, 150];
    tCols[1] = CW - tCols[0] - tCols[2] - tCols[3] - tCols[4];

    fillRect(doc, ML, y, CW, 15, DARK);
    setFont(doc, 8, 'bold', '#ffffff');
    doc.text('ID', ML + 6, y + 11);
    doc.text('TALENT', ML + tCols[0] + 6, y + 11);
    doc.text('ROLE', ML + tCols[0] + tCols[1] + 6, y + 11);
    doc.text('CALL', ML + tCols[0] + tCols[1] + tCols[2] + 6, y + 11);
    doc.text('CONTACT', ML + tCols[0] + tCols[1] + tCols[2] + tCols[3] + 6, y + 11);
    y += 15;

    cs.talentCalls.forEach(tc => {
      const p = getPerson(tc.personId);
      if (!p) return;

      const rowH = (p.phone && p.email) ? 30 : 20;
      y = checkPage(doc, y, rowH);

      const talentRole = p.roles.find(r => r.group === 'Talent');

      setFont(doc, 9, 'bold');
      const castId = p.castNumber ? String(p.castNumber) : p.firstName[0] + (p.lastName?.[0] || '');
      doc.text(castId, ML + 6, y + 13);

      setFont(doc, 9, 'normal');
      doc.text(p.firstName + ' ' + p.lastName, ML + tCols[0] + 6, y + 13);
      doc.text(talentRole?.characterName || talentRole?.position || 'Talent', ML + tCols[0] + tCols[1] + 6, y + 13);
      doc.text(tc.callTime, ML + tCols[0] + tCols[1] + tCols[2] + 6, y + 13);

      const contactX = ML + tCols[0] + tCols[1] + tCols[2] + tCols[3] + 6;
      setFont(doc, 8, 'normal');
      if (p.phone) doc.text(p.phone, contactX, y + 11);
      if (p.email) {
        setFont(doc, 7, 'normal', LINK_BLUE);
        doc.text(p.email, contactX, y + (p.phone ? 22 : 11));
      }

      hLine(doc, ML, y + rowH, CW, '#e5e7eb', 0.3);
      y += rowH;
    });
  }

  y += 6;

  // ============================================================
  // CREW BY DEPARTMENT (2-column grid)
  // ============================================================
  const crewByDept: Record<string, CrewCallEntry[]> = {};
  cs.crewCalls.forEach(cc => {
    const dept = cc.department || 'Other';
    if (!crewByDept[dept]) crewByDept[dept] = [];
    crewByDept[dept].push(cc);
  });

  const deptEntries = Object.entries(crewByDept);
  if (deptEntries.length > 0) {
    y = checkPage(doc, y, 40);

    const halfW = CW / 2;
    let colIdx = 0;
    let leftY = y;
    let rightY = y;

    deptEntries.forEach(([dept, calls]) => {
      const blockH = 16 + (calls.length * 16) + 2;
      const isLeft = colIdx % 2 === 0;
      const startX = isLeft ? ML : ML + halfW;
      let startY = isLeft ? leftY : rightY;

      startY = checkPage(doc, startY, blockH);
      if (startY === MT) {
        leftY = MT;
        rightY = MT;
        startY = MT;
      }

      // Department header
      fillRect(doc, startX, startY, halfW, 15, DARK);
      setFont(doc, 9, 'bold', '#ffffff');
      doc.text(dept.toUpperCase(), startX + 6, startY + 11);

      // CALL label right-aligned in header
      setFont(doc, 7, 'normal', '#bbbbbb');
      doc.text('CALL', startX + halfW - 6, startY + 11, { align: 'right' });

      let rowY = startY + 15;
      // Column layout: position | name | phone | call time
      const posW = 70;
      const callW = 46;
      const phoneW = 66;
      const nameW = halfW - posW - phoneW - callW - 8;

      calls.forEach(cc => {
        const p = getPerson(cc.personId);

        setFont(doc, 8, 'bold', BLACK);
        const posText = doc.splitTextToSize(cc.position, posW - 4);
        doc.text(posText[0], startX + 6, rowY + 11);

        setFont(doc, 8, 'normal');
        const fullName = p ? (p.firstName + ' ' + p.lastName) : '';
        const nameText = doc.splitTextToSize(fullName, nameW - 4);
        doc.text(nameText[0], startX + posW + 4, rowY + 11);

        if (p?.phone) {
          setFont(doc, 7, 'normal', GRAY);
          doc.text(p.phone, startX + posW + nameW + 4, rowY + 11);
        }

        setFont(doc, 8, 'normal', BLACK);
        doc.text(cc.callTime, startX + halfW - 4, rowY + 11, { align: 'right' });

        doc.setDrawColor('#e0e0e0');
        doc.setLineWidth(0.3);
        doc.setLineDashPattern([1, 1], 0);
        doc.line(startX + 4, rowY + 16, startX + halfW - 4, rowY + 16);
        doc.setLineDashPattern([], 0);

        rowY += 16;
      });

      const blockEnd = rowY + 2;
      strokeRect(doc, startX, startY, halfW, blockEnd - startY, BORDER);

      if (isLeft) {
        leftY = blockEnd;
      } else {
        rightY = blockEnd;
      }
      colIdx++;
    });

    y = Math.max(leftY, rightY) + 6;
  }

  // ============================================================
  // NOTES
  // ============================================================
  if (cs.notes) {
    y = checkPage(doc, y, 30);
    hLine(doc, ML, y, CW, BORDER, 0.3);
    y += 8;
    setFont(doc, 9, 'bold');
    doc.text('Additional Notes:', ML + 6, y + 10);
    setFont(doc, 8, 'normal', GRAY);
    const noteLines = doc.splitTextToSize(cs.notes, CW - 16);
    doc.text(noteLines, ML + 6, y + 22);
  }

  return doc;
}
