import Image from 'next/image';
import { cn } from '@/lib/utils';

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
        width={120}
        height={40}
        className={cn('object-contain max-h-8 w-auto', imageClassName)}
      />
    </div>
  );
}
