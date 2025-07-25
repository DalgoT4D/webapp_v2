import { embeddedAppUrl } from '@/constants/constants';

export default function Transform() {
  return (
    <div className="w-full h-screen overflow-hidden">
      <iframe
        className="w-full h-full border-0 block"
        src={`${embeddedAppUrl}/pipeline/transform?hide=true`}
        title="Data Transformation"
        allowFullScreen
        width="100%"
        height="100%"
        style={{
          width: '100vw',
          height: '100vh',
          minWidth: '100%',
          maxWidth: '100%',
          display: 'block',
          transform: 'scale(1)',
          transformOrigin: 'top left',
        }}
      />
    </div>
  );
}
