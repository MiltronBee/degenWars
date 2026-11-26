# contact sheet of the painted UI art (art/ui-*.webp) -> shots/ui-art.png
import pathlib
from PIL import Image, ImageDraw
A=pathlib.Path.home()/'degenWars/art'
tex=['ui-steel','ui-paper','ui-crate','ui-canvas']; pl=['ui-btn-red','ui-btn-oxide','ui-btn-steel','ui-btn-brass']
ic=sorted(p.stem for p in A.glob('ui-i-*.webp'))
W=1400; S=Image.new('RGB',(W,820),(20,19,18)); d=ImageDraw.Draw(S)
def lab(x,y,t): d.text((x,y),t,fill=(185,160,108))
x=20
for n in tex:
    im=Image.open(A/f'{n}.webp').convert('RGB'); im.thumbnail((320,240)); S.paste(im,(x,30)); lab(x,12,n); x+=340
x=20
for n in pl:
    im=Image.open(A/f'{n}.webp').convert('RGB'); im.thumbnail((320,140)); S.paste(im,(x,320)); lab(x,302,n); x+=340
# icons at 128, 32, 24 on dark and on steel
st=Image.open(A/'ui-steel.webp').convert('RGB').resize((W,300))
S.paste(st,(0,520)); lab(20,500,'icons at 128 / 32 / 24 px on ui-steel')
x=20
for n in ic:
    im=Image.open(A/f'{n}.webp').convert('RGBA')
    S.paste(im,(x,540),im)
    for k,(sz,yy) in enumerate([(32,690),(24,740)]):
        t=im.copy(); t.thumbnail((sz,sz),Image.LANCZOS); S.paste(t,(x,yy),t)
    lab(x,780,n[5:]); x+=136
S.save(pathlib.Path.home()/'degenWars/shots/ui-art.png')
