'use client';

/* eslint-disable @next/next/no-img-element -- static design illustrations, no optimization needed */

interface SuggestionCard {
  title: string;
  description: string;
  image: string;
  prompt: string;
}

const SUGGESTION_CARDS: SuggestionCard[] = [
  {
    title: 'Get an Insight',
    description: 'Trends total and comparison of your data',
    image: '/images/chat-with-data/card-insight.png',
    prompt: 'Show me the main trends in my data',
  },
  {
    title: 'What can Dalgo do?',
    description: 'Explore platform and its capabilities',
    image: '/images/chat-with-data/card-explore.png',
    prompt: 'What can Copilot help me with?',
  },
  {
    title: 'Check your data',
    description: 'Is everything synced and upto date',
    image: '/images/chat-with-data/card-check.png',
    prompt: 'Is my data synced and up to date?',
  },
  {
    title: 'Build insight',
    description: 'Turn your data into charts and KPI',
    image: '/images/chat-with-data/card-build.png',
    prompt: 'Help me build a chart from my data',
  },
];

/**
 * The "What would you like to know?" hero of a fresh chat. The composer is
 * rendered by the parent (between headline and cards) so its state stays in
 * one place.
 */
export function ChatEmptyState({
  composer,
  onSuggestion,
}: {
  composer: React.ReactNode;
  onSuggestion: (prompt: string) => void;
}) {
  return (
    <div
      className="flex h-full flex-col items-center justify-center gap-4 overflow-y-auto px-6 py-10"
      data-testid="chat-empty-state"
    >
      <h1 className="bg-gradient-to-r from-[#00897B] via-[#5DD0EA] via-45% to-[#376DA8] bg-clip-text text-center text-[28px] font-bold text-transparent md:text-[34px]">
        What would you like to know?
      </h1>
      <p className="max-w-[560px] text-center text-base text-[#7A7A8C]">
        Ask any questions and get answers from your connected data and visualize your insights
      </p>

      <div className="mt-4 flex w-full flex-col items-center gap-3">
        {composer}
        <p className="text-center text-xs text-[#7A7A8C]">
          Copilot can make mistakes. Check important results before you act on them.
        </p>
      </div>

      <div className="mt-6 grid w-full max-w-[720px] grid-cols-1 gap-3 md:grid-cols-2">
        {SUGGESTION_CARDS.map((card) => (
          <button
            key={card.title}
            type="button"
            onClick={() => onSuggestion(card.prompt)}
            data-testid={`chat-suggestion-${card.title.toLowerCase().replace(/[^a-z]+/g, '-')}`}
            className="flex h-[88px] items-center overflow-hidden rounded-xl border border-[#E8ECEF] bg-white text-left transition-shadow hover:shadow-md"
          >
            <img
              src={card.image}
              alt=""
              className="h-full w-[148px] shrink-0 object-cover"
              draggable={false}
            />
            <span className="flex min-w-0 flex-col gap-1 px-3">
              <span className="text-sm font-semibold text-[#5C5C6D]">{card.title}</span>
              <span className="text-[12.5px] leading-snug text-[#7A7A8C]">{card.description}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
