/**
 * The SYNTHETIC pages the walks read from — shared by `walk.mjs` and
 * `ph41-walk.mjs` so there is one corpus and one place to change it.
 *
 * NO MATRIMONIAL SITE IS EVER VISITED, SCREENSHOTTED OR COMMITTED (X-3, every
 * site's terms, and the privacy reason that stands whether or not the terms
 * would). Every name, date and place below is fabricated, and the portrait is
 * painted procedurally — value noise, soft blobs and a gradient — so it is
 * dense in edges like a photograph without being a face or a downloaded
 * image.
 */

export const SYNTHETIC_PAGES = {
  '/biodata': `<!doctype html><html><head><meta charset="utf-8"><title>Profile</title></head>
<body style="font-family:Georgia,serif;margin:0;background:#fff;color:#111">
  <div style="padding:28px 40px;background:#7a1f3d;color:#fff">
    <h1 style="margin:0;font-size:26px">Asha Verma</h1>
    <p style="margin:6px 0 0;opacity:.85">Profile ID SY-40021 · Synthetic sample, not a real person</p>
  </div>
  <div style="display:flex;gap:32px;padding:32px 40px">
    <!-- A PHOTOGRAPH-LIKE TEXTURE, painted procedurally (value noise + soft
         blobs + a gradient). NOT a face, NOT a downloaded image, NOT a real
         person — and dense in edges, which is the property that makes it a
         photograph to the segmentation (F314). The flat grey placeholder it
         replaces is why the photo case went unexercised for a whole phase. -->
    <canvas id="portrait" width="200" height="240" style="border:1px solid #333"></canvas>
    <table style="border-collapse:collapse;font-size:17px">
      <tr><td style="padding:7px 26px 7px 0;color:#666">Date of Birth</td><td><b>14 May 1994</b></td></tr>
      <tr><td style="padding:7px 26px 7px 0;color:#666">Time of Birth</td><td><b>07:45 AM</b></td></tr>
      <tr><td style="padding:7px 26px 7px 0;color:#666">Place of Birth</td><td><b>Nagpur, Maharashtra</b></td></tr>
      <tr><td style="padding:7px 26px 7px 0;color:#666">Height</td><td>5' 4"</td></tr>
      <tr><td style="padding:7px 26px 7px 0;color:#666">Education</td><td>M.Sc. Botany</td></tr>
      <tr><td style="padding:7px 26px 7px 0;color:#666">Lives in</td><td>Bengaluru</td></tr>
      <tr><td style="padding:7px 26px 7px 0;color:#666">Contact</td><td>+91 90000 00000</td></tr>
    </table>
  </div>
  <script>
    (function () {
      var c = document.getElementById('portrait');
      var x = c.getContext('2d');
      var g = x.createLinearGradient(0, 0, c.width, c.height);
      g.addColorStop(0, '#6a7f9c'); g.addColorStop(1, '#c9b79a');
      x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
      var seed = 1337;
      function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
      for (var i = 0; i < 9; i++) {
        var bx = rnd() * c.width, by = rnd() * c.height, br = 12 + rnd() * 70;
        var b = x.createRadialGradient(bx, by, 0, bx, by, br);
        b.addColorStop(0, 'rgba(' + (40 + rnd() * 180 | 0) + ',' + (40 + rnd() * 180 | 0) + ',' + (40 + rnd() * 180 | 0) + ',0.8)');
        b.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = b; x.fillRect(0, 0, c.width, c.height);
      }
      var img = x.getImageData(0, 0, c.width, c.height);
      for (var j = 0; j < img.data.length; j += 4) {
        var n = (rnd() - 0.5) * 150;
        img.data[j] = Math.max(0, Math.min(255, img.data[j] + n));
        img.data[j + 1] = Math.max(0, Math.min(255, img.data[j + 1] + n));
        img.data[j + 2] = Math.max(0, Math.min(255, img.data[j + 2] + n));
      }
      x.putImageData(img, 0, 0);
    })();
  </script>
</body></html>`,
  '/plain': `<!doctype html><html><head><meta charset="utf-8"><title>No details</title></head>
<body style="font-family:system-ui;padding:60px;font-size:18px;line-height:1.7">
  <h1>Terms of Service</h1>
  <p>This page carries no name, no date, no time and no place of birth. It is
  here so the walk can see what the extractor does with a crop that has
  nothing on it to read.</p>
  <p>Nothing on this page is a birth detail. Nothing on this page is a person.</p>
</body></html>`,
  '/two': `<!doctype html><html><head><meta charset="utf-8"><title>Family</title></head>
<body style="font-family:system-ui;padding:36px;font-size:17px">
  <h1 style="margin:0 0 6px">Meera Iyer</h1>
  <p style="margin:0 0 18px;color:#666">Synthetic sample · not a real person</p>
  <table style="border-collapse:collapse"><tr><td style="padding:6px 22px 6px 0;color:#666">Height</td><td>5' 3"</td></tr>
  <tr><td style="padding:6px 22px 6px 0;color:#666">Profession</td><td>Architect</td></tr></table>
  <h2 style="margin-top:30px">Brother</h2>
  <h3 style="margin:0 0 6px">Rohan Iyer</h3>
  <table style="border-collapse:collapse">
   <tr><td style="padding:6px 22px 6px 0;color:#666">Date of Birth</td><td><b>02 January 1990</b></td></tr>
   <tr><td style="padding:6px 22px 6px 0;color:#666">Place of Birth</td><td><b>Chennai</b></td></tr>
  </table>
</body></html>`,
};
