import { ImageResponse } from 'next/og';

export const alt = 'KinesisFlow documentary and Kids & Family video creator';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '72px 80px',
        color: '#191a17',
        background: 'linear-gradient(135deg, #f3f1ec 0%, #fbfaf7 58%, #f3e2da 100%)',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, fontSize: 30, fontWeight: 800 }}>
        <div style={{ width: 54, height: 54, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#191a17', color: '#fbfaf7', borderRadius: 10 }}>K</div>
        KinesisFlow
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 930 }}>
        <div style={{ color: '#b84b2c', fontSize: 22, fontWeight: 800, letterSpacing: 3, textTransform: 'uppercase' }}>AI-assisted video production</div>
        <div style={{ marginTop: 22, fontSize: 70, lineHeight: 1.04, fontWeight: 750, letterSpacing: -3 }}>Documentary-style and Kids &amp; Family videos, built scene by scene.</div>
        <div style={{ marginTop: 28, color: '#60635d', fontSize: 28 }}>Script · visuals · narration · subtitles · timeline · MP4</div>
      </div>
    </div>,
    size,
  );
}
