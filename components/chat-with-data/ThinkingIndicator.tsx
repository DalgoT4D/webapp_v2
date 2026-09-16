/**
 * The animated Copilot sparkle shown whenever the agent is thinking
 * (Figma node 3877:23119 "thinking" + motion tracks). The logo rotates 180°
 * every 2s while the gradient layer of each arm fades in on its own phase —
 * keyframes live in globals.css (copilot-think-*).
 */

const ARM_PATHS = {
  // arm pointing up-right (Figma "top 1"/"bottom 1", 7.18×8.69 at 5.04,1.61)
  arm1: 'M5.47772 5.69103C5.65119 5.43005 5.81192 5.15949 5.95834 4.88257C6.73814 3.42642 7.18056 1.76407 7.18056 0H5.04167C5.04167 0.955656 4.89526 2.01563 4.58333 2.86458C3.78046 5.05847 2.19369 6.64512 0 7.44792C1.05751 7.71289 1.56844 8.14403 2.48266 8.68593C3.67466 7.90374 4.69468 6.88282 5.4769 5.69169L5.47772 5.69103Z',
  // right arm ("top 2"/"bot 2", 8.69×7.06 at 11.48,5.04)
  arm2: 'M5.936 4.58333C3.74211 3.78046 1.69713 2.19369 0.894336 0C0.629358 1.05751 0.541893 1.45312 0 2.36734C0.782181 3.55934 1.8031 4.57936 2.99424 5.36158C3.25523 5.53505 3.52579 5.69578 3.8027 5.8422C5.25886 6.622 6.9212 7.06442 8.68527 7.06442L8.686 5.04167C7.73035 5.04167 6.78496 4.89526 5.936 4.58333Z',
  // bottom arm ("top3"/"bot 3", 7.18×8.69 at 9.78,11.36)
  arm3: 'M1.70284 2.99489C1.52937 3.25588 1.36864 3.52644 1.22222 3.80335C0.442424 5.25951 0 6.92185 0 8.68593H2.13884C2.13884 7.73027 2.28525 6.4426 2.59718 5.59364C3.40005 3.39975 4.98683 1.81311 7.18051 1.01031C6.123 0.745332 5.61212 0.541893 4.6979 0C3.5059 0.782182 2.48506 1.80375 1.70284 2.99489Z',
  // left arm ("top 4"/"bot 4", 8.69×7.30 at 1.83,9.66)
  arm4: 'M8.68593 4.6979C8.14403 5.61218 8.05648 6.23995 7.7915 7.29665C6.98862 5.10276 4.94352 3.24724 2.74983 2.44444C1.9 2.13253 0.95478 2.25498 0 2.25498V0C1.76411 0 3.4263 0.442425 4.88257 1.22222C5.15949 1.36864 5.43082 1.53016 5.69103 1.70284C6.88303 2.48502 7.90305 3.50595 8.68527 4.69708L8.68593 4.6979Z',
} as const;

const PALE = '#E8F4F3';

const GRADIENT_STOPS = (
  <>
    <stop stopColor="#00897B" />
    <stop offset="0.5" stopColor="#5DD0EA" />
    <stop offset="0.75" stopColor="#00A08E" />
    <stop offset="1" stopColor="#376DA8" />
  </>
);

function ThinkingLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 22 22"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`copilot-think-spin ${className ?? ''}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id="think-arm1"
          x1="1.22668"
          y1="0"
          x2="6.09664"
          y2="0.015767"
          gradientUnits="userSpaceOnUse"
        >
          {GRADIENT_STOPS}
        </linearGradient>
        <linearGradient
          id="think-arm2"
          x1="1.48386"
          y1="0"
          x2="7.37476"
          y2="0.0283665"
          gradientUnits="userSpaceOnUse"
        >
          {GRADIENT_STOPS}
        </linearGradient>
        <linearGradient
          id="think-arm3"
          x1="1.22667"
          y1="0"
          x2="6.0966"
          y2="0.0157668"
          gradientUnits="userSpaceOnUse"
        >
          {GRADIENT_STOPS}
        </linearGradient>
        <linearGradient
          id="think-arm4"
          x1="1.48385"
          y1="0"
          x2="7.3747"
          y2="0.0274633"
          gradientUnits="userSpaceOnUse"
        >
          {GRADIENT_STOPS}
        </linearGradient>
      </defs>
      <g transform="translate(5.04 1.61)">
        <path d={ARM_PATHS.arm1} fill={PALE} />
        <path d={ARM_PATHS.arm1} fill="url(#think-arm1)" className="copilot-think-fade-1" />
      </g>
      <g transform="translate(11.48 5.04)">
        <path d={ARM_PATHS.arm2} fill={PALE} />
        <path d={ARM_PATHS.arm2} fill="url(#think-arm2)" className="copilot-think-fade-2" />
      </g>
      <g transform="translate(9.78 11.36)">
        <path d={ARM_PATHS.arm3} fill={PALE} />
        <path d={ARM_PATHS.arm3} fill="url(#think-arm3)" className="copilot-think-fade-3" />
      </g>
      <g transform="translate(1.83 9.66)">
        <path d={ARM_PATHS.arm4} fill={PALE} />
        <path d={ARM_PATHS.arm4} fill="url(#think-arm4)" />
      </g>
    </svg>
  );
}

export function ThinkingIndicator({
  label = 'Thinking…',
  'data-testid': testId,
}: {
  label?: string;
  'data-testid'?: string;
}) {
  return (
    <div className="flex items-center gap-3" data-testid={testId}>
      <ThinkingLogo className="size-[22px] shrink-0" />
      <span className="text-sm text-[#7A7A8C]">{label}</span>
    </div>
  );
}
