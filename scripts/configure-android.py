"""Run after `npx cap add android`. Adds scanner permission and ClassCheck icons."""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
manifest = root / 'android/app/src/main/AndroidManifest.xml'
if not manifest.exists():
    raise SystemExit('Run npx cap add android before configuring Android.')
text = manifest.read_text()
if 'android.permission.CAMERA' not in text:
    text = text.replace('<application', '    <uses-permission android:name="android.permission.CAMERA" />\n    <uses-feature android:name="android.hardware.camera" android:required="false" />\n    <application', 1)
    # The insert above belongs before the first <application> (manifest root).
    manifest.write_text(text)
# Give Android's square and round launchers the existing ClassCheck icon.
source = Image.open(root / 'assets/icons/classcheck-512.png').convert('RGBA')
res = root / 'android/app/src/main/res'
for density, size in [('mdpi',48),('hdpi',72),('xhdpi',96),('xxhdpi',144),('xxxhdpi',192)]:
    folder = res / f'mipmap-{density}'
    folder.mkdir(parents=True, exist_ok=True)
    icon = source.resize((size,size),Image.Resampling.LANCZOS)
    icon.save(folder/'ic_launcher.png')
    icon.save(folder/'ic_launcher_round.png')
    # adaptive foreground at 108dp (icon is set inside a centered safe area)
    canvas_size=int(size*108/48)
    inside=int(canvas_size*.65)
    canvas=Image.new('RGBA',(canvas_size,canvas_size),(0,0,0,0))
    art=source.resize((inside,inside),Image.Resampling.LANCZOS)
    canvas.alpha_composite(art,((canvas_size-inside)//2,(canvas_size-inside)//2))
    canvas.save(folder/'ic_launcher_foreground.png')
# Reuse the generated PNG as the foreground for the adaptive launcher if installed.
print('Added Android camera permission and ClassCheck launcher icons.')
