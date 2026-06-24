import Image from 'next/image';
import { cn } from '@/lib/utils';

// Intrinsic pixel dimensions of the powered-by-dalgo.png asset
const POWERED_BY_DALGO_WIDTH = 120;
const POWERED_BY_DALGO_HEIGHT = 40;

interface PoweredByDalgoImageProps {
  className?: string;
  imageClassName?: string;
}

export function PoweredByDalgoImage({ className, imageClassName }: PoweredByDalgoImageProps) {
  return (
    <div className={cn('flex flex-col items-end flex-shrink-0', className)}>
      <Image
        src="/powered-by-dalgo.png"
        alt="Powered by Dalgo"
        width={POWERED_BY_DALGO_WIDTH}
        height={POWERED_BY_DALGO_HEIGHT}
        className={cn('object-contain max-h-8 w-auto', imageClassName)}
      />
    </div>
  );
}
