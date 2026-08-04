import { parseCopticChurchHtml, hymnToPresentationData } from './html-parser';

const sample1 = `<HTML><HEAD><TITLE>Full Prayer :: Alleluia Fai be pi-ehoo :: Ⲁ̅ⲗ̅ Ⲫⲁⲓ ⲡⲉ ⲡⲓⲉ̀ϩⲟⲟⲩ</TITLE></HEAD><BODY>
<h1>Alleluia Fai be pi-ehoo :: <span class="coptictext_utf8">Ⲁ̅ⲗ̅ Ⲫⲁⲓ ⲡⲉ ⲡⲓⲉ̀ϩⲟⲟⲩ</span></h1>
<div class="row">
<div class="col-md-9" id="hymn-page">
<div class="row">
<DIV id="hymntext" class="panel panel-default">
<div class="panel-body">
<div class='row'>
<div class='col-xs-4 textcolumn englishtext' valign='top'><p><b>People:</b> <br />
Alleluia. This is the day that the Lord has made. Let us rejoice and be glad in it. O Lord save us. O Lord straighten our ways. Blessed is He, who comes in the name of the Lord. Alleluia. <br />
<hr><br />
Said on all days that are not part of a fast, on all major and minor feasts, on the feasts of the cross, and the feast of Nayroz.</p></div>
<div class='col-xs-4 textcolumn coptictext_utf8' valign='top'><p>Ⲡⲓⲗⲁⲟⲥ:<br />
Ⲁⲗⲗⲏⲗⲟⲩⲓⲁ. Ⲫⲁⲓ ⲡⲉ ⲡⲓⲉ̀ϩⲟⲟⲩ ⲉ̀ⲧⲁ Ⲡ̀ⲟ̅ⲥ̅ ⲑⲁⲙⲓⲟϥ: ⲙⲁⲣⲉⲛⲑⲉⲗⲏⲗ ⲛ̀ⲧⲉⲛⲟ̀ⲩⲛⲟϥ ⲙ̀ⲙⲟⲛ ⲛ̀ϧⲏⲧϥ: ⲱ̀ Ⲡ̀ⲟ̅ⲥ̅ ⲉⲕⲉ̀ⲛⲁϩⲙⲉⲛ: ⲱ̀ Ⲡ̀ⲟ̅ⲥ̅ ⲉⲕⲉ̀ⲥⲟⲩⲧⲉⲛ ⲛⲉⲛⲙⲱⲓⲧ: ϥ̀ⲥ̀ⲙⲁⲣⲱⲟⲩⲧ ⲛ̀ϫⲉ ⲫⲏⲉ̀ⲑⲛⲏⲟⲩ ϧⲉⲛ ⲫ̀ⲣⲁⲛ ⲙ̀Ⲡ̀ⲟ̅ⲥ̅: ⲁ̅ⲗ̅.</p></div>
<div class='col-xs-4 textcolumn arabictext' valign='top'><p>الشعب:<br />
هلليلويا. هذا هو اليوم الذي صنعه الرب فلنفرح ونبتهج فيه. يا رب خلصنا يا رب سهل سبيلنا. مبارك الآتي باسم الرب. هلليلويا. <br />
</p></div>
</div>
</div>
</DIV>
</div>
</div>
</div>
</BODY></HTML>`;

const sample2 = `<HTML><HEAD><TITLE>Full Prayer :: Ten-oo-osht</TITLE></HEAD><BODY>
<h1>Ten-oo-osht :: <span class="coptictext_utf8">Ⲧⲉⲛⲟ̀ⲩⲱϣⲧ ⲙ̀Ⲫ̀ⲓⲱⲧ</span> :: <span class='arabictext'>تين اوؤشت</span></h1>
<div class="row">
<div class="col-md-9" id="hymn-page">
<div class="row">
<DIV id="hymntext" class="panel panel-default">
<div class="panel-body">
<div class='row'>
<div class='col-xs-4 textcolumn englishtext' valign='top'><p>We worship the Father of light, and His only-begotten Son, and the Spirit the Paraclete, the co-essential Trinity. </p></div>
<div class='col-xs-4 textcolumn coptictext_utf8' valign='top'><p>Ⲧⲉⲛⲟ̀ⲩⲱϣⲧ ⲙ̀Ⲫ̀ⲓⲱⲧ ⲙ̀ⲡⲓⲟ̀ⲩⲱⲓⲛⲓ: ⲛⲉⲙ ⲠⲉϥϢⲏⲣⲓ ⲙ̀ⲙⲟⲛⲟⲅⲉⲛⲏⲥ: ⲛⲉⲙ ⲡⲓⲠ̀ⲛⲉⲩⲙⲁ ⲙ̀Ⲡⲁⲣⲁⲕⲗⲏⲧⲟⲛ: ϯⲦ̀ⲣⲓⲁⲥ ⲛ̀ⲟⲙⲟⲟⲩⲥⲓⲟⲥ.</p></div>
<div class='col-xs-4 textcolumn arabictext' valign='top'><p>نسجد لآب النور، وإبنه الوحيد، والروح المعزي، الثالوث المساوي.<br />
</p></div>
</div>
</div>
</DIV>
</div>
</div>
</div>
</BODY></HTML>`;

const sample3 = `<HTML><HEAD><TITLE>Full Prayer :: Alleluia. Je Efmevee</TITLE></HEAD><BODY>
<h1>Alleluia. Je Efmevee :: <span class="coptictext_utf8">Ⲁⲗⲗⲏⲗⲟⲩⲓⲁ. Ϫⲉ ⲫ̀ⲙⲉⲩⲓ̀</span> :: <span class='arabictext'>الليلويا جي افميي إ</span></h1>
<div class="row">
<div class="col-md-9" id="hymn-page">
<div class="row">
<DIV id="hymntext" class="panel panel-default">
<div class="panel-body">
<div class='row'>
<div class='col-xs-4 textcolumn englishtext' valign='top'><p><b>People:</b></p></div>
<div class='col-xs-4 textcolumn coptictext_utf8' valign='top'><p>Ⲡⲓⲗⲁⲟⲥ:</p></div>
<div class='col-xs-4 textcolumn arabictext' valign='top'><p>الشعب:</p></div>
</div>
<div class='row'>
<div class='col-xs-4 textcolumn englishtext' valign='top'><p>Alleluia. The thought of man shall confess to You O Lord, and the remainder of thought shall keep a feast to You. The sacrifices and the offerings receive them to Yourself. Alleluia.</p></div>
<div class='col-xs-4 textcolumn coptictext_utf8' valign='top'><p>Ⲁⲗⲗⲏⲗⲟⲩⲓⲁ. Ϫⲉ ⲫ̀ⲙⲉⲩⲓ̀ ⲛ̀ⲟ̀ⲩⲣⲱⲙⲓ ⲉϥⲉ̀ⲟ̀ⲩⲱ̀ⲛϩ ⲛⲁⲕ ⲉ̀ⲃⲟⲗ Ⲡ̀ⲟ̅ⲥ̅: ⲟⲩⲟϩ ⲡ̀ⲥⲱϫⲡ ⲛ̀ⲧⲉ ⲟ̀ⲩⲙⲉⲩⲓ̀ ⲉϥⲉ̀ⲉⲣϣⲁⲓ ⲛⲁⲕ. Ⲛⲓⲑⲩⲥⲓⲁ ⲛⲓⲡ̀ⲣⲟⲥⲫⲟⲣⲁ ϣⲟⲡⲟⲩ ⲉ̀ⲣⲟⲕ. Ⲁⲗⲗⲏⲗⲟⲩⲓⲁ.</p></div>
<div class='col-xs-4 textcolumn arabictext' valign='top'><p>هلليلويا. إن فكر الإنسان يعترف لك يا رب، وبقية الفكر تعيد لك. الذبائح والقرابين اقبلها إليك. هلليلويا. </p></div>
</div>
<div class='row'>
<div class='col-xs-4 textcolumn englishtext' valign='top'><p><hr><br />
Said on all fasting days including the weekends of the Lent.<br />
Not said on the weekdays on Lent but instead, Alleluia ei-e-ee is said.</p></div>
<div class='col-xs-4 textcolumn coptictext_utf8' valign='top'><p>&nbsp;</p></div>
<div class='col-xs-4 textcolumn arabictext' valign='top'><p>&nbsp;</p></div>
</div>
</div>
</DIV>
</div>
</div>
</div>
</BODY></HTML>`;

describe('parseCopticChurchHtml', () => {
  // Coptic text uses combining diacritics (U+0300 range) that can split a
  // visual substring; normalize before matching so assertions are stable.
  const stripDiacritics = (s: string) => s.replace(/[\u0300-\u036f]/g, '');

  it('returns the full ParsedHymn shape', () => {
    const result = parseCopticChurchHtml(sample1);
    expect(result).toEqual(
      expect.objectContaining({
        titleEn: expect.any(String),
        titleCop: expect.any(String),
        titleAr: expect.any(String),
        speaker: expect.any(String),
        note: expect.any(String),
        verses: expect.any(Array),
      }),
    );
  });

  it('extracts the English title from the <h1>', () => {
    expect(parseCopticChurchHtml(sample1).titleEn).toBe('Alleluia Fai be pi-ehoo');
    expect(parseCopticChurchHtml(sample2).titleEn).toBe('Ten-oo-osht');
    expect(parseCopticChurchHtml(sample3).titleEn).toBe('Alleluia. Je Efmevee');
  });

  it('extracts the Coptic and Arabic titles', () => {
    const r1 = parseCopticChurchHtml(sample1);
    expect(stripDiacritics(r1.titleCop)).toContain('Ⲫⲁⲓ');
    expect(stripDiacritics(r1.titleCop)).toContain('ϩⲟⲟⲩ');

    const r2 = parseCopticChurchHtml(sample2);
    expect(stripDiacritics(r2.titleCop)).toContain('Ⲧⲉⲛⲟⲩⲱϣⲧ');
    expect(r2.titleAr).toBe('تين اوؤشت');

    const r3 = parseCopticChurchHtml(sample3);
    expect(stripDiacritics(r3.titleCop)).toContain('ⲫⲙⲉⲩⲓ');
    expect(r3.titleAr).toContain('افميي');
  });

  it('detects the speaker label when present', () => {
    expect(parseCopticChurchHtml(sample1).speaker).toBe('People');
    expect(parseCopticChurchHtml(sample3).speaker).toBe('People');
  });

  it('leaves speaker empty when no label is present', () => {
    expect(parseCopticChurchHtml(sample2).speaker).toBe('');
  });

  it('captures the usage note after an <hr>', () => {
    const r1 = parseCopticChurchHtml(sample1);
    expect(r1.note).toContain('Said on all days');
    const r3 = parseCopticChurchHtml(sample3);
    expect(r3.note).toContain('Said on all fasting days');
  });

  it('extracts trilingual verse content', () => {
    const r1 = parseCopticChurchHtml(sample1);
    expect(r1.verses).toHaveLength(1);
    expect(r1.verses[0].en).toContain('Alleluia. This is the day');
    expect(r1.verses[0].cop.length).toBeGreaterThan(50);
    expect(r1.verses[0].ar.length).toBeGreaterThan(50);

    const r2 = parseCopticChurchHtml(sample2);
    expect(r2.verses[0].en).toContain('We worship the Father of light');
  });

  it('returns an empty hymn for non-hymn HTML', () => {
    const result = parseCopticChurchHtml('<html><body><p>no hymn here</p></body></html>');
    expect(result.titleEn).toBe('');
    expect(result.verses).toHaveLength(0);
  });
});

describe('hymnToPresentationData', () => {
  it('maps a parsed hymn into presentation data', () => {
    const hymn = parseCopticChurchHtml(sample1);
    const data = hymnToPresentationData(hymn);
    expect(data.format).toBe('coptic-church-v1');
    expect(data.speaker).toBe(hymn.speaker);
    expect(data.verses).toBe(hymn.verses);
    expect(data.note).toBe(hymn.note);
  });
});
