'use client';

export function DbtNotConfigured({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center min-h-[20vh]" data-testid="dbt-not-configured">
      <div className="bg-white rounded-lg p-8 text-center">
        <p className="text-xl md:text-2xl lg:text-3xl font-normal text-foreground">{message}</p>
      </div>
    </div>
  );
}
