/**
 * Parses raw HTML from copticchurch.net into structured hymn data.
 */

export interface ParsedVerse {
  en: string;
  cop: string;
  ar: string;
}

export interface ParsedHymn {
  titleEn: string;
  titleCop: string;
  titleAr: string;
  speaker: string;
  verses: ParsedVerse[];
  note: string;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#?[a-z0-9]+;/gi, '')
    .replace(/\u00a0/g, ' ');
}

function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, ''))
    .replace(/\s+/g, ' ')
    .trim();
}

function extractParagraphText(html: string): { text: string; note: string } {
  const texts: string[] = [];
  let note = '';
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let m;
  while ((m = pRegex.exec(html)) !== null) {
    const raw = m[1];
    // Check if this paragraph contains <hr> — everything after it is a note
    const hrIdx = raw.search(/<hr/i);
    if (hrIdx !== -1) {
      const beforeHr = raw.substring(0, hrIdx);
      const afterHr = raw.substring(hrIdx).replace(/<hr[^>]*>/gi, '').replace(/<br\s*\/?>/gi, ' ');
      const beforeText = stripTags(beforeHr).trim();
      const noteText = stripTags(afterHr).trim();
      if (beforeText) texts.push(beforeText);
      if (noteText) note = noteText;
    } else {
      const t = stripTags(raw).trim();
      if (t) texts.push(t);
    }
  }
  return {
    text: texts.length > 0 ? texts.join('\n') : stripTags(html),
    note,
  };
}

function findAllBetweenMarkers(html: string, startPattern: RegExp, endMarker: string): string {
  const startMatch = html.match(startPattern);
  if (!startMatch) return '';
  const startIdx = startMatch.index! + startMatch[0].length;
  const endIdx = html.indexOf(endMarker, startIdx);
  return endIdx > startIdx ? html.substring(startIdx, endIdx) : html.substring(startIdx);
}

function extractColumnsFromBlock(block: string): { en: string; cop: string; ar: string; note: string }[] {
  const results: { en: string; cop: string; ar: string; note: string }[] = [];

  // Split by row divs
  const rowParts = block.split(/<div[^>]*class=['"]row['"][^>]*>/i);

  for (const part of rowParts) {
    const enMatch = part.match(/englishtext[^>]*>([\s\S]*?)(?=<div[^>]*class=['"]col|$)/i);
    const copMatch = part.match(/coptictext_utf8[^>]*>([\s\S]*?)(?=<div[^>]*class=['"]col|$)/i);
    const arMatch = part.match(/arabictext[^>]*>([\s\S]*?)(?=<div[^>]*class=['"]col|$)/i);

    if (!enMatch && !copMatch && !arMatch) continue;

    const enResult = enMatch ? extractParagraphText(enMatch[1]) : { text: '', note: '' };
    const copResult = copMatch ? extractParagraphText(copMatch[1]) : { text: '', note: '' };
    const arResult = arMatch ? extractParagraphText(arMatch[1]) : { text: '', note: '' };

    const en = enResult.text;
    const cop = copResult.text;
    const ar = arResult.text;
    const note = enResult.note || copResult.note || arResult.note;

    if (!en && !cop && !ar) continue;
    results.push({ en, cop, ar, note });
  }

  return results;
}

export function parseCopticChurchHtml(html: string): ParsedHymn {
  const result: ParsedHymn = {
    titleEn: '',
    titleCop: '',
    titleAr: '',
    speaker: '',
    verses: [],
    note: '',
  };

  // 1. Extract title from <h1>
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match) {
    const h1 = h1Match[1];
    const copSpan = h1.match(/<span[^>]*class="coptictext_utf8"[^>]*>([\s\S]*?)<\/span>/i);
    const arSpan = h1.match(/<span[^>]*class=['"]arabictext['"][^>]*>([\s\S]*?)<\/span>/i);
    result.titleCop = copSpan ? stripTags(copSpan[1]) : '';
    result.titleAr = arSpan ? stripTags(arSpan[1]) : '';

    let titleEn = h1;
    if (copSpan) titleEn = titleEn.replace(copSpan[0], '');
    if (arSpan) titleEn = titleEn.replace(arSpan[0], '');
    result.titleEn = stripTags(titleEn).replace(/::/g, '').replace(/\s+/g, ' ').trim();
  }

  // 2. Find content — use the full HTML between "hymntext" and end markers
  const hymnStart = html.indexOf('id="hymntext"') !== -1
    ? html.indexOf('id="hymntext"')
    : html.indexOf("id='hymntext'");

  if (hymnStart === -1) return result;

  // Find the panel-body inside hymntext
  const panelBodyStart = html.indexOf('panel-body', hymnStart);
  if (panelBodyStart === -1) return result;

  // Extract everything from panel-body to the closing DIV of panel / row / col-md
  // Find the matching closing by counting div depth from panel-body
  let depth = 0;
  let i = panelBodyStart;
  let contentStart = -1;
  let contentEnd = -1;

  // Find the opening <div class="panel-body">
  const openTag = html.indexOf('<div', panelBodyStart - 20);
  if (openTag === -1 || openTag > panelBodyStart + 20) {
    // panel-body might not be inside a <div>, just start from panel-body position
  }

  // Simpler approach: extract content between panel-body and </DIV> that closes the panel
  const contentSection = findAllBetweenMarkers(
    html,
    /class=['"]panel-body['"]/i,
    '</DIV>'
  );

  if (!contentSection) return result;

  // 3. Extract all columns from the content section
  const rows = extractColumnsFromBlock(contentSection);

  if (rows.length === 0) return result;

  // 4. Process rows: detect speaker, verses, notes
  let speakerFound = false;

  for (const row of rows) {
    const { en, cop, ar, note } = row;

    // If a row has a note (from <hr> splitting), capture it
    if (note && !result.note) {
      result.note = note;
      // If this row also has verse content, keep it as a verse
      if (!en && !cop && !ar) continue;
    }

    // Skip rows that are notes only (English has content but Coptic and Arabic are empty, and it's a usage note)
    if (!cop && !ar && en && /said on|not said|feast|fasting|lent|nayroz|week/i.test(en)) {
      if (!result.note) result.note = en;
      continue;
    }

    // Detect speaker-only row: all 3 columns contain just speaker labels (short text)
    const speakerLabels = ['people', 'priest', 'deacon', 'angel', 'response', 'choir', 'congregation'];
    const copSpeakerLabels = ['ⲡⲓⲗⲁⲟⲥ', ' Priest', 'deacon'];
    const arSpeakerLabels = ['الشعب', 'الكاهن', 'الشماس'];

    const enLower = (en || '').toLowerCase().replace(/:$/, '').trim();
    const isEnSpeaker = speakerLabels.some(s => enLower === s) && en.length < 40;
    const isCopSpeaker = !cop || (cop.replace(/:/g, '').trim().length < 20 && /ⲟⲥ$/.test(cop.replace(/:/g, '').trim()));
    const isArSpeaker = !ar || (ar.replace(/:/g, '').trim().length < 15 && /^(الشعب|الكاهن|الشماس|الملاك|ال回应)/.test(ar.replace(/:/g, '').trim()));

    // Row where all columns are just speaker labels (or empty)
    const copShort = !cop || cop.replace(/[^ⲁ-ⲟⲟ̀-ⲏⲐⲑⲒⲓⲔⲕⲗⲙⲛⲝⲡⲣⲥⲧⲩⲫⲱⲱ]/gi, '').length < 20;
    const arShort = !ar || ar.replace(/[^ء-ي]/g, '').length < 15;
    const enIsSpeakerLabel = speakerLabels.some(s => enLower === s);

    if (enIsSpeakerLabel && (copShort || !cop) && (arShort || !ar) && en.length < 40) {
      result.speaker = en.replace(/:$/, '');
      speakerFound = true;
      continue;
    }

    // Skip empty rows
    if (!en && !cop && !ar) continue;

    // Check for combined speaker+verse
    if (!speakerFound && en) {
      for (const label of speakerLabels) {
        const regex = new RegExp(`^${label}:?\\s*(.*)`, 'i');
        const match = en.match(regex);
        if (match) {
          result.speaker = label.charAt(0).toUpperCase() + label.slice(1);
          speakerFound = true;
          const rest = match[1].trim();
          if (rest || cop || ar) {
            result.verses.push({ en: rest, cop, ar });
          }
          break;
        }
      }
      if (speakerFound) continue;
    }

    // Regular verse
    result.verses.push({ en, cop, ar });
  }

  return result;
}

export function hymnToPresentationData(hymn: ParsedHymn): Record<string, unknown> {
  return {
    format: 'coptic-church-v1',
    speaker: hymn.speaker,
    verses: hymn.verses,
    note: hymn.note,
  };
}
