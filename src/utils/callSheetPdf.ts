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

// Helper: draw a filled rect
function fillRect(doc: jsPDF, x: number, y: number, w: number, h: number, color: string) {
  doc.setFillColor(color);
  doc.rect(x, y, w, h, 'F');
}

// Helper: draw a stroked rect
function strokeRect(doc: jsPDF, x: number, y: number, w: number, h: number, color = BORDER) {
  doc.setDrawColor(color);
  doc.setLineWidth(0.5);
  doc.rect(x, y, w, h, 'S');
}

// Helper: draw a horizontal line
function hLine(doc: jsPDF, x: number, y: number, w: number, color = BORDER, width = 0.5) {
  doc.setDrawColor(color);
  doc.setLineWidth(width);
  doc.line(x, y, x + w, y);
}

// Helper: set font
function setFont(doc: jsPDF, size: number, style: 'normal' | 'bold' = 'normal', color = BLACK) {
  doc.setFontSize(size);
  doc.setFont('helvetica', style);
  doc.setTextColor(color);
}

// Helper: check if we need a new page
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

  // Helpers to look up data
  const getPerson = (id: string) => people.find(p => p.id === id);
  const getLoc = (id: string) => locations.find(l => l.id === id);

  let y = MT;

  // ============================================================
  // ROW 1: Title | Crew Call | Date
  // ============================================================
  const row1Top = y;
  const row1H = 60;

  // Title (left)
  setFont(doc, 16, 'bold');
  const titleLines = doc.splitTextToSize(cs.title || 'Untitled', 220);
  doc.text(titleLines, ML, row1Top + 14);

  // Crew Call (center)
  const ccX = PW / 2;
  setFont(doc, 8, 'normal', GRAY);
  doc.text('Crew Call', ccX, row1Top + 10, { align: 'center' });
  setFont(doc, 26, 'bold');
  doc.text(cs.crewCall, ccX, row1Top + 34, { align: 'center' });

  // Date + Day (right)
  const dateStr = cs.date
    ? new Date(cs.date + 'T12:00:00').toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      })
    : 'Date TBD';
  setFont(doc, 10, 'bold');
  doc.text(dateStr, PW - MR, row1Top + 14, { align: 'right' });
  setFont(doc, 16, 'bold');
  doc.text(`Day ${cs.dayNumber} of ${cs.totalDays}`, PW - MR, row1Top + 32, { align: 'right' });

  y = row1Top + row1H;
  hLine(doc, ML, y, CW, BLACK, 1.5);
  y += 4;

  // ============================================================
  // ROW 2: Producer | Hospital | Locations | Times + Weather
  // ============================================================
  const row2Top = y;
  const col1W = 100;
  const col4W = 170;
  const col23W = (CW - col1W - col4W) / 2;
  const col2X = ML + col1W;
  const col3X = col2X + col23W;
  const col4X = col3X + col23W;

  // Column 1: Producer / Director
  setFont(doc, 7, 'bold');
  doc.text('Producer', ML + 4, row2Top + 10);
  setFont(doc, 7, 'normal');
  doc.text(cs.producer || '—', ML + 4, row2Top + 20);
  if (cs.director) {
    setFont(doc, 7, 'bold');
    doc.text('Director', ML + 4, row2Top + 34);
    setFont(doc, 7, 'normal');
    doc.text(cs.director, ML + 4, row2Top + 44);
  }

  // Column 2: Nearest Hospital
  setFont(doc, 8, 'bold');
  doc.text('Nearest Hospital', col2X + col23W / 2, row2Top + 10, { align: 'center' });
  hLine(doc, col2X + 10, row2Top + 13, col23W - 20, LIGHT_GRAY, 0.3);
  if (cs.nearestHospital) {
    setFont(doc, 7, 'normal');
    const hospLines = doc.splitTextToSize(cs.nearestHospital, col23W - 16);
    doc.text(hospLines, col2X + col23W / 2, row2Top + 24, { align: 'center' });
  }

  // Column 3: Locations
  let locY = row2Top + 6;
  cs.locationIds.forEach(lid => {
    const loc = getLoc(lid);
    if (!loc) return;
    setFont(doc, 8, 'bold');
    doc.text(loc.name, col3X + col23W / 2, locY + 8, { align: 'center' });
    const addrParts = [loc.streetAddress, [loc.city, loc.state, loc.postalCode].filter(Boolean).join(', ')].filter(Boolean);
    if (addrParts.length > 0) {
      setFont(doc, 7, 'normal', LINK_BLUE);
      addrParts.forEach((part, i) => {
        doc.text(part, col3X + col23W / 2, locY + 18 + (i * 9), { align: 'center' });
      });
      // Add link annotation
      const mapsUrl = generateMapsLink(loc);
      if (mapsUrl) {
        doc.link(col3X + 4, locY + 10, col23W - 8, 24, { url: mapsUrl });
      }
    }
    if (loc.phone) {
      setFont(doc, 7, 'normal', GRAY);
      doc.text(`📞 ${loc.phone}`, col3X + col23W / 2, locY + 38, { align: 'center' });
    }
    locY += 46;
  });

  // Column 4: Times + Weather
  setFont(doc, 8, 'normal');
  const timesData = [
    `Crew Call ◷ ${cs.crewCall}`,
    `Shooting Call ◷ ${cs.shootingCall}`,
    `First Meal ◷ ${cs.firstMeal}`,
  ];
  timesData.forEach((t, i) => {
    doc.text(t, col4X + 4, row2Top + 10 + (i * 12));
  });
  setFont(doc, 8, 'bold');
  doc.text(`Est. Wrap ◷ ${cs.estimatedWrap}`, col4X + 4, row2Top + 10 + (timesData.length * 12));

  // Weather
  if (weather) {
    const wxY = row2Top + 56;
    fillRect(doc, col4X + 4, wxY, col4W - 8, 56, '#f8f9fa');
    strokeRect(doc, col4X + 4, wxY, col4W - 8, 56, '#e5e7eb');

    const wxCenterX = col4X + col4W / 2;
    setFont(doc, 14, 'bold');
    doc.text(`${weather.tempLow}°F`, wxCenterX - 30, wxY + 14, { align: 'center' });
    doc.text(`${weather.tempHigh}°F`, wxCenterX + 30, wxY + 14, { align: 'center' });
    setFont(doc, 14, 'normal');
    doc.text('☀', wxCenterX, wxY + 14, { align: 'center' });
    setFont(doc, 6, 'normal', LIGHT_GRAY);
    doc.text('low', wxCenterX - 30, wxY + 22, { align: 'center' });
    doc.text('high', wxCenterX + 30, wxY + 22, { align: 'center' });

    setFont(doc, 7, 'normal', GRAY);
    const wxDesc = `${weather.description}. Wind ${weather.windSpeed}mph.${weather.precipChance > 0 ? ` ${weather.precipChance}% precip.` : ''}`;
    const wxLines = doc.splitTextToSize(wxDesc, col4W - 20);
    doc.text(wxLines, wxCenterX, wxY + 32, { align: 'center' });

    setFont(doc, 7, 'bold', BLACK);
    doc.text(`Sunrise: ${weather.sunrise}`, col4X + 10, wxY + 50);
    doc.text(`Sunset: ${weather.sunset}`, col4X + col4W - 10, wxY + 50, { align: 'right' });
  }

  // Vertical dividers for row 2
  const row2Bottom = Math.max(row2Top + 70, weather ? row2Top + 120 : row2Top + 70);
  [col2X, col3X, col4X].forEach(x => {
    doc.setDrawColor(BORDER);
    doc.setLineWidth(0.3);
    doc.line(x, row2Top, x, row2Bottom);
  });

  y = row2Bottom;
  hLine(doc, ML, y, CW, BORDER);
  y += 1;

  // ============================================================
  // DISCLAIMER BANNER
  // ============================================================
  if (disclaimer) {
    fillRect(doc, ML, y, CW, 18, BG_GRAY);
    hLine(doc, ML, y, CW, BORDER, 0.3);
    hLine(doc, ML, y + 18, CW, BORDER, 0.3);
    setFont(doc, 7, 'bold', '#333333');
    doc.text(disclaimer, PW / 2, y + 12, { align: 'center' });
    y += 20;
  }

  // ============================================================
  // TODAY'S SCHEDULE
  // ============================================================
  if (cs.scenes.length > 0) {
    y = checkPage(doc, y, 60);

    // Section header
    setFont(doc, 11, 'bold');
    doc.text('📅  Today\'s Schedule', ML + 4, y + 14);
    y += 20;
    hLine(doc, ML, y, CW, BORDER, 0.3);
    y += 1;

    // Table header
    const sceneCols = [60, 0, 80, 160]; // SCENE, SET/DESC (flex), CAST, LOCATION
    sceneCols[1] = CW - sceneCols[0] - sceneCols[2] - sceneCols[3];

    fillRect(doc, ML, y, CW, 14, DARK);
    setFont(doc, 7, 'bold', '#ffffff');
    doc.text('SCENE', ML + 4, y + 10);
    doc.text('SET / DESCRIPTION', ML + sceneCols[0] + 4, y + 10);
    doc.text('CAST', ML + sceneCols[0] + sceneCols[1] + 4, y + 10);
    doc.text('LOCATION', ML + sceneCols[0] + sceneCols[1] + sceneCols[2] + 4, y + 10);
    y += 14;

    cs.scenes.forEach(scene => {
      const loc = scene.locationId ? getLoc(scene.locationId) : undefined;
      const locLines = loc
        ? [loc.name, loc.streetAddress, [loc.city, loc.state, loc.postalCode].filter(Boolean).join(', ')].filter(Boolean)
        : [];
      const rowH = Math.max(24, locLines.length * 10 + 8);

      y = checkPage(doc, y, rowH);

      // Scene number cell (gray bg)
      fillRect(doc, ML, y, sceneCols[0], rowH, BG_GRAY);
      setFont(doc, 12, 'bold');
      doc.text(scene.sceneNumber, ML + sceneCols[0] / 2, y + rowH / 2 + 4, { align: 'center' });

      // Set description
      setFont(doc, 8, 'bold');
      doc.text(scene.setDescription, ML + sceneCols[0] + 4, y + 12);
      if (scene.notes) {
        setFont(doc, 7, 'normal', GRAY);
        doc.text(scene.notes, ML + sceneCols[0] + 4, y + 22);
      }

      // Cast
      setFont(doc, 8, 'normal');
      doc.text(scene.cast || '', ML + sceneCols[0] + sceneCols[1] + 4, y + 12);

      // Location
      const locX = ML + sceneCols[0] + sceneCols[1] + sceneCols[2] + 4;
      if (loc) {
        setFont(doc, 8, 'bold');
        doc.text(loc.name, locX, y + 12);
        setFont(doc, 7, 'normal', LINK_BLUE);
        const addrStr = [loc.streetAddress, [loc.city, loc.state, loc.postalCode].filter(Boolean).join(', ')].filter(Boolean);
        addrStr.forEach((line, i) => {
          doc.text(line, locX, y + 22 + (i * 9));
        });
        const mapsUrl = generateMapsLink(loc);
        if (mapsUrl) {
          doc.link(locX - 2, y + 13, sceneCols[3] - 8, addrStr.length * 9 + 4, { url: mapsUrl });
        }
      }

      hLine(doc, ML, y + rowH, CW, '#e5e7eb', 0.3);
      y += rowH;
    });
  }

  y += 4;

  // ============================================================
  // TALENT
  // ============================================================
  if (cs.talentCalls.length > 0) {
    y = checkPage(doc, y, 60);

    setFont(doc, 11, 'bold');
    doc.text('⭐  Talent', ML + 4, y + 14);
    y += 20;
    hLine(doc, ML, y, CW, BORDER, 0.3);
    y += 1;

    // Header
    const tCols = [36, 0, 120, 60, 140]; // ID, NAME(flex), ROLE, CALL, CONTACT
    tCols[1] = CW - tCols[0] - tCols[2] - tCols[3] - tCols[4];

    fillRect(doc, ML, y, CW, 14, DARK);
    setFont(doc, 7, 'bold', '#ffffff');
    doc.text('ID', ML + 4, y + 10);
    doc.text('TALENT', ML + tCols[0] + 4, y + 10);
    doc.text('ROLE', ML + tCols[0] + tCols[1] + 4, y + 10);
    doc.text('CALL', ML + tCols[0] + tCols[1] + tCols[2] + 4, y + 10);
    doc.text('CONTACT', ML + tCols[0] + tCols[1] + tCols[2] + tCols[3] + 4, y + 10);
    y += 14;

    cs.talentCalls.forEach(tc => {
      const p = getPerson(tc.personId);
      if (!p) return;

      const hasContact = p.phone || p.email;
      const rowH = hasContact ? 28 : 18;
      y = checkPage(doc, y, rowH);

      const talentRole = p.roles.find(r => r.group === 'Talent');

      // ID
      setFont(doc, 8, 'bold');
      doc.text(`${p.firstName[0]}${p.lastName[0]}`, ML + 4, y + 12);

      // Name
      setFont(doc, 8, 'normal');
      doc.text(`${p.firstName} ${p.lastName}`, ML + tCols[0] + 4, y + 12);

      // Role
      doc.text(talentRole?.characterName || talentRole?.position || 'Talent', ML + tCols[0] + tCols[1] + 4, y + 12);

      // Call
      doc.text(tc.callTime, ML + tCols[0] + tCols[1] + tCols[2] + 4, y + 12);

      // Contact
      const contactX = ML + tCols[0] + tCols[1] + tCols[2] + tCols[3] + 4;
      setFont(doc, 7, 'normal');
      if (p.phone) doc.text(p.phone, contactX, y + 10);
      if (p.email) {
        setFont(doc, 7, 'normal', LINK_BLUE);
        doc.text(p.email, contactX, y + (p.phone ? 20 : 10));
      }

      hLine(doc, ML, y + rowH, CW, '#e5e7eb', 0.3);
      y += rowH;
    });
  }

  y += 4;

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
    hLine(doc, ML, y, CW, BORDER, 0.3);
    y += 2;

    const halfW = CW / 2;
    let colIdx = 0;
    let leftY = y;
    let rightY = y;

    deptEntries.forEach(([dept, calls]) => {
      const blockH = 16 + (calls.length * 14) + 4; // header + rows + padding
      const isLeft = colIdx % 2 === 0;
      const startX = isLeft ? ML : ML + halfW;
      let startY = isLeft ? leftY : rightY;

      startY = checkPage(doc, startY, blockH);
      if (startY === MT) {
        // Reset both columns on new page
        leftY = MT;
        rightY = MT;
        startY = MT;
      }

      // Department header
      fillRect(doc, startX, startY, halfW, 14, DARK);
      setFont(doc, 8, 'bold', '#ffffff');
      doc.text(dept.toUpperCase(), startX + 4, startY + 10);

      let rowY = startY + 14;
      calls.forEach(cc => {
        const p = getPerson(cc.personId);
        setFont(doc, 7, 'bold', BLACK);
        doc.text(cc.position, startX + 4, rowY + 10);
        setFont(doc, 7, 'normal');
        doc.text(p ? `${p.firstName} ${p.lastName}` : '', startX + 80, rowY + 10);
        if (p?.phone) {
          setFont(doc, 7, 'normal', GRAY);
          doc.text(p.phone, startX + halfW - 68, rowY + 10);
        }
        setFont(doc, 7, 'normal', BLACK);
        doc.text(cc.callTime, startX + halfW - 4, rowY + 10, { align: 'right' });

        // Dotted separator
        doc.setDrawColor('#e5e7eb');
        doc.setLineWidth(0.3);
        doc.setLineDashPattern([1, 1], 0);
        doc.line(startX + 2, rowY + 14, startX + halfW - 2, rowY + 14);
        doc.setLineDashPattern([], 0);

        rowY += 14;
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

    y = Math.max(leftY, rightY) + 4;
  }

  // ============================================================
  // NOTES
  // ============================================================
  if (cs.notes) {
    y = checkPage(doc, y, 30);
    hLine(doc, ML, y, CW, BORDER, 0.3);
    y += 8;
    setFont(doc, 8, 'bold');
    doc.text('Additional Notes:', ML + 4, y + 8);
    setFont(doc, 8, 'normal', GRAY);
    const noteLines = doc.splitTextToSize(cs.notes, CW - 16);
    doc.text(noteLines, ML + 4, y + 20);
  }

  return doc;
}
