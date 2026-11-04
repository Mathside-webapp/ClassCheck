/* Private, owner-only profile photos. No attendance or profile fields are modified. */
(() => {
  const bucket = 'classcheck-profile-photos';
  let photoURL = '', request = 0;
  function paint() {
    const preview = document.getElementById('profilePhotoPreview');
    const placeholder = document.getElementById('profilePhotoPlaceholder');
    if (preview) { preview.hidden = !photoURL; if (photoURL) preview.src = photoURL; else preview.removeAttribute('src'); }
    if (placeholder) { placeholder.hidden = !!photoURL; placeholder.textContent = (AppStorage.get().profile?.full_name || 'T')[0]; }
    document.querySelectorAll('.classcheck-avatar,.dash-profile').forEach(el => {
      if (!photoURL) return;
      const img = document.createElement('img'); img.src = photoURL; img.alt = '';
      el.replaceChildren(img);
    });
  }
  document.addEventListener('DOMContentLoaded', async () => {
    if (!document.getElementById('profilePhotoFile')) return;
    let ctx;
    try { ctx = await AppBoot.ready(); } catch { return; }
    const supa = Supa.getClient(), path = `${ctx.user.id}/avatar.jpg`;
    const $ = id => document.getElementById(id);
    const file = $('profilePhotoFile'), dialog = $('profilePhotoEditor'), canvas = $('profilePhotoCanvas');
    const zoom = $('photoZoom'), x = $('photoX'), y = $('photoY'), size = $('photoSize');
    const status = $('profilePhotoStatus'), editorStatus = $('photoEditorStatus');
    let source = null, angle = 0, busy = false;
    const rotated = document.createElement('canvas');
    async function loadPhoto() {
      if (APP_CONFIG.DEMO_MODE) return;
      const { data, error } = await supa.storage.from(bucket).createSignedUrl(path, 3600);
      if (!error && data?.signedUrl) { photoURL = data.signedUrl; paint(); }
    }
    function draw() {
      if (!source) return;
      const w = source.naturalWidth, h = source.naturalHeight, swap = angle % 180 !== 0;
      rotated.width = swap ? h : w; rotated.height = swap ? w : h;
      const rc = rotated.getContext('2d');
      rc.translate(rotated.width / 2, rotated.height / 2); rc.rotate(angle * Math.PI / 180); rc.drawImage(source, -w / 2, -h / 2);
      const side = Math.min(rotated.width, rotated.height) / Number(zoom.value);
      const left = (rotated.width - side) * Number(x.value) / 100;
      const top = (rotated.height - side) * Number(y.value) / 100;
      canvas.width = canvas.height = Number(size.value);
      const c = canvas.getContext('2d'); c.fillStyle = '#ffffff'; c.fillRect(0, 0, canvas.width, canvas.height);
      c.drawImage(rotated, left, top, side, side, 0, 0, canvas.width, canvas.height);
    }
    function reset() { angle = 0; zoom.value = 1; x.value = y.value = 50; draw(); }
    $('chooseProfilePhoto').onclick = () => { file.value = ''; file.click(); };
    file.onchange = async () => {
      const selected = file.files[0]; if (!selected) return;
      const current = ++request;
      status.textContent = '';
      if (!['image/jpeg','image/png','image/webp'].includes(selected.type)) { status.textContent = 'Choose a JPEG, PNG, or WebP image.'; return; }
      if (selected.size > 10 * 1024 * 1024) { status.textContent = 'Choose an image smaller than 10 MB.'; return; }
      const url = URL.createObjectURL(selected), img = new Image();
      try {
        img.src = url; await img.decode();
        if (current !== request) return;
        if (img.naturalWidth * img.naturalHeight > 32000000) throw new Error('Choose a photo under 32 megapixels.');
        source = img; editorStatus.textContent = ''; size.value = '512'; reset(); dialog.showModal(); dialog.scrollTop = 0;
      } catch (err) { status.textContent = err.message?.includes('megapixels') ? err.message : 'This image could not be opened. Try another JPEG or PNG.'; }
      finally { URL.revokeObjectURL(url); }
    };
    [zoom,x,y,size].forEach(input => input.addEventListener('input', draw));
    $('rotatePhoto').onclick = () => { angle = (angle + 90) % 360; draw(); };
    $('resetPhoto').onclick = reset;
    $('cancelPhoto').onclick = () => { if (!busy) dialog.close(); };
    dialog.addEventListener('cancel', e => { if (busy) e.preventDefault(); });
    dialog.addEventListener('close', () => { source = null; rotated.width = rotated.height = 0; });
    $('uploadPhoto').onclick = async () => {
      if (busy || !source) return;
      if (APP_CONFIG.DEMO_MODE) { editorStatus.textContent = 'Photo upload is unavailable in demo mode.'; return; }
      if (!navigator.onLine) { editorStatus.textContent = 'Reconnect to the internet, then try uploading again.'; return; }
      busy = true; editorStatus.textContent = 'Uploading your photo…';
      dialog.querySelectorAll('button,input,select').forEach(el => el.disabled = true);
      try {
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .88));
        if (!blob) throw new Error('Image export failed. Please try another photo.');
        const { error } = await supa.storage.from(bucket).upload(path, blob, { contentType:'image/jpeg', upsert:true, cacheControl:'0' });
        if (error) throw error;
        const { data, error:readError } = await supa.storage.from(bucket).createSignedUrl(path, 3600);
        if (readError) throw readError;
        photoURL = data.signedUrl; paint(); dialog.close(); status.textContent = 'Profile photo updated.';
      } catch (err) {
        console.error('Profile photo upload failed', err);
        editorStatus.textContent = 'Could not upload your photo. Check your connection and that the profile-photo SQL setup has been applied, then retry.';
      } finally { busy = false; dialog.querySelectorAll('button,input,select').forEach(el => el.disabled = false); }
    };
    await loadPhoto(); paint();
    // Navigation replaces its avatar nodes. Reapply without rebuilding navigation or form state.
    const observer = new MutationObserver(() => {
      if (photoURL && [...document.querySelectorAll('.classcheck-avatar,.dash-profile')].some(el => !el.querySelector('img'))) paint();
    });
    observer.observe(document.body, { childList:true, subtree:true });
    document.addEventListener('classcheck:panelchange', paint);
    setInterval(() => { if (navigator.onLine && document.visibilityState === 'visible') loadPhoto(); }, 45 * 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') loadPhoto(); });
  });
})();
